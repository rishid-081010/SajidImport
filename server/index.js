import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';
import { startBatchProcessing } from './batchProcessor.js';
import { generateDubaiPortalCopy } from './copyGenerator.js';
import { processLeadsPreview, getLeadStats, generateCleanCSV, pushLeadsToWebhook, parseExcelBuffer } from './leadCleaner.js';
import { processPhotoWithQA, refinePhotoWithDirective, applyDarkroomTransformations } from './qaEnhancer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Upload directories
const uploadsDir = path.join(__dirname, 'uploads');
const originalDir = path.join(uploadsDir, 'original');
const generatedDir = path.join(uploadsDir, 'generated');
const dataDir = path.join(uploadsDir, 'data');

if (!fs.existsSync(originalDir)) fs.mkdirSync(originalDir, { recursive: true });
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

// Serve React Client production build
const clientDistDir = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
}

// Helpers for listing metadata
export function getListingMetaPath(listingId) {
  return path.join(dataDir, `${listingId}.json`);
}

export function readListingMeta(listingId) {
  try {
    const file = getListingMetaPath(listingId);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    console.error(`Error reading metadata for ${listingId}:`, e.message);
  }
  return { imagesOrder: [], roomTypes: {}, copyData: null, propertySpecs: {} };
}

export function writeListingMeta(listingId, data) {
  try {
    const file = getListingMetaPath(listingId);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error writing metadata for ${listingId}:`, e.message);
  }
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, originalDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WEBP are supported.'));
    }
  },
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// GET all listings
app.get('/api/listings', async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('real_estate_listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, listings });
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single listing details with images and metadata
app.get('/api/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: listing, error: listingErr } = await supabase
      .from('real_estate_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ success: false, error: 'Listing not found.' });
    }

    const { data: rawImages, error: imagesErr } = await supabase
      .from('real_estate_images')
      .select('*')
      .eq('listing_id', id)
      .order('created_at', { ascending: true });

    if (imagesErr) throw imagesErr;

    const meta = readListingMeta(id);

    // Merge metadata
    const images = (rawImages || []).map((img, idx) => ({
      ...img,
      room_type: meta.roomTypes?.[img.id] || img.room_type || 'Property_Photo',
      display_order: meta.imagesOrder?.indexOf(img.id) !== -1 ? meta.imagesOrder.indexOf(img.id) : idx,
      qa_report: meta.qaReports?.[img.id] || null,
      baseline_image_location: meta.baselineImages?.[img.id] || img.generated_image_location,
      custom_refined_location: meta.refinedImages?.[img.id] || (meta.refinements?.[img.id]?.length ? img.generated_image_location : null),
      refinements: meta.refinements?.[img.id] || [],
    }));

    // Sort by display order
    images.sort((a, b) => a.display_order - b.display_order);

    res.json({ 
      success: true, 
      listing: {
        ...listing,
        copy_data: meta.copyData || null,
        property_specs: meta.propertySpecs || null,
      }, 
      images 
    });
  } catch (err) {
    console.error('Error fetching listing details:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// CREATE a new listing with uploaded images
app.post('/api/listings', upload.array('images', 50), async (req, res) => {
  try {
    const { 
      name, 
      reference, 
      property_type, 
      prompt,
      purpose,
      price,
      bedrooms,
      bathrooms,
      size_sqft,
      furnishing,
      rough_notes,
      copy_tone
    } = req.body;
    const files = req.files;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Listing name is required.' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one image must be uploaded.' });
    }

    // 1. Insert listing row into Supabase
    const { data: listing, error: listingErr } = await supabase
      .from('real_estate_listings')
      .insert([
        {
          name,
          reference: reference || '',
          property_type: property_type || 'Apartment',
          prompt: prompt || '',
          status: 'draft',
          total_images: files.length,
          completed_images: 0,
          failed_images: 0,
        },
      ])
      .select()
      .single();

    if (listingErr) throw listingErr;

    // 2. Prepare image metadata rows
    const imageRows = files.map((file) => {
      const fileRelPath = `/uploads/original/${file.filename}`;
      return {
        listing_id: listing.id,
        original_filename: file.originalname,
        original_image_location: fileRelPath,
        generated_image_location: null,
        status: 'queued',
        error_message: null,
      };
    });

    const { data: insertedImages, error: imagesErr } = await supabase
      .from('real_estate_images')
      .insert(imageRows)
      .select();

    if (imagesErr) throw imagesErr;

    // 3. Save initial metadata
    const meta = {
      imagesOrder: insertedImages.map(img => img.id),
      roomTypes: {},
      propertySpecs: {
        purpose: purpose || 'For Sale',
        price: price || '',
        bedrooms: bedrooms || '',
        bathrooms: bathrooms || '',
        size_sqft: size_sqft || '',
        furnishing: furnishing || 'Unfurnished',
        rough_notes: rough_notes || '',
        copy_tone: copy_tone || 'luxury',
      },
      copyData: null,
    };

    // Generate portal copy asynchronously in background
    generateDubaiPortalCopy({
      name,
      reference,
      property_type: property_type || 'Apartment',
      purpose: purpose || 'For Sale',
      price,
      bedrooms,
      bathrooms,
      size_sqft,
      furnishing,
      rough_notes,
    }, copy_tone || 'luxury')
      .then(generatedCopy => {
        meta.copyData = generatedCopy;
        writeListingMeta(listing.id, meta);
      })
      .catch(err => {
        console.warn('Background copy generation note:', err.message);
      });

    writeListingMeta(listing.id, meta);

    // Trigger non-destructive batch processing
    startBatchProcessing(listing.id);

    res.status(201).json({
      success: true,
      message: 'Listing created successfully. Processing started.',
      listing,
      images: insertedImages,
    });
  } catch (err) {
    console.error('Error creating listing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// START or RESTART processing for a listing
app.post('/api/listings/:id/process', async (req, res) => {
  try {
    const { id } = req.params;
    const { prompt } = req.body;

    if (prompt) {
      await supabase
        .from('real_estate_listings')
        .update({ prompt })
        .eq('id', id);
    }

    // Mark images as queued for re-processing
    await supabase
      .from('real_estate_images')
      .update({ status: 'queued', error_message: null })
      .eq('listing_id', id);

    startBatchProcessing(id, prompt);
    res.json({ success: true, message: 'Batch processing initiated.' });
  } catch (err) {
    console.error('Error starting processing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// RETRY a single failed image
app.post('/api/images/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: image, error } = await supabase
      .from('real_estate_images')
      .select('*, real_estate_listings(*)')
      .eq('id', id)
      .single();

    if (error || !image) {
      return res.status(404).json({ success: false, error: 'Image not found.' });
    }

    await supabase
      .from('real_estate_images')
      .update({ status: 'queued', error_message: null })
      .eq('id', id);

    startBatchProcessing(image.listing_id);

    res.json({ success: true, message: 'Image requeued for processing.' });
  } catch (err) {
    console.error('Error retrying image:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ADD MORE IMAGES to existing listing
app.post('/api/listings/:id/images', upload.array('images', 50), async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No image files provided.' });
    }

    const { data: listing, error: listingErr } = await supabase
      .from('real_estate_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ success: false, error: 'Listing not found.' });
    }

    // Insert new image records
    const imageRows = files.map((file) => {
      const fileRelPath = `/uploads/original/${file.filename}`;
      return {
        listing_id: id,
        original_filename: file.originalname,
        original_image_location: fileRelPath,
        generated_image_location: null,
        status: 'queued',
        error_message: null,
      };
    });

    const { data: insertedImages, error: imagesErr } = await supabase
      .from('real_estate_images')
      .insert(imageRows)
      .select();

    if (imagesErr) throw imagesErr;

    // Update listing total_images count and status
    const newTotal = (listing.total_images || 0) + files.length;
    await supabase
      .from('real_estate_listings')
      .update({
        total_images: newTotal,
        status: 'processing',
      })
      .eq('id', id);

    // Update metadata order
    const meta = readListingMeta(id);
    meta.imagesOrder = meta.imagesOrder || [];
    insertedImages.forEach((img) => meta.imagesOrder.push(img.id));
    writeListingMeta(id, meta);

    // Start background processing for newly queued images
    startBatchProcessing(id);

    res.json({
      success: true,
      message: `${files.length} new photo(s) added and queued for enhancement.`,
      images: insertedImages,
    });
  } catch (err) {
    console.error('Error adding images to listing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE single image from listing
app.delete('/api/images/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: img, error: imgErr } = await supabase
      .from('real_estate_images')
      .select('*')
      .eq('id', id)
      .single();

    if (imgErr || !img) {
      return res.status(404).json({ success: false, error: 'Image not found.' });
    }

    const listingId = img.listing_id;

    // Delete image from Supabase
    await supabase
      .from('real_estate_images')
      .delete()
      .eq('id', id);

    // Delete local files if exist
    if (img.original_image_location) {
      const origAbs = path.join(__dirname, img.original_image_location.replace(/^\//, ''));
      if (fs.existsSync(origAbs)) {
        try { fs.unlinkSync(origAbs); } catch (_) {}
      }
    }
    if (img.generated_image_location) {
      const genAbs = path.join(__dirname, img.generated_image_location.replace(/^\//, ''));
      if (fs.existsSync(genAbs)) {
        try { fs.unlinkSync(genAbs); } catch (_) {}
      }
    }

    // Update listing metadata
    const meta = readListingMeta(listingId);
    if (meta.imagesOrder) {
      meta.imagesOrder = meta.imagesOrder.filter((imgId) => imgId !== id);
    }
    if (meta.roomTypes?.[id]) delete meta.roomTypes[id];
    if (meta.qaReports?.[id]) delete meta.qaReports[id];
    writeListingMeta(listingId, meta);

    // Update listing counts in Supabase
    const { data: remainingImages } = await supabase
      .from('real_estate_images')
      .select('status')
      .eq('listing_id', listingId);

    const total = remainingImages ? remainingImages.length : 0;
    const completed = remainingImages ? remainingImages.filter(i => i.status === 'completed').length : 0;
    const failed = remainingImages ? remainingImages.filter(i => i.status === 'failed').length : 0;
    const newStatus = total === 0 ? 'draft' : completed + failed >= total ? 'completed' : 'processing';

    await supabase
      .from('real_estate_listings')
      .update({
        total_images: total,
        completed_images: completed,
        failed_images: failed,
        status: newStatus,
      })
      .eq('id', listingId);

    res.json({ success: true, message: 'Photo deleted successfully.' });
  } catch (err) {
    console.error('Error deleting image:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// REFINE INDIVIDUAL IMAGE with admin custom directive (ChatGPT-style darkroom refinement)
app.post('/api/images/:id/refine', async (req, res) => {
  try {
    const { id } = req.params;
    const { directive } = req.body;

    if (!directive || !directive.trim()) {
      return res.status(400).json({ success: false, error: 'Directive instruction is required.' });
    }

    const { data: img, error: imgErr } = await supabase
      .from('real_estate_images')
      .select('*, real_estate_listings(*)')
      .eq('id', id)
      .single();

    if (imgErr || !img) {
      return res.status(404).json({ success: false, error: 'Image not found.' });
    }

    const origAbsPath = path.join(__dirname, img.original_image_location.replace(/^\//, ''));
    if (!fs.existsSync(origAbsPath)) {
      return res.status(400).json({ success: false, error: 'Original source photo not found on server.' });
    }

    const meta = readListingMeta(img.listing_id);
    const currentQAReport = meta.qaReports?.[id] || null;

    // Ensure baseline Auto-Enhanced version is permanently preserved
    meta.baselineImages = meta.baselineImages || {};
    if (!meta.baselineImages[id]) {
      meta.baselineImages[id] = img.generated_image_location;
    }

    // Save refinement to a new output path
    const outFilename = `refined-${id}-${Date.now()}.jpg`;
    const outRelPath = `/uploads/generated/${outFilename}`;
    const outAbsPath = path.join(generatedDir, outFilename);

    // Run refinement engine
    const { qaResult } = await refinePhotoWithDirective(
      origAbsPath,
      currentQAReport,
      directive.trim(),
      outAbsPath
    );

    // Update metadata
    meta.qaReports = meta.qaReports || {};
    meta.qaReports[id] = qaResult;
    meta.refinedImages = meta.refinedImages || {};
    meta.refinedImages[id] = outRelPath;
    meta.refinements = meta.refinements || {};
    meta.refinements[id] = meta.refinements[id] || [];
    meta.refinements[id].push({
      directive: directive.trim(),
      timestamp: new Date().toISOString(),
      summary: qaResult.edit_summary,
      adjustments: qaResult.adjustments,
    });
    writeListingMeta(img.listing_id, meta);

    // Update image row in Supabase
    await supabase
      .from('real_estate_images')
      .update({
        generated_image_location: outRelPath,
        status: 'completed',
        error_message: null,
      })
      .eq('id', id);

    res.json({
      success: true,
      message: 'Refinement applied successfully.',
      image: {
        ...img,
        generated_image_location: outRelPath,
        baseline_image_location: meta.baselineImages[id],
        custom_refined_location: outRelPath,
        status: 'completed',
        qa_report: qaResult,
        refinements: meta.refinements[id],
      },
    });
  } catch (err) {
    console.error('Error refining image:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// MANUAL SLIDER REFINEMENT
app.post('/api/images/:id/manual-refine', async (req, res) => {
  try {
    const { id } = req.params;
    const { brightness, saturation, gamma, clahe_max_slope, sharpness, hue } = req.body;

    const { data: img, error: imgErr } = await supabase
      .from('real_estate_images')
      .select('*, real_estate_listings(*)')
      .eq('id', id)
      .single();

    if (imgErr || !img) {
      return res.status(404).json({ success: false, error: 'Image not found.' });
    }

    const origAbsPath = path.join(__dirname, img.original_image_location.replace(/^\//, ''));
    if (!fs.existsSync(origAbsPath)) {
      return res.status(400).json({ success: false, error: 'Original source photo not found on server.' });
    }

    const meta = readListingMeta(img.listing_id);

    // Ensure baseline is preserved
    meta.baselineImages = meta.baselineImages || {};
    if (!meta.baselineImages[id]) {
      meta.baselineImages[id] = img.generated_image_location;
    }

    const outFilename = `refined-${id}-${Date.now()}.jpg`;
    const outRelPath = `/uploads/generated/${outFilename}`;
    const outAbsPath = path.join(generatedDir, outFilename);

    const adjustments = {
      brightness: Number(brightness) || 1.0,
      saturation: Number(saturation) || 1.0,
      gamma: Number(gamma) || 1.0,
      clahe_max_slope: Math.round(Number(clahe_max_slope) || 3),
      sharpness: Number(sharpness) || 1.0,
      hue: Number(hue) || 0,
      warmth_neutralize: false,
    };

    const { appliedAdjustments } = await applyDarkroomTransformations(origAbsPath, adjustments, outAbsPath);

    meta.refinedImages = meta.refinedImages || {};
    meta.refinedImages[id] = outRelPath;
    meta.qaReports = meta.qaReports || {};
    meta.qaReports[id] = {
      ...(meta.qaReports[id] || {}),
      usable: true,
      action: 'edited',
      edit_applied: true,
      edit_summary: 'Manual darkroom slider adjustments applied.',
      adjustments: appliedAdjustments,
    };
    meta.refinements = meta.refinements || {};
    meta.refinements[id] = meta.refinements[id] || [];
    meta.refinements[id].push({
      directive: 'Manual darkroom slider tweaks',
      timestamp: new Date().toISOString(),
      summary: `Exposure: ${(appliedAdjustments.brightness * 100).toFixed(0)}%, Shadow: ${(appliedAdjustments.gamma * 100).toFixed(0)}%, Sharpness: ${appliedAdjustments.sharpness.toFixed(1)}x`,
      adjustments: appliedAdjustments,
    });
    writeListingMeta(img.listing_id, meta);

    await supabase
      .from('real_estate_images')
      .update({
        generated_image_location: outRelPath,
        status: 'completed',
        error_message: null,
      })
      .eq('id', id);

    res.json({
      success: true,
      message: 'Manual adjustments applied.',
      image: {
        ...img,
        generated_image_location: outRelPath,
        baseline_image_location: meta.baselineImages[id],
        custom_refined_location: outRelPath,
        status: 'completed',
        qa_report: meta.qaReports[id],
        refinements: meta.refinements[id],
      },
    });
  } catch (err) {
    console.error('Error in manual refine:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// RESET IMAGE REFINEMENT to default AI enhancement
app.post('/api/images/:id/reset-refine', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: img, error: imgErr } = await supabase
      .from('real_estate_images')
      .select('*, real_estate_listings(*)')
      .eq('id', id)
      .single();

    if (imgErr || !img) {
      return res.status(404).json({ success: false, error: 'Image not found.' });
    }

    const origAbsPath = path.join(__dirname, img.original_image_location.replace(/^\//, ''));
    const outFilename = `enhanced-${id}.jpg`;
    const outRelPath = `/uploads/generated/${outFilename}`;
    const outAbsPath = path.join(generatedDir, outFilename);

    const { qaResult } = await processPhotoWithQA(
      origAbsPath,
      1,
      1,
      img.real_estate_listings?.name || 'Dubai Luxury Property',
      outAbsPath
    );

    const meta = readListingMeta(img.listing_id);
    meta.qaReports = meta.qaReports || {};
    meta.qaReports[id] = qaResult;
    meta.baselineImages = meta.baselineImages || {};
    meta.baselineImages[id] = outRelPath;
    if (meta.refinedImages?.[id]) delete meta.refinedImages[id];
    meta.refinements = meta.refinements || {};
    meta.refinements[id] = [];
    writeListingMeta(img.listing_id, meta);

    await supabase
      .from('real_estate_images')
      .update({
        generated_image_location: outRelPath,
        status: 'completed',
        error_message: null,
      })
      .eq('id', id);

    res.json({
      success: true,
      message: 'Image reset to default AI enhancement.',
      image: {
        ...img,
        generated_image_location: outRelPath,
        baseline_image_location: outRelPath,
        custom_refined_location: null,
        status: 'completed',
        qa_report: qaResult,
        refinements: [],
      },
    });
  } catch (err) {
    console.error('Error resetting image refinement:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE ROOM TYPE for an image
app.put('/api/images/:id/room-type', async (req, res) => {
  try {
    const { id } = req.params;
    const { room_type } = req.body;

    const { data: img } = await supabase
      .from('real_estate_images')
      .select('listing_id')
      .eq('id', id)
      .single();

    if (img) {
      const meta = readListingMeta(img.listing_id);
      meta.roomTypes = meta.roomTypes || {};
      meta.roomTypes[id] = room_type;
      writeListingMeta(img.listing_id, meta);
    }

    res.json({ success: true, room_type });
  } catch (err) {
    console.error('Error updating room type:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// REORDER IMAGES
app.put('/api/listings/:id/reorder', async (req, res) => {
  try {
    const { id } = req.params;
    const { imageIds } = req.body;

    if (Array.isArray(imageIds)) {
      const meta = readListingMeta(id);
      meta.imagesOrder = imageIds;
      writeListingMeta(id, meta);
    }

    res.json({ success: true, message: 'Image order updated.' });
  } catch (err) {
    console.error('Error reordering images:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// REGENERATE PORTAL COPY
app.post('/api/listings/:id/generate-copy', async (req, res) => {
  try {
    const { id } = req.params;
    const { tone } = req.body;

    const { data: listing, error } = await supabase
      .from('real_estate_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !listing) {
      return res.status(404).json({ success: false, error: 'Listing not found.' });
    }

    const meta = readListingMeta(id);
    const specs = meta.propertySpecs || {};

    const copy = await generateDubaiPortalCopy({
      name: listing.name,
      reference: listing.reference,
      property_type: listing.property_type,
      ...specs,
    }, tone || specs.copy_tone || 'luxury');

    meta.copyData = copy;
    if (tone) meta.propertySpecs.copy_tone = tone;
    writeListingMeta(id, meta);

    res.json({ success: true, copy });
  } catch (err) {
    console.error('Error generating copy:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DOWNLOAD ALL results as 1-Click Master ZIP (Original Aspect Ratio & Full Resolution)
app.get('/api/listings/:id/download-zip', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: listing, error: listingErr } = await supabase
      .from('real_estate_listings')
      .select('*')
      .eq('id', id)
      .single();

    if (listingErr || !listing) {
      return res.status(404).json({ success: false, error: 'Listing not found.' });
    }

    const { data: images, error: imagesErr } = await supabase
      .from('real_estate_images')
      .select('*')
      .eq('listing_id', id)
      .eq('status', 'completed');

    if (imagesErr || !images || images.length === 0) {
      return res.status(400).json({ success: false, error: 'No completed images available for download.' });
    }

    const meta = readListingMeta(id);

    // Sort images by priority order
    if (meta.imagesOrder && meta.imagesOrder.length > 0) {
      images.sort((a, b) => {
        const idxA = meta.imagesOrder.indexOf(a.id);
        const idxB = meta.imagesOrder.indexOf(b.id);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
    }

    const safeName = (listing.name || 'Listing').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipFilename = `${safeName}_Enhanced_Master_Photos.zip`;

    res.attachment(zipFilename);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    for (let idx = 0; idx < images.length; idx++) {
      const img = images[idx];
      if (!img.generated_image_location) continue;

      const genRelPath = img.generated_image_location;
      const genAbsPath = path.join(__dirname, genRelPath.replace(/^\//, ''));

      if (!fs.existsSync(genAbsPath)) continue;

      // Auto-formatted room name (e.g. 01_Living_Room.jpg)
      const orderPrefix = String(idx + 1).padStart(2, '0');
      const roomType = meta.roomTypes?.[img.id] || img.room_type || 'Property_Photo';
      const cleanRoom = roomType.replace(/[^a-zA-Z0-9_]/g, '_');
      const ext = path.extname(genAbsPath) || '.jpg';
      const filename = `${orderPrefix}_${cleanRoom}${ext}`;

      // Append original aspect ratio master enhanced photo
      archive.file(genAbsPath, { name: filename });
    }

    await archive.finalize();
  } catch (err) {
    console.error('Zip download error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE listing
app.delete('/api/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('real_estate_listings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Clean up meta file
    const metaFile = getListingMetaPath(id);
    if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile);

    res.json({ success: true, message: 'Listing deleted successfully.' });
  } catch (err) {
    console.error('Error deleting listing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// LEAD INGESTION & CLEANING STUDIO API
// ==========================================

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// 1. Live CRM Health & Stats
app.get('/api/leads/health-stats', async (req, res) => {
  try {
    const stats = await getLeadStats();
    res.json(stats);
  } catch (err) {
    console.error('Error in leads health-stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Upload & Clean Preview
app.post('/api/leads/upload-preview', uploadCsv.single('file'), async (req, res) => {
  try {
    let csvText = '';
    let filename = 'file.csv';

    if (req.file) {
      filename = req.file.originalname;
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.xlsx' || ext === '.xls') {
        csvText = parseExcelBuffer(req.file.buffer);
      } else {
        csvText = req.file.buffer.toString('utf8');
      }
    } else if (req.body.csv_text) {
      csvText = req.body.csv_text;
      filename = req.body.filename || 'pasted_leads.csv';
    } else {
      return res.status(400).json({ error: 'No file or CSV text provided.' });
    }

    const defaultPropType = req.body.default_property_type || 'Apartment';
    const result = await processLeadsPreview(csvText, defaultPropType, filename);
    res.json(result);
  } catch (err) {
    console.error('Error in leads upload-preview:', err);
    res.status(500).json({ error: err.message || 'Failed to parse and clean leads.' });
  }
});

// 3. Sample Messy File loader
app.get('/api/leads/sample-csv', (req, res) => {
  try {
    const samplePath = path.join(uploadsDir, 'sample_unstructured_leads.csv');
    if (fs.existsSync(samplePath)) {
      const content = fs.readFileSync(samplePath, 'utf8');
      res.type('text/csv').send(content);
    } else {
      res.status(404).json({ error: 'Sample file not found on server.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Export Cleaned CSV
app.post('/api/leads/export-cleaned-csv', (req, res) => {
  try {
    const { leads, filename } = req.body;
    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'Invalid leads array.' });
    }

    const cleanCsv = generateCleanCSV(leads);
    const outFilename = filename || 'as_properties_cleaned_leads.csv';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${outFilename}"`);
    res.send(cleanCsv);
  } catch (err) {
    console.error('Error in leads export-cleaned-csv:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Push Leads to CRM / Webhook
app.post('/api/leads/push-leads', async (req, res) => {
  try {
    const { leads, live_sync } = req.body;
    const result = await pushLeadsToWebhook(leads, live_sync === true);
    res.json(result);
  } catch (err) {
    console.error('Error pushing leads:', err);
    res.status(500).json({ error: err.message });
  }
});

// Single page app fallback
if (fs.existsSync(clientDistDir)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Real Estate Enhancer Server running on http://localhost:${PORT}`);
});

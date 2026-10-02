import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';
import { processPhotoWithQA } from './qaEnhancer.js';
import { readListingMeta, writeListingMeta } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Active jobs lock map to prevent duplicate concurrent runs
const activeJobs = new Set();

export async function startBatchProcessing(listingId, customPrompt = '') {
  if (activeJobs.has(listingId)) {
    console.log(`Job ${listingId} is already processing.`);
    return;
  }

  activeJobs.add(listingId);

  try {
    // 1. Fetch listing details
    const { data: listing, error: listingErr } = await supabase
      .from('real_estate_listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) {
      console.error(`Listing ${listingId} not found.`);
      activeJobs.delete(listingId);
      return;
    }

    // Update listing status to processing
    await supabase
      .from('real_estate_listings')
      .update({ status: 'processing' })
      .eq('id', listingId);

    // 2. Fetch images for this listing
    const { data: images, error: imagesErr } = await supabase
      .from('real_estate_images')
      .select('*')
      .eq('listing_id', listingId)
      .in('status', ['queued', 'failed', 'processing']);

    if (imagesErr || !images || images.length === 0) {
      console.log(`No images to process for listing ${listingId}`);
      await updateListingFinalStatus(listingId);
      activeJobs.delete(listingId);
      return;
    }

    const uploadsDir = path.join(__dirname, 'uploads');
    const generatedDir = path.join(uploadsDir, 'generated');
    if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

    // 3. Process each photo through the Strict Real Estate QA & Photographic Engine
    const BATCH_SIZE = 2;
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const chunk = images.slice(i, i + BATCH_SIZE);

      await Promise.all(
        chunk.map(async (img, chunkIdx) => {
          try {
            await supabase
              .from('real_estate_images')
              .update({ status: 'processing', error_message: null })
              .eq('id', img.id);

            const originalFilename = path.basename(img.original_image_location);
            const originalAbsPath = path.join(uploadsDir, 'original', originalFilename);

            const ext = path.extname(originalFilename) || '.jpg';
            const generatedFilename = `enhanced-${img.id}${ext}`;
            const generatedAbsPath = path.join(generatedDir, generatedFilename);
            const generatedRelPath = `/uploads/generated/${generatedFilename}`;

            if (!fs.existsSync(originalAbsPath)) {
              throw new Error(`Original file not found on disk: ${originalFilename}`);
            }

            const position = i + chunkIdx + 1;
            const context = `${listing.name} (${listing.property_type || 'Apartment'})`;

            // Run QA & conservative photographic enhancement
            const { qaResult } = await processPhotoWithQA(
              originalAbsPath,
              position,
              images.length,
              context,
              generatedAbsPath
            );

            // Save QA results and room type into local listing metadata
            const meta = readListingMeta(listingId);
            meta.roomTypes = meta.roomTypes || {};
            meta.qaReports = meta.qaReports || {};
            meta.baselineImages = meta.baselineImages || {};
            meta.baselineQAReports = meta.baselineQAReports || {};

            const roomType = qaResult.room_category || 'Property_Photo';
            meta.roomTypes[img.id] = roomType;
            meta.qaReports[img.id] = qaResult;
            meta.baselineImages[img.id] = generatedRelPath;
            meta.baselineQAReports[img.id] = qaResult;
            writeListingMeta(listingId, meta);

            // Update image record on success
            await supabase
              .from('real_estate_images')
              .update({
                status: 'completed',
                generated_image_location: generatedRelPath,
                error_message: null,
              })
              .eq('id', img.id);

            await incrementListingCounter(listingId, 'completed_images');
          } catch (err) {
            console.error(`Failed to process image ${img.id}:`, err.message);

            await supabase
              .from('real_estate_images')
              .update({
                status: 'failed',
                error_message: err.message || 'Processing failed.',
              })
              .eq('id', img.id);

            await incrementListingCounter(listingId, 'failed_images');
          }
        })
      );
    }

    // 4. Update final listing status
    await updateListingFinalStatus(listingId);
  } catch (globalErr) {
    console.error(`Error in batch processing for listing ${listingId}:`, globalErr);
  } finally {
    activeJobs.delete(listingId);
  }
}

async function incrementListingCounter(listingId, column) {
  try {
    const { data: current } = await supabase
      .from('real_estate_listings')
      .select(column)
      .eq('id', listingId)
      .single();

    if (current) {
      const newValue = (current[column] || 0) + 1;
      await supabase
        .from('real_estate_listings')
        .update({ [column]: newValue })
        .eq('id', listingId);
    }
  } catch (err) {
    console.error(`Failed to update ${column} for listing ${listingId}:`, err);
  }
}

async function updateListingFinalStatus(listingId) {
  try {
    const { data: images } = await supabase
      .from('real_estate_images')
      .select('status')
      .eq('listing_id', listingId);

    if (!images) return;

    const total = images.length;
    const completed = images.filter((i) => i.status === 'completed').length;
    const failed = images.filter((i) => i.status === 'failed').length;
    const processing = images.filter((i) => i.status === 'processing' || i.status === 'queued').length;

    let finalStatus = 'processing';
    if (processing === 0) {
      if (completed > 0) {
        finalStatus = 'completed';
      } else if (failed > 0) {
        finalStatus = 'failed';
      } else {
        finalStatus = 'completed';
      }
    }

    await supabase
      .from('real_estate_listings')
      .update({
        status: finalStatus,
        completed_images: completed,
        failed_images: failed,
      })
      .eq('id', listingId);
  } catch (err) {
    console.error(`Error updating final listing status for ${listingId}:`, err);
  }
}

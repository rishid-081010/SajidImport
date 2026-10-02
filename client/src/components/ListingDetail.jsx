import React, { useEffect, useState, useRef } from 'react';
import { 
  ArrowLeft, Download, RefreshCw, CheckCircle2, AlertTriangle, 
  Clock, Sparkles, Building2, FolderArchive, RotateCcw, X, 
  Copy, Check, FileText, Share2, Tag, ChevronUp, ChevronDown, Sliders, ChevronLeft, ChevronRight, Wand2,
  Instagram, Mail, Globe, Upload, Plus, Trash2, Image as ImageIcon, MessageSquare, Send, History
} from 'lucide-react';
import axios from 'axios';
import BeforeAfterSlider from './BeforeAfterSlider';
import Toast from './Toast';

const ROOM_CATEGORIES = [
  'Living_Room',
  'Master_Bedroom',
  'Bedroom',
  'Modern_Kitchen',
  'Balcony_Skyline_View',
  'Luxury_Bathroom',
  'Dining_Area',
  'Infinity_Pool',
  'Building_Exterior',
  'Foyer_Entrance',
  'Walk_in_Closet',
  'Terrace_Lounge',
  'Property_Photo'
];

const QUICK_DIRECTIVES = [
  { label: '☀️ Lift Dark Shadows', text: 'Lift deep shadows and dark corners on the floor while preserving black depth' },
  { label: '🪟 Pull Window Glare', text: 'Compress harsh window glare to reveal the exterior skyline and balcony view' },
  { label: '❄️ Neutralize Yellow Tint', text: 'Strip warm tungsten ceiling bulb cast to clean 3500K warm-white architectural lighting' },
  { label: '✨ Ultra Texture Crispness', text: 'Enhance micro-contrast on marble veining, joinery, and structural details' },
  { label: '🌅 Subtle Warm Glow', text: 'Add a subtle golden-hour ambient luxury warmth across the room' },
  { label: '🌊 Rich Balcony Pool/Sky', text: 'Enrich natural sky blue and pool water clarity without altering architecture' },
];

export default function ListingDetail({ listingId, onBack }) {
  const [listing, setListing] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [sliderModalImage, setSliderModalImage] = useState(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [isRetrying, setIsRetrying] = useState({});
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [isReProcessingAll, setIsReProcessingAll] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copyTab, setCopyTab] = useState('portal');
  const [copiedField, setCopiedField] = useState(null);

  // Staged additional photos state
  const [additionalFiles, setAdditionalFiles] = useState([]);
  const [additionalPreviews, setAdditionalPreviews] = useState([]);
  const [isUploadingMore, setIsUploadingMore] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState({});
  const fileInputRef = useRef(null);

  // Per-Image AI Refinement Studio state (ChatGPT-style & 3-Way Comparison)
  const [refineModalImage, setRefineModalImage] = useState(null);
  const [adminDirective, setAdminDirective] = useState('');
  const [isRefiningImage, setIsRefiningImage] = useState(false);
  const [isResettingRefine, setIsResettingRefine] = useState(false);
  const [refineMode, setRefineMode] = useState('orig-vs-refined'); // 'orig-vs-refined' | 'baseline-vs-refined' | 'orig-vs-baseline'
  const [sliderMode, setSliderMode] = useState('orig-vs-refined'); // For fullscreen compare modal
  const [refineStudioTab, setRefineStudioTab] = useState('chat'); // 'chat' | 'sliders'
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const [sliderValues, setSliderValues] = useState({
    brightness: 1.0,
    gamma: 1.05,
    clahe_max_slope: 3,
    hue: 0,
    saturation: 1.05,
    sharpness: 1.0,
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
  };

  const withTimestamp = (url) => {
    if (!url) return '';
    return `${url}${url.includes('?') ? '&' : '?'}t=${cacheBuster}`;
  };

  const getComparisonUrls = (img, mode = 'orig-vs-refined') => {
    if (!img) return { leftUrl: '', rightUrl: '', leftLabel: '', rightLabel: '' };
    const orig = withTimestamp(img.original_image_location);
    const baseline = withTimestamp(img.baseline_image_location || img.generated_image_location);
    const refined = withTimestamp(img.custom_refined_location || img.generated_image_location);

    if (mode === 'baseline-vs-refined') {
      return {
        leftUrl: baseline,
        rightUrl: refined,
        leftLabel: '🤖 AUTO-ENHANCED',
        rightLabel: '✨ CUSTOM REFINED',
      };
    }
    if (mode === 'orig-vs-baseline') {
      return {
        leftUrl: orig,
        rightUrl: baseline,
        leftLabel: '📸 ORIGINAL RAW',
        rightLabel: '🤖 AUTO-ENHANCED',
      };
    }
    // Default: orig-vs-refined
    return {
      leftUrl: orig,
      rightUrl: refined,
      leftLabel: '📸 ORIGINAL RAW',
      rightLabel: img.custom_refined_location ? '✨ CUSTOM REFINED' : '✨ AUTO-ENHANCED',
    };
  };

  const fetchListingDetails = async () => {
    try {
      const response = await axios.get(`/api/listings/${listingId}`);
      if (response.data.success) {
        setListing(response.data.listing);
        setImages(response.data.images || []);
        if (response.data.listing?.prompt && !customPrompt) {
          setCustomPrompt(response.data.listing.prompt);
        }
      }
    } catch (err) {
      console.error('Fetch listing details error:', err);
      setError('Failed to fetch listing details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListingDetails();

    const interval = setInterval(() => {
      // Smart poll only while actively queued or processing
      const hasActiveImages = images.some((img) => img.status === 'processing' || img.status === 'queued');
      if (listing?.status === 'processing' || hasActiveImages || images.length === 0) {
        fetchListingDetails();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [listingId, listing?.status, images.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!sliderModalImage) return;
      if (e.key === 'Escape') setSliderModalImage(null);
      if (e.key === 'ArrowRight') handleNextSlider();
      if (e.key === 'ArrowLeft') handlePrevSlider();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sliderModalImage, sliderIndex, images]);

  // Global Clipboard Paste Support (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        handleAdditionalFilesAdded(pastedFiles);
        showToast(`${pastedFiles.length} photo(s) pasted from clipboard!`, 'info');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleAdditionalFilesAdded = (filesArray) => {
    const validFiles = [];
    const validPreviews = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    Array.from(filesArray).forEach((file) => {
      if (allowedTypes.includes(file.type)) {
        validFiles.push(file);
        validPreviews.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          url: URL.createObjectURL(file),
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        });
      }
    });

    if (validFiles.length < filesArray.length) {
      showToast('Some files were skipped. Only JPG, PNG, and WEBP are supported.', 'error');
    }

    setAdditionalFiles((prev) => [...prev, ...validFiles]);
    setAdditionalPreviews((prev) => [...prev, ...validPreviews]);
  };

  const handleRemoveAdditionalPreview = (index) => {
    URL.revokeObjectURL(additionalPreviews[index].url);
    setAdditionalPreviews((prev) => prev.filter((_, i) => i !== index));
    setAdditionalFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadMoreImages = async () => {
    if (additionalFiles.length === 0) return;
    setIsUploadingMore(true);

    const formData = new FormData();
    additionalFiles.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const response = await axios.post(`/api/listings/${listingId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        showToast(`${additionalFiles.length} new photo(s) added! Enhancement in progress.`, 'success');
        additionalPreviews.forEach((p) => URL.revokeObjectURL(p.url));
        setAdditionalFiles([]);
        setAdditionalPreviews([]);
        fetchListingDetails();
      } else {
        showToast(response.data.error || 'Failed to upload photos.', 'error');
      }
    } catch (err) {
      console.error('Upload more images error:', err);
      showToast('Failed to upload additional photos.', 'error');
    } finally {
      setIsUploadingMore(false);
    }
  };

  const handleDeleteImage = async (imageId, originalName) => {
    if (!window.confirm(`Are you sure you want to remove "${originalName || 'this photo'}" from this listing?`)) return;

    setIsDeletingImage((prev) => ({ ...prev, [imageId]: true }));
    try {
      const response = await axios.delete(`/api/images/${imageId}`);
      if (response.data.success) {
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        showToast('Photo removed from listing.', 'success');
        fetchListingDetails();
      } else {
        showToast(response.data.error || 'Failed to delete photo.', 'error');
      }
    } catch (err) {
      console.error('Delete image error:', err);
      showToast('Failed to delete photo.', 'error');
    } finally {
      setIsDeletingImage((prev) => ({ ...prev, [imageId]: false }));
    }
  };

  const openRefineModal = (img) => {
    setRefineModalImage(img);
    setAdminDirective('');
    setRefineMode('orig-vs-refined');
    setRefineStudioTab('chat');
    
    // Seed slider values if previous adjustments exist
    const prevAdj = img.qa_report?.adjustments;
    if (prevAdj) {
      setSliderValues({
        brightness: prevAdj.brightness ?? 1.0,
        gamma: prevAdj.gamma ?? 1.05,
        clahe_max_slope: prevAdj.clahe_max_slope ?? 3,
        hue: prevAdj.hue ?? 0,
        saturation: prevAdj.saturation ?? 1.05,
        sharpness: prevAdj.sharpness ?? 1.0,
      });
    } else {
      setSliderValues({
        brightness: 1.0,
        gamma: 1.05,
        clahe_max_slope: 3,
        hue: 0,
        saturation: 1.05,
        sharpness: 1.0,
      });
    }
  };

  const handleApplyDirective = async (directiveText) => {
    const textToApply = directiveText || adminDirective;
    if (!textToApply || !textToApply.trim() || !refineModalImage) return;

    setIsRefiningImage(true);
    try {
      const response = await axios.post(`/api/images/${refineModalImage.id}/refine`, {
        directive: textToApply.trim(),
      });

      if (response.data.success) {
        showToast('AI Refinement applied to photo!', 'success');
        setCacheBuster(Date.now());
        const updatedImg = {
          ...refineModalImage,
          generated_image_location: response.data.image.generated_image_location,
          baseline_image_location: response.data.image.baseline_image_location || refineModalImage.baseline_image_location,
          custom_refined_location: response.data.image.custom_refined_location || response.data.image.generated_image_location,
          qa_report: response.data.image.qa_report,
          refinements: response.data.image.refinements || [],
        };
        setRefineModalImage(updatedImg);
        setImages((prev) => prev.map((img) => (img.id === updatedImg.id ? updatedImg : img)));
        setAdminDirective('');
        fetchListingDetails();
      } else {
        showToast(response.data.error || 'Failed to refine image.', 'error');
      }
    } catch (err) {
      console.error('Refine image error:', err);
      showToast('Failed to apply refinement.', 'error');
    } finally {
      setIsRefiningImage(false);
    }
  };

  const handleManualRefine = async () => {
    if (!refineModalImage) return;

    setIsRefiningImage(true);
    try {
      const response = await axios.post(`/api/images/${refineModalImage.id}/manual-refine`, sliderValues);

      if (response.data.success) {
        showToast('Manual darkroom adjustments applied!', 'success');
        setCacheBuster(Date.now());
        const updatedImg = {
          ...refineModalImage,
          generated_image_location: response.data.image.generated_image_location,
          baseline_image_location: response.data.image.baseline_image_location || refineModalImage.baseline_image_location,
          custom_refined_location: response.data.image.custom_refined_location || response.data.image.generated_image_location,
          qa_report: response.data.image.qa_report,
          refinements: response.data.image.refinements || [],
        };
        setRefineModalImage(updatedImg);
        setImages((prev) => prev.map((img) => (img.id === updatedImg.id ? updatedImg : img)));
        fetchListingDetails();
      } else {
        showToast(response.data.error || 'Failed to apply manual adjustments.', 'error');
      }
    } catch (err) {
      console.error('Manual refine error:', err);
      showToast('Failed to apply manual adjustments.', 'error');
    } finally {
      setIsRefiningImage(false);
    }
  };

  const handleResetRefinement = async (imageId) => {
    if (!window.confirm('Reset this photo back to the default AI enhancement?')) return;

    setIsResettingRefine(true);
    try {
      const response = await axios.post(`/api/images/${imageId}/reset-refine`);
      if (response.data.success) {
        showToast('Photo reset to default AI enhancement.', 'success');
        setCacheBuster(Date.now());
        const updatedImg = {
          ...refineModalImage,
          generated_image_location: response.data.image.generated_image_location,
          baseline_image_location: response.data.image.baseline_image_location,
          custom_refined_location: null,
          qa_report: response.data.image.qa_report,
          refinements: [],
        };
        if (refineModalImage && refineModalImage.id === imageId) {
          setRefineModalImage(updatedImg);
        }
        setSliderValues({
          brightness: 1.0,
          gamma: 1.05,
          clahe_max_slope: 3,
          hue: 0,
          saturation: 1.05,
          sharpness: 1.0,
        });
        setImages((prev) => prev.map((img) => (img.id === imageId ? updatedImg : img)));
        fetchListingDetails();
      } else {
        showToast(response.data.error || 'Failed to reset refinement.', 'error');
      }
    } catch (err) {
      console.error('Reset refinement error:', err);
      showToast('Failed to reset refinement.', 'error');
    } finally {
      setIsResettingRefine(false);
    }
  };

  const completedImages = images.filter((img) => img.status === 'completed');

  const openSliderForImage = (img) => {
    const idx = completedImages.findIndex((i) => i.id === img.id);
    setSliderIndex(idx !== -1 ? idx : 0);
    setSliderModalImage(img);
  };

  const handleNextSlider = () => {
    if (completedImages.length === 0) return;
    const nextIdx = (sliderIndex + 1) % completedImages.length;
    setSliderIndex(nextIdx);
    setSliderModalImage(completedImages[nextIdx]);
  };

  const handlePrevSlider = () => {
    if (completedImages.length === 0) return;
    const prevIdx = (sliderIndex - 1 + completedImages.length) % completedImages.length;
    setSliderIndex(prevIdx);
    setSliderModalImage(completedImages[prevIdx]);
  };

  const handleRetryImage = async (imageId) => {
    setIsRetrying((prev) => ({ ...prev, [imageId]: true }));
    try {
      const response = await axios.post(`/api/images/${imageId}/retry`);
      if (response.data.success) {
        showToast('Retrying photo enhancement...', 'info');
        fetchListingDetails();
      }
    } catch (err) {
      console.error('Retry image error:', err);
      showToast('Failed to retry image.', 'error');
    } finally {
      setIsRetrying((prev) => ({ ...prev, [imageId]: false }));
    }
  };

  const handleReProcessAll = async () => {
    setIsReProcessingAll(true);
    try {
      await axios.post(`/api/listings/${listingId}/process`, { prompt: customPrompt });
      showToast('Re-processing all photos with updated prompt...', 'info');
      fetchListingDetails();
    } catch (err) {
      console.error('Re-process error:', err);
      showToast('Failed to trigger re-enhancement.', 'error');
    } finally {
      setIsReProcessingAll(false);
    }
  };

  const handleUpdateRoomType = async (imageId, newRoomType) => {
    try {
      await axios.put(`/api/images/${imageId}/room-type`, { room_type: newRoomType });
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, room_type: newRoomType } : img))
      );
      showToast(`Category updated to ${newRoomType.replace(/_/g, ' ')}.`, 'success');
    } catch (err) {
      console.error('Update room type error:', err);
      showToast('Failed to update category.', 'error');
    }
  };

  const handleMoveImage = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const newImages = [...images];
    const temp = newImages[index];
    newImages[index] = newImages[targetIndex];
    newImages[targetIndex] = temp;

    setImages(newImages);

    try {
      await axios.put(`/api/listings/${listingId}/reorder`, {
        imageIds: newImages.map((img) => img.id),
      });
      showToast('Photo sequence reordered.', 'success');
    } catch (err) {
      console.error('Reorder images error:', err);
      showToast('Failed to save reorder.', 'error');
    }
  };

  const handleGenerateCopy = async (tone = 'luxury') => {
    setIsGeneratingCopy(true);
    try {
      const response = await axios.post(`/api/listings/${listingId}/generate-copy`, { tone });
      if (response.data.success) {
        setListing((prev) => ({
          ...prev,
          copy_data: response.data.copy,
        }));
        showToast('Marketing copy generated successfully!', 'success');
      }
    } catch (err) {
      console.error('Generate copy error:', err);
      showToast('Failed to generate listing copy.', 'error');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const handleCopyText = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast(`Copied ${fieldName} to clipboard!`, 'success');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleDownloadSingle = (imageUrl, filename) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllZip = () => {
    window.location.href = `/api/listings/${listingId}/download-zip`;
  };

  const completedCount = images.filter((img) => img.status === 'completed').length;
  const failedCount = images.filter((img) => img.status === 'failed').length;
  const processingCount = images.filter((img) => img.status === 'processing').length;
  const queuedCount = images.filter((img) => img.status === 'queued').length;
  const totalCount = images.length;
  const progressPercentage = totalCount > 0 ? Math.round(((completedCount + failedCount) / totalCount) * 100) : 0;
  const copyData = listing?.copy_data;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 text-center">
        <RefreshCw className="w-8 h-8 text-khaki-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-sans">Loading property listing details...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 text-center">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-red-400 max-w-md mx-auto mb-4">
          {error || 'Listing not found'}
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-bone-100 hover:text-white bg-navy-800 border border-navy-700 px-4 py-2 rounded-xl text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-khaki-400 hover:text-khaki-300 mb-3 transition-colors tracking-wide"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-serif font-bold text-white tracking-tight">{listing.name}</h1>
            {listing.reference && (
              <span className="text-xs font-mono bg-white/[0.05] text-khaki-400 px-2.5 py-1 rounded-md border border-white/[0.1] backdrop-blur-sm">
                #{listing.reference}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1 font-sans">
            Property Type: <span className="text-khaki-400 font-semibold">{listing.property_type}</span>
          </p>
        </div>

        {/* 1-Click Master ZIP Export (Original Aspect Ratio & Quality) */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadAllZip}
            disabled={completedCount === 0}
            className={`px-6 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2.5 shadow-xl transition-all ${
              completedCount === 0
                ? 'bg-navy-800 text-slate-500 border border-white/[0.08] cursor-not-allowed'
                : 'bg-gradient-to-r from-khaki-500 via-khaki-400 to-khaki-600 hover:from-khaki-400 hover:to-khaki-500 text-navy-950 shadow-khaki-500/20 hover:scale-[1.02]'
            }`}
          >
            <FolderArchive className="w-5 h-5" />
            DOWNLOAD ALL ZIP ({completedCount})
          </button>
        </div>
      </div>

      {/* Editable AI Prompt & Instructions Bar */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-khaki-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-khaki-400">
              Enhancement Prompt & Directives (Editable)
            </span>
          </div>
          <button
            onClick={handleReProcessAll}
            disabled={isReProcessingAll}
            className="px-3 py-1.5 rounded-xl glass-pill hover:bg-white/[0.1] text-xs font-semibold text-khaki-300 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReProcessingAll ? 'animate-spin' : ''}`} />
            {isReProcessingAll ? 'Re-Processing...' : 'Re-Enhance All with Prompt'}
          </button>
        </div>
        <textarea
          rows={2}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="Custom AI enhancement instructions..."
          className="w-full glass-input rounded-xl p-3 text-bone-100 text-xs font-mono placeholder-slate-500 focus:outline-none transition-all leading-relaxed"
        ></textarea>
      </div>

      {/* AI Processing Progress Card */}
      <div className="glass-card p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-khaki-400" />
            <h2 className="text-lg font-serif font-bold text-white">Photographic Processing Status</h2>
          </div>
          <span className="text-sm font-bold text-khaki-400 font-sans">
            {completedCount} / {totalCount} images completed ({progressPercentage}%){images.some(i => i.status === 'processing') && ' • Auto-naming in progress...'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-black/40 rounded-full h-2.5 mb-6 overflow-hidden border border-white/[0.08]">
          <div
            className="bg-gradient-to-r from-khaki-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>

        {/* Status Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="glass-pill rounded-xl p-3.5 text-center">
            <span className="text-2xl font-bold text-emerald-400 block">{completedCount}</span>
            <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Completed
            </span>
          </div>

          <div className="glass-pill rounded-xl p-3.5 text-center">
            <span className="text-2xl font-bold text-khaki-400 block">{processingCount}</span>
            <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1 mt-0.5">
              <RefreshCw className="w-3.5 h-3.5 text-khaki-400 animate-spin" /> Processing
            </span>
          </div>

          <div className="glass-pill rounded-xl p-3.5 text-center">
            <span className="text-2xl font-bold text-bone-200 block">{queuedCount}</span>
            <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Queued
            </span>
          </div>

          <div className="glass-pill rounded-xl p-3.5 text-center">
            <span className="text-2xl font-bold text-red-400 block">{failedCount}</span>
            <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Failed
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Channel Dubai Marketing Copywriter Suite */}
      <div className="glass-card p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-khaki-400" />
            <div>
              <h2 className="text-lg font-serif font-bold text-white">Multi-Channel Marketing Copywriter Suite</h2>
              <p className="text-xs text-slate-400 font-sans">1-Click generation for Portals, WhatsApp Broadcasts, Instagram, Investor Emails & Translations.</p>
            </div>
          </div>

          {/* Tone Selector & Regenerate Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleGenerateCopy('luxury')}
              disabled={isGeneratingCopy}
              className="px-3 py-1.5 rounded-xl glass-pill hover:bg-white/[0.1] text-xs font-semibold text-khaki-300 flex items-center gap-1.5 transition-all"
              title="Luxury Editorial Tone"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isGeneratingCopy ? 'Generating...' : 'Luxury Tone'}
            </button>
            <button
              onClick={() => handleGenerateCopy('investor_roi')}
              disabled={isGeneratingCopy}
              className="px-3 py-1.5 rounded-xl glass-pill hover:bg-white/[0.1] text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition-all"
              title="Investor Yield & ROI Tone"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Investor ROI
            </button>
            <button
              onClick={() => handleGenerateCopy('fast_deal')}
              disabled={isGeneratingCopy}
              className="px-3 py-1.5 rounded-xl glass-pill hover:bg-white/[0.1] text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-all"
              title="Fast Deal / Hot Opportunity Tone"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Fast Deal
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2 mb-5 border-b border-white/[0.06] pb-3">
          <button
            onClick={() => setCopyTab('portal')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              copyTab === 'portal'
                ? 'bg-khaki-500 text-navy-950 shadow-md shadow-khaki-500/20'
                : 'glass-pill text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Bayut & Property Finder
          </button>

          <button
            onClick={() => setCopyTab('whatsapp')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              copyTab === 'whatsapp'
                ? 'bg-emerald-500 text-navy-950 shadow-md shadow-emerald-500/20'
                : 'glass-pill text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" /> WhatsApp Broadcast
          </button>

          <button
            onClick={() => setCopyTab('instagram')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              copyTab === 'instagram'
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md shadow-pink-500/20'
                : 'glass-pill text-slate-400 hover:text-white'
            }`}
          >
            <Instagram className="w-3.5 h-3.5" /> Instagram & Social
          </button>

          <button
            onClick={() => setCopyTab('investor')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              copyTab === 'investor'
                ? 'bg-amber-500 text-navy-950 shadow-md shadow-amber-500/20'
                : 'glass-pill text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> VIP Investor Email
          </button>

          <button
            onClick={() => setCopyTab('translations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              copyTab === 'translations'
                ? 'bg-sky-500 text-navy-950 shadow-md shadow-sky-500/20'
                : 'glass-pill text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Arabic & Russian
          </button>
        </div>

        {copyData ? (
          <div>
            {copyTab === 'portal' && (
              <div className="space-y-4">
                {/* Portal Headline */}
                <div className="glass-pill rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-khaki-400">
                      SEO Portal Title (Under 80 Chars • Bayut & Property Finder)
                    </span>
                    <button
                      onClick={() => handleCopyText(copyData.portal_title, 'Portal Title')}
                      className="text-xs text-khaki-400 hover:text-khaki-300 flex items-center gap-1 font-semibold"
                    >
                      {copiedField === 'Portal Title' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Title!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Title
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-white">{copyData.portal_title}</p>
                </div>

                {/* Portal Description */}
                <div className="glass-pill rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-khaki-400">
                      5-Part Editorial Description & Specifications
                    </span>
                    <button
                      onClick={() => handleCopyText(copyData.portal_description, 'Full Description')}
                      className="text-xs text-khaki-400 hover:text-khaki-300 flex items-center gap-1 font-semibold"
                    >
                      {copiedField === 'Full Description' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Full Description!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Full Description
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-xs text-bone-100 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 p-3 rounded-lg border border-white/[0.05]">
                    {copyData.portal_description}
                  </pre>
                </div>
              </div>
            )}

            {copyTab === 'whatsapp' && (
              <div className="glass-pill rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                    High-Converting WhatsApp Broker Broadcast
                  </span>
                  <button
                    onClick={() => handleCopyText(copyData.whatsapp_copy, 'WhatsApp Text')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                  >
                    {copiedField === 'WhatsApp Text' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied WhatsApp Text!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy WhatsApp Broadcast
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs text-bone-100 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 p-3.5 rounded-lg border border-white/[0.05]">
                  {copyData.whatsapp_copy}
                </pre>
              </div>
            )}

            {copyTab === 'instagram' && (
              <div className="glass-pill rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-pink-400">
                    Instagram & Social Media Caption
                  </span>
                  <button
                    onClick={() => handleCopyText(copyData.instagram_copy, 'Instagram Caption')}
                    className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 font-semibold"
                  >
                    {copiedField === 'Instagram Caption' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Instagram Caption!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Instagram Caption
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs text-bone-100 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 p-3.5 rounded-lg border border-white/[0.05]">
                  {copyData.instagram_copy}
                </pre>
              </div>
            )}

            {copyTab === 'investor' && (
              <div className="glass-pill rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    VIP Investor Direct-Response Pitch
                  </span>
                  <button
                    onClick={() => handleCopyText(copyData.investor_email, 'Investor Email')}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                  >
                    {copiedField === 'Investor Email' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Investor Pitch!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Investor Email
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs text-bone-100 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 p-3.5 rounded-lg border border-white/[0.05]">
                  {copyData.investor_email}
                </pre>
              </div>
            )}

            {copyTab === 'translations' && (
              <div className="space-y-4">
                {/* Arabic */}
                <div className="glass-pill rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                      Arabic Luxury Summary (GCC & Regional Investors)
                    </span>
                    <button
                      onClick={() => handleCopyText(copyData.arabic_summary, 'Arabic Summary')}
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                    >
                      {copiedField === 'Arabic Summary' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Arabic!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Arabic
                        </>
                      )}
                    </button>
                  </div>
                  <pre dir="rtl" className="text-xs text-bone-100 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 p-3.5 rounded-lg border border-white/[0.05] text-right">
                    {copyData.arabic_summary}
                  </pre>
                </div>

                {/* Russian */}
                <div className="glass-pill rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                      Russian Luxury Summary (CIS Investors)
                    </span>
                    <button
                      onClick={() => handleCopyText(copyData.russian_summary, 'Russian Summary')}
                      className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                    >
                      {copiedField === 'Russian Summary' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied Russian!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Russian
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-xs text-bone-100 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 p-3.5 rounded-lg border border-white/[0.05]">
                    {copyData.russian_summary}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 glass-pill rounded-xl border-dashed">
            <p className="text-xs text-slate-400 mb-2 font-sans">Multi-channel copy is generating or can be created anytime.</p>
            <button
              onClick={() => handleGenerateCopy('luxury')}
              disabled={isGeneratingCopy}
              className="px-4 py-2 bg-khaki-500 hover:bg-khaki-400 text-navy-950 font-bold text-xs rounded-2xl inline-flex items-center gap-2 shadow-md shadow-khaki-500/20"
            >
              <Sparkles className="w-4 h-4" />
              {isGeneratingCopy ? 'Generating...' : 'Generate Multi-Channel Marketing Copy Now'}
            </button>
          </div>
        )}
      </div>

      {/* Add More Photos to Listing Dropzone */}
      <div className="glass-card p-5 mb-8 border border-white/[0.1] hover:border-khaki-500/40 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-khaki-400" />
            <div>
              <h3 className="text-base font-serif font-bold text-white">Add More Photos to This Listing</h3>
              <p className="text-xs text-slate-400 font-sans">
                Drag and drop, browse, or paste (<kbd className="px-1.5 py-0.5 bg-navy-950 border border-navy-700 rounded text-[10px] font-mono text-khaki-400">Ctrl + V</kbd>) additional photos anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  handleAdditionalFilesAdded(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl glass-pill hover:bg-white/[0.1] text-xs font-semibold text-khaki-300 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Browse Photos
            </button>
          </div>
        </div>

        {/* Drop Target Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.length) {
              handleAdditionalFilesAdded(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-khaki-400 bg-khaki-500/10 scale-[0.99]'
              : 'border-white/[0.12] bg-black/20 hover:border-khaki-500/50 hover:bg-white/[0.02]'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center mx-auto mb-2 text-khaki-400">
            <ImageIcon className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-white mb-0.5">
            Drop new property photos here, or click to choose files
          </p>
          <p className="text-[11px] text-slate-400">
            JPG, PNG, WEBP • Seamlessly auto-enhanced in background
          </p>
        </div>

        {/* Staged New Photos Previews & Action */}
        {additionalPreviews.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.08]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-khaki-400 uppercase tracking-wider">
                Staged New Photos ({additionalPreviews.length})
              </span>
              <button
                onClick={handleUploadMoreImages}
                disabled={isUploadingMore}
                className="px-5 py-2 bg-gradient-to-r from-khaki-500 via-khaki-400 to-khaki-600 hover:from-khaki-400 hover:to-khaki-500 text-navy-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-khaki-500/20 transition-all"
              >
                <Sparkles className={`w-4 h-4 ${isUploadingMore ? 'animate-spin' : ''}`} />
                {isUploadingMore ? 'Uploading & Queuing...' : `Upload & Auto-Enhance (${additionalPreviews.length}) New Photo(s)`}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {additionalPreviews.map((prev, idx) => (
                <div key={prev.id} className="relative group rounded-xl overflow-hidden border border-white/[0.1] bg-black/40">
                  <img src={prev.url} alt={prev.name} className="w-full h-24 object-cover" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAdditionalPreview(idx);
                    }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow hover:bg-red-500 transition-colors"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="p-1.5 bg-black/80 text-[10px] text-slate-300 truncate font-mono">
                    {prev.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Results Gallery */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif font-bold text-white flex items-center gap-2">
            Image Results Gallery ({images.length} Photos)
          </h2>
          <span className="text-xs text-slate-400 font-sans">
            Priority order determines portal cover photo (#01 = Main Cover)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className="glass-card flex flex-col justify-between hover:border-white/[0.2] transition-all"
            >
              {/* Card Header: Order, Room Tag & Delete */}
              <div className="p-3 bg-black/40 border-b border-white/[0.06] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    idx === 0 ? 'bg-khaki-500 text-navy-950 shadow-sm' : 'glass-pill text-slate-300'
                  }`}>
                    {idx === 0 ? '★ #01 COVER' : `#0${idx + 1}`}
                  </span>

                  {/* Move Up/Down Order Buttons */}
                  <button
                    onClick={() => handleMoveImage(idx, -1)}
                    disabled={idx === 0}
                    className="w-6 h-6 rounded-lg glass-pill hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 flex items-center justify-center"
                    title="Move earlier"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveImage(idx, 1)}
                    disabled={idx === images.length - 1}
                    className="w-6 h-6 rounded-lg glass-pill hover:bg-white/[0.1] text-slate-300 disabled:opacity-30 flex items-center justify-center"
                    title="Move later"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Room Classification Tag Dropdown */}
                  <div className="relative flex items-center">
                    <Tag className="w-3 h-3 text-khaki-400 absolute left-2 pointer-events-none" />
                    <select
                      value={img.room_type || 'Property_Photo'}
                      onChange={(e) => handleUpdateRoomType(img.id, e.target.value)}
                      className="glass-input text-khaki-300 text-[11px] font-semibold rounded-lg pl-6 pr-2 py-1 focus:outline-none cursor-pointer max-w-[140px]"
                    >
                      {ROOM_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Delete Single Photo Button */}
                  <button
                    onClick={() => handleDeleteImage(img.id, img.original_filename)}
                    disabled={isDeletingImage[img.id]}
                    className="w-7 h-7 rounded-lg glass-pill hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors"
                    title="Delete photo from listing"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${isDeletingImage[img.id] ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Image Comparison Thumbnail */}
              <div className="p-4 bg-black/30 border-b border-white/[0.06]">
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {/* Original Thumbnail */}
                  <div className="relative group">
                    <img
                      src={withTimestamp(img.original_image_location)}
                      alt="Original"
                      className="w-full h-36 object-cover rounded-xl border border-white/[0.08]"
                    />
                    <span className="absolute bottom-1.5 left-1.5 bg-black/80 text-[10px] text-slate-300 font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                      Original
                    </span>
                  </div>

                  {/* Enhanced Generated Thumbnail */}
                  <div className="relative group">
                    {img.status === 'completed' && img.generated_image_location ? (
                      <>
                        <img
                          src={withTimestamp(img.generated_image_location)}
                          alt="Enhanced"
                          className="w-full h-36 object-cover rounded-xl border border-khaki-500/50 shadow-md shadow-khaki-500/10 cursor-pointer"
                          onClick={() => openSliderForImage(img)}
                        />
                        <span className={`absolute bottom-1.5 left-1.5 font-bold text-[10px] px-2 py-0.5 rounded shadow ${
                          img.custom_refined_location ? 'bg-amber-400 text-navy-950' : 'bg-khaki-500 text-navy-950'
                        }`}>
                          {img.custom_refined_location ? '✨ Refined' : '🤖 Enhanced'}
                        </span>
                      </>
                    ) : img.status === 'processing' ? (
                      <div className="w-full h-36 rounded-xl border border-khaki-500/30 bg-khaki-500/5 flex flex-col items-center justify-center p-3 text-center">
                        <RefreshCw className="w-6 h-6 text-khaki-400 animate-spin mb-2" />
                        <span className="text-xs text-khaki-300 font-medium">Enhancing Clarity...</span>
                      </div>
                    ) : img.status === 'failed' ? (
                      <div className="w-full h-36 rounded-xl border border-red-500/30 bg-red-500/5 flex flex-col items-center justify-center p-3 text-center">
                        <AlertTriangle className="w-6 h-6 text-red-400 mb-1" />
                        <span className="text-xs text-red-400 font-medium">Failed</span>
                      </div>
                    ) : (
                      <div className="w-full h-36 rounded-xl border border-white/[0.08] bg-black/40 flex flex-col items-center justify-center text-center">
                        <Clock className="w-6 h-6 text-slate-500 mb-1" />
                        <span className="text-xs text-slate-400 font-medium">Queued</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-semibold text-slate-300 truncate max-w-[180px]">
                    {img.original_filename}
                  </span>

                  {/* Status Badge */}
                  {img.status === 'completed' && (
                    <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {img.custom_refined_location ? 'Custom Refined' : 'Enhanced'}
                    </span>
                  )}
                  {img.status === 'processing' && (
                    <span className="text-[10px] font-bold uppercase text-khaki-400 bg-khaki-500/10 px-2 py-0.5 rounded-full border border-khaki-500/20 flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Enhancing
                    </span>
                  )}
                  {img.status === 'failed' && (
                    <span className="text-[10px] font-bold uppercase text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Failed
                    </span>
                  )}
                  {img.status === 'queued' && (
                    <span className="text-[10px] font-bold uppercase text-slate-400 glass-pill px-2 py-0.5 rounded-full">
                      Queued
                    </span>
                  )}
                </div>

                {/* QA Verification Report Tag */}
                {img.qa_report && (
                  <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex flex-col gap-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-khaki-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-khaki-400" /> QA Verified
                      </span>
                      <span className="text-slate-400 font-mono">
                        {img.qa_report.action === 'use_as_is' ? 'Ready As-Is' : 'Conservative Edit'}
                      </span>
                    </div>
                    {img.qa_report.edit_summary && (
                      <p className="text-slate-400 text-[10px] line-clamp-1 italic">
                        {img.qa_report.edit_summary}
                      </p>
                    )}
                  </div>
                )}

                {img.error_message && (
                  <p className="text-[11px] text-red-400 mt-2 line-clamp-2 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                    {img.error_message}
                  </p>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="p-3 bg-black/40 border-t border-white/[0.06] flex items-center justify-between gap-2">
                {img.status === 'completed' && img.generated_image_location ? (
                  <>
                    <button
                      onClick={() => openRefineModal(img)}
                      className="py-2 px-3 bg-khaki-500/15 hover:bg-khaki-500/25 text-khaki-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-khaki-500/30 shadow-sm"
                      title="Direct AI or adjust sliders on this photo"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-khaki-400" /> AI Refine
                    </button>

                    <button
                      onClick={() => openSliderForImage(img)}
                      className="flex-1 py-2 px-3 glass-pill hover:bg-white/[0.1] text-bone-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Sliders className="w-3.5 h-3.5 text-slate-400" /> Compare
                    </button>

                    <button
                      onClick={() =>
                        handleDownloadSingle(
                          img.generated_image_location,
                          `0${idx + 1}_${img.room_type || 'enhanced'}.jpg`
                        )
                      }
                      className="py-2 px-2.5 glass-pill hover:bg-white/[0.1] text-bone-100 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Download single photo"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </>
                ) : img.status === 'failed' ? (
                  <button
                    onClick={() => handleRetryImage(img.id)}
                    disabled={isRetrying[img.id]}
                    className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-red-500/30"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRetrying[img.id] ? 'animate-spin' : ''}`} />
                    {isRetrying[img.id] ? 'Retrying...' : 'Retry Enhancement'}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 italic py-1.5 text-center w-full font-sans">
                    Awaiting photographic processing...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Image AI Darkroom Refinement Studio Modal (ChatGPT-Style + 3-Way Compare + Sliders) */}
      {refineModalImage && (() => {
        const comp = getComparisonUrls(refineModalImage, refineMode);
        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
            <div className="relative w-full max-w-6xl glass-panel rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] border border-white/[0.15]">
              {/* Modal Header */}
              <div className="p-4 bg-black/50 border-b border-white/[0.08] flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-khaki-500/10 border border-khaki-500/30 flex items-center justify-center text-khaki-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-serif font-bold text-white">
                        AI Darkroom Refinement Studio
                      </h3>
                      <span className="text-[11px] font-mono bg-white/[0.06] text-khaki-400 px-2 py-0.5 rounded border border-white/[0.1]">
                        {(refineModalImage.room_type || 'Property Photo').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-sans">
                      Targeted optical directives & precision sliders with real-time 3-way version comparison.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResetRefinement(refineModalImage.id)}
                    disabled={isResettingRefine || isRefiningImage}
                    className="px-3 py-1.5 rounded-xl glass-pill hover:bg-white/[0.1] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                    title="Reset back to initial baseline AI enhancement"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isResettingRefine ? 'animate-spin' : ''}`} />
                    {isResettingRefine ? 'Resetting...' : 'Reset to Default AI'}
                  </button>

                  <button
                    onClick={() => setRefineModalImage(null)}
                    className="p-2 rounded-xl glass-pill hover:bg-red-600/80 text-bone-100 hover:text-white transition-colors ml-1"
                    title="Close (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Main Body (2 Columns on large screens) */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto bg-black/40">
                {/* Left Column: 3-Way Comparison View & Slider */}
                <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-black/20">
                  {/* 3-Way Comparison Switcher Bar */}
                  <div className="w-full mb-3 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-khaki-400" /> Compare Mode:
                    </span>
                    <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/[0.08]">
                      <button
                        type="button"
                        onClick={() => setRefineMode('orig-vs-refined')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                          refineMode === 'orig-vs-refined'
                            ? 'bg-khaki-500 text-navy-950 font-bold shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        📸 Raw vs ✨ Refined
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefineMode('baseline-vs-refined')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                          refineMode === 'baseline-vs-refined'
                            ? 'bg-khaki-500 text-navy-950 font-bold shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🤖 Auto vs ✨ Refined
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefineMode('orig-vs-baseline')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                          refineMode === 'orig-vs-baseline'
                            ? 'bg-khaki-500 text-navy-950 font-bold shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        📸 Raw vs 🤖 Auto
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Before/After Slider */}
                  <BeforeAfterSlider
                    originalUrl={comp.leftUrl}
                    enhancedUrl={comp.rightUrl}
                    leftLabel={comp.leftLabel}
                    rightLabel={comp.rightLabel}
                    className="w-full h-[45vh] lg:h-[52vh] max-h-[500px]"
                  />

                  <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-400 font-sans px-1">
                    <span>💡 Drag slider handle to inspect textures & window clarity</span>
                    <button
                      onClick={() =>
                        handleDownloadSingle(
                          refineModalImage.generated_image_location,
                          `refined_${refineModalImage.room_type || 'photo'}.jpg`
                        )
                      }
                      className="text-khaki-400 hover:text-khaki-300 flex items-center gap-1 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Refined Photo
                    </button>
                  </div>
                </div>

                {/* Right Column: AI Directive Chat & Precision Sliders */}
                <div className="lg:col-span-5 p-4 sm:p-6 flex flex-col justify-between bg-black/30">
                  <div>
                    {/* Mode Tabs Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setRefineStudioTab('chat')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                            refineStudioTab === 'chat'
                              ? 'bg-khaki-500 text-navy-950 shadow-md'
                              : 'glass-pill text-slate-300 hover:text-white'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> AI Directive Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => setRefineStudioTab('sliders')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                            refineStudioTab === 'sliders'
                              ? 'bg-khaki-500 text-navy-950 shadow-md'
                              : 'glass-pill text-slate-300 hover:text-white'
                          }`}
                        >
                          <Sliders className="w-3.5 h-3.5" /> Precision Sliders
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">100% Optical</span>
                    </div>

                    {/* TAB 1: AI Directive Chat */}
                    {refineStudioTab === 'chat' ? (
                      <div>
                        {/* Directive Input Box */}
                        <div className="relative mb-3">
                          <textarea
                            rows={3}
                            value={adminDirective}
                            onChange={(e) => setAdminDirective(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                handleApplyDirective();
                              }
                            }}
                            placeholder="e.g. 'The marble flooring looks slightly dark, lift the shadow levels while keeping the window view clear.'"
                            className="w-full glass-input rounded-2xl p-3 text-bone-100 text-xs font-sans placeholder-slate-500 focus:outline-none leading-relaxed transition-all resize-none"
                          ></textarea>

                          <button
                            onClick={() => handleApplyDirective()}
                            disabled={isRefiningImage || !adminDirective.trim()}
                            className="absolute bottom-3 right-3 px-4 py-1.5 bg-gradient-to-r from-khaki-500 to-khaki-600 hover:from-khaki-400 hover:to-khaki-500 text-navy-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-khaki-500/20 disabled:opacity-40 transition-all"
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isRefiningImage ? 'animate-spin' : ''}`} />
                            {isRefiningImage ? 'Refining...' : 'Apply Directive'}
                          </button>
                        </div>

                        {/* 1-Click Quick Tweak Preset Chips */}
                        <div className="mb-4">
                          <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                            ⚡ Quick 1-Click Refinements:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_DIRECTIVES.map((chip, idx) => (
                              <button
                                key={idx}
                                disabled={isRefiningImage}
                                onClick={() => handleApplyDirective(chip.text)}
                                className="px-2.5 py-1.5 rounded-xl glass-pill hover:bg-white/[0.1] text-[11px] text-slate-300 hover:text-white transition-all text-left flex items-center gap-1 border border-white/[0.08]"
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Refinement History Timeline */}
                        <div className="border-t border-white/[0.08] pt-3">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                            <History className="w-3.5 h-3.5" /> Refinement History on This Photo
                          </span>

                          {refineModalImage.refinements && refineModalImage.refinements.length > 0 ? (
                            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                              {refineModalImage.refinements.map((ref, idx) => (
                                <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05] text-[11px]">
                                  <div className="flex items-center justify-between text-khaki-400 font-semibold mb-0.5">
                                    <span>Directive #{idx + 1}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {new Date(ref.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-white font-medium italic mb-1">"{ref.directive}"</p>
                                  {ref.summary && (
                                    <p className="text-slate-400 text-[10px]">{ref.summary}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-3 bg-black/20 rounded-xl border border-white/[0.04] text-[11px] text-slate-500 font-sans">
                              No custom directives applied yet. Initial AI enhancement active.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* TAB 2: Precision Manual Sliders */
                      <div className="space-y-3.5">
                        {/* 1. Exposure / Brightness */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-300 font-medium">☀️ Exposure & Brightness</span>
                            <span className="text-khaki-400 font-mono text-xs font-bold">
                              {(sliderValues.brightness * 100).toFixed(0)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="1.8"
                            step="0.05"
                            value={sliderValues.brightness}
                            onChange={(e) => setSliderValues((prev) => ({ ...prev, brightness: parseFloat(e.target.value) }))}
                            className="w-full accent-khaki-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* 2. Shadow Depth & Lift (Gamma) */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-300 font-medium">🌑 Shadow Lift / Tone Curve</span>
                            <span className="text-khaki-400 font-mono text-xs font-bold">
                              {sliderValues.gamma > 1.0 ? `+${((sliderValues.gamma - 1) * 100).toFixed(0)}% Lift` : `${((sliderValues.gamma - 1) * 100).toFixed(0)}% Deep`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.75"
                            max="1.45"
                            step="0.05"
                            value={sliderValues.gamma}
                            onChange={(e) => setSliderValues((prev) => ({ ...prev, gamma: parseFloat(e.target.value) }))}
                            className="w-full accent-khaki-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* 3. Window Glare Pull (CLAHE) */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-300 font-medium">🪟 Window Glare Compression (CLAHE)</span>
                            <span className="text-khaki-400 font-mono text-xs font-bold">
                              Slope: {sliderValues.clahe_max_slope}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={sliderValues.clahe_max_slope}
                            onChange={(e) => setSliderValues((prev) => ({ ...prev, clahe_max_slope: parseInt(e.target.value, 10) }))}
                            className="w-full accent-khaki-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* 4. Color Warmth / Hue Temp */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-300 font-medium">🌡️ Kelvin / Tone Warmth</span>
                            <span className="text-khaki-400 font-mono text-xs font-bold">
                              {sliderValues.hue > 0 ? `+${sliderValues.hue}° Golden` : sliderValues.hue < 0 ? `${sliderValues.hue}° Cool Neutral` : '0° Balanced'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            step="1"
                            value={sliderValues.hue}
                            onChange={(e) => setSliderValues((prev) => ({ ...prev, hue: parseInt(e.target.value, 10) }))}
                            className="w-full accent-khaki-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* 5. Vibrance / Saturation */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-300 font-medium">🎨 Vibrance & Saturation</span>
                            <span className="text-khaki-400 font-mono text-xs font-bold">
                              {(sliderValues.saturation * 100).toFixed(0)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.7"
                            max="1.5"
                            step="0.05"
                            value={sliderValues.saturation}
                            onChange={(e) => setSliderValues((prev) => ({ ...prev, saturation: parseFloat(e.target.value) }))}
                            className="w-full accent-khaki-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* 6. Structural Sharpness */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-300 font-medium">✨ Texture Crispness & Clarity</span>
                            <span className="text-khaki-400 font-mono text-xs font-bold">
                              {sliderValues.sharpness.toFixed(1)}x
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.0"
                            max="3.0"
                            step="0.2"
                            value={sliderValues.sharpness}
                            onChange={(e) => setSliderValues((prev) => ({ ...prev, sharpness: parseFloat(e.target.value) }))}
                            className="w-full accent-khaki-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* Action buttons for sliders */}
                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSliderValues({
                                brightness: 1.0,
                                gamma: 1.05,
                                clahe_max_slope: 3,
                                hue: 0,
                                saturation: 1.05,
                                sharpness: 1.0,
                              })
                            }
                            className="px-3 py-2 rounded-xl glass-pill hover:bg-white/[0.1] text-xs font-semibold text-slate-300"
                          >
                            Reset Defaults
                          </button>
                          <button
                            type="button"
                            onClick={handleManualRefine}
                            disabled={isRefiningImage}
                            className="flex-1 py-2 bg-gradient-to-r from-khaki-500 to-khaki-600 hover:from-khaki-400 hover:to-khaki-500 text-navy-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-khaki-500/20 disabled:opacity-40"
                          >
                            <Sliders className={`w-3.5 h-3.5 ${isRefiningImage ? 'animate-spin' : ''}`} />
                            {isRefiningImage ? 'Processing Darkroom...' : 'Apply Precision Sliders'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer status notice */}
                  <div className="mt-4 pt-3 border-t border-white/[0.06] text-[10px] text-slate-500 flex items-center justify-between">
                    <span>{refineStudioTab === 'chat' ? 'Press Ctrl + Enter to apply directive' : 'Fine-grained non-destructive curves'}</span>
                    <span>100% Authentic Geometry</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Before / After Split Slider Modal (With 3-Way Comparison) */}
      {sliderModalImage && (() => {
        const comp = getComparisonUrls(sliderModalImage, sliderMode);
        return (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
            <div className="relative w-full max-w-5xl glass-panel rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
              {/* Modal Top Bar */}
              <div className="p-4 bg-black/40 border-b border-white/[0.08] flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold bg-khaki-500 text-navy-950 px-2.5 py-1 rounded-md font-sans">
                    #{sliderIndex + 1} of {completedImages.length}
                  </span>
                  <span className="text-sm font-serif font-bold text-white">
                    {(sliderModalImage.room_type || 'Property Photo').replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                    {sliderModalImage.original_filename}
                  </span>
                </div>

                {/* 3-Way Selector Pills */}
                <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setSliderMode('orig-vs-refined')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      sliderMode === 'orig-vs-refined'
                        ? 'bg-khaki-500 text-navy-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📸 Raw vs ✨ Refined
                  </button>
                  <button
                    type="button"
                    onClick={() => setSliderMode('baseline-vs-refined')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      sliderMode === 'baseline-vs-refined'
                        ? 'bg-khaki-500 text-navy-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🤖 Auto vs ✨ Refined
                  </button>
                  <button
                    type="button"
                    onClick={() => setSliderMode('orig-vs-baseline')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                      sliderMode === 'orig-vs-baseline'
                        ? 'bg-khaki-500 text-navy-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📸 Raw vs 🤖 Auto
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const current = sliderModalImage;
                      setSliderModalImage(null);
                      openRefineModal(current);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-khaki-500/15 hover:bg-khaki-500/25 text-khaki-300 text-xs font-semibold flex items-center gap-1.5 border border-khaki-500/30 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-khaki-400" /> AI Refine
                  </button>
                  <button
                    onClick={handlePrevSlider}
                    className="p-2 rounded-xl glass-pill hover:bg-white/[0.1] text-bone-100 text-xs font-semibold flex items-center gap-1"
                    title="Previous image (Left arrow)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextSlider}
                    className="p-2 rounded-xl glass-pill hover:bg-white/[0.1] text-bone-100 text-xs font-semibold flex items-center gap-1"
                    title="Next image (Right arrow)"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSliderModalImage(null)}
                    className="p-2 rounded-xl glass-pill hover:bg-red-600/80 text-bone-100 hover:text-white transition-colors ml-2"
                    title="Close (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Slider Container */}
              <div className="p-4 sm:p-6 flex-1 flex items-center justify-center overflow-hidden bg-black/40">
                <BeforeAfterSlider
                  originalUrl={comp.leftUrl}
                  enhancedUrl={comp.rightUrl}
                  leftLabel={comp.leftLabel}
                  rightLabel={comp.rightLabel}
                  className="w-full h-[62vh] max-h-[600px]"
                />
              </div>

              {/* Modal Footer Controls */}
              <div className="p-3.5 bg-black/40 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
                <span className="hidden sm:inline font-sans">
                  💡 Tip: Drag slider handle horizontally. Use <kbd className="px-1.5 py-0.5 glass-pill rounded font-mono text-khaki-400">←</kbd> and <kbd className="px-1.5 py-0.5 glass-pill rounded font-mono text-khaki-400">→</kbd> to switch photos, <kbd className="px-1.5 py-0.5 glass-pill rounded font-mono text-khaki-400">Esc</kbd> to close.
                </span>
                <button
                  onClick={() =>
                    handleDownloadSingle(
                      sliderModalImage.generated_image_location,
                      `0${sliderIndex + 1}_${sliderModalImage.room_type || 'enhanced'}.jpg`
                    )
                  }
                  className="ml-auto px-4 py-2 bg-gradient-to-r from-khaki-500 via-khaki-400 to-khaki-600 hover:from-khaki-400 hover:to-khaki-500 text-navy-950 font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-khaki-500/20"
                >
                  <Download className="w-4 h-4" /> Download This Enhanced Photo
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clean popup toast */}
      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
}

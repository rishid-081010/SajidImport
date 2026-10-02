import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, X, Sparkles, Building, Hash, Home, Image as ImageIcon, 
  AlertCircle, BedDouble, Bath, Maximize2, FileText, Check, 
  ShieldCheck, Eye, Sun, Moon, Sunrise, Waves, Sliders, Wand2, Brush, Star
} from 'lucide-react';
import axios from 'axios';
import Toast from './Toast';

const ASQUARED_DEFAULT_PROMPT = `You are a real-estate property photo QA and enhancement assistant.

Review the attached property photo for portal advertising.

First assess:
- brightness
- sharpness
- natural appearance
- vertical lines and perspective
- composition
- visible people
- watermarks
- reflections
- clutter
- CGI or AI-generated appearance
- bathroom placement
- floor-plan status
- whether the photo clearly represents the property

Do not change the property or invent furniture, features, amenities or views.

Determine whether the image should be:
- used as-is
- edited
- reordered
- rejected
- sent for human review

If editing is required, edit the real-estate photo conservatively so it still looks like a natural professional photograph.

Improve only:
- exposure
- brightness
- white balance
- clarity
- straightness
- minor photographic imperfections

Preserve exactly:
- actual room layout
- finishes
- furniture
- fixtures
- architectural features
- windows
- doors
- view
- property condition

Do not:
- add furniture
- remove furniture
- add amenities
- remove amenities
- alter the room layout
- add or remove structural features
- change the view
- fabricate property features
- make the image look CGI
- make the image look AI-generated
- over-saturate
- over-sharpen
- distort proportions

If the image contains a floor plan, do not treat it as a normal room photograph. Identify it as a floor plan and evaluate whether it should be included and where it should appear in the photo sequence.

If the image contains people, watermarks, severe clutter, misleading reflections, obvious CGI, or other issues that cannot be safely corrected through conservative editing, flag the issue instead of attempting to hide or fabricate it.

For portal-ready output, target:
1200 x 900 pixels
Natural professional property-advertising style.`;

const PRESETS = [
  {
    id: 'asquared_default',
    label: '⭐ Asquared Default (QA & Strict Guardrail)',
    icon: Star,
    isPrimary: true,
    instruction: ASQUARED_DEFAULT_PROMPT
  },
  {
    id: 'retouch_overall',
    label: 'Overall Luxury Retouch',
    icon: Wand2,
    instruction: 'Professionally enhance lighting, contrast, and high-end color grading for a luxury Dubai architectural magazine finish without modifying structure.'
  },
  {
    id: 'clarity',
    label: 'Clarity & Sharpness',
    icon: Eye,
    instruction: 'Increase micro-contrast, crisp texture sharpness, and optical clarity throughout the image.'
  },
  {
    id: 'declutter',
    label: 'Clean & Declutter',
    icon: Brush,
    instruction: 'Subtly declutter and clean visible floor cables and debris while keeping genuine furniture intact.'
  },
  {
    id: 'brighten',
    label: 'Brighten Dim Interiors',
    icon: Sun,
    instruction: 'Brighten underexposed interior ceilings and lift dark shadow corners naturally.'
  },
  {
    id: 'glare',
    label: 'Balance Glare & Windows',
    icon: Moon,
    instruction: 'Balance extreme outdoor window glare so Dubai skyline views remain clear and visible.'
  },
  {
    id: 'golden_hour',
    label: 'Dubai Golden Hour',
    icon: Sunrise,
    instruction: 'Add warm, ambient golden-hour luxury warmth to window lighting and interior fixtures.'
  },
  {
    id: 'vivid_sky',
    label: 'Vivid Sky & Water',
    icon: Waves,
    instruction: 'Enrich natural sky blue tones and make balcony ocean or pool water look crystal clear.'
  }
];

// Helper to auto-format numbers with commas
const formatNumberWithCommas = (val) => {
  if (!val && val !== 0) return '';
  const clean = val.toString().replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.slice(0, 2).join('.');
};

export default function NewListing({ onListingCreated }) {
  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [purpose, setPurpose] = useState('For Sale');
  const [price, setPrice] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bedrooms, setBedrooms] = useState('2 Bedrooms');
  const [bathrooms, setBathrooms] = useState('2 Baths');
  const [sizeSqft, setSizeSqft] = useState('');
  const [roughNotes, setRoughNotes] = useState('');

  const [selectedPresets, setSelectedPresets] = useState(['asquared_default']);
  const [compiledPrompt, setCompiledPrompt] = useState(ASQUARED_DEFAULT_PROMPT);
  
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ msg: '', type: 'success' });
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
  };

  const handlePriceChange = (e) => {
    setPrice(formatNumberWithCommas(e.target.value));
  };

  const handleSizeChange = (e) => {
    setSizeSqft(formatNumberWithCommas(e.target.value));
  };

  const togglePreset = (presetId) => {
    if (presetId === 'asquared_default') {
      setSelectedPresets(['asquared_default']);
      setCompiledPrompt(ASQUARED_DEFAULT_PROMPT);
      return;
    }

    const withoutDefault = selectedPresets.filter((id) => id !== 'asquared_default');
    const isCurrentlySelected = withoutDefault.includes(presetId);
    const newSelected = isCurrentlySelected
      ? withoutDefault.filter((id) => id !== presetId)
      : [...withoutDefault, presetId];

    if (newSelected.length === 0) {
      setSelectedPresets(['asquared_default']);
      setCompiledPrompt(ASQUARED_DEFAULT_PROMPT);
      return;
    }

    setSelectedPresets(newSelected);

    const activeInstructions = newSelected
      .map((id) => PRESETS.find((p) => p.id === id)?.instruction)
      .filter(Boolean);

    setCompiledPrompt(activeInstructions.join('\n\n') + '\n\nSTRICT REQUIREMENT: Preserve 100% of the actual property layout, room structure, real furniture, and authentic view.');
  };

  const handleFilesAdded = (filesArray) => {
    setError(null);
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
      setError('Some files were skipped. Only JPG, PNG, and WEBP formats are supported.');
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setPreviews((prev) => [...prev, ...validPreviews]);
  };

  // Clipboard Paste Support (Ctrl + V)
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
        handleFilesAdded(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (index) => {
    URL.revokeObjectURL(previews[index].url);
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a listing or property name.');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Please upload at least one property image.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('reference', reference);
    formData.append('purpose', purpose);
    formData.append('price', price);
    formData.append('property_type', propertyType);
    formData.append('bedrooms', bedrooms);
    formData.append('bathrooms', bathrooms);
    formData.append('size_sqft', sizeSqft);
    formData.append('rough_notes', roughNotes);
    formData.append('prompt', compiledPrompt);

    selectedFiles.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const response = await axios.post('/api/listings', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        if (onListingCreated) {
          onListingCreated(response.data.listing);
        }
      } else {
        setError(response.data.error || 'Failed to create listing.');
      }
    } catch (err) {
      console.error('Create listing error:', err);
      setError(err.response?.data?.error || 'Failed to connect to backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold text-white tracking-tight">
          Create Property Listing & AI Package
        </h1>
        <p className="text-slate-400 mt-2 text-sm font-sans">
          Select photo presets, enter property details, and drag & drop or paste photos from clipboard (<kbd className="px-1.5 py-0.5 bg-navy-950 border border-navy-700 rounded text-xs font-mono text-khaki-400">Ctrl + V</kbd>).
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* STEP 1 — Property Listing Information */}
        <div className="glass-card p-6">
          <h2 className="text-base font-serif font-bold text-white mb-5 flex items-center gap-2 border-b border-white/[0.06] pb-3">
            <Building className="w-5 h-5 text-khaki-500" /> STEP 1 — Property Listing Information
          </h2>

          <div className="space-y-5">
            {/* Row 1: Name & Reference */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2">
                  PROPERTY / BUILDING NAME <span className="text-khaki-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marina Gate 2, Dubai Marina"
                  required
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-bone-100 placeholder-slate-500 focus:outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2">
                  # REFERENCE (OPTIONAL)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. MG-2026-09"
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-bone-100 placeholder-slate-500 focus:outline-none transition-all text-sm"
                />
              </div>
            </div>

            {/* Row 2: Listing Purpose, Price, Property Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2">
                  LISTING PURPOSE
                </label>
                <div className="grid grid-cols-2 gap-2 glass-pill p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPurpose('For Sale')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      purpose === 'For Sale'
                        ? 'bg-khaki-500 text-navy-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    For Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurpose('For Rent')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      purpose === 'For Rent'
                        ? 'bg-khaki-500 text-navy-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    For Rent
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2 flex items-center gap-1">
                  <span className="text-khaki-500 font-bold">$</span> PRICE (AED)
                </label>
                <input
                  type="text"
                  value={price}
                  onChange={handlePriceChange}
                  placeholder="e.g. 2,850,000"
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-bone-100 placeholder-slate-500 focus:outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2 flex items-center gap-1">
                  <Home className="w-3.5 h-3.5 text-slate-400" /> PROPERTY TYPE
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-bone-100 focus:outline-none transition-all text-sm cursor-pointer"
                >
                  <option value="Apartment">Apartment</option>
                  <option value="Villa">Villa</option>
                  <option value="Penthouse">Penthouse</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Commercial">Commercial</option>
                </select>
              </div>
            </div>

            {/* Row 3: Bedrooms, Bathrooms, Size */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2 flex items-center gap-1">
                  <BedDouble className="w-3.5 h-3.5 text-slate-400" /> BEDROOMS
                </label>
                <select
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-bone-100 focus:outline-none transition-all text-sm cursor-pointer"
                >
                  <option value="Studio">Studio</option>
                  <option value="1 Bedroom">1 Bedroom</option>
                  <option value="2 Bedrooms">2 Bedrooms</option>
                  <option value="3 Bedrooms">3 Bedrooms</option>
                  <option value="4 Bedrooms">4 Bedrooms</option>
                  <option value="5+ Bedrooms">5+ Bedrooms</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2 flex items-center gap-1">
                  <Bath className="w-3.5 h-3.5 text-slate-400" /> BATHROOMS
                </label>
                <select
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-bone-100 focus:outline-none transition-all text-sm cursor-pointer"
                >
                  <option value="1 Bath">1 Bath</option>
                  <option value="2 Baths">2 Baths</option>
                  <option value="3 Baths">3 Baths</option>
                  <option value="4 Baths">4 Baths</option>
                  <option value="5+ Baths">5+ Baths</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2 flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-slate-400" /> SIZE (SQ. FT.)
                </label>
                <input
                  type="text"
                  value={sizeSqft}
                  onChange={handleSizeChange}
                  placeholder="e.g. 1,450"
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-bone-100 placeholder-slate-500 focus:outline-none transition-all text-sm"
                />
              </div>
            </div>

            {/* Row 4: Rough Notes */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-khaki-500" /> ROUGH NOTES & HIGHLIGHTS (FOR BAYUT & PROPERTY FINDER GENERATOR)
              </label>
              <textarea
                rows={3}
                value={roughNotes}
                onChange={(e) => setRoughNotes(e.target.value)}
                placeholder="e.g. Full Marina view, high floor, chiller free, upgraded kitchen, vacant on transfer, infinity pool access, 2 mins to tram..."
                className="w-full glass-input rounded-xl p-3.5 text-bone-100 text-sm placeholder-slate-500 focus:outline-none transition-all leading-relaxed"
              ></textarea>
            </div>
          </div>
        </div>

        {/* STEP 2 — Upload Listing Photos */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-5">
            <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-khaki-500" /> STEP 2 — Upload Listing Photos
            </h2>
            <span className="text-xs text-khaki-400 bg-khaki-500/10 px-3 py-1 rounded-full font-medium border border-khaki-500/25">
              {previews.length} photos selected
            </span>
          </div>

          {/* Drag & Drop Box */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-khaki-400 bg-khaki-500/10 scale-[0.99]'
                : 'border-white/[0.12] hover:border-khaki-500/50 bg-black/20 hover:bg-black/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files && handleFilesAdded(e.target.files)}
            />

            <div className="w-14 h-14 rounded-2xl bg-khaki-500/10 border border-khaki-500/25 text-khaki-400 flex items-center justify-center mx-auto mb-3.5 shadow-lg shadow-black/40">
              <Upload className="w-7 h-7" />
            </div>

            <p className="text-sm font-semibold text-white">
              Drag & drop property images, or <span className="text-khaki-400 underline decoration-khaki-400/50 underline-offset-4">browse files</span>
            </p>
            <p className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1 flex-wrap font-sans">
              <span>✨ Direct Clipboard Paste supported:</span>
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 glass-pill rounded text-[11px] font-mono text-khaki-400">Ctrl + V</kbd>
              <span>anywhere to paste photos directly from WhatsApp or email!</span>
            </p>
          </div>

          {/* Image Previews */}
          {previews.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-khaki-400">
                  Uploaded Photos ({previews.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    previews.forEach((p) => URL.revokeObjectURL(p.url));
                    setPreviews([]);
                    setSelectedFiles([]);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Clear All
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {previews.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative group bg-black/40 rounded-xl overflow-hidden border border-white/[0.08] shadow-md hover:border-khaki-500/40 transition-all"
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(idx);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center backdrop-blur-md transition-colors shadow-md"
                      title="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="p-1.5 bg-black/60 border-t border-white/[0.06]">
                      <p className="text-[10px] font-medium text-bone-100 truncate">{item.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* STEP 3 — AI Enhancement Presets & Prompt */}
        <div className="glass-card p-6">
          <div className="border-b border-white/[0.06] pb-3 mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-serif font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-khaki-500" /> STEP 3 — Real Estate Photo QA & Enhancement Preset
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Non-destructive conservative enhancement. Zero structural alterations or hallucinations.
              </p>
            </div>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Hard Guardrails Active
            </span>
          </div>

          {/* Presets Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {PRESETS.map((preset) => {
              const isSelected = selectedPresets.includes(preset.id);
              const IconComp = preset.icon;
              return (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => togglePreset(preset.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-khaki-500/15 border-khaki-500 text-white shadow-sm'
                      : 'glass-pill text-slate-300 hover:border-white/[0.15]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <IconComp className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-khaki-400' : 'text-slate-400'}`} />
                    <span className={`text-xs font-semibold truncate ${isSelected ? 'text-khaki-300' : 'text-slate-200'}`}>
                      {preset.label}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-khaki-400 flex-shrink-0 ml-1 stroke-[3]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* COMPILED AI INSTRUCTIONS (EDITABLE) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-khaki-400 mb-2 flex items-center justify-between">
              <span>ACTIVE QA & ENHANCEMENT PROMPT (EDITABLE)</span>
              <span className="text-[10px] text-slate-400 font-normal">Strict Real Estate Protocol</span>
            </label>
            <textarea
              rows={8}
              value={compiledPrompt}
              onChange={(e) => setCompiledPrompt(e.target.value)}
              placeholder="QA & enhancement prompt instructions..."
              className="w-full glass-input rounded-xl p-3.5 text-bone-100 text-xs font-mono placeholder-slate-500 focus:outline-none transition-all leading-relaxed"
            ></textarea>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || selectedFiles.length === 0}
            className={`px-8 py-4 rounded-2xl font-bold text-navy-950 text-base flex items-center gap-3 transition-all shadow-xl ${
              isSubmitting || selectedFiles.length === 0
                ? 'bg-navy-800 text-slate-500 cursor-not-allowed border border-white/[0.08]'
                : 'bg-gradient-to-r from-khaki-500 via-khaki-400 to-khaki-600 hover:from-khaki-400 hover:to-khaki-500 shadow-khaki-500/20 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            {isSubmitting ? 'Evaluating QA & Enhancing Photos...' : `RUN QA & ENHANCE ${selectedFiles.length} PHOTOS`}
          </button>
        </div>
      </form>

      {/* Clean popup toast */}
      <Toast
        message={toast.msg}
        type={toast.type}
        onClose={() => setToast({ msg: '', type: 'success' })}
      />
    </div>
  );
}

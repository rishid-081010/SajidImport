# 🏙️ A SQUARED REAL ESTATE — Unified Luxury Admin Suite

A unified real estate listing enhancement & lead management operations dashboard built for **A SQUARED REAL ESTATE** (Dubai, UAE).

---

## ✨ Features

### 1. 🖼️ Real Estate Listing & Darkroom Studio
- **Conservative Photographic Enhancements**: Pure tone-curve and optical corrections (exposure, brightness, shadow lift, window glare pull, Kelvin white balance, sharpness) using `sharp` / `libvips`.
- **100% Authentic Preservation**: Zero generative AI additions (no synthetic furniture, no hallucinated fixtures, authentic layout preserved).
- **Per-Image AI Darkroom Refinement Studio**:
  - **💬 Conversational Directives**: Natural language requests to fine-tune specific image areas.
  - **🎚️ Precision Manual Sliders**: Exposure, Gamma Shadow Lift, CLAHE Window Pull, Kelvin Tone Warmth, Saturation, and Sharpness.
- **3-Way Real-Time Comparison Slider**:
  - `📸 Original Raw vs ✨ Custom Refined`
  - `🤖 Auto-Enhanced vs ✨ Custom Refined`
  - `📸 Original Raw vs 🤖 Auto-Enhanced`
- **Dynamic Post-Processing Management**: Upload additional photos, delete images, or reorder sequences anytime with real-time updates.
- **Automated Dubai Portal Copy Generation**: Generates Property Finder / Bayut listing copy with luxury tone options.
- **1-Click High-Res ZIP Export**: Batch export portal-ready photos in sequence.

### 2. 👥 Lead Ingestion & Validation Studio
- **International E.164 Phone Formatting**: Real-time country code detection with interactive country picker (🇦🇪 UAE default).
- **Multi-Channel Lead Capture**: Manual intake, CSV bulk upload, Excel (.xlsx) bulk upload, and clipboard paste.
- **Client & Agent Tracking**: Assign to agents (e.g. Sajid / Imran), track budgets (AED), property types, and inquiry stages.
- **Interactive Quick Actions**: 1-click WhatsApp chat launch, click-to-call, status updates, and Excel/CSV export.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/rishid-081010/SajidImport.git
cd SajidImport

# Install root & server dependencies
npm install
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..
```

### Configuration
Create a `.env` file in the project root:
```env
PORT=5000
OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development & Build
```bash
# Build client
cd client && npm run build && cd ..

# Start server
node server/index.js
```

Open `http://localhost:5000` in your browser.

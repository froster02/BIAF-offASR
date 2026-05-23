# 🎨 Offline Translation Portal — React Frontend

This is the premium React user interface for the **Offline AI Translation System**. Built with **React 19** and **Vite 8**, it implements an elegant, high-fidelity **glassmorphic dark UI** designed to offer a fluid, responsive, and tactile experience for rural field officers and translators.

---

## 🔮 Aesthetics & Styling Principles

The interface uses pure **Vanilla CSS** (configured inside [`src/index.css`](src/index.css)) following state-of-the-art visual design practices:
* **Harmonious Dark Theme**: Uses curated deep slate background colors (`#0a0e17` and `#121824`) blended with soft indigo and violet radial gradients (`radial-gradient`) to give the app a premium, high-tech glow that reduces eye strain.
* **Glassmorphic Cards**: Implements translucent white layers (`rgba(18, 24, 38, 0.7)`) with a custom `backdrop-filter: blur(16px)` and ultra-subtle border outlines (`rgba(255, 255, 255, 0.08)`), making panels appear suspended.
* **Micro-Animations & Transitions**: Interactive states, buttons, dropzones, and sidebar navigation items feature smooth cubic-bezier transitions (`all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`) and elegant lift behaviors.
* **Premium Typography**: Integrates Google Fonts featuring **Outfit** for clean, bold headings and **Inter** for readable, high-legibility body copies.
* **Custom Scrollbars**: Beautiful thin slate-and-indigo scrollbars that match the color theme seamlessly across all modern browsers.

---

## 🧩 Interface Structure & Live Modules

The entire application runs as a cohesive Single Page Application (SPA) inside [`src/App.jsx`](src/App.jsx):

```
┌─────────────────────────────────────────────────────────────┐
│  Branding    │  Header: Title & Subtitle                   │
├───────────────┼─────────────────────────────────────────────┤
│  Navigation   │                                             │
│  - Video Dub  │  Interactive Grid Panels                    │
│  - Audio Trans│                                             │
│  - Text Trans │  [ Source Upload / Input ]                  │
│               │             ▼                               │
│  Status Card  │  [ Realtime Progress Meters / Live Dubs ]   │
│  - STT Ready  │             ▼                               │
│  - NLLB Ready │  [ Interactive SRT Sync / Dub Output ]      │
│  - TTS Ready  │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

### 1. Unified Navigation Sidebar
* Switch seamlessly between **Video Translator (Dubbing)**, **Audio Translator**, and **Text Translator** tabs.
* **Live Model Status Card**: Prominently displays the real-time cache state of offline engine weights (ASR, NLLB Translation, TTS) by polling `/api/models-status` on initialization.

### 2. Multi-Format Drag & Drop Zone
* A flexible file upload zone matching files by type with active dashed boundary glows.
* Supports high-volume audio (`.wav`, `.mp3`, `.m4a`) and video (`.mp4`, `.mov`, `.avi`, `.webm`) uploads.

### 3. Live Processing Panel
* Includes pulsating progress indicators (`@keyframes pulseGlow`) and detailed task step counters (e.g., "Extracting audio track...", "Transcribing speech...", "Translating subtitles...", "Synthesizing dubbed voiceover...").

### 4. Interactive Subtitle Sync Editor
* Reviews translated outputs side-by-side with millisecond timestamp markers.
* Highlights individual chunks to make validation and fine-tuning extremely intuitive.

### 5. Multi-Player Outputs
* Features custom built-in native HTML5 video and audio players styled to match the dark slate theme.

---

## 🛠️ Development & Building Commands

The frontend operates in a monorepo setup. You can run it separately for design modifications or build it for backend inclusion.

### 1. Install Node Dependencies
Before starting, ensure you have **Node.js** (v18+) installed. Go to the `frontend/` directory and install the packages:
```bash
npm install
```

### 2. Launch Vite Development Server
Start the local hot-reloading development server to iterate on the user interface:
```bash
npm run dev
```
* The UI will launch on **`http://localhost:5173`**.
* *Note*: By default, API requests are routed to the FastAPI backend running on port `8000` (`http://localhost:8000`).

### 3. Production Compilation & Packaging
Build the optimized static assets for production deployment:
```bash
npm run build
```
* This compiles the React 19 source code, minifies CSS/JS assets, and outputs them into the `frontend/dist/` directory.
* When the FastAPI server starts, it automatically checks for the existence of `frontend/dist` and serves these static assets directly at the root `/` URL, allowing you to run the entire monorepo on a **single unified port**.

---

## 📁 File Structure
* **`public/`**: Static public assets (icons, brand marks).
* **`src/assets/`**: Component-specific image styles and visual icons.
* **`src/index.css`**: Core typography rules, CSS custom properties, buttons, sliders, progress bars, dropzones, grids, media layout overrides, and animations.
* **`src/main.jsx`**: Vite React entrypoint mounting the application tree.
* **`src/App.jsx`**: Core UI workspace integrating states, file uploads, tab switching, and backend API bindings.

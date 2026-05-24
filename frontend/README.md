# 🎨 Offline Translation Portal — React Frontend

This is the premium React user interface for the **Offline AI Translation System**. Built with **React 19** and **Vite 8**, it implements a refined **editorial-rural aesthetic** designed for field officers and translators working with agricultural and development content.

---

## 🔮 Aesthetics & Styling Principles

The interface uses pure **Vanilla CSS** (configured inside [`src/index.css`](src/index.css)) following distinctive visual design practices:
*   **Editorial Look**: Swaps generic "AI slop" fonts for characterful typography—**Alegreya** (serif) for headings and **Hind** (sans-serif) for high-legibility body text.
*   **Rural-Tech Palette**: A cohesive green-and-white theme featuring deep moss greens (`#1f4f2b`) and crisp forest accents, reflecting the agricultural focus of the tool.
*   **Atmospheric Detail**: Soft page-level radial gradients and subtle transparencies that provide depth without overwhelming the user.
*   **Refined Layout**: Generous whitespace, pill-shaped navigation items, and grid-based module layouts that are 100% responsive for mobile-first field usage.
*   **Micro-Animations**: Pulsating progress indicators and smooth transitions that guide users through complex ML processing steps (ASR -> Translation -> TTS).

---

## 🧩 Interface Structure & Live Modules

The application is a cohesive Single Page Application (SPA) inside [`src/App.jsx`](src/App.jsx):

### 1. Unified Navigation
*   **Dashboard**: A high-level overview with quick-action capabilities.
*   **Text Translate**: Instant sentence translation across Marathi, Hindi, and English.
*   **Audio Dub**: Upload audio/video to transcribe, translate, and synthesize voiceovers.
*   **Video Dub**: Full pipeline to extract audio, generate translated subtitles, and burn them into frames.
*   **Settings**: Monitor offline model cache states (Whisper, NLLB, MMS) and system performance.

### 2. Multi-Format Drag & Drop
*   Supports audio (`.wav`, `.mp3`, `.m4a`) and video (`.mp4`, `.mov`, `.avi`, `.webm`) uploads.
*   Features a responsive, tactile dropzone that reacts to hover and file-dragging states.

### 3. Live Processing Panel
*   Real-time feedback as the backend processes heavy ML tasks.
*   Detailed status updates: "Extracting audio track...", "Transcribing speech...", "Translating subtitles...", "Synthesizing dubbed voiceover...".

### 4. Interactive Subtitle Sync Editor
*   Reviews translated segments side-by-side with millisecond precision.
*   Allows field workers to validate AI outputs before final video generation.

---

## 🛠️ Development & Building

### 1. Install Dependencies
Ensure you have **Node.js** (v18+) installed.
```bash
npm install
```

### 2. Development Server
Start the local hot-reloading server:
```bash
npm run dev
```
*   UI: `http://localhost:5173`
*   API Proxy: Configured to route `/api/*` requests to port `8000`.

### 3. Production Build
Compile optimized static assets:
```bash
npm run build
```
*   Outputs to `frontend/dist/`.
*   Served directly by the FastAPI backend at the root URL.

---

## 📁 File Structure
*   **`public/`**: Favicon and static assets.
*   **`src/assets/`**: Images and hero visuals.
*   **`src/index.css`**: The design system—typography, variables, and layout components.
*   **`src/App.jsx`**: Main workspace logic and state management.

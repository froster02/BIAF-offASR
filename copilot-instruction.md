# BAIF (BIAF-offASR) — AI Context File

## Project Identity

Offline Translation Portal. AGPLv3. React 19 SPA + FastAPI backend + Hugging Face ML models (Whisper ASR, NLLB-200 translation, MMS-TTS). Supports English/Hindi/Marathi. All ML runs locally — no cloud API calls.

---

## Directory Map

```
.
├── backend/
│   ├── app.py              # FastAPI app: 10 API endpoints, CORS, static mount
│   ├── auth.py             # JWT auth (HS256, 24h expiry), SQLite users.db, bcrypt
│   ├── models.py           # ModelManager: lazy-loads Whisper/NLLB/TTS, thread-safe
│   ├── document_utils.py   # Translate DOCX/PPTX/XLSX/PDF with style preservation
│   ├── subtitles.py        # SRT/VTT generation, FFmpeg audio/video ops
│   ├── jobs.py             # Thread-safe in-memory job manager (polling pattern)
│   ├── download_models.py  # Pre-download all models for offline use
│   ├── requirements.txt    # 25 packages: fastapi, torch, transformers, etc.
│   └── __init__.py         # Enables `from backend import ...`
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Single-file SPA: 6 tabs, 40+ states, ~1276 lines
│   │   └── index.css       # CSS design system: 58 custom properties, Poppins + Open Sans
│   └── package.json        # React 19 + Vite 8 only — no routing/state libs
├── testcase/
│   ├── backend/
│   │   ├── test_api_integration.py   # 3 FastAPI TestClient tests (auth required)
│   │   ├── test_models_unit.py       # 8 ModelManager unit tests (CI_MODE mock)
│   │   └── test_sync_logic.py        # 1 audio segment alignment test
│   ├── e2e/
│   │   ├── test_app_flow.py          # Core flow: login → translate → verify mock
│   │   └── test_advanced_features.py # Recording, doc upload, settings
│   └── __init__.py                   # Required for test discovery
├── .github/workflows/
│   ├── ci-cd.yml           # Main pipeline: backend tests → frontend lint/build → e2e
│   ├── python-app.yml      # Legacy Python CI
│   ├── pylint.yml          # Pylint check (disables C0114,C0115,C0116,R0903)
│   ├── codeql.yml          # GitHub CodeQL security scan
│   ├── docker-image.yml    # Docker build on push/PR
│   └── dependency-review.yml  # License/vulnerability check (blocks GPL-2/3)
├── Dockerfile              # Multi-stage: node:20 → python:3.11-slim, bakes models
├── main.py                 # PyInstaller entry point (adds backend/ to sys.path)
├── run.sh                  # macOS/Linux launcher (venv + deps + model check)
├── start.bat               # Windows launcher
└── copilot-instruction.md  # THIS FILE
```

---

## Backend Architecture

### Auth Scheme

- `users.db` (SQLite) created on import via `init_db()`
- Default users: `admin/admin123` (role: admin), `user/user123` (role: user)
- JWT HS256, 24h expiry, HTTP Bearer via `fastapi.security.HTTPBearer`
- Secret key: hardcoded in `auth.py` — do NOT expose or commit if changed
- FastAPI dependencies: `get_current_user` (any auth), `require_admin` (admin-only)

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/login` | No | Login → `{access_token, token_type, role}` |
| GET | `/api/models-status` | Yes | `{is_cached, whisper_cached, nllb_cached, tts_cached, models_dir}` |
| POST | `/api/detect-language` | No | `{text}` → `{language}` |
| GET | `/api/jobs/{job_id}` | Yes | Poll async job `{status, progress, result, error}` |
| POST | `/api/translate-text` | Yes | `{text, src_lang, tgt_lang}` → `{translated_text, detected_src_lang}` |
| POST | `/api/transcribe-audio` | Yes | Multipart: `file, model_size, language` |
| POST | `/api/translate-audio` | Yes | Multipart: `file, model_size, src_lang, tgt_lang` → full translation + TTS |
| POST | `/api/text-to-speech` | Yes | `{text, lang}` → binary WAV |
| POST | `/api/process-video` | Yes | Multipart: async → `{job_id}` (poll /api/jobs/{id}) |
| GET | `/api/download-file` | Yes | Query: `session_id, filename` → FileResponse |
| POST | `/api/translate-document` | Yes | Multipart: async → `{job_id}` |

CORS: `allow_origins=["*"]`. Static mount: `frontend/dist` if it exists.

### ModelManager (`backend/models.py`)

- Thread-safe via `threading.RLock()`
- Lazy-loads models on first use: Whisper ("tiny", "base"), NLLB-200 (distilled 600M), MMS-TTS (hin/mar/eng)
- Device auto-select: CUDA > MPS > CPU
- `CI_MODE=true` → returns mock responses, skips real inference
- `translate` / `translate_batch` — NLLB-200 with forced BOS token per language
- `text_to_speech` — MMS-TTS VITS with optional speed adjustment via scipy interpolation
- `transcribe` — Whisper pipeline with `chunk_length_s=30, stride_length_s=5`

### Data Flow Patterns

- **Synchronous:** text translation, TTS, transcription
- **Async (polling):** video processing, document translation → return `job_id`, frontend polls `/api/jobs/{id}` every 2s
- **File downloads:** served from session temp dirs (UUID-based) via `/api/download-file`
- **Session isolation:** each upload creates `backend/temp/{session_id}/` directory

### Import Pattern (Critical Gotcha)

`backend/app.py` uses a try/except fallback for imports:
```python
try:
    from . import models       # relative import (works when backend is a package)
    from . import document_utils
    from . import auth as auth_mod
    from . import jobs
    from . import subtitles
except (ImportError, ValueError):
    import models              # absolute fallback (works when cwd is backend/)
    import document_utils
    import auth as auth_mod
    import jobs
    import subtitles
```
When tests run from repo root (`pytest testcase/backend/`), the relative imports work because `backend/__init__.py` exists. The fallback would fail since `models` is not on `sys.path`.

---

## Frontend Architecture

### Structure

- Single-file SPA (`App.jsx`), tab-based navigation via `activeTab` state
- No React Router, no state library — pure `useState`/`useEffect`/`useRef`
- 6 tabs: Dashboard, Text Translate, Documents, Audio Dub, Video Dub, Settings

### Critical State & Functions

- `auth` — login token from `localStorage`, checked at startup
- `activeTab` — drives which section renders
- `audioResult`, `videoResult`, `docResult` — hold full API responses including `translated_segments`, `detected_src_lang`
- `modelsStatus`, `isConnected` — polled every 5s via `/api/models-status`
- `authFetch(url, options)` — wraps `fetch` with `Authorization: Bearer` header
- `pollJob(job_id, onSuccess, onFail, onProgress)` — polls `/api/jobs/{id}` every 2s
- `MediaRecorder` API for microphone capture (start/stop → File object)

### API Calls Summary

1. `POST /api/login` — unauthenticated
2. `GET /api/models-status` — polled every 5s after login
3. `POST /api/translate-text` — text translation
4. `POST /api/text-to-speech` — TTS synthesis → blob URL
5. `POST /api/translate-audio` — audio dubbing with FormData
6. `POST /api/process-video` — starts async video job → poll
7. `GET /api/jobs/{job_id}` — polled every 2s
8. `POST /api/translate-document` — starts async doc job → poll
9. `GET /api/download-file` — downloads processed files

### CSS Design System (`index.css`)

- 58 CSS custom properties for colors, shadows, gradients, spacing
- Google Fonts: Poppins (headings), Open Sans (body)
- Responsive breakpoints: 1024px, 768px, 480px
- Key classes: `.glass-card`, `.dropzone`, `.btn-primary`, `.translator-grid`, `.subtitle-editor`

---

## Testing

### Backend Tests (`testcase/backend/`)

| File | Tests | Type |
|------|-------|------|
| `test_api_integration.py` | `test_get_models_status`, `test_translate_text_api`, `test_download_file_not_found` | FastAPI TestClient |
| `test_models_unit.py` | 8 tests: init, translate (empty/unsupported/same/batch), TTS | ModelManager unit |
| `test_sync_logic.py` | `test_merge_audio_segments_alignment` | Audio segment timing |

### E2E Tests (`testcase/e2e/`)

- Both use Playwright, start backend (`CI_MODE=true`) + frontend as subprocesses
- Wait for ports 8000/5173 via socket polling
- Take screenshot on failure: `e2e_failure.png`
- Clean up processes with SIGTERM in `finally` block

### CI Mode

`CI_MODE=true` env var makes ModelManager return mock values:
- `transcribe` → mock result with text + segments
- `translate` → `[CI MOCK] {tgt_lang}: {text}`
- `translate_batch` → per-item mock
- `text_to_speech` → silent WAV file

### CI/CD Pipeline

| Workflow | When | Steps |
|----------|------|-------|
| `ci-cd.yml` | Push/PR to main | backend tests → frontend lint+build → e2e → code quality → docker build |
| `python-app.yml` | Push/PR to main | Legacy Python CI |
| `pylint.yml` | Push/PR to main | Pylint on all .py files |
| `codeql.yml` | Push/PR to main + weekly | CodeQL Python security scan |
| `dependency-review.yml` | PR to main | License/vulnerability check |
| `docker-image.yml` | Push/PR to main | Docker build |

Node.js version: 22 (required by ESLint 10.x which uses `util.styleText`).
Python version: 3.10.

---

## Critical Gotchas for AI Assistants

1. **`CI_MODE` env var** — must be `"true"` for mock ML. Tests set it. Never use real inference in CI.
2. **Import pattern** — `app.py` uses relative imports with absolute fallback. Tests from root rely on `__init__.py` for relative imports. The `testcase/` dir also has `__init__.py` for discovery.
3. **Hardcoded JWT secret** — in `auth.py`. Fine for offline/local use, but must be externalized for production.
4. **`backend/__init__.py` exists** — this makes `backend` a Python package. This is why `from backend.app import app` works in tests.
5. **No `.env` file** — configuration is env-var-only (`CI_MODE`, `PORT`). No dotenv.
6. **CSS is all custom** — no Tailwind, no component library. Design system lives in `index.css` variables.
7. **App.jsx is a single 1276-line file** — no component splitting. All state is at the top level.
8. **No React Router** — tab navigation via `activeTab` state + conditional rendering.
9. **Docker bakes models** — `download_models.py` runs during build so the image is fully offline.
10. **Test discovery requires `__init__.py`** — both `testcase/` and `testcase/backend/` have them. Don't remove.
11. **`pytest || true`** in some CI workflows — tests can fail without blocking the pipeline.
12. **`catch (e)` blocks** — many unused error variables. Use optional catch binding (`catch {`).
13. **`React` import** — NOT needed with React 19's automatic JSX transform.
14. **`FFmpeg` is required** — for audio extraction, subtitle burning, and audio overlay operations.

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `CI_MODE` | Mock ML inference for testing | unset |
| `PORT` | Docker container port | 7860 |

---

## Language & Model Support

| Language | Whisper Code | NLLB Code | MMS-TTS Model |
|----------|-------------|-----------|---------------|
| English | `en` | `eng_Latn` | `facebook/mms-tts-eng` |
| Hindi | `hi` | `hin_Deva` | `facebook/mms-tts-hin` |
| Marathi | `mr` | `mar_Deva` | `facebook/mms-tts-mar` |

Whisper sizes: `tiny`, `base`. Language auto-detection via `langdetect` library. Source language `"auto"` passes `None` to Whisper for automatic detection.

---

## Offline Setup

```bash
# Pre-download all models
python backend/download_models.py --output ./backend/models

# Or use Docker (bakes models into image)
docker build -t baif .
docker run -p 7860:7860 baif
```

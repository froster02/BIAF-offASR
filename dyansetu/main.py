"""Dyansetu — offline, CPU-only translation & transcription server.

Zero outbound network calls at runtime: every model load below resolves to a
local path under core.config.MODELS_DIR. CORS is locked to localhost by
default (override via DYANSETU_ALLOWED_ORIGINS) — unlike the existing
backend/app.py, which allows '*' with credentials=True (flagged in the prior
security audit); this rebuild does not repeat that.
"""
import logging
import os
import shutil
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("dyansetu")

from core import config  # noqa: E402
from api.routes import router  # noqa: E402


def _clean_temp_folder():
    if os.path.exists(config.TEMP_DIR):
        shutil.rmtree(config.TEMP_DIR)
    os.makedirs(config.TEMP_DIR, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Dyansetu starting up (ci_mode=%s, ram_ceiling_mb=%d)...", config.CI_MODE, config.RAM_CEILING_MB)
    _clean_temp_folder()
    yield
    logger.info("Dyansetu shutting down.")


app = FastAPI(title="Dyansetu Offline Translation API", version="1.0.0", lifespan=lifespan)

_allowed_origins = os.environ.get("DYANSETU_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(router)

_frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(_frontend_dist):
    logger.info("Mounting frontend build at / from %s", _frontend_dist)
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="static")
else:
    logger.warning("Frontend build not found at %s — API-only mode.", _frontend_dist)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    logger.info("Starting Dyansetu on port %d...", port)
    uvicorn.run(app, host="127.0.0.1", port=port)

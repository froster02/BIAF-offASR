"""Central runtime configuration for Dyansetu.

Single source of truth for paths, thread limits, and the RAM ceiling the
batch-verification pass (see tests/test_batch_verification.py) checks against.
Values here are tuned for the target machine: Windows 11, Intel i5 11th Gen
(4C/8T), 16GB RAM, no GPU.
"""
import os
import multiprocessing

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DYANSETU_ROOT = os.path.dirname(BASE_DIR)

MODELS_DIR = os.environ.get("DYANSETU_MODELS_DIR", os.path.join(DYANSETU_ROOT, "models"))
TEMP_DIR = os.environ.get("DYANSETU_TEMP_DIR", os.path.join(DYANSETU_ROOT, "temp"))

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# Hard RAM ceiling for the whole process tree, enforced by tests/test_batch_verification.py.
# Leaves ~9GB clear of the 16GB box for OS + document buffers, per the brief's 6-8GB target.
RAM_CEILING_MB = int(os.environ.get("DYANSETU_RAM_CEILING_MB", 7168))

# CPU thread budget. i5-11th-gen mobile/desktop parts are 4C/8T; leave 1 logical core
# free for the OS/UI so transcription/translation don't stall foreground interaction.
_PHYSICAL_LIKE_THREADS = max(1, (multiprocessing.cpu_count() or 4) - 1)
CT2_INTRA_THREADS = int(os.environ.get("DYANSETU_CT2_THREADS", _PHYSICAL_LIKE_THREADS))
WHISPER_CPU_THREADS = int(os.environ.get("DYANSETU_WHISPER_THREADS", _PHYSICAL_LIKE_THREADS))

# CI/dev mode: short-circuits every heavy model load with deterministic mocks so the
# API surface and request/response contracts can be exercised without the multi-GB
# model downloads this environment cannot perform (see Sprint verification notes).
CI_MODE = os.environ.get("DYANSETU_CI_MODE", "false").lower() == "true"

SUPPORTED_LANGUAGES = ("English", "Hindi", "Marathi")

# NOTE (unverified in this dev environment — macOS, no target hardware access):
# RAM_CEILING_MB is a policy value, not a measured one. It must be re-validated with
# Windows Task Manager / Resource Monitor on the actual i5-11th-gen target while running
# tests/test_batch_verification.py's concurrent load scenario before this is trusted.

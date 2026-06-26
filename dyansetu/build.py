"""PyInstaller build driver for an offline, air-gapped Windows distribution.

UNVERIFIED in this sandbox: this is generated on macOS and has never been run
through PyInstaller on Windows. oneMKL/CTranslate2/onnxruntime native
dependency bundling is exactly the kind of thing that looks right on paper and
needs a real Windows build-and-launch cycle to confirm — treat every path
below as a starting point to debug against, not a guarantee.

Usage (on the Windows build machine, inside the project venv):
    python build.py
"""
import os
import platform
import subprocess
import sys

DYANSETU_ROOT = os.path.dirname(os.path.abspath(__file__))
DIST_NAME = "Dyansetu"


def build():
    if platform.system() != "Windows":
        print(
            "WARNING: build.py is meant to run on the Windows 11 target build machine "
            "(oneMKL/CTranslate2 binaries are platform-specific). Continuing anyway since "
            "this may be a dry-run / CI smoke test.",
            file=sys.stderr,
        )

    # The whole models/ tree (model_config.json, regional_vocab.txt, and once
    # populated, the CTranslate2 INT8 binaries, ONNX correction model, PaddleOCR
    # weights, and lid.176.ftz) is bulk data, not a Python package — bundle it as
    # one tree rather than enumerating files. Verify on the build machine that
    # this glob matches what scripts/convert_indictrans2_ct2.py and
    # scripts/export_correction_model_onnx.py actually produced.
    added_data = []
    models_dir = os.path.join(DYANSETU_ROOT, "models")
    if os.path.isdir(models_dir):
        added_data.append((models_dir, "models"))

    # ctranslate2 ships its own compiled extension + bundled oneMKL/oneDNN shared
    # libraries; PyInstaller's static analysis frequently misses these because
    # they're loaded via ctypes/dlopen rather than a plain `import`, hence the
    # explicit --collect-all below rather than trusting --hidden-import alone.
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", DIST_NAME,
        "--onedir",
        "--noconfirm",
        "--collect-all", "ctranslate2",
        "--collect-all", "onnxruntime",
        "--collect-all", "faster_whisper",
        "--collect-all", "paddleocr",
        "--collect-all", "indicnlp",
        "--collect-all", "fasttext",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "uvicorn.protocols.http.auto",
    ]
    for src, dest in added_data:
        sep = ";" if platform.system() == "Windows" else ":"
        cmd += ["--add-data", f"{src}{sep}{dest}"]

    cmd.append(os.path.join(DYANSETU_ROOT, "main.py"))

    print("Running:", " ".join(cmd))
    result = subprocess.run(cmd, cwd=DYANSETU_ROOT)
    if result.returncode != 0:
        raise SystemExit(result.returncode)

    print(
        f"\nBuild output: {os.path.join(DYANSETU_ROOT, 'dist', DIST_NAME)}\n"
        "Next steps (must be done on the target machine, unverified here):\n"
        "  1. Launch the built .exe and confirm it serves /health on 127.0.0.1.\n"
        "  2. Run a real (non-CI_MODE) request through each endpoint with Task "
        "Manager open, watching working-set memory against the 7GB ceiling.\n"
        "  3. Confirm ffmpeg.exe is present on PATH or vendored alongside the bundle — "
        "it is invoked via subprocess and is NOT a Python dependency PyInstaller can bundle."
    )


if __name__ == "__main__":
    build()

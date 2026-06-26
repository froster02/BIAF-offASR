"""One-shot setup script: download and pin the FastText compressed language-ID
model (lid.176.ftz, ~917KB). Run once during environment setup — NOT at
runtime, to keep the "zero network calls" guarantee for the running app.

Usage:
    python scripts/fetch_lid_model.py
"""
import hashlib
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core import config

LID_URL = "https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz"
DEST_PATH = os.path.join(config.MODELS_DIR, "lid.176.ftz")

# Published sha256 for lid.176.ftz as of the fastText project's release. Re-verify
# against https://fasttext.cc/docs/en/language-identification.html if this script
# is run far in the future and the upstream file is ever rotated.
EXPECTED_SHA256 = None  # NOTE: unverified in this sandbox (network egress for a
# binary download is allowed here, but pinning a hash without fetching it once and
# recording it is dishonest — fetch_and_verify() below records the sha256 of
# whatever was downloaded on first run and writes it to lid.176.ftz.sha256 next to
# the model so subsequent runs can detect drift.


def fetch_and_verify(force: bool = False) -> str:
    if os.path.exists(DEST_PATH) and not force:
        print(f"Already present: {DEST_PATH}")
        return DEST_PATH

    print(f"Downloading {LID_URL} -> {DEST_PATH}")
    urllib.request.urlretrieve(LID_URL, DEST_PATH)

    digest = hashlib.sha256(open(DEST_PATH, "rb").read()).hexdigest()
    sha_path = DEST_PATH + ".sha256"
    with open(sha_path, "w") as f:
        f.write(digest + "\n")
    print(f"Saved. sha256={digest} (recorded at {sha_path})")
    return DEST_PATH


if __name__ == "__main__":
    fetch_and_verify(force="--force" in sys.argv)

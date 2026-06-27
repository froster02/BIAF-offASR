"""Convert AI4Bharat IndicTrans2 distilled checkpoints to CTranslate2 INT8.

UNVERIFIED in this sandbox: exact HuggingFace repo IDs for the distilled
checkpoints are unconfirmed here (no network model pull was performed — see
models/model_config.json's "verified": false flags). Confirm the correct repo
IDs on AI4Bharat's model hub before running this for real; the IDs below are
this script's best-effort placeholders, not a guarantee.

IndicTrans2 ships in HF transformers format with a custom
`IndicTransForConditionalGeneration` architecture class (not plain
MarianMT/M2M100), so ctranslate2's generic `TransformersConverter` may need
the `--copy_files` / custom mapping flags, or a model-specific converter, if
the stock converter doesn't recognize the arch out of the box. Run this on a
machine with network + ~6GB free disk for the HF download + CT2 output, then
copy only the `models/indictrans2-*-ct2-int8/` output directories to the
target Windows box — do NOT ship the original HF checkpoint, it's the thing
we're quantizing away from.

Usage:
    python scripts/convert_indictrans2_ct2.py --variant en-indic
    python scripts/convert_indictrans2_ct2.py --variant indic-indic
"""
import argparse
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core import config

SOURCE_MODEL_BY_VARIANT = {
    "en-indic": "ai4bharat/indictrans2-en-indic-dist-200M",
    "indic-indic": "ai4bharat/indictrans2-indic-indic-dist-320M",
}


def convert(variant: str, force: bool = False):
    if variant not in SOURCE_MODEL_BY_VARIANT:
        raise ValueError(f"Unknown variant '{variant}', expected one of {list(SOURCE_MODEL_BY_VARIANT)}")

    source_model = SOURCE_MODEL_BY_VARIANT[variant]
    output_dir = os.path.join(config.MODELS_DIR, f"indictrans2-{variant}-ct2-int8")

    if os.path.isdir(output_dir) and not force:
        print(f"Already converted: {output_dir} (pass --force to redo)")
        return output_dir

    cmd = [
        "ct2-transformers-converter",
        "--model", source_model,
        "--output_dir", output_dir,
        "--quantization", "int8",
        "--force",
    ]
    print("Running:", " ".join(cmd))
    result = subprocess.run(cmd)
    if result.returncode != 0:
        raise RuntimeError(
            f"ct2-transformers-converter failed (exit {result.returncode}) for {source_model}. "
            f"If this is an 'unrecognized architecture' error, IndicTrans2's custom model class "
            f"needs a model-specific converter — check AI4Bharat's repo for an official CT2 export "
            f"recipe before assuming the generic TransformersConverter applies."
        )

    # Tokenizer files are needed at inference time (services/translation.py loads them
    # via AutoTokenizer from this same directory) but ct2-transformers-converter only
    # writes the CT2 model binary — fetch the tokenizer alongside it.
    from transformers import AutoTokenizer
    tokenizer = AutoTokenizer.from_pretrained(source_model)
    tokenizer.save_pretrained(output_dir)

    print(f"Converted {source_model} -> {output_dir}")
    return output_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", required=True, choices=list(SOURCE_MODEL_BY_VARIANT))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    convert(args.variant, force=args.force)

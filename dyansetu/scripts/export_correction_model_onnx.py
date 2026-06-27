"""Export the post-ASR correction seq2seq model to ONNX so the production
runtime (core/model_manager.py get_correction_model) never needs torch.

Run this on a workstation with `optimum[exporters]` and `torch` installed
(see requirements-dev.txt, NOT requirements.txt) — torch is a build-time tool
here, not a production dependency.

UNVERIFIED: defaults to base google/mt5-small. Swap --model to a Hindi/Marathi
ASR-correction fine-tune once one is trained on (noisy hypothesis, clean
reference) pairs — base mT5-small has no task-specific correction ability and
should not be assumed to behave well in services/post_asr_correction.py until
that fine-tuning step happens.

Usage:
    python scripts/export_correction_model_onnx.py --model google/mt5-small
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core import config


def export(model_id: str, force: bool = False):
    output_dir = os.path.join(config.MODELS_DIR, "post-asr-correction-onnx")
    if os.path.isdir(output_dir) and not force:
        print(f"Already exported: {output_dir} (pass --force to redo)")
        return output_dir

    from optimum.onnxruntime import ORTModelForSeq2SeqLM
    from transformers import AutoTokenizer

    print(f"Exporting {model_id} -> ONNX at {output_dir}")
    model = ORTModelForSeq2SeqLM.from_pretrained(model_id, export=True)
    tokenizer = AutoTokenizer.from_pretrained(model_id)

    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"Exported {model_id} -> {output_dir}")
    return output_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="google/mt5-small")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    export(args.model, force=args.force)

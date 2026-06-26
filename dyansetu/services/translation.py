"""IndicTrans2-Dist / IndicTrans2-Dist-M2M translation via CTranslate2 (INT8).

Routing: English<->{Hindi,Marathi} goes through the en-indic distilled model;
Marathi<->Hindi (direct inter-Indic, no English pivot) goes through the
indic-indic (M2M) distilled model. Same FLORES-200-style language codes the
existing transformers/NLLB backend already uses (backend/models.py
NLLB_LANG_CODES) — reused here rather than inventing a parallel convention.

UNVERIFIED in this sandbox: IndicTrans2's exact tokenizer/tagging convention
(language-tag placement, whether it needs IndicTransToolkit's script
transliteration preprocessing step) could not be confirmed against a live
checkpoint here (no network model pull was performed, per the agreed
scaffold-only scope). The language-tag-prefix scheme below mirrors NLLB/M2M100
convention and is the most likely correct shape, but MUST be validated against
the actual converted CT2 model's expected input before trusting output quality.
"""
import logging

from services import normalize, dnt_masking

logger = logging.getLogger("dyansetu.translation")

LANG_CODES = {
    "Marathi": "mar_Deva",
    "Hindi": "hin_Deva",
    "English": "eng_Latn",
}

_tokenizer_cache = {}


def _variant_for(src_lang: str, tgt_lang: str) -> str:
    return "en-indic" if "English" in (src_lang, tgt_lang) else "indic-indic"


def _get_tokenizer(model_manager, variant: str):
    if variant in _tokenizer_cache:
        return _tokenizer_cache[variant]
    from transformers import AutoTokenizer
    import os
    tokenizer_dir = os.path.join(model_manager.models_dir, f"indictrans2-{variant}-ct2-int8")
    tok = AutoTokenizer.from_pretrained(tokenizer_dir)
    _tokenizer_cache[variant] = tok
    return tok


def translate(model_manager, text: str, src_lang: str, tgt_lang: str) -> str:
    if not text.strip():
        return ""
    if src_lang == tgt_lang:
        return text

    src_code = LANG_CODES.get(src_lang)
    tgt_code = LANG_CODES.get(tgt_lang)
    if not src_code or not tgt_code:
        raise ValueError(f"Unsupported translation languages: {src_lang} -> {tgt_lang}")

    if model_manager.ci_mode:
        return f"[CI MOCK] {tgt_lang}: {text}"

    variant = _variant_for(src_lang, tgt_lang)
    translator = model_manager.get_translator(variant)
    tokenizer = _get_tokenizer(model_manager, variant)

    preprocessed = normalize.preprocess(text, src_lang)
    masked_text, spans = dnt_masking.mask(preprocessed)

    source_tokens = [src_code] + tokenizer.tokenize(masked_text)
    target_prefix = [[tgt_code]]

    results = translator.translate_batch(
        [source_tokens],
        target_prefix=target_prefix,
        beam_size=4,
        no_repeat_ngram_size=3,
        max_decoding_length=256,
    )
    output_tokens = results[0].hypotheses[0][1:]  # drop the leading tgt-lang tag we forced
    translated = tokenizer.convert_tokens_to_string(output_tokens)
    return dnt_masking.unmask(translated, spans)


def translate_batch(model_manager, texts: list, src_lang: str, tgt_lang: str) -> list:
    if not texts:
        return []
    if model_manager.ci_mode:
        return [f"[CI MOCK] {tgt_lang}: {t}" if t.strip() else t for t in texts]
    if src_lang == tgt_lang:
        return list(texts)

    non_empty_indices = [i for i, t in enumerate(texts) if t.strip()]
    if not non_empty_indices:
        return list(texts)

    src_code = LANG_CODES.get(src_lang)
    tgt_code = LANG_CODES.get(tgt_lang)
    if not src_code or not tgt_code:
        raise ValueError(f"Unsupported translation languages: {src_lang} -> {tgt_lang}")

    variant = _variant_for(src_lang, tgt_lang)
    translator = model_manager.get_translator(variant)
    tokenizer = _get_tokenizer(model_manager, variant)

    masked_list = []
    spans_list = []
    source_batches = []
    for i in non_empty_indices:
        preprocessed = normalize.preprocess(texts[i], src_lang)
        masked_text, spans = dnt_masking.mask(preprocessed)
        masked_list.append(masked_text)
        spans_list.append(spans)
        source_batches.append([src_code] + tokenizer.tokenize(masked_text))

    results = translator.translate_batch(
        source_batches,
        target_prefix=[[tgt_code]] * len(source_batches),
        beam_size=4,
        no_repeat_ngram_size=3,
        max_decoding_length=256,
    )

    out = list(texts)
    for pos, i in enumerate(non_empty_indices):
        output_tokens = results[pos].hypotheses[0][1:]
        translated = tokenizer.convert_tokens_to_string(output_tokens)
        out[i] = dnt_masking.unmask(translated, spans_list[pos])
    return out

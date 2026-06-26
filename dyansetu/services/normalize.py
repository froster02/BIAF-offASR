"""Text normalization: Unicode NFC normalization followed by indicnlp's
rule-based Devanagari script unification (nukta forms, candrabindu variants,
visually-equivalent codepoint sequences) so Marathi and Hindi text reach the
translation engine in one canonical representation rather than several
Unicode-equivalent-but-byte-different forms.
"""
import logging
import unicodedata

logger = logging.getLogger("dyansetu.normalize")

_normalizer_cache = {}


def nfc_normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def _get_indic_normalizer(lang_code: str):
    """lang_code: indicnlp 2-letter code, 'hi' or 'mr'."""
    if lang_code in _normalizer_cache:
        return _normalizer_cache[lang_code]
    from indicnlp.normalize.indic_normalize import IndicNormalizerFactory
    normalizer = IndicNormalizerFactory().get_normalizer(lang_code)
    _normalizer_cache[lang_code] = normalizer
    return normalizer


_LANG_NAME_TO_INDIC_CODE = {"Hindi": "hi", "Marathi": "mr"}


def unify_script(text: str, language: str) -> str:
    """Project Marathi/Hindi text into indicnlp's canonical Devanagari form.
    No-op for English or unrecognized languages."""
    text = nfc_normalize(text)
    indic_code = _LANG_NAME_TO_INDIC_CODE.get(language)
    if not indic_code:
        return text
    try:
        normalizer = _get_indic_normalizer(indic_code)
        return normalizer.normalize(text)
    except Exception as e:
        logger.warning("indicnlp normalization failed for lang=%s: %s — returning NFC-only text", language, e)
        return text


def preprocess(text: str, language: str) -> str:
    """Single entry point used by services.translation before tokenization."""
    return unify_script(text, language)

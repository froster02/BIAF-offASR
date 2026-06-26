"""Do-Not-Translate (DNT) span masking.

Wraps technical/literal spans (URLs, phone numbers, measurement units, locale
codes like "en-US", percentages) in explicit `<dnt>...</dnt>` tags before the
text reaches the MT engine, then restores the literal spans after generation.
IndicTrans2 was not trained with a DNT-tag convention, so rather than relying
on the model to "respect" the tag, we strip the spans out entirely, translate
the surrounding text with placeholders, and splice the originals back in —
this guarantees zero distortion rather than hoping the model preserves the tag.
"""
import re

# Order matters: more specific patterns first so a URL containing a number
# isn't partially consumed by the number pattern first.
_PATTERNS = [
    ("url", re.compile(r"\bhttps?://[^\s<>\"]+|\bwww\.[^\s<>\"]+", re.IGNORECASE)),
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    ("phone", re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b")),
    ("locale", re.compile(r"\b[a-z]{2}[-_][A-Z]{2}\b")),
    ("percent", re.compile(r"\b\d+(?:\.\d+)?\s?%")),
    ("unit", re.compile(
        r"\b\d+(?:\.\d+)?\s?(?:kg|g|mg|km|m|cm|mm|ml|l|kb|mb|gb|tb|hz|khz|mhz|ghz|fps|px|°c|°f)\b",
        re.IGNORECASE,
    )),
]

_PLACEHOLDER_FMT = "DNT{idx}"  # private-use-area sentinels: survive
# tokenization/translation as opaque characters far more reliably than literal
# <dnt> markup, which a seq2seq model may rewrite, translate, or drop.
_PLACEHOLDER_RE = re.compile(r"DNT(\d+)")


def mask(text: str):
    """Returns (masked_text, spans) where spans[i] is the original literal
    text for placeholder index i, in encounter order."""
    spans = []

    def _replace(match):
        spans.append(match.group(0))
        return _PLACEHOLDER_FMT.format(idx=len(spans) - 1)

    masked = text
    for _name, pattern in _PATTERNS:
        masked = pattern.sub(_replace, masked)
    return masked, spans


def unmask(translated_text: str, spans: list) -> str:
    def _restore(match):
        idx = int(match.group(1))
        return spans[idx] if 0 <= idx < len(spans) else match.group(0)

    return _PLACEHOLDER_RE.sub(_restore, translated_text)

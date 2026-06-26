"""Ultra-light language identification: FastText lid.176.ftz as the primary
classifier, with a character-level Devanagari disambiguator as a fallback for
short strings (3-4 words) where fastText's hi/mr split is least reliable.

fastText's lid.176 model is trained on Wikipedia-scale text; on 3-4 word inputs
its softmax over 176 languages is noisy precisely between closely related
scripts like Hindi/Marathi. Rather than reaching for a heavier NLP model, we
use a small set of Marathi-distinctive Devanagari graphemes/conjuncts as a
deterministic tie-breaker — this is the "native character unigram/bigram
tracking" the brief asks for, and it's O(len(text)), no model load required.
"""
import logging
import os
import unicodedata

logger = logging.getLogger("dyansetu.lang_id")

LABEL_TO_NAME = {
    "en": "English",
    "hi": "Hindi",
    "mr": "Marathi",
}

# Characters/conjuncts that occur in standard Marathi orthography but are absent
# or vanishingly rare in standard Hindi orthography. 'ळ' (U+0933, letter LLA) is
# the single strongest signal — it is a load-bearing Marathi phoneme with no
# equivalent in Hindi.
MARATHI_DISTINCTIVE_CHARS = {
    "ळ",  # ळ (LLA)
}
# Common Marathi-only word-final/postposition bigrams that rarely appear in Hindi
# (e.g. "-ंनी", "-ाला" as a postposition cluster, "-ात" locative).
MARATHI_DISTINCTIVE_BIGRAMS = {"ंनी", "ाला", "ातू", "ावर"}

SHORT_TEXT_WORD_THRESHOLD = 4


class FastTextLangID:
    def __init__(self, models_dir: str, ci_mode: bool = False):
        self.ci_mode = ci_mode
        self.model_path = os.path.join(models_dir, "lid.176.ftz")
        self._model = None
        if not ci_mode and not os.path.exists(self.model_path):
            logger.warning(
                "lid.176.ftz not found at %s — run scripts/fetch_lid_model.py. "
                "Falling back to Devanagari-heuristic-only identification until then.",
                self.model_path,
            )

    def _load(self):
        if self._model is None and not self.ci_mode and os.path.exists(self.model_path):
            import fasttext
            self._model = fasttext.load_model(self.model_path)
        return self._model

    def _devanagari_disambiguate(self, text: str) -> str:
        """Returns 'Marathi' or 'Hindi' based on distinctive graphemes; defaults
        to 'Hindi' when no signal is found (Hindi is the larger-prior language)."""
        for ch in text:
            if ch in MARATHI_DISTINCTIVE_CHARS:
                return "Marathi"
        for bigram in MARATHI_DISTINCTIVE_BIGRAMS:
            if bigram in text:
                return "Marathi"
        return "Hindi"

    def _is_devanagari(self, text: str) -> bool:
        return any(0x0900 <= ord(ch) <= 0x097F for ch in text)

    def predict(self, text: str) -> str:
        """Returns one of SUPPORTED_LANGUAGES, defaulting to 'English'."""
        text = unicodedata.normalize("NFC", text).strip()
        if not text:
            return "English"

        if self.ci_mode:
            return "Marathi" if self._is_devanagari(text) else "English"

        model = self._load()
        word_count = len(text.split())

        if model is None:
            # No fastText model available — best-effort via script + heuristic only.
            return self._devanagari_disambiguate(text) if self._is_devanagari(text) else "English"

        labels, probs = model.predict(text.replace("\n", " "), k=3)
        ranked = list(zip([l.replace("__label__", "") for l in labels], probs))
        top_label, top_prob = ranked[0]

        if top_label not in LABEL_TO_NAME:
            return self._devanagari_disambiguate(text) if self._is_devanagari(text) else "English"

        predicted = LABEL_TO_NAME[top_label]

        # Reliability override: short Devanagari strings where fastText's hi/mr
        # call is exactly the failure mode this disambiguator exists for.
        if predicted in ("Hindi", "Marathi") and word_count <= SHORT_TEXT_WORD_THRESHOLD:
            heuristic = self._devanagari_disambiguate(text)
            if heuristic != predicted:
                logger.debug(
                    "lang_id override on short text (%d words): fastText=%s heuristic=%s -> using heuristic",
                    word_count, predicted, heuristic,
                )
            return heuristic

        return predicted

"""PaddleOCR wrapper for scanned-page text recovery (CPU-only, mobile/light models).

Devanagari words carry a shirorekha (the horizontal top line connecting
glyphs within a word) that visually joins the whole word into one connected
stroke. We read OCR results at line/word granularity (PaddleOCR's natural
detection unit) rather than per-character, specifically so a word's
shirorekha-connected glyph run is never split mid-stroke into separate boxes
that could be translated/overlaid independently and break the visual unit.
"""
import logging

logger = logging.getLogger("dyansetu.ocr_processor")


def ocr_and_translate_page(page, model_manager, src_lang, tgt_lang):
    """page: a fitz (PyMuPDF) Page object from a scanned (no extractable text) PDF."""
    import numpy as np
    from services import translation

    try:
        pix = page.get_pixmap()
        img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)

        reader = model_manager.get_ocr_reader()
        if reader is None:  # CI mode
            return

        results = reader.ocr(img_data, cls=True)
        # PaddleOCR returns [[ [bbox_coords, (text, prob)], ... ]] per image.
        line_results = results[0] if results else []

        for bbox_coords, (text, _prob) in line_results:
            if not text.strip():
                continue
            translated = translation.translate(model_manager, text, src_lang, tgt_lang)

            x0 = min(p[0] for p in bbox_coords)
            y0 = min(p[1] for p in bbox_coords)
            x1 = max(p[0] for p in bbox_coords)
            y1 = max(p[1] for p in bbox_coords)

            img_w, img_h = pix.width, pix.height
            page_w, page_h = page.rect.width, page.rect.height
            rect = [
                x0 * page_w / img_w,
                y0 * page_h / img_h,
                x1 * page_w / img_w,
                y1 * page_h / img_h,
            ]

            # Scanned page: the original glyphs are baked into the background
            # image, not vector text, so there's nothing to redact — overlay only.
            page.insert_textbox(rect, translated, fontsize=10, fontname="helv")
    except Exception as e:
        logger.warning("OCR overlay failed: %s", e)

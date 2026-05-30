# Design Spec: High-Fidelity Document Translation Preservation

**Date:** 2026-05-30  
**Status:** Draft  
**Goal:** Improve offline translation of DOCX, PPTX, XLSX, and PDF files by preserving exact formatting, styles, images, and layout.

## 1. Problem Statement
Current document translation logic replaces text at the "run" or "cell" level without regard for layout or styling. This leads to:
- Broken PDF layouts (text just appended to new pages).
- Loss of images and vectors in PDFs.
- Fragmented styling in DOCX/PPTX when a word with specific formatting is translated into a phrase.
- Unstyled Excel outputs.

## 2. Proposed Architecture

### 2.1 DOCX & PPTX: Paragraph-Level Re-distribution
Instead of iterating through fine-grained `runs`, the system will:
1.  **Extract**: Join all `run.text` in a `paragraph` into a single string.
2.  **Translate**: Send the full paragraph to the NLLB-200 model for better context.
3.  **Map**: Use a redistribution algorithm:
    - If a paragraph has only one style, replace the first run's text with the full translation and clear subsequent runs.
    - If it has multiple styles, the system will attempt to distribute the translated text proportionally or anchor styles to the original word positions (best effort).
4.  **Preservation**: Since we only modify `run.text`, all images, headers, footers, and shapes anchored to the paragraph are preserved.

### 2.2 PDF: Coordinate-Based Redaction & Overlay
Move from "Extract and Re-create" to "In-Place Modification":
1.  **Iterate**: Use PyMuPDF's `page.get_text("dict")` to find every text span's exact coordinates (`bbox`).
2.  **Translate**: Translate the text found in each `bbox`.
3.  **Redact**: Apply `page.add_redact_annot(bbox, fill=(1,1,1))` to digitally "white out" the original text.
4.  **Overlay**: Use `page.insert_textbox(bbox, translated_text, fontname="helv", fontsize=original_size)`.
5.  **Media**: Images and graphics outside the text `bbox` are untouched, ensuring 100% image retention.

### 2.3 XLSX: Style Cloning
1.  **Read**: Load the workbook with `openpyxl`.
2.  **Clone**: For every translated cell, copy the following properties from the source cell to the target:
    - `font` (size, bold, color, name).
    - `fill` (background color).
    - `border`.
    - `alignment` (center, wrap text).
    - `number_format`.

### 2.4 OCR: Coordinate-Aware Scanned PDF Translation
For scanned PDFs where `page.get_text()` returns nothing:
1.  **Extract**: Use `EasyOCR` to detect text regions and return both text and their `bbox` (bounding boxes).
2.  **Translate**: Translate the detected text per region.
3.  **Overlay**: Insert the translated text into the original `bbox` coordinates.
4.  **Preservation**: The original scanned image remains as the background, while translated text is layered on top, maintaining the visual structure of the scanned document.

## 3. Data Flow
1.  **Upload**: User uploads file via `/api/translate-document`.
2.  **Job Creation**: Job Manager creates a `document_translation` job.
3.  **Processing**: `document_utils.py` runs the format-aware logic.
4.  **Storage**: Translated file is saved in the session's temp folder.
5.  **Completion**: Frontend polls and receives the download URL.

## 4. Error Handling
- **Font Availability**: If a specific regional font isn't available for PDF overlay, fallback to a standard Unicode-capable font (e.g., Noto Sans).
- **Text Overflow**: If translated text is significantly longer than original text in PDF/PPTX, use "shrink to fit" logic for the font size.

## 5. Success Criteria
- [ ] PDFs retain all original images and background graphics.
- [ ] Word documents retain bold/italic/underline properties in translated text.
- [ ] Excel documents retain cell colors and borders.
- [ ] PowerPoint slides keep all shapes and text-box positioning.

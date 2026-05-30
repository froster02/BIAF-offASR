# High-Fidelity Document Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement high-fidelity, format-preserving translation for DOCX, PPTX, XLSX, and PDF (including scanned PDFs with coordinate-aware OCR).

**Architecture:** 
- **DOCX/PPTX**: Paragraph-level translation with redistribution across runs.
- **PDF**: Coordinate-based redaction and overlay using PyMuPDF.
- **OCR**: Coordinate-aware text detection and overlay for scanned pages.
- **XLSX**: Deep style cloning using `openpyxl`.

**Tech Stack:** `python-docx`, `python-pptx`, `pymupdf`, `openpyxl`, `easyocr`, `numpy`.

---

### Task 1: Improved XLSX Style Preservation

**Files:**
- Modify: `backend/document_utils.py`

- [ ] **Step 1: Implement deep style cloning in `translate_xlsx`**

```python
def translate_xlsx(input_path, output_path, model_manager, src_lang, tgt_lang):
    from copy import copy
    wb = load_workbook(input_path)
    texts_to_translate = []
    cell_refs = [] 
    
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        for row in ws.iter_rows():
            for cell in row:
                if cell.value and isinstance(cell.value, str) and cell.value.strip():
                    texts_to_translate.append(cell.value)
                    cell_refs.append((sheet_name, cell.coordinate))

    if not texts_to_translate:
        wb.save(output_path)
        return output_path

    translated_texts = model_manager.translate_batch(texts_to_translate, src_lang, tgt_lang)
    
    for i, (sheet_name, coord) in enumerate(cell_refs):
        ws = wb[sheet_name]
        cell = ws[coord]
        original_style = {
            "font": copy(cell.font),
            "fill": copy(cell.fill),
            "border": copy(cell.border),
            "alignment": copy(cell.alignment),
            "number_format": cell.number_format,
            "protection": copy(cell.protection)
        }
        cell.value = translated_texts[i]
        cell.font = original_style["font"]
        cell.fill = original_style["fill"]
        cell.border = original_style["border"]
        cell.alignment = original_style["alignment"]
        cell.number_format = original_style["number_format"]
        cell.protection = original_style["protection"]
        
    wb.save(output_path)
    return output_path
```

- [ ] **Step 2: Commit changes**

```bash
git add backend/document_utils.py
git commit -m "feat(docs): add deep style cloning for Excel translation"
```

---

### Task 2: High-Fidelity PDF Translation (Redaction & Overlay)

**Files:**
- Modify: `backend/document_utils.py`

- [ ] **Step 1: Rewrite `translate_pdf` to use redaction and coordinate-aware insertion**

```python
def translate_pdf(input_path, output_path, model_manager, src_lang, tgt_lang):
    import fitz
    doc = fitz.open(input_path)
    
    for page in doc:
        # Get text blocks with coordinates
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:
            if "lines" in b:
                for l in b["lines"]:
                    for s in l["spans"]:
                        original_text = s["text"]
                        if original_text.strip():
                            translated = model_manager.translate(original_text, src_lang, tgt_lang)
                            bbox = s["bbox"] # (x0, y0, x1, y1)
                            
                            # Redact original text
                            page.add_redact_annot(bbox, fill=(1, 1, 1))
                            page.apply_redactions()
                            
                            # Insert translated text
                            # Try to match font size, default to a unicode font if needed
                            fontsize = s["size"]
                            page.insert_textbox(bbox, translated, fontsize=fontsize, fontname="helv", align=0)
                            
    doc.save(output_path)
    doc.close()
    return output_path
```

- [ ] **Step 2: Commit changes**

```bash
git add backend/document_utils.py
git commit -m "feat(docs): implement coordinate-based redaction and overlay for PDF"
```

---

### Task 3: Coordinate-Aware OCR for Scanned PDFs

**Files:**
- Modify: `backend/document_utils.py`

- [ ] **Step 1: Implement `ocr_and_translate_page` helper**

```python
def ocr_and_translate_page(page, model_manager, src_lang, tgt_lang):
    import numpy as np
    pix = page.get_pixmap()
    img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
    
    reader = get_ocr_reader()
    results = reader.readtext(img_data) # returns [([coords], text, prob), ...]
    
    for (bbox_coords, text, prob) in results:
        if text.strip():
            translated = model_manager.translate(text, src_lang, tgt_lang)
            # Convert EasyOCR bbox to fitz Rect
            # EasyOCR bbox: [[x,y],[x,y],[x,y],[x,y]]
            x0 = min([p[0] for p in bbox_coords])
            y0 = min([p[1] for p in bbox_coords])
            x1 = max([p[0] for p in bbox_coords])
            y1 = max([p[1] for p in bbox_coords])
            
            # Map image coords to PDF page coords
            img_w, img_h = pix.width, pix.height
            page_w, page_h = page.rect.width, page.rect.height
            
            rect = [
                x0 * page_w / img_w,
                y0 * page_h / img_h,
                x1 * page_w / img_w,
                y1 * page_h / img_h
            ]
            
            # Since it's a scan, we don't redact (the image is the background)
            # Just overlay the text
            page.insert_textbox(rect, translated, fontsize=10, fontname="helv")
```

- [ ] **Step 2: Update `translate_pdf` to use the OCR helper**

```python
# Inside translate_pdf, check if text was found:
if not any("lines" in b for b in blocks):
    ocr_and_translate_page(page, model_manager, src_lang, tgt_lang)
```

- [ ] **Step 3: Commit changes**

```bash
git add backend/document_utils.py
git commit -m "feat(docs): add coordinate-aware OCR for scanned PDFs"
```

---

### Task 4: Paragraph-Level Redistribution for DOCX/PPTX

**Files:**
- Modify: `backend/document_utils.py`

- [ ] **Step 1: Implement robust `translate_docx` with paragraph joining**

```python
def translate_docx(input_path, output_path, model_manager, src_lang, tgt_lang):
    doc = Document(input_path)
    for para in doc.paragraphs:
        if para.text.strip():
            full_text = para.text
            translated = model_manager.translate(full_text, src_lang, tgt_lang)
            
            if len(para.runs) > 0:
                # Clear all runs and put translation in the first one to preserve style
                para.runs[0].text = translated
                for i in range(1, len(para.runs)):
                    para.runs[i].text = ""
    # Repeat similar logic for tables
    doc.save(output_path)
```

- [ ] **Step 2: Commit changes**

```bash
git add backend/document_utils.py
git commit -m "feat(docs): improve DOCX preservation via paragraph-level translation"
```

"""
pdf_extractor.py
Extracts text from UPANA course PDFs using PyMuPDF.

- Skips administrative pages (Descripción, Indicador de logro, etc.)
- Starts content extraction from the "CONTENIDOS CLASE" page
- Crops top ~18% of each page to exclude the UPANA logo/header image
- Extracts the course name from the UPANA running footer
  "FACULTAD DE … / COURSE NAME N" which appears at the bottom of each page
"""

import re
import fitz  # PyMuPDF
from dataclasses import dataclass
from typing import List, Optional

ADMIN_KEYWORDS = [
    "descripción",
    "indicador de logro",
    "indicadores de logro",
    "contenidos de aprendizaje",
    "fecha de entrega",
    "fecha:",
]

CONTENT_START_KEYWORDS = [
    "contenidos clase",
    "contenido de la clase",
    "contenidos de la clase",
]

CROP_TOP_RATIO = 0.18   # crop top 18% to remove UPANA logo image

# Words that stay lowercase in Spanish title-casing
_LOWERCASE_WORDS = {
    "a", "al", "con", "de", "del", "el", "en", "es", "la", "las",
    "lo", "los", "o", "para", "por", "que", "un", "una", "unos",
    "unas", "y", "e", "ni", "u",
}


def _smart_title(text: str) -> str:
    """Title-case respecting Spanish small words (first word always capitalised)."""
    words = text.lower().split()
    result = []
    for i, word in enumerate(words):
        if i == 0 or word not in _LOWERCASE_WORDS:
            result.append(word.capitalize())
        else:
            result.append(word)
    return " ".join(result)


@dataclass
class ExtractedPage:
    page_num: int   # 1-based
    text: str


def _strip_footer(text: str) -> str:
    """
    Remove UPANA running footer lines from extracted page text.

    The footer pattern is:  "FACULTAD DE … / COURSE NAME  N"
    Due to PDF block ordering it sometimes surfaces at the top of the
    extracted text rather than the bottom.
    """
    lines = text.splitlines()
    cleaned = [
        line for line in lines
        if not ("FACULTAD DE" in line.upper() and "/" in line)
    ]
    return "\n".join(cleaned).strip()


def _is_admin_page(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in ADMIN_KEYWORDS)


def _is_content_start(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in CONTENT_START_KEYWORDS)


def extract_course_name(pdf_path: str) -> Optional[str]:
    """
    Extract the official course name from the UPANA running footer.

    UPANA PDFs include a footer line like:
      "FACULTAD DE CIENCIAS DE LA EDUCACIÓN / DIDÁCTICA PARA LA ENSEÑANZA … N"
    where N is the page/session number.

    Returns a properly title-cased string, or None if not found.
    """
    doc = fitz.open(pdf_path)
    try:
        for page in doc:
            # Collect all spans, group by line y so we can join multi-span lines
            lines: dict[int, str] = {}
            for block in page.get_text("dict")["blocks"]:
                if "lines" not in block:
                    continue
                for line in block["lines"]:
                    y = round(line["bbox"][1])
                    text = " ".join(s["text"] for s in line["spans"]).strip()
                    if text:
                        lines[y] = (lines.get(y, "") + " " + text).strip()

            for text in lines.values():
                if "FACULTAD DE" not in text.upper() or "/" not in text:
                    continue
                # Extract the part after the last "/" (the course name)
                raw = text.split("/", 1)[1].strip()
                # Strip trailing session/page number like " 2" or " 12"
                raw = re.sub(r"\s+\d+\s*$", "", raw).strip()
                if raw:
                    return _smart_title(raw)
    finally:
        doc.close()
    return None


def extract_pages(pdf_path: str) -> List[ExtractedPage]:
    """
    Open the PDF and return a list of ExtractedPage objects,
    beginning from the 'CONTENIDOS CLASE' page (or the first
    non-administrative page if the marker isn't found).
    """
    doc = fitz.open(pdf_path)

    # Pass 1: collect full-page text to find the start index
    all_texts: List[str] = []
    for page in doc:
        all_texts.append(page.get_text("text").strip())

    start_idx = _find_content_start(all_texts)

    # Pass 2: extract cropped text from start_idx onwards
    pages: List[ExtractedPage] = []
    for i in range(start_idx, len(doc)):
        page = doc[i]
        rect = page.rect
        crop_y = rect.y0 + rect.height * CROP_TOP_RATIO
        clip = fitz.Rect(rect.x0, crop_y, rect.x1, rect.y1)

        text = page.get_text("text", clip=clip).strip()
        text = _strip_footer(text)
        if text:
            pages.append(ExtractedPage(page_num=i + 1, text=text))

    doc.close()
    return pages


def _find_content_start(texts: List[str]) -> int:
    """
    Find the index of the first content page.

    Priority:
    1. First page that contains a CONTENT_START_KEYWORDS marker.
    2. First page that doesn't look like an admin page (fallback).
    """
    # 1. Explicit marker
    for i, text in enumerate(texts):
        if _is_content_start(text):
            return i

    # 2. Fallback: skip admin/title pages at the beginning
    for i, text in enumerate(texts):
        if text and not _is_admin_page(text):
            return i

    return 0  # Couldn't determine — return everything

import asyncio
import os
import subprocess
import tempfile
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from classifier import classify_to_slides, edit_single_slide
from pdf_extractor import extract_course_name, extract_pages
from slide_builder import build_presentation


class EditSlideRequest(BaseModel):
    instruction: str


app = FastAPI(title="PPT Generator API", version="0.1.0")

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow all origins so Vite dev server (any port) and the production host work.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Temp file store ───────────────────────────────────────────────────────────
# Maps file_id → {path, filename, thumb_count, slides, course_name, author_name}
_file_store: dict[str, dict] = {}

TEMP_DIR = Path(tempfile.gettempdir()) / "pptgen_files"
TEMP_DIR.mkdir(exist_ok=True)

# ── Thumbnail generation ──────────────────────────────────────────────────────
# Paths can be overridden via env vars for Docker / Linux deployments
_SOFFICE  = os.getenv("SOFFICE_PATH",  "/Applications/LibreOffice.app/Contents/MacOS/soffice")
_PDFTOPPM = os.getenv("PDFTOPPM_PATH", "/opt/homebrew/bin/pdftoppm")


async def _generate_thumbnails(pptx_path: Path, file_id: str) -> int:
    """
    Convert .pptx → PDF (LibreOffice) → PNG-per-slide (pdftoppm).
    Stores images in TEMP_DIR / file_id / slide-N.png (1-based).
    Returns the number of images generated; returns 0 on any failure
    (graceful — caller shows CSS mock thumbnails instead).
    """
    thumb_dir = TEMP_DIR / file_id
    thumb_dir.mkdir(exist_ok=True)

    # Remove stale PNGs so a re-run with fewer slides doesn't leave ghost files
    for old_png in thumb_dir.glob("slide-*.png"):
        old_png.unlink(missing_ok=True)

    loop = asyncio.get_running_loop()

    try:
        # Step 1: PPTX → PDF via LibreOffice headless
        def _run_libreoffice():
            return subprocess.run(
                [_SOFFICE, "--headless", "--convert-to", "pdf",
                 "--outdir", str(thumb_dir), str(pptx_path)],
                capture_output=True,
                timeout=120,
            )

        r = await loop.run_in_executor(None, _run_libreoffice)
        if r.returncode != 0:
            print(f"[thumbnails] LibreOffice failed: {r.stderr.decode(errors='replace')}")
            return 0

        pdf_path = thumb_dir / (pptx_path.stem + ".pdf")
        if not pdf_path.exists():
            print("[thumbnails] LibreOffice produced no PDF")
            return 0

        # Step 2: PDF → PNGs via pdftoppm
        def _run_pdftoppm():
            return subprocess.run(
                [_PDFTOPPM, "-png", "-r", "150",
                 str(pdf_path), str(thumb_dir / "slide")],
                capture_output=True,
                timeout=60,
            )

        r = await loop.run_in_executor(None, _run_pdftoppm)
        if r.returncode != 0:
            print(f"[thumbnails] pdftoppm failed: {r.stderr.decode(errors='replace')}")
            return 0

        count = len(sorted(thumb_dir.glob("slide-*.png")))
        print(f"[thumbnails] Generated {count} thumbnail(s) for {file_id}")
        return count

    except Exception as exc:
        print(f"[thumbnails] Exception: {exc}")
        return 0


# ── API routes (all under /api so the same paths work in dev and production) ──
router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok", "message": "PPT Generator API running"}


@router.post("/generate")
async def generate_presentation(
    pdf: UploadFile = File(..., description="PDF course material"),
    course_name: str = Form(default="", description="Optional course name for the title slide"),
    author_name: str = Form(default="", description="Optional author / teacher name"),
):
    """
    Generate a .pptx presentation from an uploaded UPANA course PDF.
    Returns JSON with slide metadata and a file_id for downloading.
    """
    if not (pdf.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured on the server.")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(await pdf.read())
        tmp_path = tmp.name

    try:
        # ── Step 1: Extract text ──────────────────────────────────────────
        pages = extract_pages(tmp_path)
        if not pages:
            raise HTTPException(
                status_code=422,
                detail="No content found in the PDF. Make sure it contains a 'CONTENIDOS CLASE' section.",
            )

        # ── Step 2: Classify with Claude ─────────────────────────────────
        pdf_course_name = course_name.strip() or (extract_course_name(tmp_path) or "")
        slides = classify_to_slides([p.text for p in pages], course_name=pdf_course_name)
        if not slides:
            raise HTTPException(status_code=422, detail="Claude could not generate slide content from this PDF.")

        # ── Step 3: Build the .pptx ───────────────────────────────────────
        pptx_bytes = build_presentation(slides, course_name=course_name, author_name=author_name)

        # ── Step 4: Save to temp and register ────────────────────────────
        file_id = uuid.uuid4().hex
        out_path = TEMP_DIR / f"{file_id}.pptx"
        out_path.write_bytes(pptx_bytes)

        stem = Path(pdf.filename or "presentation").stem
        out_filename = f"{stem}_presentation.pptx"
        _file_store[file_id] = {
            "path":        out_path,
            "filename":    out_filename,
            "thumb_count": 0,
            "slides":      slides,
            "course_name": course_name,
            "author_name": author_name,
        }

        # ── Step 5: Generate slide thumbnails (best-effort) ──────────────
        thumb_count = await _generate_thumbnails(out_path, file_id)
        _file_store[file_id]["thumb_count"] = thumb_count

        return {
            "file_id":         file_id,
            "filename":        out_filename,
            "slide_count":     len(slides),
            "thumbnail_count": thumb_count,
            "slides": [
                {"slide_type": s.slide_type, "title": s.title, "bullets": s.bullets}
                for s in slides
            ],
        }

    finally:
        os.unlink(tmp_path)


@router.get("/download/{file_id}")
def download_presentation(file_id: str):
    """Download a previously generated .pptx by its file_id."""
    if not file_id.isalnum() or file_id not in _file_store:
        raise HTTPException(status_code=404, detail="File not found or expired. Please regenerate.")

    info = _file_store[file_id]
    path: Path = info["path"]

    if not path.exists():
        _file_store.pop(file_id, None)
        raise HTTPException(status_code=404, detail="File has been cleaned up. Please regenerate.")

    return FileResponse(
        path=str(path),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=info["filename"],
    )


@router.get("/slides/{file_id}/{index}")
def get_slide_thumbnail(file_id: str, index: int):
    """Serve a PNG thumbnail for slide {index} (1-based)."""
    if not file_id.isalnum() or file_id not in _file_store:
        raise HTTPException(status_code=404, detail="Not found")

    thumb_dir = TEMP_DIR / file_id
    all_thumbs = sorted(thumb_dir.glob("slide-*.png"))

    if index < 1 or index > len(all_thumbs):
        raise HTTPException(status_code=404, detail="Slide index out of range")

    thumb_path = all_thumbs[index - 1]
    if not thumb_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file missing")

    return FileResponse(str(thumb_path), media_type="image/png")


@router.post("/slides/{file_id}/{index}/edit")
async def edit_slide_endpoint(file_id: str, index: int, body: EditSlideRequest):
    """
    Edit a specific slide (1-based) using a natural-language instruction.
    Rebuilds the PPTX and regenerates thumbnails.
    """
    if not file_id.isalnum() or file_id not in _file_store:
        raise HTTPException(status_code=404, detail="File not found or expired.")

    info = _file_store[file_id]
    slides = info.get("slides")

    if not slides:
        raise HTTPException(status_code=422, detail="Slide data unavailable — please regenerate.")
    if index < 1 or index > len(slides):
        raise HTTPException(status_code=404, detail=f"Slide {index} not found (total: {len(slides)}).")

    instruction = body.instruction.strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="Instruction must not be empty.")

    loop = asyncio.get_running_loop()
    original = slides[index - 1]
    edited = await loop.run_in_executor(None, lambda: edit_single_slide(original, instruction))

    updated_slides = list(slides)
    updated_slides[index - 1] = edited
    info["slides"] = updated_slides

    pptx_bytes = build_presentation(
        updated_slides,
        course_name=info.get("course_name", ""),
        author_name=info.get("author_name", ""),
    )
    out_path: Path = info["path"]
    out_path.write_bytes(pptx_bytes)

    thumb_count = await _generate_thumbnails(out_path, file_id)
    info["thumb_count"] = thumb_count

    return {
        "index": index,
        "slide": {
            "slide_type": edited.slide_type,
            "title":      edited.title,
            "bullets":    edited.bullets,
        },
        "thumbnail_count": thumb_count,
    }


# ── Register router ───────────────────────────────────────────────────────────
app.include_router(router)

# ── Serve React build in production ──────────────────────────────────────────
# In dev this directory doesn't exist, so the block is skipped.
# In production (Docker) the React build is copied here by the Dockerfile.
_STATIC = Path(__file__).parent / "static"
if _STATIC.exists():
    app.mount("/", StaticFiles(directory=str(_STATIC), html=True), name="static")

# 🎨 PPT Generator — Project Overview

> Automated presentation generator from PDF source material, built for UPANA coursework.

---

## 📌 What We're Building

A **full-stack web app** that takes a PDF (course material) as input and automatically generates a polished `.pptx` presentation following the UPANA formatting rules — saving hours of manual slide-building per class.

---

## 🧩 Stack

| Layer | Tech |
|---|---|
| Frontend | React + TypeScript (Vite 5) |
| Backend | Python + FastAPI |
| PDF Parsing | PyMuPDF (fitz) |
| Slide Generation | python-pptx |
| UI Components | shadcn/ui |
| Styling | Tailwind CSS |
| AI Layer | Claude API (content classification & structuring) |

---

## 🗂️ Project Structure

```
ppt-generator/
├── frontend/        ← React app (port 5174)
│   └── src/
├── backend/         ← FastAPI (port 8000)
│   ├── main.py
│   ├── requirements.txt
│   └── venv/
└── README.md
```

**GitHub:** https://github.com/andrecrts/ppt-generator

---

## ⚙️ Skills Installed

- `vercel-react-best-practices` — React patterns & conventions
- `vercel-composition-patterns` — Component composition guidance
- `shadcn` — shadcn/ui component management

---

## 🏗️ Architecture & Approach

### Flow
```
User uploads PDF
      ↓
Backend: PyMuPDF extracts text + detects tables/figures
      ↓
Claude API classifies content blocks
(section header / bullet list / table / caption)
      ↓
python-pptx builds .pptx using EDU Template
      ↓
User downloads finished presentation
```

### Key Design Decisions
- **AI-powered classification** — Claude handles the messy edge cases (ambiguous headings, merged content, sparse slides) instead of brittle regex heuristics
- **Template-first** — All slides derive from `EDU Template.pptx` to maintain consistent branding
- **Stateless API** — Each `/generate` call is self-contained; no DB needed initially
- **React frontend** — File upload UI, progress indicator, slide preview, download button

---

## 📋 UPANA Formatting Rules (Codified)

- [ ] Skip administrative slides (Descripción, Indicador de logro, Contenidos, Fecha)
- [ ] Content starts at **"CONTENIDOS CLASE"** section of PDF
- [ ] One bullet format per slide (no mixed `•` and `1.`)
- [ ] Tables copied as cropped images from PDF (not recreated in OOXML)
- [ ] Font: 2pt above template default (16pt body); 14pt if >6 bullets
- [ ] `normAutofit` enabled on all text frames
- [ ] Images every ~3 slides from Unsplash/Pexels (topic-relevant)
- [ ] Crop top ~15–20% of PDF pages to exclude UPANA logo

---

## 🛣️ Roadmap

### Phase 1 — Core Pipeline
- [ ] PDF upload endpoint (`POST /generate`)
- [ ] PDF text extraction (PyMuPDF)
- [ ] Content block classification (Claude API)
- [ ] Basic python-pptx slide generation
- [ ] `.pptx` file download

### Phase 2 — UI
- [ ] File upload component (drag & drop)
- [ ] Generation progress indicator
- [ ] Slide preview (thumbnail grid)
- [ ] Download button

### Phase 3 — Polish
- [ ] Table/figure detection and image cropping
- [ ] Auto Unsplash image injection
- [ ] Per-course teacher/template settings
- [ ] Slide count & section summary

---

## 🔑 Running Locally

```bash
# Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs (Swagger)

# Frontend
cd frontend
npm run dev
# → http://localhost:5174
```

---

## 🖥️ UI Mockup

### UI Sections Breakdown

1. **Upload Zone** — Drag & drop or browse, accepts `.pdf` files only
2. **Course Selector** — Dropdown pre-filled with UPANA courses + auto-fills teacher name
3. **Generate Button** — Triggers `POST /generate` to the FastAPI backend
4. **Progress Bar** — Streams status from backend (extracting → classifying → building)
5. **Slide Preview Grid** — Thumbnail cards showing each generated slide in order
6. **Download Button** — Fetches the `.pptx` file from the backend

---

*Started: 2026-05-25*

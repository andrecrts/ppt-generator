# ── Stage 1: Build the React frontend ───────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build
# Output: /app/frontend/dist


# ── Stage 2: Python backend ──────────────────────────────────────────────────
FROM python:3.12-slim

# System deps:
#   - libreoffice    → PPTX → PDF conversion for slide thumbnails
#   - poppler-utils  → pdftoppm (PDF → PNG per slide)
#   - curl           → healthcheck in Render
# Using --no-install-recommends keeps the image lean (~800 MB vs ~1.5 GB full install).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    poppler-utils \
    curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source + template
COPY backend/ .

# Copy compiled React build into backend/static so FastAPI can serve it
COPY --from=frontend-build /app/frontend/dist ./static

# pdftoppm lives at /usr/bin/pdftoppm on Debian/Ubuntu
ENV PDFTOPPM_PATH=/usr/bin/pdftoppm
ENV SOFFICE_PATH=/usr/bin/soffice

# Render sets $PORT; default to 8000 for local Docker runs
ENV PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

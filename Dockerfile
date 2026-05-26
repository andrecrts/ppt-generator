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
#   - poppler-utils  → pdftoppm (slide thumbnail generation)
#   - curl           → healthcheck in Render
# LibreOffice is intentionally omitted on the free tier (too large / too much RAM).
# Thumbnails fall back to CSS mocks gracefully when the binary is absent.
RUN apt-get update && apt-get install -y --no-install-recommends \
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
# SOFFICE_PATH is intentionally unset (LibreOffice not installed on free tier)

# Render sets $PORT; default to 8000 for local Docker runs
ENV PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

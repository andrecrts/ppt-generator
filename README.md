# PPT Generator

Automated presentation generator from PDF source material.

## Structure

```
ppt-generator/
├── frontend/   # React + TypeScript (Vite)
├── backend/    # Python FastAPI
└── README.md
```

## Getting Started

### Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
# API runs at http://localhost:8000
```

### Frontend
```bash
cd frontend
npm run dev
# App runs at http://localhost:5173
```

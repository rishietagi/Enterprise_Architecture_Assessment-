# CIL EA Navigator

TOGAF 9.1-guided EA assessment POC for Coromandel International. Works fully offline; a Gemini key only adds AI narrative.

1. Put `TOGAF_9.1.pdf` and `TOGAF_Study_Guide.pdf` in `data/togaf/`. Optional: copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY`.
2. `cd backend; conda run -n pmo-intel-engine pip install -r requirements.txt`
3. `conda run -n pmo-intel-engine python -m app.rag.ingest` (one-off, about 3 min; skipped when the PDFs are unchanged)
4. `conda run -n pmo-intel-engine uvicorn app.main:app --reload --port 8000`
5. In a second terminal: `cd frontend; npm install; npm run dev`, then open http://localhost:5173
6. Tests: `cd backend; conda run -n pmo-intel-engine pytest -q`

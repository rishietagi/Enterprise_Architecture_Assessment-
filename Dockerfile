# One container: FastAPI serves the API and the built React app. Used by Render (render.yaml) and local Docker.

# --- 1. Build the frontend
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- 2. API runtime
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt
COPY backend/app backend/app
COPY seed seed
# Prebuilt TOGAF index (chunks, embeddings, BM25). The TOGAF PDFs themselves are never shipped.
COPY data/index data/index
COPY --from=web /web/dist frontend/dist
WORKDIR /app/backend
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]

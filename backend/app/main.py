"""CIL EA Navigator API."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

from . import auth
from .config import get_settings
from .db import init_db
from .rag.retrieve import INDEX
from .routers import applications, approach, arch_views, budget, business, coach, data_tech, overview, roadmap, settings, templates, vision

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    INDEX.load()
    threading.Thread(target=INDEX.warm_model, daemon=True).start()
    yield


app = FastAPI(title="CIL EA Navigator", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins.split(","), allow_methods=["*"],
                   allow_headers=["*"])


@app.middleware("http")
async def login_gate(request: Request, call_next):
    """API calls need a signed session cookie when APP_USERS is set; the SPA itself loads so it can show the login page."""
    if auth.needs_login(request):
        return JSONResponse({"detail": "Login required"}, status_code=401)
    return await call_next(request)


app.include_router(auth.router)
for r in (overview, approach, vision, business, applications, data_tech, budget, arch_views, roadmap, coach, templates, settings):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"ok": True, "rag": INDEX.mode, "llm_key": get_settings().has_key}


DIST = get_settings().frontend_dist
if DIST.is_dir():  # production: serve the built SPA; unknown non-API paths fall back to index.html for client routing
    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = (DIST / path).resolve()
        if path and not path.startswith("api/") and f.is_file() and f.is_relative_to(DIST.resolve()):
            return FileResponse(f)
        if path.startswith("api/"):
            return Response(status_code=404)
        return FileResponse(DIST / "index.html")

"""CIL EA Navigator API."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import init_db
from .rag.retrieve import INDEX
from .routers import applications, approach, arch_views, business, coach, data_tech, overview, roadmap, settings, templates, vision

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
for r in (overview, approach, vision, business, applications, data_tech, arch_views, roadmap, coach, templates, settings):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"ok": True, "rag": INDEX.mode, "llm_key": get_settings().has_key}

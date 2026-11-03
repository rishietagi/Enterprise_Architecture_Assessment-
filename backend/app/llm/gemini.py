"""The only entry point to the LLM: generate_json(kind, prompt, schema, fallback).

Chain: SQLite cache -> primary model (8 RPM limiter, 429 backoff x3) -> fallback model -> deterministic fallback.
With no GEMINI_API_KEY the deterministic fallback is returned straight away.
"""
from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import deque
from collections.abc import Callable

from sqlmodel import Session

from ..config import get_settings
from ..db import get_engine
from ..models import LlmCache

log = logging.getLogger("llm")

KINDS = {"coach", "ask", "draft_vision", "map_apps", "findings", "initiative_briefs"}
BACKOFF = (2, 4, 8)
MAX_WAIT_S = 20


class RateLimiter:
    def __init__(self, rpm: int):
        self.rpm = rpm
        self.calls: deque[float] = deque()
        self.lock = threading.Lock()

    def acquire(self, max_wait: float = MAX_WAIT_S) -> bool:
        deadline = time.monotonic() + max_wait
        while True:
            with self.lock:
                now = time.monotonic()
                while self.calls and now - self.calls[0] >= 60:
                    self.calls.popleft()
                if len(self.calls) < self.rpm:
                    self.calls.append(now)
                    return True
                wait = 60 - (now - self.calls[0])
            if time.monotonic() + wait > deadline:
                return False
            time.sleep(min(wait, 1.0))


_limiter: RateLimiter | None = None
_client = None
_last_status: dict = {"last_mode": None, "last_error": None}


def limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter(get_settings().llm_rpm)
    return _limiter


def client():
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=get_settings().gemini_api_key)
    return _client


def cache_key(model: str, prompt: str) -> str:
    return hashlib.sha256((model + "\n" + prompt).encode("utf-8")).hexdigest()


def _cache_get(key: str) -> dict | None:
    with Session(get_engine()) as s:
        row = s.get(LlmCache, key)
        return row.response if row else None


def _cache_put(key: str, kind: str, model: str, data: dict) -> None:
    with Session(get_engine()) as s:
        s.merge(LlmCache(key=key, kind=kind, model=model, response=data))
        s.commit()


def _is_429(e: Exception) -> bool:
    code = getattr(e, "code", None) or getattr(e, "status_code", None)
    return code == 429 or "429" in str(e)[:200] or "RESOURCE_EXHAUSTED" in str(e)


def _call(model: str, prompt: str, schema: dict) -> dict:
    from google.genai import types

    cfg = types.GenerateContentConfig(temperature=0.2, response_mime_type="application/json",
                                      response_json_schema=schema)
    resp = client().models.generate_content(model=model, contents=prompt, config=cfg)
    return json.loads(resp.text)


def _try_model(model: str, prompt: str, schema: dict) -> dict | None:
    for attempt in range(len(BACKOFF) + 1):
        if not limiter().acquire():
            _last_status["last_error"] = "Local rate limit (8 RPM) reached"
            return None
        try:
            return _call(model, prompt, schema)
        except Exception as e:
            _last_status["last_error"] = f"{model}: {str(e)[:200]}"
            if _is_429(e) and attempt < len(BACKOFF):
                log.warning("429 from %s, backing off %ss", model, BACKOFF[attempt])
                time.sleep(BACKOFF[attempt])
                continue
            log.warning("Gemini call failed on %s: %s", model, e)
            return None
    return None


def generate_json(kind: str, prompt: str, schema: dict, fallback: Callable[[], dict]) -> dict:
    """Returns {"data": ..., "mode": "ai" | "cached" | "fallback", "model": str | None}."""
    assert kind in KINDS, f"unknown AI call type {kind}"
    s = get_settings()
    if not s.has_key:
        _last_status["last_mode"] = "fallback"
        return {"data": fallback(), "mode": "fallback", "model": None, "reason": "No GEMINI_API_KEY set"}
    for model in (s.gemini_model, s.gemini_fallback_model):
        hit = _cache_get(cache_key(model, prompt))
        if hit is not None:
            return {"data": hit, "mode": "cached", "model": model}
    for model in (s.gemini_model, s.gemini_fallback_model):
        data = _try_model(model, prompt, schema)
        if data is not None:
            _cache_put(cache_key(model, prompt), kind, model, data)
            _last_status["last_mode"] = "ai"
            return {"data": data, "mode": "ai", "model": model}
    _last_status["last_mode"] = "fallback"
    return {"data": fallback(), "mode": "fallback", "model": None,
            "reason": _last_status.get("last_error") or "Gemini unavailable"}


def status() -> dict:
    s = get_settings()
    return {"has_key": s.has_key, "model": s.gemini_model, "fallback_model": s.gemini_fallback_model,
            "rpm": s.llm_rpm, **_last_status}

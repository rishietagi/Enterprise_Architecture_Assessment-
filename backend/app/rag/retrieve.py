"""Phase-aware hybrid retrieval: tag filter -> dense top-30 + BM25 top-30 -> RRF(k=60) -> priority weight.

Index files are loaded once (startup). If embeddings or the query model are unavailable the index runs
BM25-only ("lexical mode").
"""
from __future__ import annotations

import json
import logging
import pickle
import re
import threading

import numpy as np

from ..config import get_settings
from .ingest import tokenize
from .profiles import TAG_ALIAS, profile

log = logging.getLogger("rag")

PRIORITY_WEIGHT = {1: 1.0, 2: 0.85, 3: 0.7}
RRF_K = 60
TOP_N = 30
MAX_PER_SECTION = 4


class Index:
    def __init__(self):
        self.chunks: list[dict] = []
        self.emb: np.ndarray | None = None
        self.bm25 = None
        self.meta: dict = {}
        self.model = None
        self.model_error: str | None = None
        self._lock = threading.Lock()

    @property
    def ready(self) -> bool:
        return bool(self.chunks)

    @property
    def mode(self) -> str:
        if not self.ready:
            return "none"
        return "hybrid" if self.emb is not None and self.model_error is None else "lexical"

    def load(self) -> None:
        d = get_settings().index_dir
        path = d / "chunks.jsonl"
        if not path.exists():
            self.chunks, self.emb, self.bm25 = [], None, None
            return
        with open(path, encoding="utf-8") as f:
            self.chunks = [json.loads(line) for line in f if line.strip()]
        with open(d / "bm25.pkl", "rb") as f:
            self.bm25 = pickle.load(f)
        emb_path = d / "embeddings.npy"
        self.emb = np.load(emb_path) if emb_path.exists() else None
        if self.emb is not None and len(self.emb) != len(self.chunks):
            self.emb = None
        meta = d / "meta.json"
        self.meta = json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else {}
        log.info("TOGAF index loaded: %d chunks, mode=%s", len(self.chunks), self.mode)

    def warm_model(self) -> None:
        if self.emb is None or self.model is not None:
            return
        if not get_settings().rag_dense:
            self.model_error = "dense retrieval disabled (RAG_DENSE=false)"
            return
        with self._lock:
            if self.model is not None:
                return
            try:
                from fastembed import TextEmbedding

                s = get_settings()
                self.model = TextEmbedding(model_name=s.embed_model, cache_dir=str(s.model_cache_dir))
                self.model_error = None
            except Exception as e:
                self.model_error = str(e)
                log.warning("Query embedding model unavailable, lexical mode: %s", e)

    def query_vec(self, q: str) -> np.ndarray | None:
        self.warm_model()
        if self.model is None:
            return None
        v = np.array(next(iter(self.model.query_embed(q))), dtype=np.float32)
        return v / max(float(np.linalg.norm(v)), 1e-9)


INDEX = Index()


def status() -> dict:
    return {"ready": INDEX.ready, "mode": INDEX.mode, "n_chunks": len(INDEX.chunks), "meta": INDEX.meta,
            "model_error": INDEX.model_error}


def citation_label(c: dict) -> str:
    prefix = "TOGAF 9.1" if c["source"] == "course" else "Study Guide"
    num = c.get("section_no")
    title = c.get("title", "")
    if num and title.startswith(num):
        title = title[len(num):].strip()
    name = c.get("subtitle") or title
    name = re.sub(r"\s+", " ", name)[:56]
    sec = f"§{num} {name}" if num else name
    return f"{prefix} {sec} · p.{c['pdf_page_start']}"


def excerpt(c: dict, limit: int = 1400) -> str:
    body = c["text"].split("\n", 1)[-1].strip()
    return body if len(body) <= limit else body[:limit].rsplit(" ", 1)[0] + " …"


def to_hit(c: dict, score: float = 0.0) -> dict:
    return {"id": c["id"], "label": citation_label(c), "breadcrumb": c["breadcrumb"] + (f" > {c['subtitle']}" if c.get("subtitle") else ""),
            "section_no": c.get("section_no"), "page": c["pdf_page_start"], "content_type": c["content_type"],
            "source": c["source"], "score": round(score, 5), "text": excerpt(c)}


def _candidates(screen, phases, types) -> list[int]:
    ch = INDEX.chunks
    idx = list(range(len(ch)))
    screen = TAG_ALIAS.get(screen, screen)
    if screen or phases:
        ph = set(phases or [])
        idx = [i for i in idx if (screen and screen in ch[i]["screens"]) or (ph & set(ch[i]["adm_phases"]))]
    if types:
        ts = set(types) | {"summary"}
        typed = [i for i in idx if ch[i]["content_type"] in ts]
        if len(typed) >= 6:
            idx = typed
    return idx


def retrieve(query: str, screen: str | None = None, phases: list[str] | None = None,
             types: list[str] | None = None, k: int = 6) -> list[dict]:
    if not INDEX.ready or not query.strip():
        return []
    prof = profile(screen)
    phases = phases if phases is not None else prof["phases"]
    types = types if types is not None else prof["types"]
    cand = _candidates(screen, phases, types)
    if not cand:
        cand = list(range(len(INDEX.chunks)))
    cand_arr = np.array(cand)

    ranks: dict[int, float] = {}
    # BM25
    scores = np.asarray(INDEX.bm25.get_scores(tokenize(query)))[cand_arr]
    for r, j in enumerate(np.argsort(-scores)[:TOP_N]):
        if scores[j] > 0:
            ranks[int(cand_arr[j])] = ranks.get(int(cand_arr[j]), 0.0) + 1.0 / (RRF_K + r + 1)
    # dense
    if INDEX.emb is not None:
        qv = INDEX.query_vec(query)
        if qv is not None:
            sims = INDEX.emb[cand_arr] @ qv
            for r, j in enumerate(np.argsort(-sims)[:TOP_N]):
                ranks[int(cand_arr[j])] = ranks.get(int(cand_arr[j]), 0.0) + 1.0 / (RRF_K + r + 1)

    fused = sorted(((s * PRIORITY_WEIGHT.get(INDEX.chunks[i]["priority"], 0.7), i) for i, s in ranks.items()), reverse=True)
    out, per_section = [], {}
    for s, i in fused:
        c = INDEX.chunks[i]
        key = (c["source"], c.get("section_no") or c["title"])
        if per_section.get(key, 0) >= MAX_PER_SECTION:
            continue
        per_section[key] = per_section.get(key, 0) + 1
        out.append((s, i))
        if len(out) >= k:
            break
    # include >= 1 plain-English summary chunk when one matches
    if out and not any(INDEX.chunks[i]["content_type"] == "summary" for _, i in out):
        summary = next(((s, i) for s, i in fused if INDEX.chunks[i]["content_type"] == "summary"), None)
        if summary:
            out = out[: k - 1] + [summary] if len(out) >= k else out + [summary]
    return [to_hit(INDEX.chunks[i], s) for s, i in out]


def by_ids(ids: list[str]) -> list[dict]:
    m = {c["id"]: c for c in INDEX.chunks}
    return [to_hit(m[i]) for i in ids if i in m]


# --------------------------------------------------------------------------- principles (§23.6)
TOGAF_PRINCIPLE_NAMES = [
    "Primacy of Principles", "Maximize Benefit to the Enterprise", "Information Management is Everybody's Business",
    "Business Continuity", "Common Use Applications", "Service Orientation", "Compliance with Law",
    "IT Responsibility", "Protection of Intellectual Property", "Data is an Asset", "Data is Shared",
    "Data is Accessible", "Data Trustee", "Common Vocabulary and Data Definitions", "Data Security",
    "Technology Independence", "Ease-of-Use", "Requirements-Based Change", "Responsive Change Management",
    "Control Technical Diversity", "Interoperability"]
PRINCIPLE_CATEGORY = {**{n: "Business" for n in range(1, 10)}, **{n: "Data" for n in range(10, 16)},
                      **{n: "Application" for n in (16, 17)}, **{n: "Technology" for n in range(18, 22)}}


def _section(body: str, name: str, nxt: list[str]) -> str:
    m = re.search(rf"{name}:\s*(.*?)(?=(?:{'|'.join(nxt)}):|\Z)", body, flags=re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def togaf_principles() -> list[dict]:
    """The 21 TOGAF example principles, parsed from content_type == 'principle' chunks."""
    found = {}
    for c in INDEX.chunks:
        if c["content_type"] != "principle":
            continue
        m = re.match(r"Principle (\d+):\s*(.+)", c.get("subtitle", ""))
        if not m:
            continue
        n = int(m.group(1))
        body = c["text"].split("\n", 1)[-1]
        impl = _section(body, "Implications", ["Principle \\d+"])
        found[n] = {"statement": _section(body, "Statement", ["Rationale", "Implications"]),
                    "rationale": _section(body, "Rationale", ["Implications"]),
                    "implications": [p.strip() for p in impl.split("•") if p.strip()],
                    "citation": to_hit(c)}
    out = []
    for n, name in enumerate(TOGAF_PRINCIPLE_NAMES, start=1):
        p = found.get(n)
        out.append({"id": f"TOGAF-{n:02d}", "number": n, "name": name, "category": PRINCIPLE_CATEGORY[n],
                    "statement": p["statement"] if p else "Run TOGAF ingest to load the statement from §23.6.",
                    "rationale": p["rationale"] if p else "", "implications": p["implications"] if p else [],
                    "citation": p["citation"] if p else None, "source": "togaf"})
    return out

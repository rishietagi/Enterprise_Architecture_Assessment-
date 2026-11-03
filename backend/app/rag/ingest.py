"""Build the TOGAF index: chunker -> fastembed embeddings -> BM25 -> data/index/.

Run from backend/:  python -m app.rag.ingest [--force]
Idempotent: skipped when the PDF hash is unchanged (unless --force).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import pickle
import re
import time
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

from ..config import get_settings
from .chunker import build_chunks

log = logging.getLogger("rag.ingest")

STOP = set("the a an and or of to in on for is are be by as at with this that these those it its from which can "
           "may will should must into each any all not no such also than then there their they".split())


def tokenize(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP and len(w) > 1]


def pdf_hash(paths: list[Path]) -> str:
    h = hashlib.sha256()
    for p in paths:
        if p.exists():
            h.update(p.name.encode())
            h.update(p.read_bytes())
    return h.hexdigest()


def embed_texts(texts: list[str]) -> np.ndarray:
    from fastembed import TextEmbedding

    s = get_settings()
    model = TextEmbedding(model_name=s.embed_model, cache_dir=str(s.model_cache_dir))
    vecs = np.array(list(model.embed(texts, batch_size=32)), dtype=np.float32)
    return vecs / np.clip(np.linalg.norm(vecs, axis=1, keepdims=True), 1e-9, None)


def ingest(force: bool = False) -> dict:
    s = get_settings()
    pdfs = [p for p in (s.course_pdf, s.guide_pdf) if p.exists()]
    if not s.course_pdf.exists():
        return {"status": "missing_pdf", "detail": f"Put TOGAF_9.1.pdf in {s.togaf_dir}"}
    out = s.index_dir
    out.mkdir(parents=True, exist_ok=True)
    meta_path = out / "meta.json"
    digest = pdf_hash(pdfs)
    if not force and meta_path.exists() and (out / "chunks.jsonl").exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if meta.get("hash") == digest:
            return {"status": "skipped", **meta}

    t0 = time.time()
    chunks = build_chunks(str(s.course_pdf), str(s.guide_pdf) if s.guide_pdf.exists() else None)
    with open(out / "chunks.jsonl", "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    with open(out / "bm25.pkl", "wb") as f:
        pickle.dump(BM25Okapi([tokenize(c["text"]) for c in chunks]), f)

    dense = False
    try:
        np.save(out / "embeddings.npy", embed_texts([c["text"] for c in chunks]))
        dense = True
    except Exception as e:  # corporate proxy / offline: BM25-only "lexical mode"
        log.warning("Embedding model unavailable, lexical mode only: %s", e)
        (out / "embeddings.npy").unlink(missing_ok=True)

    meta = {"hash": digest, "n_chunks": len(chunks), "dense": dense, "model": s.embed_model if dense else None,
            "built": time.strftime("%Y-%m-%d %H:%M"), "seconds": round(time.time() - t0, 1)}
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return {"status": "built", **meta}


def main():
    logging.basicConfig(level=logging.INFO)
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    r = ingest(force=ap.parse_args().force)
    print(json.dumps(r, indent=2))


if __name__ == "__main__":
    main()

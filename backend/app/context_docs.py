"""Text extraction for documents uploaded as Architecture Vision context, plus a deterministic read of the themes
they carry (used to ground the vision statements and as the no-key fallback). No extra dependencies: PDF via
PyMuPDF, Office files via their XML parts, spreadsheets via openpyxl."""
from __future__ import annotations

import collections
import io
import re
import zipfile

MAX_CHARS = 200_000
KINDS = {"pdf", "docx", "pptx", "xlsx", "txt", "md", "csv"}
STOP = set("""a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having he her here
hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our
ours out over own same she should so some such than that the their theirs them then there these they this those through
to too under until up very was we were what when where which while who whom why will with would you your yours shall
may must per via etc within across using used use new one two three based including include includes well like make
made many much including page pages slide figure table total year years fy cr rs lakh crore crores sample""".split())


def kind_of(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return ext if ext in KINDS else ""


def _xml_text(data: bytes, parts: tuple[str, ...]) -> str:
    out = []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for n in sorted(z.namelist()):
            if n.startswith(parts) and n.endswith(".xml"):
                xml = z.read(n).decode("utf-8", "ignore")
                xml = re.sub(r"</(w:p|a:p)>", "\n", xml)
                out.append(re.sub(r"<[^>]+>", "", xml))
    return "\n".join(out)


def extract(name: str, data: bytes) -> str:
    k = kind_of(name)
    if k == "pdf":
        import fitz  # PyMuPDF
        with fitz.open(stream=data, filetype="pdf") as doc:
            text = "\n".join(p.get_text() for p in doc)
    elif k == "docx":
        text = _xml_text(data, ("word/document",))
    elif k == "pptx":
        text = _xml_text(data, ("ppt/slides/slide",))
    elif k == "xlsx":
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        text = "\n".join(" ".join(str(c) for c in row if c is not None) for ws in wb.worksheets for row in ws.iter_rows(values_only=True))
    elif k in ("txt", "md", "csv"):
        text = data.decode("utf-8", "ignore")
    else:
        raise ValueError("Upload a PDF, Word, PowerPoint, Excel, text or Markdown file")
    text = re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n\n", text)).strip()
    return text[:MAX_CHARS]


def words(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z][a-z\-]{2,}", text.lower()) if w not in STOP]


def themes(text: str, n: int = 12) -> list[dict]:
    """Most frequent content words and two-word phrases: a plain-language read of what the context is about."""
    ws = words(text)
    bi = collections.Counter(f"{a} {b}" for a, b in zip(ws, ws[1:]) if a != b)
    uni = collections.Counter(ws)
    top = [(p, c) for p, c in bi.most_common(n * 2) if c >= 2][: n // 2]
    used = {w for p, _ in top for w in p.split()}
    top += [(w, c) for w, c in uni.most_common(n * 3) if w not in used][: n - len(top)]
    return [{"term": t, "count": c} for t, c in sorted(top, key=lambda x: -x[1])]


def sentences_with(text: str, terms: list[str], limit: int = 4) -> list[str]:
    """Sentences from the context that mention the given terms, for evidence under a statement."""
    sents = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text))
    out = []
    for snt in sents:
        low = snt.lower()
        if 40 <= len(snt) <= 320 and any(t in low for t in terms):
            out.append(snt.strip())
        if len(out) >= limit:
            break
    return out

"""
Port of togaf_chunker.py (repo root) - behaviour unchanged; adds build_chunks() for in-process use.

TOGAF reference chunker — ADM-phase-aware chunking for the CIL EA Navigator RAG.

Tested against:
  data/togaf/TOGAF_9.1.pdf          (The Open Group, TOGAF 9.1, 692 pages)
  data/togaf/TOGAF_Study_Guide.pdf  (TOGAF 9 Foundation Study Guide, 265 pages)

Strategy (why this beats fixed-size chunking for TOGAF):
  1. Boundaries come from the PDF's own bookmark tree (TOC), down to level-3
     sections, so a chunk never straddles two ADM steps or two artifacts.
  2. Every chunk is tagged by a longest-prefix rule table (RULES below) with
     adm_phases[], screens[], content_type and priority. Retrieval filters on
     these tags first and does similarity search second.
  3. Content-aware splitters for the high-value sections:
       - 23.6.x  Example Architecture Principles  -> one chunk per principle
       - 35.6.x  Artifacts by ADM phase           -> one chunk per catalog/matrix/diagram
       - 3.x / Appendix A definitions             -> one chunk per term (already leaf TOC nodes)
  4. Running headers/footers are removed by page position, not by regex.
  5. The groff kerning artifact ("enterpr ise", "Wor k", "Par t") is repaired
     with a vocabulary learned from the document itself.
  6. Every chunk text is prefixed with its breadcrumb so the embedding knows
     where it sits ("TOGAF 9.1 > Phase B: Business Architecture > 8.4 Steps").

Usage:
  python togaf_chunker.py --course data/togaf/TOGAF_9.1.pdf \
                          --guide  data/togaf/TOGAF_Study_Guide.pdf \
                          --out    data/togaf/chunks.jsonl
Requires: pymupdf  (pip install pymupdf). Do NOT use pypdf - it destroys word spacing in these PDFs.
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import unicodedata

import pymupdf

# ---------------------------------------------------------------------------
# Tag vocabulary
# ---------------------------------------------------------------------------
# adm_phases: PRELIM, A, B, C_DATA, C_APP, D, E, F, G, H, REQ, CORE
# screens:    overview, vision, business, applications, data_tech, roadmap
# content_type: objectives, approach, inputs, steps, outputs, technique, artifact,
#               deliverable, principle, definition, governance, checklist,
#               maturity, reference_model, concept, summary
# priority: 1 = core grounding, 2 = supporting, 3 = background. SKIP = not indexed.

SKIP = "SKIP"

# Longest-prefix-wins rules for the TOGAF 9.1 course book, keyed by section number.
# value = (adm_phases, screens, content_type, priority)
COURSE_RULES: dict[str, tuple] = {
    # Part I - Introduction
    "1": (["CORE"], ["overview"], "concept", 3),
    "2": (["CORE"], ["overview"], "concept", 2),
    "3": (["CORE"], ["overview"], "definition", 2),
    "4": SKIP,  # release notes
    # Part II - ADM
    "5": (["CORE"], ["overview"], "concept", 1),
    "5.4": (["CORE", "G"], ["roadmap"], "governance", 1),
    "5.5": (["A"], ["vision"], "approach", 1),
    "6": (["PRELIM"], ["vision"], "approach", 1),
    "7": (["A"], ["vision"], "approach", 1),
    "8": (["B"], ["business"], "approach", 1),
    "9": (["C_DATA", "C_APP"], ["applications", "data_tech"], "approach", 1),
    "10": (["C_DATA"], ["data_tech"], "approach", 1),
    "11": (["C_APP"], ["applications"], "approach", 1),
    "12": (["D"], ["data_tech"], "approach", 1),
    "13": (["E"], ["roadmap"], "approach", 1),
    "14": (["F"], ["roadmap"], "approach", 1),
    "15": (["G"], ["roadmap"], "governance", 1),
    "16": (["H"], ["roadmap"], "governance", 1),
    "17": (["REQ"], ["roadmap", "overview"], "approach", 1),
    # Part III - Guidelines & Techniques
    "18": SKIP,
    "19": (["CORE"], ["overview"], "concept", 3),
    "20": (["CORE"], ["overview"], "concept", 3),
    "21": (["CORE"], ["data_tech"], "technique", 2),  # security, per-phase overrides below
    "21.4": (["REQ"], ["roadmap"], "technique", 2),
    "21.5": (["PRELIM"], ["vision"], "technique", 2),
    "21.6": (["A"], ["vision"], "technique", 2),
    "21.7": (["B"], ["business"], "technique", 2),
    "21.8": (["C_DATA", "C_APP"], ["applications", "data_tech"], "technique", 2),
    "21.9": (["D"], ["data_tech"], "technique", 2),
    "21.10": (["E"], ["roadmap"], "technique", 2),
    "21.11": (["F"], ["roadmap"], "technique", 2),
    "21.12": (["G"], ["roadmap"], "technique", 2),
    "21.13": (["H"], ["roadmap"], "technique", 2),
    "21.14": SKIP,
    "22": (["C_APP", "D"], ["applications", "data_tech"], "technique", 3),  # SOA
    "23": (["PRELIM", "A"], ["vision"], "technique", 1),
    "23.6": (["PRELIM", "A"], ["vision"], "principle", 1),
    "23.6.2": (["PRELIM", "A", "C_DATA"], ["vision", "data_tech"], "principle", 1),
    "23.6.3": (["PRELIM", "A", "C_APP"], ["vision", "applications"], "principle", 1),
    "23.6.4": (["PRELIM", "A", "D"], ["vision", "data_tech"], "principle", 1),
    "24": (["A"], ["vision"], "technique", 1),  # stakeholder management
    "25": (["C_APP", "D"], ["applications", "data_tech"], "technique", 3),
    "25.2": SKIP, "25.3": SKIP, "25.4": SKIP,
    "26": (["A", "B"], ["vision", "business"], "technique", 2),  # business scenarios
    "27": (["B", "C_DATA", "C_APP", "D", "E"], ["business", "applications", "data_tech", "roadmap"], "technique", 1),  # gap analysis
    "28": (["E", "F"], ["roadmap"], "technique", 1),  # migration planning techniques
    "29": (["C_APP", "E"], ["applications", "roadmap"], "technique", 2),  # interoperability
    "30": (["E", "F"], ["roadmap"], "technique", 2),  # readiness
    "31": (["E", "F", "G"], ["roadmap"], "technique", 2),  # risk
    "32": (["B", "E", "F"], ["business", "roadmap"], "technique", 1),  # capability-based planning
    # Part IV - Content Framework
    "33": (["CORE"], ["overview"], "concept", 2),
    "34": (["CORE"], ["overview"], "concept", 3),
    "34.6": (["B", "C_DATA", "C_APP", "D"], ["business", "applications", "data_tech"], "artifact", 1),  # entity attributes -> template fields
    "35": (["CORE"], ["overview"], "concept", 2),
    "35.6.1": (["PRELIM"], ["vision"], "artifact", 1),
    "35.6.2": (["A"], ["vision"], "artifact", 1),
    "35.6.3": (["B"], ["business"], "artifact", 1),
    "35.6.4": (["C_DATA"], ["data_tech"], "artifact", 1),
    "35.6.5": (["C_APP"], ["applications"], "artifact", 1),
    "35.6.6": (["D"], ["data_tech"], "artifact", 1),
    "35.6.7": (["E"], ["roadmap"], "artifact", 1),
    "35.6.8": (["REQ"], ["roadmap"], "artifact", 1),
    "35.7": (["CORE"], ["overview"], "artifact", 2),
    "35.7.1": (["B"], ["business"], "artifact", 2),
    "35.7.2": (["C_APP", "D"], ["data_tech"], "artifact", 2),
    "35.7.6": (["C_DATA"], ["data_tech"], "artifact", 2),
    "36": (["CORE"], ["overview"], "deliverable", 2),
    "36.2.1": (["B", "C_APP", "D"], ["applications"], "deliverable", 2),
    "36.2.2": (["G"], ["roadmap"], "deliverable", 1),
    "36.2.3": (["B", "C_DATA", "C_APP", "D"], ["overview"], "deliverable", 1),
    "36.2.4": (["PRELIM"], ["vision"], "deliverable", 1),
    "36.2.5": (["PRELIM", "G"], ["roadmap"], "deliverable", 2),
    "36.2.6": (["REQ"], ["roadmap"], "deliverable", 2),
    "36.2.7": (["E", "F"], ["roadmap"], "deliverable", 1),
    "36.2.8": (["A"], ["vision"], "deliverable", 1),
    "36.2.9": (["PRELIM", "A"], ["vision"], "deliverable", 1),
    "36.2.10": (["A", "B"], ["business", "overview"], "deliverable", 1),
    "36.2.11": (["H"], ["roadmap"], "deliverable", 2),
    "36.2.12": (["A"], ["vision"], "deliverable", 3),
    "36.2.13": (["G"], ["roadmap"], "deliverable", 1),
    "36.2.14": (["F"], ["roadmap"], "deliverable", 1),
    "36.2.15": (["F", "G"], ["roadmap"], "deliverable", 1),
    "36.2.16": (["PRELIM"], ["roadmap"], "deliverable", 2),
    "36.2.17": (["PRELIM", "A"], ["vision"], "deliverable", 2),
    "36.2.18": (["REQ", "H"], ["roadmap"], "deliverable", 2),
    "36.2.19": (["E"], ["applications"], "deliverable", 2),
    "36.2.20": (["A"], ["vision"], "deliverable", 1),
    "36.2.21": (["PRELIM"], ["vision"], "deliverable", 2),
    "37": (["CORE", "E"], ["applications", "roadmap"], "concept", 2),  # building blocks
    # Part V - Enterprise Continuum & Tools
    "38": SKIP,
    "39": (["CORE"], ["overview"], "concept", 3),
    "40": (["CORE"], ["overview"], "concept", 3),
    "41": (["PRELIM", "G"], ["roadmap"], "governance", 2),  # repository
    "42": SKIP,
    # Part VI - Reference Models
    "43": (["D"], ["data_tech"], "reference_model", 2),
    "43.5": (["D"], ["data_tech"], "reference_model", 3),
    "44": (["C_APP", "C_DATA"], ["applications", "data_tech"], "reference_model", 3),
    # Part VII - Capability Framework
    "45": SKIP,
    "46": (["PRELIM"], ["roadmap"], "governance", 2),
    "47": (["G"], ["roadmap"], "governance", 1),  # architecture board
    "48": (["G"], ["roadmap"], "governance", 1),  # compliance
    "48.5": (["G"], ["roadmap"], "checklist", 1),
    "48.5.1": (["G", "D"], ["roadmap", "data_tech"], "checklist", 1),
    "48.5.2": (["G", "D"], ["roadmap", "data_tech"], "checklist", 1),
    "48.5.3": (["G", "C_APP"], ["roadmap", "applications"], "checklist", 1),
    "48.5.4": (["G", "C_DATA"], ["roadmap", "data_tech"], "checklist", 1),
    "48.5.5": (["G", "D"], ["roadmap", "data_tech"], "checklist", 1),
    "48.5.6": (["G", "D"], ["roadmap", "data_tech"], "checklist", 1),
    "49": (["G"], ["roadmap"], "governance", 2),
    "50": (["PRELIM", "G"], ["roadmap"], "governance", 1),
    "51": (["CORE"], ["overview", "roadmap"], "maturity", 1),
    "52": SKIP,
    # Appendices
    "A": (["CORE"], ["overview"], "definition", 3),
    "B": SKIP,
}

# Study guide rules (section numbers are "Chapter.Section"). Summary tier: short, plain-English restatements.
GUIDE_RULES: dict[str, tuple] = {
    "1": SKIP,
    "2": (["CORE"], ["overview"], "summary", 2),
    "3": (["CORE"], ["overview"], "summary", 2),
    "4": (["CORE"], ["overview"], "definition", 3),
    "5": (["CORE"], ["overview"], "summary", 2),
    "6": (["CORE"], ["overview"], "summary", 3),
    "7": (["CORE"], ["overview"], "summary", 2),
    "7.2": (["PRELIM"], ["vision"], "summary", 1),
    "7.3": (["A"], ["vision"], "summary", 1),
    "7.4": (["B"], ["business"], "summary", 1),
    "7.5": (["C_DATA", "C_APP"], ["applications", "data_tech"], "summary", 1),
    "7.6": (["D"], ["data_tech"], "summary", 1),
    "7.7": (["E"], ["roadmap"], "summary", 1),
    "7.8": (["F"], ["roadmap"], "summary", 1),
    "7.9": (["G"], ["roadmap"], "summary", 1),
    "7.10": (["H"], ["roadmap"], "summary", 1),
    "7.11": (["REQ"], ["roadmap"], "summary", 1),
    "8": (["CORE"], ["overview"], "summary", 2),
    "8.3": (["PRELIM", "A"], ["vision"], "summary", 1),
    "8.4": (["A", "B"], ["vision", "business"], "summary", 2),
    "8.5": (["B", "C_DATA", "C_APP", "D", "E"], ["business", "applications", "data_tech", "roadmap"], "summary", 1),
    "8.6": (["C_APP", "E"], ["applications", "roadmap"], "summary", 2),
    "8.7": (["E", "F"], ["roadmap"], "summary", 2),
    "8.8": (["E", "F", "G"], ["roadmap"], "summary", 2),
    "8.9": (["B", "E", "F"], ["business", "roadmap"], "summary", 1),
    "9": (["G"], ["roadmap"], "summary", 1),
    "10": (["CORE"], ["overview"], "summary", 2),
    "11": (["CORE", "E"], ["applications", "roadmap"], "summary", 2),
    "12": (["CORE"], ["overview"], "summary", 2),
    "13": (["D"], ["data_tech"], "summary", 3),
    "Appendix": SKIP, "Index": SKIP, "Preface": SKIP, "About": SKIP,
    "Trademarks": SKIP, "Acknowledgements": SKIP, "References": SKIP,
}
# Study-guide sub-sections that are never indexed, whatever the chapter
GUIDE_SKIP_TITLES = ("Test Yourself", "Recommended Reading", "Key Learning Points")

STEP_TITLES = {"objectives": "objectives", "approach": "approach", "inputs": "inputs",
               "steps": "steps", "outputs": "outputs"}

# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------
HEADER_Y = 45  # running header band (both PDFs)
FOOTER_Y = {"course": 710, "guide": 640}
NOISE = re.compile(r"(Syllabus Reference:[^)]*\)?|Copyright protected\..*|Personal PDF Edition.*|"
                   r"©\s*2009-2011 The Open Group.*|Open Group Standard \(2011\))")


def page_text(page, footer_y: float) -> str:
    blocks = [b for b in page.get_text("blocks") if b[6] == 0 and b[1] >= HEADER_Y and b[3] <= footer_y]
    blocks.sort(key=lambda b: (round(b[1]), b[0]))
    return "\n".join(b[4] for b in blocks)


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("‘‘", '"').replace("’’", '"')
    text = re.sub(r"^\s*I\s+(?=[A-Z])", "• ", text, flags=re.M)  # groff bullet glyph -> •
    text = re.sub(r"^\s*•\s*\n", "• ", text, flags=re.M)
    text = NOISE.sub("", text)
    return text


def build_vocab(full_text: str) -> collections.Counter:
    return collections.Counter(w.lower() for w in re.findall(r"[A-Za-z]{2,}", full_text))


STOP_RIGHT = {"the", "a", "an", "each", "use", "more", "all", "which", "this", "that", "these", "those",
              "other", "any", "its", "it", "is", "in", "on", "to", "of", "be", "by", "as", "at", "not",
              "new", "both", "one", "two", "example", "and", "can", "may", "will", "are", "was", "has"}


def make_dekerner(vocab: collections.Counter):
    """The groff font in TOGAF 9.1 splits words after the letter 'r':
    'enterpr ise', 'Wor k', 'Ser vice', 'platfor m', 'Por tfolio'.
    Join 'Xr Y' when 'XrY' occurs unsplit elsewhere (study guide or course) and Y is not a stopword."""
    # right fragment is a lookahead so 'for enterpr ise' is not swallowed by the 'for' match
    pat = re.compile(r"\b([A-Za-z]*[rR]) (?=([a-z]{1,9})\b)")

    def fix(m):
        a, b = m.group(1), m.group(2)
        if b not in STOP_RIGHT and vocab[(a + b).lower()] >= 2:
            return a  # drop the space
        return m.group(0)

    def run(text: str) -> str:
        for _ in range(2):  # double splits like 'infor mation'
            text = pat.sub(fix, text)
        return text
    return run


def tidy(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"(?<![.:;!?•\n])\n(?=[a-z(])", " ", text)  # re-flow wrapped lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# ---------------------------------------------------------------------------
# Section slicing
# ---------------------------------------------------------------------------


def section_no(title: str) -> str | None:
    m = re.match(r"^\s*(?:Chapter\s+)?([A-Z]?\d+(?:\.\d+)*|[A-Z](?:\.\d+)*)\b", title)
    return m.group(1) if m else None


def lookup(rules: dict, num: str | None, title: str):
    if num is None:
        key = title.split()[0] if title.split() else ""
        return rules.get(key, SKIP)
    parts = num.split(".")
    for i in range(len(parts), 0, -1):
        k = ".".join(parts[:i])
        if k in rules:
            return rules[k]
    return SKIP


def load(pdf_path: str, kind: str):
    doc = pymupdf.open(pdf_path)
    pages = [normalize(page_text(p, FOOTER_Y[kind])) for p in doc]
    toc = [(lvl, title.strip(), page) for lvl, title, page in doc.get_toc() if page > 0]
    return pages, toc


def find_heading(page: str, num: str, title_words: str, start: int = 0) -> int:
    """Locate a section heading inside a page. Headings render as '7.2 \\nApproach' or '23.6.1 Business Principles'."""
    t = re.escape(title_words.split()[0]) if title_words else ""
    pat = re.compile(rf"(?m)^\s*{re.escape(num)}\s*\n?\s*{t}")
    m = pat.search(page, start)
    return m.start() if m else -1


def slice_sections(pages: list[str], toc: list, kind: str):
    """Yield (num, title, level, breadcrumb[], page_start, page_end, raw_text) for every TOC node,
    cut at heading positions; parent text = intro text before its first child."""
    flat = []
    stack: list[str] = []
    for lvl, title, page in toc:
        stack = stack[: lvl - 1] + [title]
        num = section_no(title)
        flat.append({"lvl": lvl, "title": title, "num": num, "page": page - 1, "crumb": list(stack)})
    # resolve character offsets in a concatenated document
    offsets, acc = [], 0
    for p in pages:
        offsets.append(acc)
        acc += len(p) + 1
    full = "\n".join(pages)
    for node in flat:
        pos = -1
        if node["num"]:
            words = node["title"][len(node["num"]):].strip() if node["title"].startswith(node["num"]) else \
                node["title"].split(None, 2)[-1]
            for pg in (node["page"], node["page"] + 1):
                if 0 <= pg < len(pages):
                    rel = find_heading(pages[pg], node["num"], words)
                    if rel >= 0:
                        pos = offsets[pg] + rel
                        break
        node["found"] = pos >= 0
        node["pos"] = pos if pos >= 0 else offsets[node["page"]]
    missed = [n["title"] for n in flat if n["num"] and not n["found"]]
    print(f"[{kind}] headings anchored: {sum(n['found'] for n in flat)}/{sum(1 for n in flat if n['num'])}"
          f" (unanchored fall back to page start): {missed[:8]}")
    flat.sort(key=lambda n: (n["pos"], n["lvl"]))
    for i, node in enumerate(flat):
        end = flat[i + 1]["pos"] if i + 1 < len(flat) else len(full)
        text = full[node["pos"]:end]
        pend = max(j for j, o in enumerate(offsets) if o <= max(node["pos"], end - 1))
        yield node["num"], node["title"], node["lvl"], node["crumb"], node["page"] + 1, pend + 1, text

# ---------------------------------------------------------------------------
# Content-aware splitting
# ---------------------------------------------------------------------------
TARGET_TOK, MAX_TOK, MIN_TOK = 450, 800, 60


def ntok(s: str) -> int:
    return int(len(s.split()) * 1.35)


def split_principles(text: str):
    parts = re.split(r"(?m)^(?=Principle \d+:)", text)
    return [p for p in parts if p.strip()]


ARTIFACT_HEAD = re.compile(r"(?m)^(?=[A-Z][A-Za-z/&,\- ]{3,70} (?:Catalog|Matrix|Diagram)s?\s*$)")


def split_artifacts(text: str):
    parts = [p for p in ARTIFACT_HEAD.split(text) if p.strip()]
    # drop the one-line "The following describes catalogs, matrices..." preamble
    return [p for p in parts if not (p.lstrip().startswith("The following") and ntok(p) < 60)]


def split_by_size(text: str):
    if ntok(text) <= MAX_TOK:
        return [text]
    paras = re.split(r"\n(?=\S)", text)
    out, cur = [], ""
    for p in paras:
        if cur and ntok(cur + "\n" + p) > TARGET_TOK:
            out.append(cur)
            tail = " ".join(cur.split()[-40:])  # ~50-token overlap for continuity
            cur = tail + "\n" + p
        else:
            cur = (cur + "\n" + p) if cur else p
    if cur.strip():
        out.append(cur)
    return out


ADM_SUBSECTION = {"1": "objectives", "2": "approach", "3": "inputs", "4": "steps", "5": "outputs"}


def content_type_for(num: str | None, title: str, default: str, kind: str = "course") -> str:
    """ADM phase chapters 6-17 of TOGAF 9.1 all follow x.1 Objectives / x.2 Approach / x.3 Inputs /
    x.4 Steps / x.5 Outputs - so 8.4.2 'Develop Baseline Business Architecture' is a 'steps' chunk."""
    if kind == "course" and num and default in ("approach", "governance"):
        parts = num.split(".")
        if parts[0].isdigit() and 6 <= int(parts[0]) <= 17 and len(parts) >= 2 and parts[1] in ADM_SUBSECTION:
            return ADM_SUBSECTION[parts[1]]
    leaf = title.split()[-1].lower() if title.split() else ""
    if default == "approach" and leaf in STEP_TITLES:
        return STEP_TITLES[leaf]
    return default


def chunk_pdf(pdf_path: str, kind: str, label: str, rules: dict, dekern):
    pages, toc = load(pdf_path, kind)
    for num, title, lvl, crumb, p0, p1, raw in slice_sections(pages, toc, kind):
        if kind == "guide" and any(s in title for s in GUIDE_SKIP_TITLES):
            continue
        rule = lookup(rules, num, title)
        if rule == SKIP:
            continue
        phases, screens, ctype, prio = rule
        ctype = content_type_for(num, title, ctype, kind)
        body = tidy(dekern(raw))
        # drop the heading line itself from the body (it is in the breadcrumb)
        body = re.sub(rf"^\s*{re.escape(num or '')}\s*\n?[^\n]*\n", "", body, count=1) if num else body
        if ntok(body) < 15:
            continue  # pure container heading with no intro text
        if num and num.startswith("23.6."):
            pieces = split_principles(body)
        elif num and num.startswith("35.6."):
            pieces = split_artifacts(body)
        else:
            pieces = [body]
        pieces = [s for p in pieces for s in split_by_size(p)]
        breadcrumb = " > ".join([label] + [c for c in crumb if c not in ("ADM", "Introduction")])
        for k, piece in enumerate(pieces):
            first_line = piece.strip().split("\n", 1)[0][:80]
            sub = first_line if (num or "").startswith(("23.6.", "35.6.")) else ""
            yield {
                "id": f"{kind}:{num or title[:20]}:{k}",
                "source": kind,
                "section_no": num,
                "title": title,
                "subtitle": sub,
                "breadcrumb": breadcrumb,
                "pdf_page_start": p0,
                "pdf_page_end": p1,
                "adm_phases": phases,
                "screens": screens,
                "content_type": ("principle" if re.match(r"Principle \d+:", sub)
                                 else "technique" if ctype == "principle" else ctype),
                "priority": prio,
                "n_tokens": ntok(piece),
                # text that gets embedded: breadcrumb + body
                "text": f"[{breadcrumb}{' > ' + sub if sub else ''}]\n{piece.strip()}",
            }


def merge_small(chunks: list[dict]) -> list[dict]:
    """Merge chunks below MIN_TOK into the previous chunk of the same section (definitions excepted)."""
    out: list[dict] = []
    for c in chunks:
        if (out and c["n_tokens"] < MIN_TOK and c["content_type"] not in ("definition", "principle", "artifact")
                and out[-1]["section_no"] == c["section_no"]):
            out[-1]["text"] += "\n" + c["text"].split("\n", 1)[-1]
            out[-1]["n_tokens"] += c["n_tokens"]
            out[-1]["pdf_page_end"] = c["pdf_page_end"]
        else:
            out.append(c)
    return out


def build_chunks(course: str, guide: str | None = None) -> list[dict]:
    """Chunk the course book (and optionally the study guide). Same output as the CLI, returned in memory."""
    all_text = "\n".join(normalize(p.get_text()) for p in pymupdf.open(course))
    if guide:
        all_text += "\n".join(normalize(p.get_text()) for p in pymupdf.open(guide))
    dekern = make_dekerner(build_vocab(all_text))

    chunks = list(chunk_pdf(course, "course", "TOGAF 9.1", COURSE_RULES, dekern))
    if guide:
        chunks += list(chunk_pdf(guide, "guide", "TOGAF Study Guide", GUIDE_RULES, dekern))
    chunks = merge_small(chunks)
    seen = collections.Counter()
    for c in chunks:
        seen[c["id"]] += 1
        if seen[c["id"]] > 1:
            c["id"] += f"-{seen[c['id']]}"
    return chunks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--course", required=True)
    ap.add_argument("--guide", required=False)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    chunks = build_chunks(a.course, a.guide)
    with open(a.out, "w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    by_screen = collections.Counter(s for c in chunks for s in c["screens"])
    by_phase = collections.Counter(p for c in chunks for p in c["adm_phases"])
    print(f"{len(chunks)} chunks -> {a.out}")
    print("by screen:", dict(by_screen))
    print("by phase :", dict(by_phase))


if __name__ == "__main__":
    main()

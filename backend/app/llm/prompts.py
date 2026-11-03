"""Prompt builders and JSON schemas for the 6 AI call types. Every prompt carries the grounding contract."""
from __future__ import annotations

import json

GROUNDING_CONTRACT = """GROUNDING CONTRACT (mandatory):
- Answer ONLY from the numbered TOGAF excerpts and the CIL facts below. TOGAF 9.1 is the ground truth for method.
- Cite excerpts as [n] using their numbers. Every TOGAF claim must carry at least one citation.
- If something is not in the excerpts, say "not covered by TOGAF excerpts" instead of inventing it.
- Never invent vendor names, products, people, dates or numbers. Use only numbers given in CIL facts; write TBD otherwise.
- Numbers in CIL facts were computed by deterministic rules; do not recompute or change them.
- Data marked "assumed" is a demo placeholder: phrase it as "to validate in discovery", never as fact.
- Consultant tone: short, specific, no filler, no emojis."""


def excerpts_block(hits: list[dict]) -> str:
    if not hits:
        return "TOGAF EXCERPTS: none retrieved."
    lines = ["TOGAF EXCERPTS:"]
    for n, h in enumerate(hits, start=1):
        lines.append(f"[{n}] {h['label']} | {h['breadcrumb']}\n{h['text']}")
    return "\n\n".join(lines)


def _facts(facts: dict | str) -> str:
    return facts if isinstance(facts, str) else json.dumps(facts, ensure_ascii=False, indent=1)


def build(task: str, facts: dict | str, hits: list[dict]) -> str:
    return (f"You are a TOGAF 9.1 enterprise architecture coach on a Coromandel International (CIL) EA assessment.\n\n"
            f"{GROUNDING_CONTRACT}\n\nTASK:\n{task}\n\nCIL FACTS:\n{_facts(facts)}\n\n{excerpts_block(hits)}")


CITED_ITEM = {"type": "object", "properties": {"text": {"type": "string"},
                                               "cites": {"type": "array", "items": {"type": "integer"}}},
              "required": ["text", "cites"]}

SCHEMAS = {
    "coach": {"type": "object", "properties": {
        "guidance": {"type": "array", "items": CITED_ITEM, "minItems": 4, "maxItems": 6},
        "next_actions": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 2}},
        "required": ["guidance", "next_actions"]},
    "ask": {"type": "object", "properties": {"answer": {"type": "string"},
                                             "cites": {"type": "array", "items": {"type": "integer"}}},
            "required": ["answer", "cites"]},
    "draft_vision": {"type": "object", "properties": {
        "vision_statement": {"type": "string"}, "ai_ambition": {"type": "string"},
        "objectives": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 5},
        "success_measures": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 5},
        "cites": {"type": "array", "items": {"type": "integer"}}},
        "required": ["vision_statement", "ai_ambition", "objectives", "success_measures", "cites"]},
    "vision_statements": {"type": "object", "properties": {"statements": {"type": "array", "minItems": 5, "maxItems": 5, "items": {
        "type": "object", "properties": {"title": {"type": "string"}, "statement": {"type": "string"},
                                         "drivers": {"type": "array", "items": {"type": "string"}},
                                         "evidence": {"type": "array", "items": {"type": "string"}},
                                         "cites": {"type": "array", "items": {"type": "integer"}}},
        "required": ["title", "statement", "drivers", "cites"]}}}, "required": ["statements"]},
    "suggest_principle": {"type": "object", "properties": {
        "name": {"type": "string"}, "statement": {"type": "string"}, "rationale": {"type": "string"},
        "implications": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 4},
        "category": {"type": "string"}, "togaf_basis": {"type": "string"},
        "cites": {"type": "array", "items": {"type": "integer"}}},
        "required": ["name", "statement", "rationale", "implications", "category", "cites"]},
    "map_apps": {"type": "object", "properties": {"mappings": {"type": "array", "items": {
        "type": "object", "properties": {"app_id": {"type": "string"},
                                         "caps": {"type": "array", "items": {"type": "string"}},
                                         "confidence": {"type": "number"}},
        "required": ["app_id", "caps", "confidence"]}}}, "required": ["mappings"]},
    "findings": {"type": "object", "properties": {
        "findings": {"type": "array", "items": CITED_ITEM, "minItems": 3, "maxItems": 4},
        "recommendations": {"type": "array", "items": CITED_ITEM, "minItems": 3, "maxItems": 3}},
        "required": ["findings", "recommendations"]},
    "initiative_briefs": {"type": "object", "properties": {"briefs": {"type": "array", "items": {
        "type": "object", "properties": {"theme_id": {"type": "string"}, "summary": {"type": "string"},
                                         "outcomes": {"type": "array", "items": {"type": "string"},
                                                      "minItems": 3, "maxItems": 3},
                                         "cites": {"type": "array", "items": {"type": "integer"}}},
        "required": ["theme_id", "summary", "outcomes", "cites"]}}}, "required": ["briefs"]},
}

TASKS = {
    "coach": ("Give 4-6 guidance bullets on how TOGAF says this screen's work ({screen}) should be done, applied to the "
              "CIL state. Each bullet <= 30 words with cites. Then exactly 2 concrete next actions for the CIL team."),
    "ask": "Answer the user's question in <= 120 words using the excerpts, with [n] citations. Question: {q}",
    "draft_vision": ("Draft the Architecture Vision (TOGAF Phase A) for CIL: a 1-2 sentence vision statement, a 1-2 "
                     "sentence AI ambition, 3-5 architecture objectives and 3-5 measurable success measures (no "
                     "invented numbers: use 'target TBD' where a figure is needed). Ground the structure in the excerpts."),
    "vision_statements": ("Read the context notes and document excerpts, then write exactly 5 Architecture Vision statements "
                          "for CIL (TOGAF Phase A). Each has a 3-6 word title and a 1-2 sentence statement (<= 45 words) "
                          "describing the target state, the driver ids it answers, and up to 2 short evidence quotes taken "
                          "verbatim from the documents. Cover different themes; no invented numbers, vendors or dates."),
    "suggest_principle": ("Suggest ONE new architecture principle for CIL in the TOGAF §23.4 template: name (<= 6 words), "
                          "statement, rationale and 2-4 implications, plus a category (Business, Data, Application, "
                          "Technology, Security or AI) and the TOGAF principle it builds on. It must not duplicate "
                          "already_adopted, and should address a theme in the context, drivers or the hint."),
    "map_apps": ("Map each application to 1-3 capability L2 ids from the given L2 list only, with confidence 0-1. "
                 "Use names and descriptions; do not invent ids."),
    "findings": ("Write exactly {n} insights (as findings) and 3 recommendations for the {screen} view, in a concise "
                 "consultant tone. Insights interpret the computed rule outputs and tab_insights (quote their numbers exactly). Recommendations say what TOGAF prescribes next. "
                 "Each item <= 35 words with cites."),
    "initiative_briefs": ("For every initiative write a 2-sentence summary and exactly 3 outcomes, grounded in its gaps "
                          "and the TOGAF migration-planning excerpts. Return one brief per theme_id."),
}

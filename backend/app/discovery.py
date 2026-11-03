"""Current-state discovery helpers: build an L3 questionnaire from the template and draft survey emails.
Deterministic today; the AI layer can replace generate_questions later without changing the stored shape."""
from __future__ import annotations

import copy

from .db import read_seed

REPLY_TO = "KPMG EA team"
DOMAIN = "coromandel.com"


def generate_questions(l3: dict) -> list[dict]:
    """Template questions worded for this L3, plus one contextual question for its standard-practice reference."""
    d = read_seed()["discovery"]
    qs = []
    for q in copy.deepcopy(d["template"]):
        q["text"] = q["text"].replace("{l3}", l3["name"].split(" (")[0].lower() if q["id"] != "owner" else l3["name"])
        if q.get("options"):
            q["options"] = list(q["options"])
        qs.append(q)
    ctx = d["contextual"].get(l3.get("ref") or "", d["generic_context"].replace("{l3}", l3["name"]))
    qs.append({"id": "context", "dim": None, "type": "text", "label": "Process context", "text": ctx, "generated": True,
               "help": "Specific to this process: facts and figures help us size the gap. Approximate numbers are fine."})
    return qs


def _question_lines(qs: list[dict], explain: bool) -> list[str]:
    out = []
    for i, q in enumerate(qs, start=1):
        out.append(f"{i}. {q['label']}")
        if explain and q.get("help"):
            out.append(f"   What we mean: {q['help']}")
    return out


def attachment(l3: dict, qs: list[dict]) -> dict:
    """The Excel questionnaire that goes with the survey email (described, not generated, in the POC)."""
    slug = "_".join(w for w in "".join(ch if ch.isalnum() else " " for ch in l3["name"].split(" (")[0]).split()[:4])
    return {"name": f"Discovery_Questionnaire_{l3['id']}_{slug}.xlsx", "size_kb": 18 + 2 * len(qs),
            "sheets": ["Instructions", f"Questionnaire ({len(qs)} questions)", "Reply options"],
            "columns": ["#", "Question", "What we mean", "Answer (select 1-5 or type)", "Comments (free text)"]}


def email_draft(l3: dict, l2: dict, l1: dict, survey: dict, kind: str = "initial") -> dict:
    """kind = initial | explain (after a walkthrough request) | redirect (to the owner named in the reply)."""
    opts = read_seed()["discovery"]["response_options"]
    rec = survey.get("recipient") or {}
    to_role = survey.get("redirect_to") if kind == "redirect" and survey.get("redirect_to") else rec.get("role") or l2.get("owner") or "Process owner"
    qs = survey.get("questions") or []
    explain = kind == "explain"
    att = attachment(l3, qs)
    subject = (f"EA current-state discovery: {l3['name']} ({l3['id']})" if kind != "explain"
               else f"Walkthrough and guidance: {l3['name']} ({l3['id']}) discovery questions")
    intro = {
        "initial": [f"Dear {to_role},",
                    "",
                    f"As part of the Enterprise Architecture programme, we are documenting how {l2['name']} works today "
                    f"across plants, regions and entities. You have been identified as the business owner for "
                    f"\"{l3['name']}\" ({l1['name']} › {l2['name']}).",
                    "",
                    f"Could you spend 15 minutes on the attached questionnaire ({len(qs)} questions)? Pick the option that best "
                    "describes how the process runs today and add any comments in the free-text column. Your answers feed the "
                    "capability assessment and gap register that will shape the 2030 roadmap. Approximate answers are fine."],
        "explain": [f"Dear {to_role},",
                    "",
                    f"Thank you for asking for a walkthrough of the \"{l3['name']}\" questions. The attached questionnaire now "
                    "carries a short note under each question on what we are looking for. We can also take you through it on a "
                    "30-minute call; reply with a convenient slot this week."],
        "redirect": [f"Dear {to_role},",
                     "",
                     f"{rec.get('role') or 'The previous recipient'} suggested you are the right owner for \"{l3['name']}\" "
                     f"({l1['name']} › {l2['name']}). Could you help us with the attached questionnaire ({len(qs)} questions)? "
                     "Approximate answers are fine."],
    }[kind]
    body = intro + ["", "When you reply, please choose one of these options:"] + [f"  [{o['label']}] {o['hint']}" for o in opts] + \
        ["", "The questionnaire covers:"] + _question_lines(qs, explain) + \
        ["", "Your answers are used only for the architecture assessment and will be played back to you before they are final.",
         "", "Regards,", REPLY_TO, "Enterprise Architecture programme"]
    return {"to_role": to_role, "to": rec.get("email", "") if kind != "redirect" else "", "cc": f"ea.office@{DOMAIN}",
            "domain": DOMAIN, "subject": subject, "body": "\n".join(body), "kind": kind, "attachment": att,
            "options": [{"key": o["key"], "label": o["label"]} for o in opts]}

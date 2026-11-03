"""xlsx templates (download), upload validation and table exports."""
from __future__ import annotations

import io
from typing import Any

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

NAVY = "0B2A6F"
HEAD_FILL = PatternFill("solid", fgColor=NAVY)
HEAD_FONT = Font(bold=True, color="FFFFFF")
YN = ["Y", "N"]
SCORE = [1, 2, 3, 4, 5]

QUESTIONNAIRE_COLS = [
    {"key": "id", "label": "Capability ID", "required": True}, {"key": "l1", "label": "L1 capability"},
    {"key": "name", "label": "L2 capability"},
    {"key": "process", "label": "Process standardisation (1-5)", "enum": SCORE, "required": True},
    {"key": "digital", "label": "Technology & AI enablement (1 Manual ... 5 Agentic AI)", "enum": SCORE, "required": True},
    {"key": "data", "label": "Data availability & trust (1-5)", "enum": SCORE, "required": True},
    {"key": "integration", "label": "Integration & hand-offs (1-5)", "enum": SCORE, "required": True},
    {"key": "importance", "label": "Importance to 2030 strategy (1-5)", "enum": SCORE, "required": True}]
APP_TEXT = ("name", "description", "vendor", "version", "type", "layer", "business_owner", "it_owner", "users", "hosting",
            "platform", "customisation", "licence_model", "support_model", "contract_end", "scalability", "dr",
            "standards_class", "lifecycle", "retire_date", "interfaces", "run_cost", "issues")

DATA_COLS = [
    {"key": "id", "label": "Domain ID", "required": True}, {"key": "name", "label": "Data domain", "required": True},
    {"key": "owner", "label": "Named business owner?", "enum": YN},
    {"key": "sor", "label": "System of record (App ID)"},
    {"key": "mdm", "label": "MDM", "enum": ["none", "partial", "full"]},
    {"key": "q_completeness", "label": "Completeness (1-5)", "enum": SCORE},
    {"key": "q_accuracy", "label": "Accuracy (1-5)", "enum": SCORE},
    {"key": "q_timeliness", "label": "Timeliness (1-5)", "enum": SCORE},
    {"key": "lineage", "label": "Lineage documented?", "enum": YN},
    {"key": "pii", "label": "Holds personal data?", "enum": YN},
    {"key": "classified", "label": "Privacy & retention classified?", "enum": YN},
    {"key": "consumers", "label": "Consuming apps (App IDs, comma-separated)"}]

README = {
    "applications": ["Application Portfolio intake", "TOGAF 9.1 §35.6.5 Application Portfolio Catalog and §34.6 Application "
                     "Component attributes define these fields.", "One row per application. Use App IDs A27+ for new rows.",
                     "Capabilities served: L2 IDs from the 'Capability L2' sheet, comma-separated.",
                     "Vendor: write TBD if unknown. Never guess a vendor.",
                     "Fields follow the Tech DD data request: business function, version and licences, customisation, "
                     "platform, scalability and redundancy, hosting and support arrangements.",
                     "Fit scores 1-5 drive the disposition (Invest / Retain / Modernise / Replace) at threshold 3.0, "
                     "then the rationalization rules set on Vision & Guardrails."],
    "technology": ["Technology Portfolio intake", "TOGAF 9.1 §35.6.6 Technology Portfolio Catalog and §34.6 Physical "
                   "Technology Component attributes define these fields.", "Standards class follows TOGAF §34.6 "
                   "(Non-Standard ... Retired Standard)."],
    "questionnaire": ["Capability maturity questionnaire (Phase B)", "TOGAF 9.1 §8.4 Phase B steps, §27 Gap Analysis and "
                      "§32 Capability-Based Planning.", "Score each L2 capability 1-5 per dimension using the scale below.",
                      "Maturity = mean(process, digital, data, integration). Gap if importance ≥ 4 and maturity ≤ 2.5."],
    "data_domains": ["Data domain governance (Phase C Data)", "TOGAF 9.1 §35.6.4 Data Entity/Data Component Catalog, "
                     "§34.6 Data Entity attributes, Data principles 10-15 (§23.6.2).",
                     "Score = owner 20 + SoR 10 + MDM 20 + quality 30 + lineage 10 + classified-if-PII 10."],
}

KINDS = ("applications", "technology", "questionnaire", "data_domains")


def _style_header(ws, n_cols: int) -> None:
    for i in range(1, n_cols + 1):
        cell = ws.cell(row=1, column=i)
        cell.fill, cell.font = HEAD_FILL, HEAD_FONT
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(i)].width = 22
    ws.row_dimensions[1].height = 34
    ws.freeze_panes = "A2"


def columns(kind: str, cfg: dict) -> list[dict]:
    if kind in ("applications", "technology"):
        return cfg["templates"][kind]["columns"]
    return QUESTIONNAIRE_COLS if kind == "questionnaire" else DATA_COLS


def sheet_name(kind: str, cfg: dict) -> str:
    if kind in ("applications", "technology"):
        return cfg["templates"][kind]["sheet"]
    return "Capability Questionnaire" if kind == "questionnaire" else "Data Domains"


def _rows_for(kind: str, state: dict) -> list[dict]:
    if kind == "applications":
        out = []
        for a in state["apps"]:
            r = {k: a.get(k) for k in ("id", "criticality") + APP_TEXT}
            r["in_scope"] = "Y" if a.get("in_scope", True) else "N"
            r["caps"] = ", ".join(a["caps"])
            r["sor"] = ", ".join(a.get("sor", []))
            r["pii"] = "Y" if a.get("pii") else ("N" if "pii" in a else None)
            for key, v in zip(("bf_functional_fit", "bf_strategic_alignment", "bf_user_satisfaction"), a["bf"]):
                r[key] = v
            for key, v in zip(("tf_tech_currency", "tf_integration_readiness", "tf_security_compliance", "tf_cost_efficiency"), a["tf"]):
                r[key] = v
            out.append(r)
        return out
    if kind == "technology":
        return [{"id": p["id"], "name": p["name"], "vendor": p.get("vendor"), "version": p.get("version"),
                 "category": p.get("category"), "location": p.get("location"), "standard": p.get("standard"),
                 "lifecycle": p.get("lifecycle"), "eos_date": p.get("eos_date"), "apps": ", ".join(p.get("apps", []))}
                for p in state["tech"]["platforms"]]
    if kind == "questionnaire":
        q = lambda c, i: c["q"][i] if c.get("q") else None  # noqa: E731
        return [{"id": c["id"], "l1": l1["name"], "name": c["name"], "process": q(c, 0), "digital": q(c, 1),
                 "data": q(c, 2), "integration": q(c, 3), "importance": c.get("importance")}
                for l1 in state["caps"]["capabilities"] for c in l1["children"]]
    return [{"id": d["id"], "name": d["name"], "owner": "Y" if d["owner"] else "N", "sor": d["sor"], "mdm": d["mdm"],
             "q_completeness": d["quality"][0], "q_accuracy": d["quality"][1], "q_timeliness": d["quality"][2],
             "lineage": "Y" if d["lineage"] else "N", "pii": "Y" if d["pii"] else "N",
             "classified": "Y" if d["classified"] else "N", "consumers": ", ".join(d["consumers"])} for d in state["data"]]


def build_template(kind: str, state: dict) -> bytes:
    cfg = state["cfg"]
    cols = columns(kind, cfg)
    wb = Workbook()
    readme = wb.active
    readme.title = "README"
    for i, line in enumerate(README[kind], start=1):
        readme.cell(row=i, column=1, value=line).font = Font(bold=(i == 1), size=14 if i == 1 else 11)
    if kind == "questionnaire":
        row = len(README[kind]) + 2
        readme.cell(row=row, column=1, value="Questions and answer scale").font = Font(bold=True)
        for q in state["caps"]["questionnaire"]["questions"]:
            row += 1
            readme.cell(row=row, column=1, value=f"{q.get('label', q['key'])}: {q['text']}").font = Font(bold=True)
            for o in q.get("options", []):
                row += 1
                readme.cell(row=row, column=1, value=f"   {o['n']} = {o['label']}: {o['hint']}")
    readme.column_dimensions["A"].width = 120

    ws = wb.create_sheet(sheet_name(kind, cfg))
    for i, c in enumerate(cols, start=1):
        ws.cell(row=1, column=i, value=c["label"] + (" *" if c.get("required") else ""))
    _style_header(ws, len(cols))
    for r, row in enumerate(_rows_for(kind, state), start=2):
        for i, c in enumerate(cols, start=1):
            ws.cell(row=r, column=i, value=row.get(c["key"]))
    # enum dropdowns (lists live on a hidden sheet to avoid the 255-char formula limit)
    lists = wb.create_sheet("Lists")
    lists.sheet_state = "hidden"
    li = 0
    for i, c in enumerate(cols, start=1):
        if "enum" in c:
            li += 1
            for j, v in enumerate(c["enum"], start=1):
                lists.cell(row=j, column=li, value=v)
            col = get_column_letter(li)
            dv = DataValidation(type="list", formula1=f"=Lists!${col}$1:${col}${len(c['enum'])}", allow_blank=True,
                                showErrorMessage=True, errorTitle="Invalid value", error=f"Pick a value for {c['label']}")
            ws.add_data_validation(dv)
            dv.add(f"{get_column_letter(i)}2:{get_column_letter(i)}500")
    ref = wb.create_sheet("Capability L2")
    ref.append(["L2 ID", "L1", "L2 capability"])
    _style_header(ref, 3)
    ref.column_dimensions["C"].width = 60
    for l1 in state["caps"]["capabilities"]:
        for c in l1["children"]:
            ref.append([c["id"], l1["name"], c["name"]])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# --------------------------------------------------------------------------- upload
def _norm_label(s: Any) -> str:
    return str(s or "").replace("*", "").strip().lower()


def parse_upload(kind: str, content: bytes, cfg: dict) -> tuple[list[dict], list[dict], list[dict]]:
    """Returns (rows, errors, warnings). Rows hold raw values keyed by column key; enum/required checks applied."""
    cols = columns(kind, cfg)
    try:
        wb = load_workbook(io.BytesIO(content), data_only=True)
    except Exception:
        return [], [{"row": 0, "column": "", "message": "Not a valid .xlsx file"}], []
    name = sheet_name(kind, cfg)
    ws = wb[name] if name in wb.sheetnames else next((wb[s] for s in wb.sheetnames if s not in ("README", "Lists", "Capability L2")), None)
    if ws is None:
        return [], [{"row": 0, "column": "", "message": f"Sheet '{name}' not found"}], []
    header = [_norm_label(c.value) for c in ws[1]]
    by_label = {_norm_label(c["label"]): c for c in cols}
    missing = [c["label"] for c in cols if c.get("required") and _norm_label(c["label"]) not in header]
    if missing:
        return [], [{"row": 1, "column": m, "message": "Required column missing"} for m in missing], []
    rows, errors, warnings = [], [], []
    for r_i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if all(v in (None, "") for v in row):
            continue
        rec, ok = {}, True
        for h, v in zip(header, row):
            c = by_label.get(h)
            if not c:
                continue
            if isinstance(v, str):
                v = v.strip()
            if v in (None, ""):
                if c.get("required"):
                    if c["key"] == "caps":  # allow import; flagged for 'Map capabilities with AI'
                        warnings.append({"row": r_i, "column": c["label"], "message": "No capabilities: use Map with AI"})
                    else:
                        errors.append({"row": r_i, "column": c["label"], "message": "Required value missing"})
                        ok = False
                rec[c["key"]] = None
                continue
            if "enum" in c:
                allowed = c["enum"]
                if isinstance(allowed[0], int):
                    try:
                        v = int(float(v))
                    except (TypeError, ValueError):
                        pass
                if v not in allowed:
                    errors.append({"row": r_i, "column": c["label"], "message": f"'{v}' not in {allowed}"})
                    ok = False
                    continue
            rec[c["key"]] = v
        if ok:
            rows.append(rec)
    return rows, errors, warnings


def split_ids(v: Any) -> list[str]:
    return [x.strip() for x in str(v or "").replace(";", ",").split(",") if x.strip()]


def app_from_row(r: dict, existing: dict | None, l2_ids: set[str], warnings: list, row_no: int) -> dict:
    a = dict(existing or {})
    for k in APP_TEXT:
        if r.get(k) is not None:
            a[k] = r[k]
    if r.get("in_scope") is not None:
        a["in_scope"] = r["in_scope"] == "Y"
    a["id"] = r["id"]
    a.setdefault("vendor", "TBD")
    a.setdefault("type", "COTS")
    a.setdefault("hosting", "Unknown")
    a.setdefault("lifecycle", "Unknown")
    caps = split_ids(r.get("caps"))
    bad = [c for c in caps if c not in l2_ids]
    if bad:
        warnings.append({"row": row_no, "column": "Capabilities", "message": f"Unknown L2 ids ignored: {', '.join(bad)}"})
    a["caps"] = [c for c in caps if c in l2_ids] if r.get("caps") is not None else a.get("caps", [])
    a["sor"] = split_ids(r.get("sor")) if r.get("sor") is not None else a.get("sor", [])
    if r.get("pii") is not None:
        a["pii"] = r["pii"] == "Y"
    a["criticality"] = int(r["criticality"]) if r.get("criticality") is not None else a.get("criticality", 3)
    bf_keys = ("bf_functional_fit", "bf_strategic_alignment", "bf_user_satisfaction")
    tf_keys = ("tf_tech_currency", "tf_integration_readiness", "tf_security_compliance", "tf_cost_efficiency")
    prev_bf, prev_tf = a.get("bf", [3, 3, 3]), a.get("tf", [3, 3, 3, 3])
    a["bf"] = [int(r[k]) if r.get(k) is not None else prev_bf[i] for i, k in enumerate(bf_keys)]
    a["tf"] = [int(r[k]) if r.get(k) is not None else prev_tf[i] for i, k in enumerate(tf_keys)]
    if existing is None and any(r.get(k) is None for k in bf_keys + tf_keys):
        warnings.append({"row": row_no, "column": "Fit scores", "message": "Missing fit scores defaulted to 3"})
    a.setdefault("in_scope", a.get("hosting") != "RISE (SAP-managed)")
    return a


def data_from_row(r: dict, existing: dict | None) -> dict:
    d = dict(existing or {"consumers": [], "quality": [3, 3, 3]})
    d["id"], d["name"] = r["id"], r.get("name") or d.get("name", r["id"])

    def yn(key, default=False):
        return (r[key] == "Y") if r.get(key) is not None else d.get(key, default)
    for k in ("owner", "lineage", "pii", "classified"):
        d[k] = yn(k)
    if r.get("sor") is not None:
        d["sor"] = str(r["sor"])
    d.setdefault("sor", "")
    d["mdm"] = r.get("mdm") or d.get("mdm", "none")
    q = d.get("quality", [3, 3, 3])
    d["quality"] = [int(r[k]) if r.get(k) is not None else q[i] for i, k in enumerate(("q_completeness", "q_accuracy", "q_timeliness"))]
    if r.get("consumers") is not None:
        d["consumers"] = split_ids(r["consumers"])
    return d


# --------------------------------------------------------------------------- exports
def export_table(title: str, rows: list[dict]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31]
    if rows:
        keys = list(rows[0].keys())
        ws.append(keys)
        _style_header(ws, len(keys))
        for r in rows:
            ws.append([", ".join(map(str, v)) if isinstance(v, list) else v for v in (r.get(k) for k in keys)])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()

"""Every screen endpoint works with no API key; AI calls degrade to the deterministic fallback."""
import io

import pytest
from openpyxl import load_workbook

SCREENS = ["overview", "vision", "business", "applications", "data_tech", "roadmap"]


@pytest.mark.parametrize("screen", SCREENS)
def test_screen_endpoints(client, screen):
    r = client.get(f"/api/{screen}")
    assert r.status_code == 200
    assert "kpis" in r.json()


def test_overview_golden(client):
    o = client.get("/api/overview").json()
    assert o["kpis"]["acmm_mean"] == 1.56
    assert o["kpis"]["avg_cap_maturity"] == 2.48
    assert o["kpis"]["total_cr"] == [31.5, 79.5]
    assert {d["name"]: d["count"] for d in o["dispositions"]} == {"Invest": 11, "Retain": 3, "Modernise": 6, "Replace": 4, "Out of scope": 2}
    assert len(o["adm"]) == 10 and len(o["top_gaps"]) == 5
    assert len(o["views"]) == 14 and o["states"]["metrics"] and len(o["states"]["columns"]) == 6
    assert sum(len(x["apps"]) for x in o["landscape"]["layers"]) == 26


def test_vision_principles(client):
    v = client.get("/api/vision").json()
    assert len(v["principles"]["togaf"]) == 21 and len(v["principles"]["cil"]) == 10
    assert v["kpis"]["ai_total"] == 8


@pytest.mark.parametrize("screen", SCREENS)
def test_coach_and_findings_without_key(client, screen):
    c = client.post(f"/api/coach/{screen}").json()
    assert c["mode"] == "fallback" and len(c["guidance"]) >= 1 and len(c["next_actions"]) == 2
    f = client.post(f"/api/findings/{screen}").json()
    assert f["mode"] == "fallback" and len(f["findings"]) == 3


def test_coach_citations(client):
    c = client.post("/api/coach/business").json()
    assert c["citations"] and all("label" in h and "text" in h for h in c["citations"])
    assert all(1 <= n <= len(c["citations"]) for g in c["guidance"] for n in g["cites"])


def test_ask_and_ai_calls_without_key(client):
    assert client.post("/api/coach/ask", json={"q": "What is a capability gap?", "screen": "business"}).json()["mode"] == "fallback"
    d = client.post("/api/vision/draft").json()
    assert d["vision_statement"] and 3 <= len(d["objectives"]) <= 5
    b = client.post("/api/roadmap/briefs").json()
    assert len(b["briefs"]) == 10
    m = client.post("/api/applications/map", json={"app_ids": ["A14"]}).json()
    assert m["method"] == "keyword"


def test_capability_update_recomputes(client):
    before = client.get("/api/business").json()["kpis"]["avg_maturity"]
    r = client.put("/api/business/capabilities/C08.4", json={"q": [5, 5, 5, 5], "importance": 4})
    assert r.status_code == 200 and r.json()["kpis"]["avg_maturity"] > before
    client.put("/api/business/capabilities/C08.4", json={"q": [1, 1, 1, 1], "importance": 4})


@pytest.mark.parametrize("kind", ["applications", "technology", "questionnaire", "data_domains"])
def test_template_roundtrip(client, kind):
    r = client.get(f"/api/templates/{kind}")
    assert r.status_code == 200
    wb = load_workbook(io.BytesIO(r.content))
    assert "README" in wb.sheetnames and "Capability L2" in wb.sheetnames
    up = client.post(f"/api/templates/{kind}/upload", files={"file": ("t.xlsx", r.content)}).json()
    assert up["imported"] > 0 and up["errors"] == []


def test_upload_rejects_bad_enum(client):
    wb = load_workbook(io.BytesIO(client.get("/api/templates/questionnaire").content))
    ws = wb["Capability Questionnaire"]
    ws["D2"] = 9
    buf = io.BytesIO()
    wb.save(buf)
    up = client.post("/api/templates/questionnaire/upload", files={"file": ("t.xlsx", buf.getvalue())}).json()
    assert any(e["row"] == 2 for e in up["errors"])


def test_settings_and_reset(client):
    s = client.get("/api/settings").json()
    assert s["llm"]["has_key"] is False and s["config"]["rationalization"]["threshold"] == 3.0
    client.put("/api/settings/config", json={"patch": {"rationalization": {"threshold": 3.5}}})
    assert client.get("/api/applications").json()["threshold"] == 3.5
    client.post("/api/settings/reset")
    assert client.get("/api/applications").json()["threshold"] == 3.0
    assert client.get("/api/overview").json()["kpis"]["total_cr"] == [31.5, 79.5]


def test_decision_log(client):
    d = client.post("/api/roadmap/decisions", json={"title": "Test decision", "principles": ["TOGAF-21"]}).json()
    assert d["id"]
    assert client.delete(f"/api/roadmap/decisions/{d['id']}").status_code == 200


def test_catalog_editing(client):
    b = client.get("/api/business").json()
    assert b["kpis"]["n_l0"] == 5 and len(b["reference"]) == 324 and b["ladder"][4]["label"] == "Agentic AI"
    r = client.post("/api/business/catalog/from_reference", json={"ref": "R4.3.5"}).json()
    new = r["added"][0]
    assert new.startswith("C07.") and r["coverage"]["adopted"] == 46
    c = next(x for l1 in r["l1"] for x in l1["children"] if x["id"] == new)
    assert not c["assessed"] and c["ref"] == "R4.3.5" and len(c["l3"]) == 3 and c["l3"][0]["id"] == f"{new}.1"
    r = client.post("/api/business/catalog/from_reference", json={"ref": "R1.2.1.4"}).json()
    assert r["added"] == ["C01.1.4"] and r["coverage"]["l3_adopted"] == 157 + 3
    client.delete("/api/business/catalog/C01.1.4")
    r = client.put(f"/api/business/capabilities/{new}", json={"q": [2, 4, 2, 2], "importance": 5, "apps": ["A06", "A07"]}).json()
    c = next(x for l1 in r["l1"] for x in l1["children"] if x["id"] == new)
    assert c["assessed"] and c["ai_level"] == "AI-enabled" and {a["id"] for a in c["apps"]} == {"A06", "A07"}
    r = client.post("/api/business/catalog", json={"level": 1, "parent": "L0-5", "name": "Governance, Risk & Compliance"}).json()
    l1 = next(x for x in r["l1"] if x["name"] == "Governance, Risk & Compliance")
    r = client.put(f"/api/business/catalog/{l1['id']}", json={"fields": {"owner": "Chief Risk Officer"}}).json()
    assert next(x for x in r["l1"] if x["id"] == l1["id"])["owner"] == "Chief Risk Officer"
    r = client.delete(f"/api/business/catalog/{new}").json()
    assert new in r["deleted"]
    assert all(new not in a["caps"] for a in client.get("/api/applications").json()["apps"])
    client.delete(f"/api/business/catalog/{l1['id']}")


def test_application_intake_and_override(client):
    r = client.post("/api/applications", json={"fields": {"name": "Spreadsheet scheme tracker", "type": "Ad hoc tool",
                                                          "caps": ["C05.3"], "bf": [2, 2, 2], "tf": [2, 2, 2, 2],
                                                          "business_owner": "Head of Sales"}}).json()
    aid = r["id"]
    a = next(x for x in client.get("/api/applications").json()["apps"] if x["id"] == aid)
    assert a["source"] == "client" and a["computed"]["label"] == "Replace"
    bad = client.put(f"/api/applications/{aid}", json={"fields": {"override": {"disposition": "Invest"}}})
    assert bad.status_code == 422
    client.put(f"/api/applications/{aid}", json={"fields": {"override": {"disposition": "Tolerate", "reason": "Sunset FY28"}}})
    a = next(x for x in client.get("/api/applications").json()["apps"] if x["id"] == aid)
    assert a["computed"]["label"] == "Retain" and a["computed"]["overridden"]
    r = client.post("/api/applications/interfaces", json={"from": aid, "to": "A01", "data": "Schemes", "pattern": "Manual / re-key"}).json()
    assert any(i["from"] == aid for i in r["interfaces"])
    assert client.delete(f"/api/applications/{aid}").status_code == 200
    assert all(i["from"] != aid for i in client.get("/api/applications").json()["interfaces"])


def test_rules_and_guidelines_configurable(client):
    v = client.put("/api/vision/rules", json={"rules": [{"id": "RR-04", "enabled": True}, {"id": "RR-01", "enabled": False}]}).json()
    on = {x["id"]: x["enabled"] for x in v["rules"]["rules"]}
    assert on["RR-04"] and on["RR-01"]  # RR-01 is locked
    a = client.get("/api/applications").json()
    assert a["kpis"]["dispositions"]["Consolidate"] > 0
    v = client.put("/api/vision/rules", json={"labels": {"Eliminate": {"label": "Retire"}}}).json()
    assert v["rules"]["labels"]["Eliminate"]["label"] == "Retire"
    client.post("/api/vision/rules/reset")
    assert client.get("/api/applications").json()["kpis"]["dispositions"]["Consolidate"] == 0
    v = client.post("/api/vision/guidelines", json={"kind": "guardrail", "name": "No shadow SaaS", "statement": "x"}).json()
    g = next(x for x in v["guardrails"] if x["name"] == "No shadow SaaS")
    assert g["source"] == "client"
    assert client.delete(f"/api/vision/guidelines/{g['id']}").status_code == 200


def _is_xp(x):
    return isinstance(x, dict) and x["title"] and x["result"] and isinstance(x["lines"], list)


@pytest.mark.parametrize("screen", SCREENS)
def test_every_kpi_is_explained(client, screen):
    d = client.get(f"/api/{screen}").json()
    assert d["explain"] and all(_is_xp(x) for x in d["explain"].values())


def test_computed_rows_are_explained(client):
    b = client.get("/api/business").json()
    assert all(_is_xp(c["explain"]) for l1 in b["l1"] for c in l1["children"] if c["assessed"])
    assert all(_is_xp(g["explain"]) for g in b["gaps"])
    a = client.get("/api/applications").json()
    assert all(_is_xp(x["computed"]["explain"]) for x in a["apps"]) and all(_is_xp(c["explain"]) for c in a["clusters"])
    d = client.get("/api/data_tech").json()
    assert all(_is_xp(x["computed"]["explain"]) for x in d["domains"]) and len(d["check_explain"]) == 10
    r = client.get("/api/roadmap").json()
    assert all(_is_xp(i["explain"]) for i in r["initiatives"]) and all(_is_xp(g["explain"]) for g in r["gaps"])
    assert any(ln["label"] == "Grouped into" for ln in r["gaps"][0]["explain"]["lines"])
    o = client.get("/api/overview").json()
    assert all(_is_xp(n["explain"]) for n in o["adm"])
    v = client.get("/api/vision").json()
    assert all(_is_xp(i["explain"]) for i in v["ai_initiatives"])

def test_discovery_seed_matches_baseline(client):
    b = client.get("/api/business").json()
    k = b["kpis"]
    assert k["n_l3"] == 156 and k["responded"] == 73 and k["analysed_l2"] == 19 and k["avg_maturity"] == 2.48 and k["gaps"] == 23
    c = next(x for l1 in b["l1"] for x in l1["children"] if x["id"] == "C04.1")
    d = c["discovery"]
    assert d["analysed"] and not d["stale"] and d["inference"]["q"] == [3, 2, 2, 2] and d["inference"]["importance"] == 5
    assert [x["value"] for x in d["inference"]["dims"]] == [3, 2, 2, 2, 5] and all(x["comment"] for x in d["inference"]["dims"])
    assert c["basis"] == "discovery" and all(x["score"] for x in c["l3"])
    assert {x["status"] for l1 in b["l1"] for c2 in l1["children"] for x in c2["l3"]} >= {"responded", "sent", "walkthrough", "redirected", "draft", "not_generated"}
    assert all(3 <= len(v) <= 4 for v in b["insights"].values()) and set(b["insights"]) == {
        "reference", "discovery", "process", "matrix", "alignment", "entanglement", "gaps", "models"}


def test_discovery_flow(client):
    r = client.post("/api/business/discovery/C02.2/generate").json()
    c = next(x for l1 in r["l1"] for x in l1["children"] if x["id"] == "C02.2")
    assert all(x["status"] == "draft" for x in c["l3"])
    lid = c["l3"][0]["id"]
    qs = c["l3"][0]["survey"]["questions"]
    assert 15 <= len(qs) <= 17 and any(q.get("generated") for q in qs)
    assert {"peak", "fallback", "workarounds"} <= {q["id"] for q in qs}
    assert sum(1 for q in qs if (q["dim"] or "").startswith("A")) == 5
    e = client.get(f"/api/business/discovery/{lid}/email").json()
    assert e["subject"] and len(e["options"]) == 3 and "Request a walkthrough" in e["body"]
    assert e["attachment"]["name"].endswith(".xlsx") and "coromandel.com" in e["cc"] and "Murugappa" not in e["body"]
    assert client.post(f"/api/business/discovery/{lid}/send", json={"to": "owner@coromandel.com"}).status_code == 409
    r = client.post(f"/api/business/discovery/{lid}/finalise").json()
    assert r["finalised"] == 1
    client.post(f"/api/business/discovery/{lid}/send", json={"to": "owner@coromandel.com"})
    r = client.post(f"/api/business/discovery/{lid}/response", json={"outcome": "walkthrough", "note": "Call please"}).json()
    x = next(y for l1 in r["l1"] for c2 in l1["children"] for y in c2["l3"] if y["id"] == lid)
    assert x["status"] == "walkthrough"
    assert "What we mean" in client.get(f"/api/business/discovery/{lid}/email?kind=explain").json()["body"]
    bad = client.post(f"/api/business/discovery/{lid}/response", json={"outcome": "submitted", "answers": {"process": 2}})
    assert bad.status_code == 422
    ans = {"process": 1, "tech": 1, "data": 1, "integration": 1, "fit": 1, "partnering": 2, "reporting": 1, "change": 2, "adoption": 1,
           "importance": 5, "owner": "Head of Regulatory", "comments": {"tech": "Dossiers are built in Word"}}
    r = client.post(f"/api/business/discovery/{lid}/response", json={"outcome": "submitted", "channel": "workshop", "answers": ans}).json()
    x = next(y for l1 in r["l1"] for c2 in l1["children"] for y in c2["l3"] if y["id"] == lid)
    assert x["score"]["maturity"] == 1 and x["score"]["is_gap"] and x["quadrant"]["key"] == "underserved"
    assert x["score"]["alignment"] == 1.4 and len(x["score"]["alignment_parts"]) == 5
    g = next(g for g in r["gap_register"]["transactional"] if g["l3"]["id"] == lid)
    assert g["severity"] == "High" and "Lifting" in g["hypothesis"] and g["l2"]["id"] == "C02.2"
    assert all(t["related"] and t["severity"] in ("High", "Medium", "Low") for t in r["gap_register"]["thematic"])
    r = client.put(f"/api/business/gaps/{g['id']}", json={"description": "Dossiers assembled by hand", "severity": "Medium"}).json()
    g2 = next(x for x in r["gap_register"]["transactional"] if x["id"] == g["id"])
    assert g2["description"] == "Dossiers assembled by hand" and g2["severity"] == "Medium" and g2["edited"]
    r = client.delete(f"/api/business/gaps/{g['id']}").json()
    assert next(x for x in r["gap_register"]["transactional"] if x["id"] == g["id"])["description"] == g["description"]
    before = r["kpis"]["gaps"]
    r = client.post("/api/business/discovery/l2/C02.2/analyse").json()
    c = next(x for l1 in r["l1"] for x in l1["children"] if x["id"] == "C02.2")
    assert c["q"] == [1, 1, 1, 1] and c["importance"] == 5 and c["basis"] == "discovery" and c["source"] == "client"
    assert r["kpis"]["gaps"] == before + 1
    r = client.put("/api/business/discovery/l2/C02.2/comments", json={"comments": {"T": "Dossiers built in Word"}}).json()
    c = next(x for l1 in r["l1"] for x in l1["children"] if x["id"] == "C02.2")
    assert c["discovery"]["comments"]["T"] == "Dossiers built in Word"
    f = client.post("/api/findings/business?tab=discovery").json()
    assert f["mode"] == "fallback" and 3 <= len(f["findings"]) <= 4 and f["tab"] == "discovery"
    client.post("/api/settings/reset")
    assert client.get("/api/business").json()["kpis"]["gaps"] == 23


def test_process_models_and_plan(client):
    b = client.get("/api/business").json()
    m = b["models"][0]
    nodes = m["nodes"] + [{"id": "n99", "type": "function", "label": "New step", "lane": m["lanes"][0]["id"], "x": 10, "y": 10, "w": 136, "h": 58}]
    r = client.put(f"/api/business/models/{m['id']}", json={"lanes": m["lanes"], "nodes": nodes, "edges": m["edges"]}).json()
    assert len(r["models"][0]["nodes"]) == len(m["nodes"]) + 1 and r["models"][0]["source"] == "client"
    assert client.put(f"/api/business/models/{m['id']}", json={"lanes": [], "nodes": [], "edges": [{"from": "a", "to": "b"}]}).status_code == 422
    r = client.post(f"/api/business/models/{m['id']}/reset").json()
    assert len(r["models"][0]["nodes"]) == len(m["nodes"])
    v = client.get("/api/vision").json()
    p = v["plan"]
    assert p["current_week"] == 4 and len(p["phases"]) == 4 and p["counts"]["total"] == 24 and p["counts"]["milestone"] == 3
    tid = p["phases"][2]["activities"][2]["id"]
    v = client.put(f"/api/vision/plan/{tid}", json={"status": "done"}).json()
    a = next(x for ph in v["plan"]["phases"] for x in ph["activities"] if x["id"] == tid)
    assert a["status"] == "done" and a["status_source"] == "client"

def test_new_models_phase_plans_and_app_views(client):
    r = client.post("/api/business/models", json={"name": "Plant order to dispatch", "lanes": ["Plant", "Depot"]}).json()
    mid = r["added"][0]
    m = next(x for x in r["models"] if x["id"] == mid)
    assert m["custom"] and [l["name"] for l in m["lanes"]] == ["Plant", "Depot"] and len(m["nodes"]) == 2
    c = client.post("/api/business/models", json={"name": "Copy of PM-01", "copy_from": "PM-01"}).json()
    cp = next(x for x in c["models"] if x["id"] == c["added"][0])
    assert len(cp["nodes"]) == len(next(x for x in c["models"] if x["id"] == "PM-01")["nodes"])
    for x in (mid, cp["id"]):
        assert x not in [y["id"] for y in client.delete(f"/api/business/models/{x}").json()["models"]]
    b = client.get("/api/business").json()
    assert b["plan"]["id"] == "business" and b["plan"]["start_week"] == 1 and b["plan"]["status"] == "in_progress"
    a = client.get("/api/applications").json()
    assert a["plan"]["id"] == "applications" and a["plan"]["status"] == "in_progress" and a["plan"]["milestone"]["week"] == 8
    l2 = [c for l1 in a["cap_tree"]["l1"] for c in l1["children"]]
    assert len(l2) == 45 and any(x["apps"] for c in l2 for x in c["l3"])
    assert {"intake", "rationalization", "capability", "architecture", "interaction", "integration"} <= set(a["insights"])
    assert all(3 <= len(v) <= 4 for v in a["insights"].values())


def test_approach_vision_context_and_rationale(client):
    a = client.get("/api/approach").json()
    assert len(a["scope_of_work"]["items"]) == 6 and len(a["phases"]) == 4 and a["plan"]["cadence"]["steerco"] == [4, 8, 12, 16] and all(p["objective"] and p["gate"] for p in a["phases"])
    tid = a["plan"]["phases"][1]["activities"][0]["id"]
    a = client.put(f"/api/approach/plan/{tid}", json={"status": "done"}).json()
    assert next(x for ph in a["plan"]["phases"] for x in ph["activities"] if x["id"] == tid)["status"] == "done"
    v = client.put("/api/vision/context", json={"text": "Drone spraying and farmer advisory must scale; retail stores double by 2030."}).json()
    assert v["context"]["text"].startswith("Drone") and v["phase"]["id"] == "vision"
    files = [("files", ("notes.md", b"# Strategy\nDigital agronomy for every farmer. Data quality and data ownership matter. Drone telemetry.", "text/markdown"))]
    v = client.post("/api/vision/context/docs", files=files).json()
    assert v["added"] == ["notes.md"] and v["context"]["docs"][0]["words"] > 5 and v["context"]["themes"]
    g = client.post("/api/vision/statements/generate").json()
    assert g["mode"] == "fallback" and len(g["statements"]) == 5 and all(x["statement"] for x in g["statements"])
    v = client.put("/api/vision/statements", json={"statements": g["statements"], "mode": "fallback"}).json()
    assert len(v["context"]["statements"]) == 5 and v["vision_doc"]["vision_statement"]
    p = client.post("/api/vision/principles/suggest", json={"hint": ""}).json()
    assert p["name"] and p["statement"] and len(p["implications"]) >= 2
    v = client.post("/api/vision/guidelines", json={"kind": "principle", **{k: p[k] for k in ("name", "statement", "category", "togaf_basis", "rationale", "implications")}}).json()
    assert any(x["name"] == p["name"] and x.get("rationale") for x in v["principles"]["cil"])
    v = client.delete(f"/api/vision/context/docs/{v['context']['docs'][0]['id']}").json()
    assert not v["context"]["docs"]
    apps = client.get("/api/applications").json()["apps"]
    assert all(x["computed"]["statement"] and "BF" not in x["computed"]["statement"] for x in apps)
    client.post("/api/settings/reset")


def test_reference_views_and_sample_context(client):
    a = client.get("/api/applications").json()
    rv = a["ref_view"]
    assert rv["id"] == "APP-REF" and len(rv["layers"]) >= 6 and rv["counts"]["total"] == sum(rv["counts"][k] for k in ("ok", "partial", "missing", "validate"))
    assert any(b["app_refs"] for ly in rv["layers"] for row in ly["rows"] for b in row)
    assert set(a["layers"]) == {"Customer & Sales", "Logistics & Operations", "Enterprise Apps", "Admin Apps", "Data & AI"}
    assert all(x["layer"] in a["layers"] for x in a["apps"])
    d = client.get("/api/data_tech").json()
    assert d["data_ref"]["edges"] and d["infra_ref"]["aside"]["boxes"] and d["plan"]["id"] == "data_tech"
    assert {"data", "data_arch", "tech", "infra"} <= set(d["insights"]) and all(3 <= len(v) <= 4 for v in d["insights"].values())
    linked = next(b for ly in d["infra_ref"]["layers"] for row in ly["rows"] for b in row if b.get("check") == "R09")
    assert linked["status"] == "missing" and linked["derived"].startswith("R09 fail")
    hosted = next(b for ly in d["infra_ref"]["layers"] for row in ly["rows"] for b in row if b.get("hosting") == "Azure")
    assert hosted["hosted"]
    body = {k: rv[k] for k in ("title", "subtitle", "functions", "layers", "aside", "edges")}
    body["layers"][0]["rows"][0].append({"id": "b-new", "name": "Agronomy Copilot", "status": "missing"})
    body["layers"] = body["layers"][:-1]
    a2 = client.put("/api/arch_views/APP-REF", json=body).json()
    names = [b["name"] for ly in a2["ref_view"]["layers"] for row in ly["rows"] for b in row]
    assert "Agronomy Copilot" in names and len(a2["ref_view"]["layers"]) == len(rv["layers"]) - 1 and a2["ref_view"]["source"] == "client"
    dup = dict(body, layers=[dict(body["layers"][0], rows=[[{"id": "x", "name": "A"}, {"id": "x", "name": "B"}]])])
    assert client.put("/api/arch_views/APP-REF", json=dup).status_code == 422
    a3 = client.post("/api/arch_views/APP-REF/reset").json()
    assert len(a3["ref_view"]["layers"]) == len(rv["layers"]) and a3["ref_view"]["source"] == "assumed"
    v = client.post("/api/vision/context/sample").json()
    assert len(v["added"]) == 3 and v["context"]["text"].startswith("Sample") and all(x["source"] == "assumed" for x in v["context"]["docs"])
    v = client.post("/api/vision/context/sample").json()
    assert len(v["context"]["docs"]) == 3
    client.post("/api/settings/reset")


def test_budget_health_roadmap_and_inputs(client):
    b = client.get("/api/budget").json()
    assert b["inputs"]["fys"] and len(b["inputs"]["overall"]) == 3 and b["analysis"]["latest"]["total"] > 0
    assert {"inputs", "analysis"} == set(b["insights"])
    body = {k: b["inputs"][k] for k in ("fys", "overall", "capex", "opex", "factors")}
    body["opex"].append({"id": "OX99", "name": "AI services", "kind": "cloud", "values": [0, 1, 2, 3]})
    b2 = client.put("/api/budget", json=body).json()
    assert b2["source"] == "client" and any(x["id"] == "OX99" for x in b2["inputs"]["opex"])
    assert client.put("/api/budget", json=dict(body, overall=body["overall"][:2])).status_code == 422
    rm = client.get("/api/roadmap").json()
    assert rm["plan"] and rm["long_list"] and all(i["prio"]["label"] and i["gap_list"] is not None for i in rm["long_list"])
    assert {"longlist", "priority", "roadmap", "governance"} == set(rm["insights"]) and rm["budget"]["afford"]
    iid = rm["long_list"][0]["id"]
    rm = client.put(f"/api/roadmap/initiatives/{iid}", json={"benefits": ["Lower run cost"], "risks": ["Adoption"], "constraints": []}).json()
    x = next(i for i in rm["long_list"] if i["id"] == iid)
    assert x["benefits"] == ["Lower run cost"] and x["notes_source"] == "client"
    rm = client.put("/api/roadmap/repository", json={"tooling": "ArchiMate tool", "ownership": [{"view": "Apps", "owner": "Head of Apps", "cadence": "Quarterly"}], "process": ["Raise", "Review"]}).json()
    assert rm["repository"]["source"] == "client" and rm["repository"]["ownership"][0]["owner"] == "Head of Apps"
    a = client.get("/api/applications").json()
    assert a["tech_health"]["counts"]["in_scope"] and "health" in a["insights"]
    r = next(x for x in a["tech_health"]["rows"] if x["id"] == "A05")
    assert r["debt_band"] in ("High", "Medium") and r["scal_status"] != "OK"
    d = client.get("/api/data_tech").json()
    assert d["engineering_checks"] and d["engineering"]["score"] is not None and {"inputs", "engineering"} <= set(d["insights"])
    d = client.post("/api/data_tech/domains", json={"name": "Drone imagery", "data_types": ["Geospatial"], "pii": False}).json()
    did = d["added"]
    assert any(x["id"] == did and x["data_types"] == ["Geospatial"] for x in d["domains"])
    d = client.put(f"/api/data_tech/domains/{did}", json={"owner": True, "sensitivity": "Confidential"}).json()
    assert next(x for x in d["domains"] if x["id"] == did)["owner"] is True
    assert did not in [x["id"] for x in client.delete(f"/api/data_tech/domains/{did}").json()["domains"]]
    n = len(d["platforms"])
    d = client.post("/api/data_tech/platforms", json={"name": "Azure Databricks", "category": "AI & analytics", "standard": "Proposed Standard"}).json()
    assert len(d["platforms"]) == n + 1
    locs = d["locations"]
    net = d["network"] + [{"id": "N99", "from": locs[0]["id"], "to": locs[1]["id"], "type": "MPLS", "note": ""}]
    d = client.put("/api/data_tech/sites", json={"locations": locs, "network": net}).json()
    assert any(x["id"] == "N99" for x in d["network"]) and d["sites_source"] == "client"
    d = client.put("/api/data_tech/checks/E08", json={"status": "pass"}).json()
    blk = next(b for ly in d["infra_ref"]["layers"] for row in ly["rows"] for b in row if b.get("check") == "E08")
    assert blk["status"] == "ok"
    ap = client.put("/api/approach/scope", json={"requirement": "Edited requirement text", "objective": "Edited objective", "items": [{"n": 1, "title": "Only item", "activities": "Do it"}]}).json()
    assert ap["scope_of_work"]["requirement"].startswith("Edited") and len(ap["scope_of_work"]["items"]) == 1
    assert len(client.post("/api/approach/scope/reset").json()["scope_of_work"]["items"]) == 6
    v = client.get("/api/vision").json()
    assert v["viewpoints"] and v["tailoring"]
    v = client.post("/api/vision/guidelines", json={"kind": "tailoring", "framework": "TOGAF", "element": "Phase H", "decision": "Excluded", "rationale": "Out of scope"}).json()
    assert any(t["element"] == "Phase H" for t in v["tailoring"])
    f = client.post("/api/findings/applications?tab=health").json()
    assert f["findings"]
    client.post("/api/settings/reset")


def test_domain_gap_registers(client):
    for screen, item, port in (("applications", "AG-", "AT-"), ("data_tech", "DG-", "DT-")):
        d = client.get(f"/api/{screen}").json()
        reg = d["gap_register"]
        assert reg["gaps"] and reg["counts"]["item"] and reg["counts"]["portfolio"] and "gaps" in d["insights"]
        assert all(g["id"].startswith((item, port)) and g["hypothesis"] and g["initiative_name"] for g in reg["gaps"])
        gid = reg["gaps"][0]["id"]
        d = client.put(f"/api/{screen}/gaps/{gid}", json={"severity": "Low", "hypothesis": "Edited hypothesis"}).json()
        g = next(x for x in d["gap_register"]["gaps"] if x["id"] == gid)
        assert g["severity"] == "Low" and g["edited"] and g["generated"]["hypothesis"] != "Edited hypothesis"
        d = client.delete(f"/api/{screen}/gaps/{gid}").json()
        assert not next(x for x in d["gap_register"]["gaps"] if x["id"] == gid)["edited"]
        assert client.put(f"/api/{screen}/gaps/TG-X", json={"severity": "Low"}).status_code == 404


def test_roadmap_built_from_gap_registers(client):
    rm = client.get("/api/roadmap").json()
    b = client.get("/api/business").json()["gap_register"]
    a = client.get("/api/applications").json()["gap_register"]
    d = client.get("/api/data_tech").json()["gap_register"]
    n_reg = len(b["transactional"]) + len(b["thematic"]) + len(a["gaps"]) + len(d["gaps"])
    kinds = {g["kind"] for g in rm["gaps"]}
    assert {"business", "application", "data_tech", "governance"} <= kinds
    assert len(rm["gaps"]) == n_reg + sum(g["kind"] == "governance" for g in rm["gaps"])
    assert sum(i["gaps"] for i in rm["initiatives"]) == len(rm["gaps"])
    assert all(i["by_register"] for i in rm["initiatives"])
    gid = a["gaps"][0]["id"]
    before = next(g for g in rm["gaps"] if g["id"] == gid)["severity"]
    new = "Low" if before != "Low" else "High"
    client.put(f"/api/applications/gaps/{gid}", json={"severity": new})
    after = next(g for g in client.get("/api/roadmap").json()["gaps"] if g["id"] == gid)
    assert after["severity"] == new and after["priority"] == {"High": 20, "Medium": 12, "Low": 6}[new]
    client.delete(f"/api/applications/gaps/{gid}")


def test_login_gate(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "app_users", "demo:demo-pass,arham:x")
    client.cookies.clear()
    assert client.get("/api/overview").status_code == 401
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/auth/me").json() == {"required": True, "user": None}
    assert client.post("/api/auth/login", json={"username": "demo", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "Demo", "password": "demo-pass"}).json()["user"] == "demo"
    assert client.get("/api/overview").status_code == 200 and client.get("/api/auth/me").json()["user"] == "demo"
    client.cookies.set("ea_session", "demo|9999999999|forged")
    assert client.get("/api/overview").status_code == 401
    client.post("/api/auth/logout")
    client.cookies.clear()
    monkeypatch.setattr(get_settings(), "app_users", "")
    assert client.get("/api/overview").status_code == 200 and client.get("/api/auth/me").json()["required"] is False
    assert client.get("/api/does-not-exist").status_code == 404


def test_cyber_inputs_feed_gaps(client):
    d = client.get("/api/data_tech").json()
    cy = d["cyber"]
    assert cy["posture"]["score"] is not None and len(cy["posture"]["functions"]) == 6
    weak = [g for g in d["gap_register"]["gaps"] if g["category"] == "Cyber security" and g["scope"] == "item"]
    assert len(weak) == cy["posture"]["counts"]["weak"] and "cyber" in d["insights"]
    inp = cy["inputs"]
    controls = [dict(c, maturity=4) for c in inp["controls"]]
    r = client.put("/api/data_tech/cyber", json={**inp, "controls": controls}).json()
    assert r["cyber"]["posture"]["counts"]["weak"] == 0 and r["cyber"]["inputs"]["source"] == "client"
    assert not [g for g in r["gap_register"]["gaps"] if g["category"] == "Cyber security" and g["scope"] == "item"]
    bad = client.put("/api/data_tech/cyber", json={**inp, "controls": [dict(controls[0], maturity=7)]})
    assert bad.status_code == 422
    r = client.delete("/api/data_tech/cyber").json()
    assert r["cyber"]["posture"]["counts"]["weak"] == cy["posture"]["counts"]["weak"]


def test_operating_model(client):
    om = client.get("/api/roadmap").json()["operating_model"]
    assert om["model"] and len(om["roles"]) >= 5 and om["forums"] and om["kpis"]
    assert any(k["current"] for k in om["kpis"]) and all("basis" in k for k in om["kpis"])
    body = {k: om[k] for k in ("model", "rationale", "roles", "forums", "engagement", "kpis")}
    body["roles"] = body["roles"] + [{"id": "R99", "title": "OT Architect", "reports_to": "R2", "count": "1", "sourcing": "CIL", "responsibilities": ["Plant OT"]}]
    r = client.put("/api/roadmap/operating-model", json=body).json()
    assert r["operating_model"]["source"] == "client" and r["operating_model"]["roles"][-1]["title"] == "OT Architect"
    body["roles"][-1]["reports_to"] = "R404"
    assert client.put("/api/roadmap/operating-model", json=body).status_code == 422
    r = client.delete("/api/roadmap/operating-model").json()
    assert r["operating_model"]["source"] == "assumed" and len(r["operating_model"]["roles"]) == len(om["roles"])

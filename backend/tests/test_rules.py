"""Golden values (PROJECT_CONTEXT §4) and 1:1 parity with rules_reference.py on the seed data."""
import collections
import copy
import importlib.util
import statistics as st

import pytest

from app import rules
from app.config import ROOT_DIR
from app.db import read_seed


@pytest.fixture(scope="module")
def seed():
    return read_seed()


@pytest.fixture(scope="module")
def r(seed):
    return rules.run_all(seed)


@pytest.fixture(scope="module")
def r_codes(seed):
    """Same rules with the reference's wording (internal codes as labels) for string-level parity."""
    s = copy.deepcopy(seed)
    s["cfg"]["rationalization"]["labels"] = {k: {"label": "Retain" if k.startswith("Retain") else k}
                                             for k in s["cfg"]["rationalization"]["labels"]}
    return rules.run_all(s)


@pytest.fixture(scope="module")
def ref(seed):
    spec = importlib.util.spec_from_file_location("rules_reference", ROOT_DIR / "rules_reference.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.run_all(mod.load_seed(ROOT_DIR / "seed"))


def test_capabilities(r):
    assert len(r["cap_rows"]) == 45
    assert round(st.mean(c["maturity"] for c in r["cap_rows"]), 2) == 2.48


def test_dispositions(r):
    c = collections.Counter(a["disposition"] for a in r["app_rows"])
    assert c == {"Invest": 11, "Tolerate": 3, "Migrate": 6, "Eliminate": 4, "Retain (out of scope)": 2}


def test_rationale_string(r):
    row = next(a for a in r["app_rows"] if a["disposition"] == "Migrate")
    assert "→ Modernise" in row["rationale"] and "BF" in row["rationale"] and row["label"] == "Modernise"
    labels = {a["label"] for a in r["app_rows"]}
    assert labels == {"Invest", "Retain", "Modernise", "Replace", "Out of scope"} and "Eliminate" not in str(r["gaps"])


def _with_rules(seed, enable, **patch):
    s = copy.deepcopy(seed)
    for x in s["cfg"]["rationalization"]["rules"]:
        if x["id"] in enable:
            x["enabled"] = True
    s["cfg"]["rationalization"].update(patch)
    return rules.run_all(s)


def test_principle_rules_change_dispositions(seed, r):
    base = collections.Counter(a["disposition"] for a in r["app_rows"])
    on = _with_rules(seed, {"RR-04"})
    c = collections.Counter(a["disposition"] for a in on["app_rows"])
    assert c["Consolidate"] > 0 and sum(c.values()) == sum(base.values())
    a = next(x for x in on["app_rows"] if x["disposition"] == "Consolidate")
    assert "RR-04" in a["rules_fired"] and a["consolidate_into"] and "duplicate of" in a["rationale"]
    assert any(g["title"].startswith("Consolidate:") for g in on["gaps"])


def test_override_keeps_rule_result(seed):
    s = copy.deepcopy(seed)
    app = next(a for a in s["apps"] if a["id"] == "A22")
    app["override"] = {"disposition": "Invest", "reason": "Board decision"}
    row = next(a for a in rules.run_all(s)["app_rows"] if a["id"] == "A22")
    assert row["disposition"] == "Invest" and row["overridden"] and row["rule_disposition"] != "Invest"
    assert "overridden to Invest: Board decision" in row["rationale"]


def test_weights_and_unassessed(seed, r):
    w = _with_rules(seed, set(), bf_weights=[1, 1, 1], tf_weights=[1, 1, 1, 1])
    assert [a["disposition"] for a in w["app_rows"]] == [a["disposition"] for a in r["app_rows"]]
    s = copy.deepcopy(seed)
    s["caps"]["capabilities"][0]["children"].append({"id": "C01.9", "name": "New", "q": None, "importance": None})
    assert len(rules.run_all(s)["cap_rows"]) == 45


def test_entanglement_states_and_coverage(r):
    e = r["entanglement"]
    assert len(e["nodes"]) == 45 and e["dependencies"] and all(n["explain"] for n in e["nodes"])
    st_ = r["states"]
    gaps = next(m for m in st_["metrics"] if m["key"] == "gaps")["values"]
    assert gaps[0] == 62 and gaps[-1] == 0 and gaps == sorted(gaps, reverse=True)
    cap = next(m for m in st_["metrics"] if m["key"] == "cap")["values"]
    assert cap[0] == 2.48 and cap[-1] >= cap[0]
    assert r["coverage"]["adopted"] == 45 and r["coverage"]["total"] == 70
    assert r["integration"]["count"] > 0 and 0 <= r["integration"]["p2p_share"] <= 100


def test_duplication_clusters(r):
    assert len(r["clusters"]) == 7
    c = next(c for c in r["clusters"] if c["cap"] == "C07.1")
    assert c["apps"] == ["A06", "A07", "A08", "A09"] and c["survivor"] == "A06"


def test_data_scores(r):
    s = {d["id"]: d["score"] for d in r["data_rows"]}
    assert (s["DD-01"], s["DD-06"], s["DD-08"]) == (24, 22, 92)


def test_tech_and_governance(r):
    assert r["tech"]["resilience_score"] == 43 and r["tech"]["unknown"] == 3
    assert r["gov"]["acmm_mean"] == 1.56


def test_gaps_and_initiatives(r):
    assert len(r["gaps"]) == 62
    assert len(r["initiatives"]) == 10
    w0 = [i["id"] for i in r["initiatives"] if i["wave_id"] == "W0"]
    assert w0 == ["TH8"]
    assert next(i for i in r["initiatives"] if i["id"] == "TH2")["wave_id"] == "W3"


def test_total_budget(r):
    assert [round(x, 1) for x in r["total_cr"]] == [55.5, 139.5]


def test_parity_with_reference(r_codes, ref):
    """Every value the reference computes is reproduced exactly (ports may add fields, never change them).
    Run with the reference's wording; the UI labels (Modernise, Replace ...) are a display layer over the same codes."""
    r = r_codes

    def strip(rows, keys):
        return [{k: x[k] for k in keys} for x in rows]
    assert strip(r["cap_rows"], ref["cap_rows"][0].keys()) == ref["cap_rows"]
    assert strip(r["app_rows"], ref["app_rows"][0].keys()) == ref["app_rows"]
    assert strip(r["clusters"], ref["clusters"][0].keys()) == ref["clusters"]
    assert strip(r["data_rows"], ref["data_rows"][0].keys()) == ref["data_rows"]
    assert {k: r["tech"][k] for k in ref["tech"]} == ref["tech"]
    assert {k: r["gov"][k] for k in ref["gov"]} == ref["gov"]
    assert strip(r["gaps"], ref["gaps"][0].keys()) == ref["gaps"]
    assert strip(r["initiatives"], ref["initiatives"][0].keys()) == ref["initiatives"]
    assert r["fy_budget"] == ref["fy_budget"] and r["total_cr"] == ref["total_cr"]


def test_data_readiness(seed, r):
    ai = rules.data_readiness(seed["vision"]["ai_initiatives"], r["data_rows"], seed["cfg"])
    assert len(ai) == 8
    a02 = next(i for i in ai if i["id"] == "AI-02")
    assert not a02["ready"] and {b["id"] for b in a02["blocking"]} == {"DD-06", "DD-01"}
    assert next(i for i in ai if i["id"] == "AI-01")["ready"]

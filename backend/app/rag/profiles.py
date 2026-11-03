"""Screen retrieval profiles (PROJECT_CONTEXT §5) and default coach queries."""
from __future__ import annotations

PROFILES: dict[str, dict] = {
    "overview": {"phases": ["CORE", "REQ"], "types": ["concept", "approach", "summary", "maturity"],
                 "query": "Architecture Development Method phases cycle requirements management iteration"},
    "approach": {"phases": ["PRELIM", "A"], "types": ["approach", "deliverable", "steps"],
                 "query": "Preliminary Phase tailoring the ADM Statement of Architecture Work scope plan engagement"},
    "vision": {"phases": ["PRELIM", "A"], "types": ["principle", "deliverable", "approach", "technique"],
               "query": "Phase A Architecture Vision stakeholders business drivers architecture principles statement of architecture work"},
    "business": {"phases": ["B"], "types": ["steps", "artifact", "technique"],
                 "query": "Phase B Business Architecture baseline target gap analysis capability-based planning business capabilities"},
    "applications": {"phases": ["C_APP"], "types": ["artifact", "steps", "checklist"],
                     "query": "Application Architecture Application Portfolio Catalog baseline target gap analysis rationalization"},
    "data_tech": {"phases": ["C_DATA", "D"], "types": ["artifact", "steps", "checklist", "principle"],
                  "query": "Data Architecture data entity data governance Technology Architecture technology standards resilience checklist"},
    "budget": {"phases": ["E", "F"], "types": ["technique", "deliverable"],
               "query": "Migration Planning cost benefit analysis business value implementation and migration plan resources"},
    "roadmap": {"phases": ["E", "F", "G", "H", "REQ"], "types": ["technique", "deliverable", "governance"],
                "query": "Opportunities and Solutions Migration Planning transition architecture work packages architecture roadmap implementation governance architecture board"},
}

SCREENS = list(PROFILES)
TAG_ALIAS = {"approach": "vision", "budget": "roadmap"}  # screens that reuse another screen's chunk tags (index built before they existed)


def profile(screen: str | None) -> dict:
    return PROFILES.get(screen or "", {"phases": None, "types": None, "query": ""})

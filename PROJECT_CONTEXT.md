# CIL EA Navigator — Project Context

A TOGAF-guided Enterprise Architecture assessment tool (POC) for **Coromandel International Ltd (CIL)**. It turns what we know about CIL into the EA views promised in the KPMG proposal. TOGAF 9.1 is the ground truth for *how* each view is built, served through a phase-aware RAG. Deterministic rules do the scoring, and a free Gemini Flash model writes the narrative.

**Design stance: simple screens, smart backend.** Each screen shows one main visual, one table and one AI button. Every number on screen comes from a rule in `seed/config.json`, and every AI sentence cites a TOGAF section.

---

## 1. Client snapshot (research, Nov 2026)

| Topic | What we know | Source |
|---|---|---|
| Company | Coromandel International, Murugappa Group, HQ Chennai. FY26 total income ≈ ₹30,882 Cr (FY25 ≈ ₹24,085 Cr, ~90% Nutrients) | public |
| Businesses | Fertilisers (NPK/DAP, SSP), specialty nutrients, organic, crop protection, bio-products (neem), retail, drones | public |
| Footprint | 2 corporate offices (Chennai, Hyderabad), 19 factories, 10–12 regional sales offices (deck). Investor deck: 21 manufacturing locations, 8 R&D centres. **Reconcile, incl. NACL** | deck / public |
| Acquisitions | NACL Industries, 53.73% (crop protection, 2025). Dhaksha Unmanned Systems, 58% (drones) | public |
| Retail | 1,075 company-owned Gromor stores (Nov-2025) in AP, TS, KA, TN, MH. Plan to roughly double. ~3.3M farmers reached | public |
| Farmer digital | **MyGromor app** (1M+ users; advisory, pricing, image-based pest detection; ~15% of store sales). **Gromor Nutri Connect** app (launched Mar-2026 with Gromor Gram, 101 villages, 12 states). WhatsApp advisory bot. Satellite/NDVI advisory (partner claim: Farmonaut) | public |
| Agronomy services | 58 Nutri clinics + central soil/leaf lab. **Gromor Drive** drone spraying (~250 drones, 2.2 lakh acres FY25) | public |
| Enterprise digital | Sales force & dealer portal, e-commerce (~₹100 Cr H1FY26), retail AI (customer 360), manufacturing analytics, predictive maintenance | public |
| Core IT | SAP (RISE), SuccessFactors, AVEVA PI, Retail, HRMS + 50–60 external apps (COTS & custom). DC Hyderabad, DR Chennai, Azure. SQL Server, 5–6k AD users, Entra SSO. ~100 TB, VM/storage-level backup. Mostly 2/3-tier, few containers | deck |
| AI agenda | Copilot, production ML, conversational AI, agentic AI initiatives | deck |
| Out of scope | SAP RISE (ERP) and OT: dependencies captured only | deck |

The deck's 5 digital focus areas are AI-accelerated R&D, connected product + service, digital agronomy platform, drone & robotics, and Data/AI/EA foundation. The deck's main message is that enterprise architecture is the scaling mechanism.

Seed data lives in `seed/*.json`. Every record carries `source: deck | public | assumed`, and the UI **must** show this as a small provenance badge. Assumed values are demo placeholders for discovery to validate.

---

## 2. Scope: 9 asks → 6 screens

The original asks were Dashboard, Vision/AI vision, Business capabilities, IS architecture, Rationalization, Data view, Tech view, Roadmap & budgeting, and EA governance. They merge along TOGAF ADM phase lines:

| # | Screen | ADM phases | Merges | Deck views covered (slide 24) |
|---|---|---|---|---|
| 0 | **Dashboard** | ADM wheel, Requirements Mgmt | Dashboard | CIL outputs strip |
| 1 | **Vision & Guardrails** | Preliminary, A | Vision + AI vision + principles | Stakeholder viewpoints, Governance (principles) |
| 2 | **Business Capabilities** | B | Capabilities + questionnaire | Capability, Value stream |
| 3 | **Applications** | C (Application) | IS architecture + templates + rationalization | App portfolio, Interaction, Integration |
| 4 | **Data & Technology** | C (Data), D | Data view + Tech view | Info domain, Data governance, Infra, Platform, Resilience, Security |
| 5 | **Roadmap & Governance** | E, F, G, H | Roadmap & budget + EA governance | Transition architecture, Governance |

The TOGAF Coach is not a screen. It is a right-side panel available on every screen, and it knows which phase it is on.

---

## 3. Screen specs (keep each screen to this. Do not add more)

Every screen uses one template: **PageHeader** (title, ADM phase chips, one-line purpose) → **4 KPI cards** → **main visual card** → **detail table card** → **AI Findings card** (empty until "Generate findings" is clicked).

### 0 · Dashboard
- **ADM wheel** (interactive SVG, layout as in the TOGAF image: Preliminary on top, A–H in a ring, Requirements Mgmt in the centre). Nodes are coloured by screen completeness (not started / in progress / assessed) and clicking a node navigates to its screen.
- KPIs: EA maturity (ACMM mean /5), avg capability maturity, data governance avg score, roadmap ₹ range.
- Panels: disposition donut (Invest/Tolerate/Migrate/Eliminate/Retain), top-5 priority gaps, wave mini-timeline.

### 1 · Vision & Guardrails (Preliminary + A)
- Card *Engagement*: request statement, 6 drivers, 5 focus-area chips, scope in/out, stakeholder viewpoints table.
- Card *Architecture & AI Vision*: **Generate with AI** drafts the vision statement, AI ambition, 3–5 objectives and success measures, all editable and saved. Includes an AI initiatives table (8 rows). A **data readiness** badge is deterministic: ready if every dependent data domain scores ≥ 60, otherwise it lists the blocking domains.
- Card *Principles & Guardrails*: a library of the **21 TOGAF example principles** (taken from RAG chunks where `content_type == "principle"`) plus **10 CIL/AI principles** (seed). Each can be toggled on as adopted, and expands to Statement / Rationale / Implications. The counter warns outside 10–20 adopted (TOGAF §23.6).
- KPIs: drivers, principles adopted (n/20), AI initiatives data-ready (x/8), scope exclusions.

### 2 · Business Capabilities (B)
- Main: **capability heatmap**. The 11 L1 columns hold 45 L2 tiles coloured by maturity band, with importance shown as dots and a focus-area marker. A toggle switches to an importance-vs-maturity scatter.
- Clicking a tile opens a sheet with the 5-question questionnaire (1–5 radio, anchors from seed). Saving recomputes.
- Template: download the questionnaire as xlsx for client workshops, then upload it back.
- KPIs: avg maturity, weak+critical count, priority gaps, focus areas covered.

### 3 · Applications (C-Application)
- Tab *Inventory*: table (name, vendor, type, hosting, capability chips, criticality, lifecycle, provenance). Buttons: **Download intake template**, **Upload**, and **Map capabilities with AI**, which only appears for rows with no capability IDs.
- Tab *Rationalization*: a **TIME quadrant** scatter (x = technical fit, y = business fit, threshold lines at 3.0, bubble = criticality, colour = disposition) and **duplication clusters** (capability → apps → proposed survivor). The disposition table carries a deterministic rationale string such as `BF 3.33 ≥ 3.0, TF 2.75 < 3.0 → Migrate`.
- KPIs: apps inventoried (vs "core + 50–60" target), Invest/Tolerate/Migrate/Eliminate, duplication clusters, lifecycle unknown.

### 4 · Data & Technology (C-Data + D)
- Tab *Data*: domain score bars (0–100, banded) and a governance table (owner, SoR, MDM, quality, PII, classified), with privacy-risk flags. Also a compact **Application/Data matrix** (SoR = filled, consumer = dot).
- Tab *Technology*: deck facts card, locations, platform catalog with TOGAF standards-class chips, and a **resilience checklist** with editable status (pass/partial/fail/unknown) feeding a score gauge. Each check cites its TOGAF §48.5 checklist.
- KPIs: avg data score, privacy-risk domains, resilience score, items to validate.

### 5 · Roadmap & Governance (E–H)
- Tab *Roadmap*: **gap register** (all gaps from screens 2–4 + governance; filter by phase/kind; sort by priority). A **wave swimlane** with columns W0 Quick wins / W1 Foundation / W2 Scale / W3 Optimise to 2030 holds initiative cards (size, ₹ range, #gaps, dependencies). **Budget** shows a range bar by FY (FY27–FY30) and an editable rate card. AI: **Write initiative briefs**, one batched call.
- Tab *Governance*: **ACMM radar** (9 elements, 0–5 sliders), ARB charter card, review checkpoints, compliance-level legend (§48.2), and a **decision log** (title, context, decision, principles referenced, status), persisted.
- KPIs: gaps, initiatives, ₹ range (low–high), ACMM mean.

---

## 4. Deterministic rules (the backbone)

`rules_reference.py` is the **executable spec**. Port it to `backend/app/rules/` unchanged in behaviour. All parameters come from `seed/config.json`, and the UI Settings sheet can edit them.

- **Capabilities (B):** maturity = mean(process, digital, data, integration). Gap if importance ≥ 4 and maturity ≤ 2.5. Urgency is 5 for focus areas, otherwise 3, with +1 if maturity ≤ 1.5.
- **Rationalization (C-App):** BF = mean(bf), TF = mean(tf), threshold 3.0 → TIME. Overrides: out-of-scope → Retain; EOL < 24m forces Migrate. Duplication = an L2 served by ≥ 2 in-scope apps; the survivor is the system-of-record first, then the highest BF.
- **Data (C-Data):** weighted score — owner 20, SoR 10, MDM 20, quality 30, lineage 10, classified-if-PII 10. Gap if score < 60, no owner, or PII unclassified (urgency 5, DPDP Act 2023).
- **Technology (D):** each non-pass check becomes a gap. Unknown becomes "Validate in discovery".
- **Governance:** ACMM level ≤ 1 → gap 4×4; level 2 → 3×3.
- **Roadmap (E/F):** gap priority = impact × urgency. Gaps group into **10 themes** (`config.themes`, derived from the deck's focus areas plus foundations), and the theme size is adjusted by gap count. Waves are assigned by rule and pushed after their dependencies. Cost uses the ₹ rate-card range, split across FYs by wave.

**Golden values on seed data** (tests must assert these):
- 45 L2 capabilities, avg maturity 2.48
- Dispositions: Invest 11, Tolerate 3, Migrate 6, Eliminate 4, Retain 2
- 7 duplication clusters (e.g. C07.1: A06, A07, A08, A09 → A06)
- Data scores: DD-01 = 24, DD-06 = 22, DD-08 = 92
- Resilience score 43 (3 unknown). ACMM mean 1.56.
- 62 gaps, 10 initiatives. TH8 EA governance is the only W0 initiative. TH2 Drones lands in W3.
- Total ₹55.5–139.5 Cr

---

## 5. TOGAF RAG (ground truth)

**Corpus:** `data/togaf/TOGAF_9.1.pdf` (692 pp) and `data/togaf/TOGAF_Study_Guide.pdf` (265 pp). `togaf_chunker.py` is tested on both and produces ~1,080 chunks in ~4 s.

**Chunking strategy:**
1. Boundaries come from the PDF bookmark tree down to level 3, with headings anchored in the text (815/875 anchored, the rest fall back to page start). A chunk never straddles two ADM steps.
2. A longest-prefix **rule table** tags every chunk with `adm_phases` (PRELIM, A, B, C_DATA, C_APP, D, E, F, G, H, REQ, CORE), `screens`, `content_type` (objectives/approach/inputs/steps/outputs/technique/artifact/deliverable/principle/definition/governance/checklist/maturity/reference_model/concept/summary) and `priority` 1–3. Low-value parts are skipped: release notes, tools, US Treasury/IBM patterns, skills, exam questions.
3. Content-aware splits: §23.6 gives **one chunk per principle** (21). §35.6 gives **one chunk per catalog/matrix/diagram** (~60 artifacts, which ground the templates). Definitions get one chunk per term.
4. Running headers/footers are removed by page position. The groff kerning artifact ("enterpr ise") is repaired using the document's own vocabulary.
5. Each chunk is prefixed with its breadcrumb, e.g. `[TOGAF 9.1 > 8 Phase B: Business Architecture > 8.4 Steps]`. Paragraph-aware split targets ~450 tokens (max 800, ~50 overlap).
6. The study guide is indexed as a `summary` tier (plain-English restatement); the 9.1 book is authoritative.

**Retrieval:** `retrieve(query, screen=None, phases=None, types=None, k=6)`
- Filter by tags → dense top-30 (fastembed `BAAI/bge-small-en-v1.5`, local, no API quota) plus BM25 top-30 (`rank_bm25`) → reciprocal rank fusion (k = 60).
- Multiply by a priority weight (1.0 / 0.85 / 0.7). Cap at 4 chunks per section and include ≥ 1 `summary` chunk when one matches.
- Return the chunk and a citation label: `TOGAF 9.1 §8.4 Steps · p.123` (PDF page).
- Storage is plain files (`data/index/chunks.jsonl`, `embeddings.npy`, `bm25.pkl`): 1k chunks, in-memory numpy cosine, no vector DB needed.
- If the embedding model cannot download (e.g. corporate proxy), run BM25-only and show "lexical mode" in Settings.

**Screen retrieval profiles:**

| Screen | Phases | Preferred types |
|---|---|---|
| vision | PRELIM, A | principle, deliverable, approach, technique |
| business | B | steps, artifact, technique (§27 gap, §32 capability planning) |
| applications | C_APP | artifact (§35.6.5), steps, checklist |
| data_tech | C_DATA, D | artifact, steps, checklist, principle |
| roadmap | E, F, G, H, REQ | technique (§28), deliverable, governance |

---

## 6. AI layer (free Gemini Flash, used sparingly)

The SDK is `google-genai`. Settings come from `.env`: `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`), and `GEMINI_FALLBACK_MODEL` (default `gemini-2.5-flash-lite`). Check AI Studio for the free-tier model IDs currently live and set them in `.env`.

Free tier is roughly 10–15 RPM, so the layer is built around that:
- A client-side limiter allows 8 RPM, retries 429s with backoff ×3, then falls back to the fallback model, then to a **deterministic fallback**: the retrieved TOGAF excerpts, shown unsynthesised.
- `llm_cache` table: key = sha256(model + prompt). Identical requests never hit the API twice.
- JSON output via `response_mime_type="application/json"` + `response_schema`. Temperature 0.2.
- **Grounding contract** (every prompt): answer only from the supplied TOGAF excerpts and CIL facts; cite excerpts as `[n]`; say "not covered by TOGAF excerpts" rather than invent; never invent vendor names or numbers.

**Exactly 6 AI calls:**

| Call | Trigger | Input | Output (JSON) |
|---|---|---|---|
| `coach(screen)` | Coach panel opened (cached) | screen profile retrieval + screen state summary | 4–6 guidance bullets w/ cites, 2 next actions |
| `ask(q, screen)` | Coach ask box | q + retrieval | answer + cites |
| `draft_vision()` | Vision "Generate" | drivers, focus areas, scope, adopted principles, §7/§36.2.8 chunks | vision_statement, ai_ambition, objectives[], success_measures[] |
| `map_apps(apps)` | Applications "Map with AI" | ≤ 30 apps/call + L2 list | {app_id: [L2 ids], confidence}. Keyword fallback |
| `findings(screen)` | "Generate findings" | **computed rule outputs** (not raw data) + retrieval | 3 findings, 3 recommendations, cites |
| `initiative_briefs()` | Roadmap button | all initiatives + their gaps | {theme_id: {summary, outcomes[3]}} in ONE call |

---

## 7. Data, templates, persistence

- **SQLite** via SQLModel stores inputs only: capability scores, applications, data domains, tech checks, ACMM levels, principle selections, vision doc, decision log, settings overrides, llm_cache. **Rules are computed on request**, so views are always consistent. No stored gaps.
- First start: if the DB is empty, seed from `seed/*.json`. Settings has a "Reset demo data" button.
- **Templates (openpyxl):** generated from `config.templates` (apps, technology) plus questionnaire and data-domain templates built from seed. Each has a styled header, frozen row, enum dropdown validation, a README sheet citing TOGAF refs (§35.6.5, §34.6), and a reference sheet listing capability L2 IDs.
- **Upload:** validate columns and enums, return row-level errors, upsert by ID, set source to `client`.
- **Exports:** each screen's table to xlsx; Vision to Markdown.

---

## 8. Stack

- **Backend:** Python (existing conda env), FastAPI, SQLModel/SQLite, PyMuPDF, fastembed, rank-bm25, numpy, openpyxl, google-genai, pytest.
- **Frontend:** Vite + React + TypeScript, Tailwind + **shadcn/ui** (incl. Sidebar, Sheet, Tabs, Table, Chart), Recharts via shadcn charts, TanStack Query, React Router, lucide-react, sonner.

**UI language:**
- Clean consulting look. Navy primary `#0B2A6F` (matches the deck), slate neutrals, white cards, rounded-xl, generous whitespace, Inter.
- Band colours: strong/Invest teal `#0F9D8A`, developing/Tolerate amber `#D97706`, weak/Migrate orange `#EA580C`, critical/Eliminate red `#DC2626`, Retain slate.
- Provenance badges: deck = navy outline, public = teal outline, assumed = dashed amber.
- Skeletons while loading, sonner toasts, no layout shift. Laptop-first (1440 px) and works at 1280 px.

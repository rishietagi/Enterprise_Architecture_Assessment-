# Session Log — CIL EA Assessment Tool

Context handover so work can continue after the chat is cleared. Read with `CLAUDE.md` (rules and status log) and
`handover/RFP.md` (the RFP summary and coverage). Last updated 2026-11-03.

---

## 1. What the app is

A KPMG Enterprise Architecture assessment tool (TOGAF 9.1) for Coromandel International Limited (CIL), the agri-inputs
company in the Murugappa Group. It is a POC delivering the RFP for an Enterprise IT Architecture review.

- **Backend:** FastAPI + SQLModel/SQLite (`backend/`), hybrid RAG over TOGAF PDFs, Gemini with a deterministic fallback (works with no API key).
- **Frontend:** React + Vite + TanStack Query + shadcn (`frontend/`).
- **Conda env:** `pmo-intel-engine` (`C:\miniconda\envs\pmo-intel-engine\python.exe`). Never create a venv.
- **Run:**
  - API: from `backend/`: `python -m uvicorn app.main:app --reload --port 8000`
  - Web: from `frontend/`: `npm run dev`, then http://localhost:5173
- **Tests:** `pytest -q` from `backend/` (61 green). `npm run build` from `frontend/` (clean).
- **Screenshot tooling:** Playwright lives in `C:\miniconda\envs\mmsa\python.exe`.

## 2. Opening flow

Welcome page (KPMG logo, "Welcome to the Enterprise Architecture Assessment Tool", Let's Begin) → **Available Engagements**
popup → Coromandel International Limited → the workspace. The selection is kept in `sessionStorage` (`ea.engagement`), so
a new browser session starts at the welcome page. The sidebar has a white KPMG logo and a Switch Engagement link.
Files: `frontend/src/components/Gate.tsx`, `App.tsx`, `AppSidebar.tsx`, `public/kpmg-logo*.png` (copied from
`Desktop\IT_SMO_Platform\public`).

## 3. Screens (8) and their steps

Every phase screen follows the same layout: PhasePlan "Where We Are" strip → `StepBar` → step card → InsightsCard (rule-based insights per step, AI rewrite on button).
No KPI rows and no "On this screen" summaries on phase screens.

| Screen | Steps / content |
|---|---|
| **Dashboard** (`/`) | Engagement strip, 6 KPIs, Domain Health (7 domains, links), ADM cycle, dispositions, top gaps, waves (with affordability), Architecture Views tabs (current→target states, landscape, RFP views 1-14), insights |
| **Approach & Plan** | Editable Scope of Work (deck slide 6: requirement, objective, 6 items); Engagement Approach (4 phases) and Detailed Work Plan (deck timeline W1-W16, 21 tasks T01-T21, milestones M1-M3, weekly connect / steerco W4, W8, W12, W16 markers). Weeks only, no dates. |
| **Vision & Guardrails** | Where We Are; Context & Documents (upload, **Load Sample Context** one-click), 5 vision statements; Guidelines and Principles tabs: Principles (Suggest with AI), Guardrails & Patterns, Rationalization Rules, Stakeholder Viewpoints (= ISO 42010 viewpoint catalogue), Framework Tailoring (TOGAF/42010 register) |
| **Business Architecture** | 1 Current State Discovery (L0-L3, questionnaires: generate → review/edit → finalise → orchestrate by email with Excel attachment chip → responses; 16 questions incl. peak/fallback/workarounds) · 2 Assessment (process maturity, criticality × maturity, business-IT alignment, entanglement to L3) · 3 Gap Register (transactional L3 + thematic L1/L0) · 4 Architecture Views (ARIS EPC modeller, SVG and draw.io export) |
| **Applications** | 1 Application Intake (Tech DD fields incl. technical health fields) · 2 Capability View (KPI: capabilities without any app, filter) · 3 Rationalization (Fit & Dispositions / Technical Health: debt, SPOF, scalability) · 4 **Gap Register** · 5 Architecture Views (Application Architecture layered view, Interactions & Dependencies with editable Interface Catalog, Integration & API) |
| **Data & Technology** | 1 Inputs (editable data domains with data types / sensitivity / volume / retention / SoR / consumers; technology platforms; sites & network) · 2 Assessment (Data Governance, Resilience & Standards, Engineering Practices E01-E10) · 3 **Gap Register** · 4 Architecture Views (Data Architecture, Data Flow & AI Readiness, Infrastructure & Platform with Details drill-downs: network, cloud + editable landing zones, private hosting/DR, security) |
| **IT Budget** | 1 Cost Inputs (client template: Overall IT Costs, IT Capex by initiative tagged to roadmap themes, IT Opex by cost head, Business Factors; FY25A-FY28P editable, add/remove years and lines) · 2 Cost Analysis (spend by FY, % revenue vs benchmark, run/change, ratios, opex heads growth, roadmap affordability, reconciliation) |
| **Roadmap & Governance** | 1 Initiative Long List (gaps addressed per register, cost, wave, capex plan, editable benefits / risks / constraints / owner / KPIs) · 2 Prioritisation (value × effort quadrants, ranked) · 3 Roadmap (waves, FY timeline, risks register, affordability, budget + rate card) · 4 EA Governance (ACMM, ARB, decision log, editable Repository & Ownership) |

## 4. Key design decisions (do not undo without asking)

- **Application layers:** Customer & Sales, Logistics & Operations, Enterprise Apps, Admin Apps, Data & AI (`views.LAYERS`, `theme.DEFAULT_LAYER`).
- **Layered architecture views** (not called "reference" in the UI): application, information & data, technology & infrastructure. Table `ArchView`, seed `seed/reference_views.json`, editor `components/RefArchitecture.tsx` (Edit Layout, block dialog, Restore Default, export PNG/CSV/draw.io). Infra blocks with `check` follow the resilience/engineering checklist; `hosting` blocks list hosted apps. App view has only 6 core CIL functions in its header.
- **Network, cloud and security** are consolidated into the infrastructure view with Details drill-downs (no separate views).
- **Roadmap is built from the gap registers** (Business + Application + Data & Technology + 8 ACMM governance gaps = 157 gaps → 10 initiatives, ₹31.5–79.5 Cr; register sizes are S/M/L only, XL capped to L via `roadmap_registers.MAX_SIZE`; the parity roadmap keeps XL). `views.ctx` builds the registers once (`_registers`); `rules/roadmap_registers.py` unifies and builds. Severity → priority: High 20, Medium 12, Low 6. The parity-port roadmap (62 gaps, golden values vs `rules_reference.py`) is kept in `r["parity"]` and tested in `test_rules.py`.
- **Gap registers:**
  - Business: `rules/gap_register.py`, edits stored in SettingOverride `gap_notes`.
  - Applications and Data & Technology: `rules/domain_gaps.py`, edits stored in `app_gap_notes` / `dt_gap_notes`.
  - Edit endpoints: `PUT/DELETE /api/{screen}/gaps/{id}`.
- **Source badges removed from the UI** (no Assumed / Deck / Public labels or Source columns). The `source` field is still kept in the data and the AI prompts; the AI phrases assumed data as "to validate".
- **IT Budget feeds everything:** `budget_facts` goes into every screen's AI summary; it also drives app support spend on Applications, infra and cloud spend on Data & Technology, and affordability on the Roadmap.
- **Headings** use Title Case. Use "Architecture Views", never "Architect views".
- **Every view** has Export (PNG, CSV where tabular, draw.io for diagrams), and inputs are editable with add/delete.
- **Discovery emails** use the `coromandel.com` domain (user's instruction). The RFP SPOC emails use `coromandel.murugappa.com`; this is still open.

## 5. Data and seed

- `seed/`: `vision.json` (engagement plan, scope of work, viewpoints, tailoring), `applications.json`, `capabilities.json`, `discovery.json`, `data_domains.json`, `technology.json` (resilience checks R01-R10, engineering checks E01-E10, landing zones), `config.json` (rules, themes with benefits/risks/constraints, budget_rules, prioritization, tech_health, roadmap severity/size params, governance.repository), `budget.json`, `reference_views.json`, `context_samples.json`, `process_models.json`, `integrations.json`.
- **Discovery demo data:** 73 of 156 L3 questionnaires answered (47%) across 19 fully analysed L2s, with owners, systems, context answers, per-question comments and consultant comments. Answers are calibrated so the inferred L2 P/T/D/I/importance equal the seed baseline (golden values, avg maturity 2.48 and 23 capability gaps hold); the generator asserts this. C05.3 and C08.1 keep the sent/draft/walkthrough/redirected states for the demo.
- `db.SEED_VERSION = 9`: bump it to force a one-time reseed when the seed shape changes. `POST /api/settings/reset` reseeds the demo.
- **Overrides** (SettingOverride keys): `budget`, `scope_of_work`, `initiative_notes`, `repository`, `sites`, `landing_zones`, `gap_notes`, `app_gap_notes`, `dt_gap_notes`, `vision_context`, `config`.
- **Demo figures are illustrative placeholders,** for example revenue ₹150,000 Cr (FY25A) and IT spend ₹300 Cr at 0.20% of revenue (client team figure, 2026-11-04), and the technical-health intake values.

## 6. Constraints

- **AI:** max 6 call types, still 6. New features reuse the `draft_vision` and `findings` kinds.
- **Roadmap AI buttons:** `components/AiAction.tsx` ("Regenerate with AI" plus a ROADMAP tag and tooltip) marks outputs that AI will draft later: business gap register, L2 consultant comments, process models, app/D&T gap registers, disposition rationale, architecture views, interface catalogue, technical health, data domain catalogue, budget inputs/commentary, initiative long list, roadmap risks, scope of work, engagement approach, viewpoint catalogue. It makes no AI call (still 6 types): it refreshes the rule-based draft and says so in a toast.
- **Numbers come from rules** in `backend/app/rules/`. The LLM writes narrative only, grounded in TOGAF chunks with citations.
- **Screens:** 8 (Approach & Plan and IT Budget were added at the user's request). Do not add more without asking.

## 7. Open items / next steps

1. **Render deployment: deploy-ready (2026-11-03), not yet deployed.** The user deploys it by following `DEPLOY.md`.
   - `Dockerfile` (node 22 build → python 3.11 runtime), `.dockerignore`, `render.yaml` Blueprint (free plan, Singapore, health `/api/health`).
   - FastAPI serves `frontend/dist` with an SPA fallback (`main.py`).
   - **Login gate** (in-app page, not the browser popup): `app/auth.py`. `APP_USERS="name:pw,..."` (empty = no login, local dev), HMAC-signed HttpOnly cookie `ea_session` (`SESSION_SECRET`, `SESSION_HOURS`); `/api/*` returns 401 without it, except `/api/health` and `/api/auth/*`. Frontend `components/Login.tsx` (`AuthProvider`, Sign Out in the sidebar); `api.ts` fires `ea:auth-required` on 401.
   - `RAG_DENSE=false` gives BM25-only retrieval (about 150 MB RAM). `data/index/` is now committed; the PDFs are not.
   - **Persistence:** the default is that the SQLite DB at `/tmp` resets on every restart. Paid option: a Render Disk plus `DB_PATH=/var/data/cil.db`. Free Postgres would need a code change; not done.
   - Docker was not running locally, so the image build is untested here. The production mode was tested via uvicorn with the same env (login, 401, SPA routes, export).
2. **Email domain:** confirm `coromandel.com` or `coromandel.murugappa.com`.
3. **Target-state views (RFP view 13):** parked by the user ("dont do 1").
4. **ArchiMate exchange export:** not done (draw.io is done).
5. **Still read-only seed:** ARB charter, compliance levels, estate facts, business drivers and focus areas.
6. **"Relook at application layers with Arham":** a discussion item for the user.

## 8. User preferences (how to work with this user)

- Consultant-quality, concise copy; no emojis; Title Case headings; CIL agri-sector context, never oil and gas examples.
- Wants everything editable, connected and exportable; rule-based insights on every step.
- Gives batches of UI feedback with screenshots. Implement all of it, verify in the browser with Playwright screenshots, then report.
- Asks for honest status ("are the initiatives considering gaps from all of these now") and expects a plain yes/no plus what changed.
- Deployment and other outward-facing actions: explain first, act only on an explicit "go".

## 9. Changes 2026-11-04

- Vision: business driver tags removed from the vision statements. Principles, guardrails and patterns are one tab with a **CIL / TOGAF §23.6** switch (to avoid duplicates) and a type filter; a newly added item is scrolled to and highlighted. Stakeholder viewpoints expand to show purpose, questions answered, where used and where to find them (new fields `purpose`, `questions`, `used_in`, `where`).
- AI buttons: the "Roadmap" tag is gone from `AiAction`. Approach & Plan scope of work has **Upload RFP** (stored as a context document) before Regenerate with AI.
- AI Insights no longer show a stale AI rewrite after data changes: the query key includes the tab's rule-based insight text (FindingsCard takes a `sig`).
- Removed from the UI: entanglement scores (the dependency map stays), disposition in the application intake (table and form), "Closed by" initiative in the app/D&T gap registers, consumers and score in the data domain inputs, wave and quadrant in the initiative long list.
- `USER_GUIDE.md`: a short user guide to the whole app.
- Add-principle bug: could not reproduce (the API and UI both add it); the item was probably landing off-screen, now it is highlighted.
- Roadmap › EA Governance has two tabs: **EA Operating Model** (`components/OperatingModel.tsx`: org chart from `reports_to`, forums, engagement steps, KPIs with live "Today" values from `views.operating_model` measures; seed `config.governance.operating_model`, override SettingOverride `operating_model`, `PUT/DELETE /api/roadmap/operating-model`) and **Maturity & Review Board** (the old content).
- Data & Technology cyber: Inputs tab **Cyber Security** and Assessment tab **Cyber Security** (`components/Cyber.tsx`). Seed `technology.json` `cyber` (NIST CSF 2.0 controls CY01-CY12, metrics, tooling, compliance; assumed), override SettingOverride `cyber`, `PUT/DELETE /api/data_tech/cyber`, rules `rules/cyber.py` (score = (mean maturity − 1)/4 × 100), params `config.cyber_rules`. Weak controls and open metrics/tooling/compliance become D&T gaps under TH7, so the roadmap now has 168 gaps.
- Orchestrate email dialog: the shared Textarea uses `field-sizing-content`, which made the body grow past the dialog; the email body is now `field-sizing-fixed` and the dialog scrolls inside `max-h-[90vh]`.
- Dev note: stale uvicorn processes (and their multiprocessing children) on :8000 served old code; kill them before checking in the browser.


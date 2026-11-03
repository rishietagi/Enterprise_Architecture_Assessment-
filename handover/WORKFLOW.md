a# CIL EA Assessment: framework and workflow for SPECTRA

**What this is.** This is a TOGAF-based Enterprise Architecture assessment framework for Coromandel International (CIL). It is packaged so the SPECTRA team can load it into their existing workshop tool. It is not a spec for a new app.

**What it shows the client.** KPMG can run their EA assessment end to end: from problem statement, through framework, maturity rating and rule-based output, to a summary architecture view. Every number can be traced to the input behind it.

**How data gets in.** Through the front end. Every input is entered or edited in a form during or after the workshop (§4). Excel is only a bulk path: download a template, fill it, upload it, and it runs the same validation as the forms.

**Companion file.** `CIL_EA_Framework_Data.xlsx` is seed and example data, with one sheet per step; sheet names start with the step number. Use it to pre-load the demo and to test the logic. It does not replace front-end intake.

| Sheet type | What it holds |
|---|---|
| `input` | Data to ingest |
| `config` | The framework and rule parameters |
| `computed` | Rule outputs on the seed data. Use these to check your implementation. |

**Out of scope.** This framework does not use a knowledge graph. SPECTRA's KG Console step is replaced by retrieval (RAG) over the TOGAF 9.1 book, which your team rebuilds (see §5).

---

## 1. How it maps to SPECTRA's 7 steps

| SPECTRA step | What it becomes here | User action | Sheets |
|---|---|---|---|
| 1 Problem statement | Engagement, drivers, focus areas, scope, stakeholders | Enter in forms, or upload a client document and confirm the AI pre-fill | `1_*` |
| 2 KG Console | **RAG over TOGAF 9.1** grounds every AI explanation and cites the section | None. Runs behind "Coach" and "Generate findings" | `2_RAG_Profiles` |
| 3 Framework (TPCO, Excel upload) | TPCO, principles, guardrails, patterns, rationalization rules, leading-practice capability model, themes | Upload the framework workbook, then toggle or edit principles and rules | `3_*` |
| 4 Maturity assessment (rating among options) | Capability questionnaire (5 questions, 5 options each), application fit scoring, data domain scoring, resilience checklist, ACMM | Rate each item with the client in the room | `4_*` |
| 5 Output (KPMG solutions) | Scores, dispositions, gap register, initiatives, waves, ₹ range. Each initiative maps to a KPMG solution. | Review; map initiatives to the internal solution catalog | `5_OUT_*` |
| 6 Agent selection | AI initiatives with a data-readiness check, plus agent candidates from the Technology & AI ladder | Pick the capabilities to build an agent for | `6_*` |
| 7 Summary view | Current → transition → target states, headline KPIs, 14 RFP architecture views | Present or export | `7_*` |

---

## 2. Principles that make it traceable

1. **Rules compute every number.** The LLM writes narrative only, over computed results.
2. **Rule parameters live in config**, never in code. See `3_Rule_Parameters`.
3. **Each computed value carries an "explain" trace:** inputs → formula → rule fired → TOGAF section. Show it behind an (i) icon.
4. **Provenance on every record:**

   | Source tag | Meaning |
   |---|---|
   | `deck` | KPMG proposal |
   | `public` | Coromandel public disclosures |
   | `assumed` | Demo placeholder; validate with the client |
   | `client` | Entered during the workshop |
   | `togaf` | TOGAF 9.1 |

   Show it as a badge. Never present `assumed` data as fact, and never invent vendor names (use `TBD`).
5. **Everything works without an AI key.** Each AI call has a deterministic fallback.

---

## 3. End-to-end workflow, step by step

### Step 1: Problem statement

**Shown:** a client card with the request, horizon, 6 business drivers, 5 digital focus areas, scope in and out, constraints and stakeholder viewpoints. Each item has a provenance badge.

**Example** (`1_Engagement`, `1_Drivers`, `1_Focus_Areas`):
- **Request:** "Establish a practical, industry-aligned (TOGAF) EA baseline, define the future-state architecture and governance model, and a prioritized roadmap to 2030" (`deck`)
- **Driver D4:** "Scalable foundation for future applications, acquisitions (NACL, 53% stake 2025) and AI adoption" (`deck`)
- **Focus area F3:** "Digital agronomy platform: advisory, satellite insights, orders and service journeys" (`deck`)
- **Out of scope:** SAP RISE detailed assessment and OT systems. Dependencies are still captured, and the rules set these apps to "Out of scope".

**Optional AI:** "Draft vision" produces a vision statement, AI ambition, objectives and success measures. Its inputs are the drivers, focus areas, scope and adopted principles, and it cites TOGAF Phase A (§7). The user edits and saves the draft.

### Step 2: Knowledge (RAG replaces the KG Console)

Nothing to click. Every screen has a **Coach** panel (TOGAF guidance plus next actions) and a **Generate findings** button (3 findings and 3 recommendations). Both retrieve TOGAF chunks with the screen's profile from `2_RAG_Profiles` and cite them as `TOGAF 9.1 §x.y · p.N`. See §5 for the strategy.

### Step 3: Framework (TPCO and rules)

**Input:** enter or edit in the framework forms (§4), or bulk-upload the `3_*` sheets.

**Shown:**

- **TPCO board** (`3_TPCO`, 29 items):

  | TPCO element | Source in this framework | Example |
  |---|---|---|
  | Themes | The 10 roadmap themes | TH1 "Digital agronomy & farmer platform" |
  | Priorities | Focus areas F1–F5 | F3 "Digital agronomy platform" |
  | Challenges | Business drivers D1–D6 | D3 "End-to-end visibility of dependencies…" |
  | Opportunities | AI initiatives AI-01–08 | AI-02 "Image-based pest & disease detection" |

- **Principles** (`3_Principles`): the 21 TOGAF example principles plus 10 CIL and AI principles, each with an adopt toggle. TOGAF suggests adopting 10–20; the seed adopts 15. Users can add, edit or delete CIL principles.
  - Example: P-CIL-02 "Clean-core ERP: keep SAP S/4HANA standard, extend side-by-side". Its TOGAF basis is Principle 5, Common Use Applications.

- **Guardrails** (`3_Guardrails`, 8) and **patterns** (`3_Patterns`, 6), each with an active toggle.
  - Example guardrail: G-06 "Human approval for agentic actions with spend".
  - Example pattern: PT-01 "API-led integration", which implements P-CIL-03.

- **Rationalization rules** (`3_Rationalization_Rules`), run in order after the fit quadrant. Each rule cites the principle, guardrail or driver it enforces. Only RR-01 and RR-02 are on by default, so the golden values hold. Turning a rule on live recomputes dispositions, gaps and the roadmap, which works well in a workshop.

  | Rule | If | Then |
  |---|---|---|
  | RR-01 (locked) | Out of scope | Out of scope (retain) |
  | RR-02 | Vendor support ends within 24 months and the quadrant is Invest or Retain | Modernise |
  | RR-03 | Security ≤ 2 on an app with criticality ≥ 4 | Modernise |
  | RR-04 | Duplicate of a cluster survivor | Consolidate |
  | RR-05 | Custom app overlapping SAP capabilities | Replace (clean core) |
  | RR-06 | Strategic alignment ≥ 4 on an app the quadrant would Replace | Modernise |

- **Disposition terminology** (`3_Disposition_Labels`), editable. Codes are internal; users see the labels.

  | Code | Label |
  |---|---|
  | Invest | Invest |
  | Tolerate | Retain |
  | Migrate | Modernise |
  | Eliminate | Replace |
  | Consolidate | Consolidate |
  | Retain (out of scope) | Out of scope |

- **Leading-practice capability model** (`3_Reference_Model`): 5 L0, 14 L1 and 70 L2, generated for agri-inputs. Each L2 has a description and a leading-practice statement. Example: R4.3.3 "Crop diagnostics & recommendations", leading practice "Image-based diagnosis with agronomist review of recommendations". *Generated (`assumed`); replace with the agreed KPMG reference model.*

### Step 4: Maturity assessment (rating among options)

**4a. Capability workflow.** Users move through six steps:

1. **Leading practice.** Pick reference capabilities and add them to the client catalog. Coverage today is 45 of 70 (64%).
2. **Questionnaire.** Rate every L2 on 5 questions with 5 anchored options each (`4_Questionnaire`).

   | Q | Dimension | Options 1 → 5 |
   |---|---|---|
   | Q1 | Process standardisation | Ad hoc · Documented locally · Standardised · Measured · Optimised |
   | **Q2** | **Technology & AI enablement** | **Manual / siloed tools · Digitised · Integrated automation · AI-enabled · Agentic AI** |
   | Q3 | Data availability & trust | Unavailable · Siloed · Governed · Trusted · AI-ready |
   | Q4 | Integration & hand-offs | Re-keyed · File / batch · Point-to-point · API / event · Orchestrated |
   | Q5 | Importance to 2030 strategy | Low · Supporting · Important · High · Critical |

   Each assessment also captures the supporting applications, the automation or tools in use, and the owner.

3. **Catalog.** Edit the CIL L0 › L1 › L2 catalog (`4_Capability_Catalog`, 5 / 11 / 45) with owners, reference links and dependencies.
4. **Heat map** of maturity by L1, with importance and AI level marked. It has three alternate views:
   - importance × maturity scatter;
   - **business–IT alignment table** (capability → maturity vs target → apps; flags capabilities with no application support);
   - **end-to-end processes** (`4_Value_Streams`): stage → capability → apps. Example: order-to-cash runs Plan demand → Set price & scheme → Capture dealer order → Check credit → Fulfil & dispatch → Record movement (iFMS) → Invoice & collect → Claim subsidy.
5. **Entanglement.** An L1 dependency map, plus a trace for one capability: upstream, downstream, and capabilities sharing an app.
6. **Gap register.**

Worked examples (`5_OUT_Capability_Scores`):

| L2 | Q1–Q4 | Imp | Maturity | Band | Target | Q2 level | Gap? |
|---|---|---|---|---|---|---|---|
| C07.3 Crop diagnostics & recommendations | 2,3,2,1 | 5 | 2.00 | weak | 4.0 | Integrated automation | Yes. Priority 5 × 5 = 25 (focus area F2, so urgency 5) |
| C08.4 Prescription maps | 1,1,1,1 | 4 | 1.00 | critical | 3.5 | Manual / siloed | Yes. Urgency 5 (focus area) +1, capped at 5 |
| C09.1 Financial accounting & close | 4,4,4,3 | 4 | 3.75 | strong | 3.5 | AI-enabled | No |

**4b. Applications** (`4_Applications`, 26 apps). The intake form follows the Tech DD data request:

- **Identity:** name, what it does, vendor (`TBD` if unknown), version, type, layer.
- **Ownership:** business owner, IT owner, users, support arrangement, licence model, contract end.
- **Architecture:** hosting, platform, customisation, scalability, DR, lifecycle, in scope.
- **Mappings:** capabilities served (L2 IDs), data domains mastered.
- **Scores (1–5):** criticality, business fit [functional, strategic, user satisfaction], technical fit [currency, integration, security, cost].

The interfaces between apps (`4_Interfaces`, 32) feed the interaction and integration views.

**Overrides:** an architect can override any disposition, but must give a reason. The rule result stays visible next to the override.

Examples (`5_OUT_App_Dispositions`):

| App | BF | TF | Disposition | Rationale |
|---|---|---|---|---|
| A06 MyGromor farmer app | 4.33 | 3.25 | Invest | BF 4.33 ≥ 3.0, TF 3.25 ≥ 3.0 → Invest |
| A20 Subsidy & iFMS reconciliation tool | 4.00 | 2.25 | Modernise | BF 4.00 ≥ 3.0, TF 2.25 < 3.0 → Modernise |
| A22 R&D trial data (spreadsheets) | 2.00 | 1.75 | Replace | BF 2.00 < 3.0, TF 1.75 < 3.0 → Replace |
| A01 SAP S/4HANA (RISE) | 4.00 | 4.00 | Out of scope | Out of scope (dependencies only) |

**4c. Data and technology inputs:**

- **Data domains** (`4_Data_Domains`, 10). Each records owner (yes/no), system of record, MDM (none / partial / full), quality 1–5 × 3, lineage, PII, classified and consumers. Example: DD-01 Farmer & Customer scores **24** (critical) and carries a privacy risk.
- **Resilience checklist** (`4_Resilience_Checks`, 10). TOGAF §48.5 items rated pass / partial / fail / unknown. Example: R09 "MLOps pipeline for production ML" is rated fail.
- **Platforms, locations, network and security zones** (`4_Tech_*`, `4_Locations`, `4_Network`, `4_Security_Zones`). These feed the infrastructure, network, cloud and security views.
- **ACMM** (`4_ACMM`): 9 elements rated 0–5; the mean is 1.56.

### Step 5: Output (what KPMG can offer)

**Shown:**

- **Gap register** (`5_OUT_Gaps`, 62 gaps, sorted by priority = impact × urgency). Every gap names the rule that created it, for example "Importance 5 ≥ 4 and maturity 2.00 ≤ 2.5 → GAP".
- **Initiatives** (`5_OUT_Initiatives`, 10). Gaps group into themes; each theme with at least one gap becomes an initiative with a size, wave, dependencies and an indicative ₹ range.
  - Example: TH1 "Digital agronomy & farmer platform" has 13 gaps, size XL, sits in wave W2 after TH4 and TH5, and costs ₹10–25 Cr.
- **Budget by FY** (`5_OUT_Budget_FY`). The total is ₹55.5–139.5 Cr, indicative from the rate card.

**SPECTRA step 5 mapping:** fill the `kpmg_solution_or_accelerator` column (currently `TBD`) from your internal solution catalog. The theme name is the matching key: TH4 Data & AI foundation, TH5 Integration & API layer, TH8 EA governance & operating model, and so on.

### Step 6: Agent selection

**Shown:**

- **AI initiatives with data readiness** (`6_AI_Initiatives`). An initiative is ready only if every data domain it depends on scores at least 60. 2 of 8 are ready. Example: AI-02 "Image-based pest detection" is blocked by DD-06 (22) and DD-01 (24).
- **Agent candidates** (`6_Agent_Candidates`, 37). Rule: importance ≥ 4 and Q2 ≤ 3.

  | Q2 level | Recommendation |
  |---|---|
  | Q2 = 3 (Integrated automation) | **AI-enabled agent candidate** |
  | Q2 ≤ 2 | **Automate or integrate first** |

  Each row lists the supporting apps and the guardrails that apply: G-05 (no farmer PII in external models), G-06 (human approval for spend), P-AI-01 (human in the loop).

**User action:** pick a candidate and create the agent on the platform (SPECTRA's step 6).

### Step 7: Summary view

**Shown:**

- **Headline KPIs** (`7_OUT_Headline_KPIs`).
- **Current → transition → target states** (`7_OUT_States`). A gap closes when its initiative's wave completes, and its measure moves to the rule target.

  | Measure | Current | W0 | W1 | W2 | W3 | Target |
  |---|---|---|---|---|---|---|
  | Avg capability maturity | 2.48 | 2.51 | 2.65 | 3.29 | 3.38 | 3.64 |
  | Open gaps | 62 | 52 | 30 | 5 | 0 | 0 |
  | Apps needing action | 10 | 10 | 5 | 2 | 0 | 0 |
  | Resilience score | 43 | 57 | 100 | 100 | 100 | 100 |
  | Point-to-point interfaces % | 100 | 100 | 44 | 44 | 44 | 44 |

- **The 14 RFP architecture views** (`7_RFP_Views`), each mapped to a TOGAF artifact and the step that produces it:

  | View | Where it is produced |
  |---|---|
  | Enterprise landscape | Summary |
  | Capability & business–IT alignment | Step 4a |
  | Application portfolio & architecture, interactions, integration & data flow | Step 4b |
  | Data & analytics, platform, network, cloud & hybrid, security, standards & lifecycle | Step 4c |
  | Principles & decisions | Step 3 |
  | Current / target / transition states | Summary |
  | E2E processes | Step 4a |

- **Export:** the gap register, the vision as `.md`, and every table as `.xlsx`.

---

## 4. Data intake through the front end

### Rules for every form

1. **Saving sets provenance to `client`** on that record. Seed rows stay `assumed` until someone edits them.
2. **Every save recomputes.** Rules run on request, never stored. Show the new result straight away, e.g. a toast: "C07.3 maturity 2.00 → 2.75, still a gap".
3. **Validate on the form,** using the enums below. Scores are integers from 1 to 5. A field that isn't known is set to `TBD` or `Unknown`, never guessed. Vendor defaults to `TBD`.
4. **IDs are generated, not typed.** The next free ID is used: A27, C07.5, I33, DD-11, G-09 and so on.
5. **Deleting cascades.** Deleting an app removes its interfaces. Deleting a capability removes it and its children from app mappings and dependencies.
6. **Bulk alternative.** "Download template" pre-fills the current records. "Upload" validates every row and returns errors by row and column (e.g. "'9' not in [1..5]"). Valid rows are upserted by ID.
7. **AI may pre-fill, never decide.** For example, a client document is uploaded in step 1 and AI drafts the drivers and scope; an app has no capabilities and AI suggests them. The user confirms before anything is saved. AI never fills a score.

### Forms by step

| Step | Entity | Form fields (type · allowed values) | Required | Bulk sheet |
|---|---|---|---|---|
| 1 | Engagement | client (text), request (long text), horizon (text) | client, request | `1_Engagement` |
| 1 | Business driver | driver (text), source (deck/public/client) | driver | `1_Drivers` |
| 1 | Focus area | name, detail (text) | name | `1_Focus_Areas` |
| 1 | Scope item | type (in scope / out of scope / constraint), item (text) | both | `1_Scope` |
| 1 | Stakeholder | viewpoint, concerns (text); screens (multi-select of the 6) | viewpoint | `1_Stakeholders` |
| 1 | Vision | vision statement, AI ambition (long text); objectives, success measures (list, max 5). "Draft with AI" fills it; the user edits and saves. | statement | n/a |
| 3 | TPCO item | type (Theme/Priority/Challenge/Opportunity), statement, linked to (IDs) | type, statement | `3_TPCO` |
| 3 | Principle | name, statement, category (Business/Data/Application/Technology/Security/AI), rationale, implications (list), TOGAF basis, adopted (toggle). TOGAF principles: toggle only. Warn if fewer than 10 or more than 20 are adopted. | name, statement | `3_Principles` |
| 3 | Guardrail | name, statement, category, enforced by, active (toggle) | name | `3_Guardrails` |
| 3 | Pattern | name, use, implements principle (select), active | name | `3_Patterns` |
| 3 | Rationalization rule | enabled (toggle; RR-01 locked on), parameters (numbers in the ranges shown in `3_Rationalization_Rules`) | n/a | `3_Rationalization_Rules` |
| 3 | Rule settings | fit threshold (1–5, step 0.1), business-fit weights × 3, technical-fit weights × 4 (non-negative, sum > 0), gap rule (importance min 1–5, maturity max 1–5), disposition labels and descriptions (text). "Reset to defaults" button. | n/a | `3_Disposition_Labels`, `3_Rule_Parameters` |
| 3 | Reference model node | level (L0/L1/L2), parent, name, description, leading practice. Admin only. | level, name | `3_Reference_Model` |
| 4a | Capability (catalog) | level, parent (select one level up), name, description, owner (role or person), focus area (F1–F5 or none), depends on (multi-select L2), automation/tools (text). "Add from leading practice" copies a reference node and keeps its link. | level, parent, name | `4_Capability_Catalog` |
| 4a | Capability assessment | Q1–Q5 (radio, 5 anchored options each, all required); supporting apps (multi-select, writes each app's capability list); automation/tools in use; owner | Q1–Q5 | `4_Capability_Catalog` q-columns |
| 4a | Value stream | name, trigger, outcome; ordered stages, each with name and capabilities (multi-select L2) | name, ≥ 1 stage | `4_Value_Streams` |
| 4b | Application | **Identity:** name, what it does, vendor (TBD default), version, type (COTS/SaaS/Custom/Platform/Ad hoc tool), layer (Engagement/Core business/Operations & field/Data & AI/Enterprise & workplace), users. **Ownership:** business owner, IT owner, support arrangement (In-house/Vendor SaaS/Vendor AMS/Vendor-managed (RISE)/Partner-managed/Subsidiary IT/TBD), licence model (Perpetual/Subscription/Open source/Custom-built/TBD), contract end, run-cost band (< Rs 25L / Rs 25L-1Cr / Rs 1-5Cr / > Rs 5Cr). **Architecture:** hosting (RISE (SAP-managed)/SaaS/Azure/DC-HYD/Partner-hosted/Unknown), platform, customisation (None/Low/Medium/High (custom)/n/a/TBD), scalability (Low/Medium/High/TBD), redundancy/DR (None/Backup only/Warm standby/Active-active/TBD), standards class, lifecycle (Current/Ageing/EOL < 24m/Unknown), retire date, in scope (toggle). **Mappings:** capabilities served (multi-select L2), data domains mastered (multi-select), holds PII (toggle). **Scores 1–5:** criticality, functional fit, strategic alignment, user satisfaction, technology currency, integration readiness, security & compliance, cost efficiency. **Override:** disposition (select) + reason (required if set). | name; reason if overriding | `4_Applications` |
| 4b | Interface | from, to (app or external, must differ), data exchanged, data domain, pattern (API/Event/File / batch/DB link/Manual / re-key), routing (Point-to-point/API layer), frequency | from, to, pattern | `4_Interfaces` |
| 4c | Data domain | name, named owner (Y/N + name), system of record (select app), MDM (none/partial/full), quality 1–5 × 3 (completeness, accuracy, timeliness), lineage documented (Y/N), holds PII (Y/N), privacy/retention classified (Y/N), consuming apps (multi-select) | name | `4_Data_Domains` |
| 4c | Resilience check | status (pass/partial/fail/unknown), evidence note | status | `4_Resilience_Checks` |
| 4c | Platform | name, vendor (TBD), version, category, location (Primary DC - Hyderabad/DR site - Chennai/Microsoft Azure/SAP RISE/Plant / edge/Retail store), standards class (Standard/Provisional/Proposed/Phasing-Out/Non-Standard/Retired), lifecycle, end-of-support date, apps hosted | name | `4_Tech_Platforms` |
| 4c | Location / network link / security zone | location: name, type · link: from, to, type, note · zone: name, what it holds, checks (multi-select R01–R10) | name | `4_Locations`, `4_Network`, `4_Security_Zones` |
| 4c | ACMM element | level 0–5 (slider) | level | `4_ACMM` |
| 5 | Initiative mapping | KPMG solution or accelerator (select from the internal catalog), notes | n/a | `5_OUT_Initiatives` (last column) |
| 5 | Rate card | low and high ₹ Cr per size S/M/L/XL | all | `3_Rule_Parameters` |
| 5 | Decision | title, context, decision, principles (multi-select), status (Proposed/Approved/Rejected) | title | n/a |
| 6 | AI initiative | name, type, status, depends on data domains (multi-select) | name | `6_AI_Initiatives` |
| 6 | Agent (create) | from a candidate: name, capability, goal, tools/apps used, guardrails acknowledged (G-05, G-06, P-AI-01), human-approval threshold | name, capability | n/a |

### What each save changes

| Input changed | What recomputes |
|---|---|
| Capability assessment | Maturity, band, gap, AI level → gap register → initiatives, waves, ₹ → states |
| App scores or rules | Disposition → app gaps, clusters → roadmap |
| Data domain | Domain score, privacy risk → AI readiness → roadmap |
| Resilience check | Resilience score → technology gaps → roadmap |
| Interface | Integration metrics and diagrams |

---

## 5. Knowledge layer (RAG strategy, for your rebuild)

**Sources:**
- TOGAF 9.1 (692 pages), the core source.
- TOGAF 9 Foundation Study Guide (265 pages), for summaries.

**Chunking**, structure-aware rather than fixed-size:

1. Split on the PDF's bookmark tree down to level-3 sections. A chunk never straddles two ADM steps or two artifacts.
2. Use special splitters for the high-value sections:
   - §23.6 example principles: one chunk per principle;
   - §35.6 artifacts: one chunk per catalog, matrix or diagram;
   - definitions: one chunk per term.
3. Target about 450 tokens per chunk, with a maximum of 800 and a minimum of 60. Long sections are split with roughly 50 tokens of overlap; small siblings are merged.
4. Remove running headers and footers by page position. Repair PDF kerning breaks ("enterpr ise").
5. Prefix every chunk with its breadcrumb, e.g. "TOGAF 9.1 > Phase B > 8.4 Steps".
6. Tag every chunk with:
   - `adm_phases`: PRELIM, A, B, C_DATA, C_APP, D, E, F, G, H, REQ, CORE;
   - `screens`;
   - `content_type`: steps, artifact, principle, checklist, technique…;
   - `priority`: 1 core, 2 supporting, 3 background, or skipped.
7. The current build produces about 1,083 chunks. Use pymupdf for extraction (pypdf breaks the spacing).

**Retrieval (hybrid):**

1. Filter chunks by the screen's tags (`2_RAG_Profiles`).
2. Take the dense top 30 (bge-small-en-v1.5 embeddings) and the BM25 top 30.
3. Fuse them with reciprocal rank fusion (k = 60).
4. Multiply by a priority weight: 1.0, 0.85 or 0.7.
5. Keep at most 4 chunks per section, plus at least one study-guide summary.
6. Pass the excerpts to the LLM as `[1]..[k]`. The prompt only allows cited claims, and citations render as `TOGAF 9.1 §x.y · p.N`.

**AI calls** (max 6, all button-triggered, cached, rate-limited, with a deterministic fallback when no key is set):

| # | Call | Fallback without a key |
|---|---|---|
| 1 | Coach guidance per screen | Deterministic text |
| 2 | Ask-a-question | Deterministic text |
| 3 | Draft vision | Templated draft |
| 4 | Map apps to capabilities | Keyword match |
| 5 | Findings per screen | Rule-derived statements |
| 6 | Initiative briefs | Deterministic text |

---

## 6. How the reference build is made (for orientation only)

| Layer | Stack |
|---|---|
| Backend | FastAPI + SQLite (inputs only), Python |
| Rules | Pure functions in `backend/app/rules/` (capabilities, rationalization, data, technology, governance, roadmap, integration, states) |
| RAG | `backend/app/rag/` (chunker, ingest, retrieve, profiles) |
| LLM | Gemini, through one JSON-schema call wrapper |
| Frontend | React + Vite + Tailwind/shadcn |
| Screens | 6: Dashboard, Vision & Guardrails, Business Capabilities, Applications, Data & Technology, Roadmap & Governance |

**Screen layout:** every screen has a summary header (sections, outputs, RFP views), then 4 KPI cards, the main visual, a table and a findings card.

**Your platform only needs:**
1. the intake forms in §4;
2. the formulas in `3_Rule_Parameters`;
3. the ordering of steps in §3;
4. the workbook, as seed data and the bulk-upload format.

---

## 7. Seeding, bulk upload and golden values

- **Production intake is the front end (§4).** Use the workbook to seed the demo and as the bulk-upload template format.
- **Seed load order:** `3_*` (framework) → `1_*` → `4_*`, then compute `5`–`7`.
- **IDs are the join keys:**

  | Entity | ID format |
  |---|---|
  | Capabilities | L0-n / Cnn / Cnn.n |
  | Apps | Ann |
  | Data domains | DD-nn |
  | Checks | Rnn |
  | Interfaces | Inn |
  | Themes | THn |
  | Reference model | Rn.n.n |

- **List fields** are comma-separated IDs (for example `caps`, `depends_on`, `sor`, `consumers`).
- **The `5_OUT_*` and `7_OUT_*` sheets** are expected results with the default config. If your implementation reproduces them, the logic is right:
  - capabilities: 45 L2, average maturity **2.48**, **23** capability gaps;
  - apps: **11** Invest, **3** Retain, **6** Modernise, **4** Replace, **2** Out of scope; **7** duplication clusters;
  - data and technology: DD-01 **24**, DD-06 **22**, DD-08 **92**; resilience **43** with 3 unknown; ACMM **1.56**;
  - roadmap: **62** gaps → **10** initiatives; TH8 is the only W0; TH2 lands in W3; total **₹55.5–139.5 Cr**.
- **Placeholders to replace** with client data before any client claims (all marked `assumed`):
  - every score, owner and interface;
  - the leading-practice model;
  - network link types.

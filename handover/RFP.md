# CIL RFP: Enterprise IT Architecture Review (summary and app coverage)

Source: *RFP for Enterprise IT Architecture*, Coromandel International Limited, 7 pages (read from photographs of pages 2–7; page 1 not provided).
Status as of 2026-11-03, against the CIL EA Navigator POC.

Legend: **Covered** = the app produces it today · **Partial** = present but thinner than the RFP asks · **Not covered** = missing.

---

## 1. What the RFP asks for

**Background.** CIL wants an independent review of its IT architecture and recommendations for a modern, secure, scalable, standardised, future-ready enterprise architecture: assess the current landscape, find gaps and risks, define the target, and recommend a pragmatic roadmap. The vendor sets the scope itself and is not limited to what the RFP lists.

**Four objectives**

| Objective | Question | Expected content |
|---|---|---|
| Assess | Where are we today; what is wrong or missing? | Current landscape (apps, infra, network, integration, data, cloud, cyber); maturity, lifecycle, technical debt, redundancy, dependencies, scalability, resilience, security posture; gaps and risks; benchmark against industry practice and standards |
| Define | Where should we go? | Target architecture aligned to strategy; principles, standards, technology choices, reference architectures; required capabilities, platforms, patterns; future landscape and transition direction |
| Develop | What changes, and how? | Solutions for gaps, technical debt, obsolescence, complexity; modernisation, rationalisation, consolidation, standardisation; prioritised roadmap (quick wins, strategic initiatives, dependencies, indicative effort and investment); gap-filling architecture |
| Draft / Document | How is it documented and maintained? | E2E documentation for current and target states; enterprise, domain, solution, integration, data, infra, cloud and security views; repository, standards catalogue, landscape and diagrams in **editable** format; maintainable modelling approach for ongoing governance |

**Scope of assessment: nine domains.** Enterprise & business architecture; application; integration & API; data, analytics & AI; infrastructure & platform; network & connectivity; cloud; cybersecurity & resilience; modern technology & engineering (DevSecOps, CI/CD, IaC, containers, microservices, platform engineering, emerging tech, vendor dependency).

**Assessment must identify (12):** maturity; gaps and risks; obsolescence; technical debt; duplication and complexity; single points of failure; security and resilience gaps; scalability limits; integration and data limits; standardisation opportunities; consolidation and optimisation; capabilities for future needs. The output is a prioritised gap assessment with business and technology impact and a remediation direction.

**Target architecture must address (12):** business–technology alignment; standardisation and simplification; security and privacy by design; scalability and resilience; cloud and hybrid adoption; modern application and integration architecture; enterprise data architecture; automation and efficiency; observability; technology lifecycle management; cost optimisation; future technology adoption. It should also recommend platforms, standards, patterns and reference architectures.

**Standards.** TOGAF is the primary framework: tailor it, justify any deviations, and leave CIL with a framework it can run on its own. Documentation follows **ISO/IEC/IEEE 42010** (stakeholders, concerns, viewpoints, views); document which TOGAF and 42010 practices were adopted, tailored or excluded, and why.

**Roadmap must show (8):** priority initiatives, dependencies, sequencing, quick wins, medium/long-term initiatives, indicative effort and investment, key risks and constraints, expected benefits.

**Repository and documentation.** A comprehensive, structured, maintainable EA repository with traceability across capabilities, applications, integrations, data, platforms, infrastructure, network, cloud and cyber. Minimum 14 views (listed in §2.5). It must be **layered** (expandable without redesign), **levelled** (executive to technical, with traceability), and **updatable** (editable/native formats, recognised modelling standards). The vendor also recommends the repository tooling, ownership model, update mechanism and governance process.

**Expected outcome.** Current state → architecture gaps → target architecture → standards → gap-filling architecture → roadmap → documentation, so IT leadership can see where CIL stands, what must change and why, what the future looks like, what to standardise, consolidate, modernise or introduce, and in what order.

**Proposal contents (10):** understanding, methodology, scope, current/target approach, deliverables, plan and duration, team, experience and references, assumptions and dependencies, commercials. Vendors are encouraged to propose their own approach; the scope is not exhaustive.

**SPOCs (CIL):** Suryanarayana P (GM-IT) and Syamjee J (SrGM-IT). Their email domain is `coromandel.murugappa.com`.

---

## 2. Coverage in the app

Updated 2026-11-03 after the second build round. Changes since the first check are marked **(new)**.

### 2.1 Objectives

| Objective | Status | Where |
|---|---|---|
| Assess | Covered | Business discovery and assessment; application intake, rationalization and **technical health (new)**; data, resilience and **engineering practices (new)** on Data & Technology; ACMM; **IT Budget cost baseline (new)** |
| Define | Partial | Principles, guardrails, vision statements, gap hypotheses, layered architecture views. Target-state versions of the views were deliberately left out (decision 2026-11-03) |
| Develop | Covered | Dispositions, clusters, **initiative long list with gaps addressed, benefits, risks and constraints (new)**, **value × effort prioritisation (new)**, wave roadmap, cost by FY, **affordability against the IT capex plan (new)** |
| Draft / Document | Covered | 14-view index, every view editable and exportable as PNG and CSV, **draw.io export for the layered views, interactions and process models (new)**, **ISO 42010 viewpoint catalogue and tailoring register (new)**, **repository & ownership model (new)** |

### 2.2 Architecture domains

| Domain | Status | Where |
|---|---|---|
| Enterprise & business | Covered | Capability model to L3, alignment, ACMM, ARB, decision log, repository ownership |
| Application | Covered | Intake (now with technical debt, peak load, failover, key person, vendor lock-in), capability view, rationalization, technical health, layered view |
| Integration & API | Covered **(new)** | Integration & API view restored: pattern mix, hotspots, routing, governance and the editable Interface Catalog |
| Data, analytics & AI | Covered | Editable data domains with data types, sensitivity, volume and retention **(new)**; scores, matrix, data architecture, AI readiness |
| Infrastructure & platform | Covered | Infrastructure view with private-hosting drill-down (hosted apps, DR checks, run cost) **(new)**; editable platforms **(new)** |
| Network & connectivity | Covered **(new)** | Editable sites and links; network drill-down with link types, checks and run cost |
| Cloud | Covered **(new)** | Editable Azure landing zones, hosting placement, cloud checks and cloud run cost |
| Cybersecurity & resilience | Covered | Security drill-down (identity plane, zones, checks, security spend), resilience checklist |
| Modern technology & engineering | Covered **(new)** | Engineering practices checklist E01–E10 (DevSecOps, CI/CD, IaC, containers, API-first, platform engineering, observability, vendor exit, emerging tech), scored and linked to infrastructure blocks |

### 2.3 Assessment findings (the 12 the RFP lists)

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Maturity | Covered | Capability, data, resilience, engineering, ACMM |
| 2 | Gaps and risks | Covered | Gap registers; **initiative risk and constraint register (new)** |
| 3 | Technology obsolescence | Covered **(new)** | Lifecycle on apps and platforms; obsolescence finding on Technology Assessment |
| 4 | Technical debt | Covered **(new)** | Debt score per app (intake + L3 workaround answers) |
| 5 | Duplication and complexity | Covered | Duplication clusters, entanglement |
| 6 | Single points of failure | Covered **(new)** | SPOF flags per app (critical with weak DR, key person, integration hub, no process fallback) |
| 7 | Security and resilience gaps | Covered | Resilience checklist, security drill-down |
| 8 | Scalability limitations | Covered **(new)** | Scalability status per app (intake + L3 peak-season answers) |
| 9 | Integration and data limitations | Covered | Integration view, data scores |
| 10 | Standardisation opportunities | Covered **(new)** | Standardisation finding on Technology Assessment; standards classes |
| 11 | Consolidation and optimisation | Covered | Rationalization, clusters, opex heads by growth on IT Budget |
| 12 | Capabilities for future needs | Partial | Missing blocks in the layered views, gap hypotheses |

### 2.4 Target architecture, roadmap and standards

| Item | Status | Notes |
|---|---|---|
| Target-state views | Not covered (by decision) | Left out at the user's request |
| Cost optimisation | Covered **(new)** | IT Budget: run vs change, intensity vs benchmark, growth by cost head |
| Observability, automation | Covered **(new)** | Engineering checks E07–E08, blocks in the infrastructure view |
| Roadmap: priorities, dependencies, sequencing, quick wins, medium/long term, effort and investment | Covered | Long list, prioritisation, waves, timeline, budget |
| Roadmap: key risks and constraints, expected benefits | Covered **(new)** | Editable per initiative; risks register on the Roadmap step |
| TOGAF tailoring and deviations | Covered **(new)** | Framework Tailoring register with approval status |
| ISO/IEC/IEEE 42010 | Covered **(new)** | Viewpoint catalogue linking stakeholders and concerns to the RFP views |
| Repository tooling, ownership, update process | Covered **(new)** | Repository & Ownership card on EA Governance |
| Editable / native formats | Partial | draw.io export added; ArchiMate exchange format not yet |

### 2.5 The 14 documentation views

All 14 now have a home: 1 Dashboard landscape · 2 Business assessment · 3 Application architecture · 4 Interactions · 5 **Integration & API (restored)** · 6 Data architecture · 7–10 Infrastructure & platform with network, cloud and security drill-downs · 11 Standards & lifecycle · 12 Vision guidelines and decision log · 13 Dashboard states (metrics only, by decision) · 14 Process models.

---

## 3. Still open

1. Target and transition architecture diagrams (RFP view 13): parked by decision.
2. ArchiMate exchange export alongside draw.io.
3. Some reference content is still read-only seed data: ARB charter, compliance levels, estate facts, business drivers and focus areas.
4. Email domain: discovery emails use `coromandel.com`; the RFP SPOCs use `coromandel.murugappa.com`. Confirm which to use.

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

### 2.1 Objectives

| Objective | Status | Where |
|---|---|---|
| Assess | Covered | Business discovery and assessment (L3 questionnaires, maturity, criticality, alignment, entanglement); application intake, fit and rationalization; data-domain scores; resilience checklist; ACMM on Roadmap & Governance |
| Define | Partial | Principles, guardrails, patterns and vision statements (Vision); target hypotheses per gap; states projection (Dashboard). There are no **target-state architecture views**; the layered views are rated current state |
| Develop | Covered | Dispositions with rationale, duplication clusters, gap → initiative → wave roadmap with ₹ ranges and dependency push |
| Draft / Document | Partial | 14-view index, editable layered views, PNG/CSV/SVG export, decision log. Not in recognised modelling formats (ArchiMate, draw.io/Visio); no repository and ownership recommendation |

### 2.2 Architecture domains

| Domain | Status | What exists | What is missing |
|---|---|---|---|
| Enterprise & business | Covered | Capability model L0–L3, business–IT alignment (5 questions), ACMM maturity, ARB and decision log | Technology strategy and EA operating model as an explicit deliverable (only ARB and compliance levels) |
| Application | Covered | Portfolio catalog (Tech DD fields), capability view, BF/TF rationalization, layered application architecture, interactions | Technology stack per app, DevSecOps maturity, **technical debt** score |
| Integration & API | Partial | Interface Catalog (editable from the interactions view), p2p share, hotspots, R05 check | Dedicated integration/API/data-flow view (removed at our request on 2026-11-03), middleware inventory, event-driven and batch design, integration governance |
| Data, analytics & AI | Covered | Domain governance scores, App/Data matrix, data architecture view with flows, AI readiness | Warehouse/lakehouse inventory, AI/ML/GenAI readiness beyond data-domain thresholds |
| Infrastructure & platform | Partial | Infrastructure view (DC, DR, hosting, platform services), resilience checks, standards & lifecycle | Compute/storage inventory, HA design, monitoring/observability assessment beyond a block rating |
| Network & connectivity | Partial | Network layer blocks in the infrastructure view | LAN/WAN inventory, segmentation, remote access, load balancing, third-party connectivity (network seed links are no longer shown since views were consolidated) |
| Cloud | Partial | Hybrid & public cloud layer, hosting counts, P-CIL-01 cloud-smart principle | Landing zones, cloud governance, migration and **cost optimisation** |
| Cybersecurity & resilience | Partial | Security column, §48.5 checks (SSO, SIEM, backups, DR), DPDP privacy risk | IAM/PAM depth, vulnerability management, security governance, business continuity |
| Modern technology & engineering | **Not covered** | Only a DevOps block and R06 container check | DevSecOps, CI/CD, IaC, microservices, platform engineering, emerging tech and **vendor dependency** assessment |

### 2.3 Assessment findings (the 12 the RFP lists)

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Current architecture maturity | Covered | Capability maturity, data scores, resilience score, ACMM |
| 2 | Architectural gaps and risks | Partial | Gap registers (capability, transactional/thematic, data, tech, governance); **no risk register** |
| 3 | Technology obsolescence | Partial | Lifecycle fields, EOL rule RR-02, standards view; no obsolescence summary across the estate |
| 4 | Technical debt | **Not covered** | Customisation and issues fields exist but are not scored or shown |
| 5 | Duplication and complexity | Covered | Duplication clusters, entanglement, survivor proposal |
| 6 | Single points of failure | **Not covered** | Hotspots show heavy interfaces but nothing flags SPOFs |
| 7 | Security and resilience gaps | Covered | Resilience checklist, security column, privacy risk |
| 8 | Scalability limitations | **Not covered** | `scalability` captured in intake, never surfaced |
| 9 | Integration and data limitations | Covered | p2p and manual share, data-domain gaps |
| 10 | Standardisation opportunities | Partial | Standards classes; no explicit opportunity list |
| 11 | Consolidation and optimisation | Covered | Rationalization, Consolidate disposition (RR-04) |
| 12 | Capabilities for future needs | Partial | Gap target hypotheses, missing blocks in layered views |
| – | Prioritised gaps with business/technology impact | Covered | Priority = impact × urgency on the roadmap gap register |

### 2.4 Target architecture (the 12 the RFP lists)

Principles, guardrails and patterns on Vision & Guardrails address most items by intent (alignment, standardisation, security/privacy by design, cloud, integration, data, lifecycle). The gaps are:

- No **target-state version** of the application, data and infrastructure views (only current-state ratings plus the projected metrics on the Dashboard).
- **Cost optimisation**, **observability** and **automation/operational efficiency** have no dedicated assessment or target design.
- Recommended platforms and standards are only the Technology Standards Catalog; there is no target technology stack by layer.

### 2.5 The 14 documentation views

| # | View | Status | Where |
|---|---|---|---|
| 1 | Enterprise-level architecture and landscape | Covered | Dashboard › Enterprise Landscape |
| 2 | Business capability and business–IT alignment | Covered | Business › Assessment |
| 3 | Application portfolio and architecture | Covered | Applications › Intake, Architecture Views |
| 4 | Application dependencies and interactions | Covered | Applications › Interactions & Dependencies |
| 5 | Integration, API and data-flow architecture | Partial | Interface Catalog plus data flows; no dedicated view |
| 6 | Data and analytics architecture | Covered | Data & Technology › Data Architecture |
| 7 | Infrastructure and platform | Covered | Data & Technology › Infrastructure & Platform |
| 8 | Network and connectivity | Partial | Network layer of view 7 only |
| 9 | Cloud and hybrid | Partial | Cloud layer of view 7 only |
| 10 | Cybersecurity and resilience | Partial | Security column of view 7 plus checklist |
| 11 | Technology standards and lifecycle | Covered | Data & Technology › Technology Assessment |
| 12 | Decisions, principles, standards, patterns | Covered | Vision › Guidelines; Roadmap › Decision Log |
| 13 | Current, target and transition states | Partial | Dashboard states (metrics); no target or transition diagrams |
| 14 | E2E views for critical processes | Covered | Business › Architecture Views (ARIS EPC) |

Repository qualities:

- **Layered:** Covered (add layers, rows and blocks; add apps, interfaces and process models).
- **Levelled:** Partial (executive Dashboard down to L3, but no drill-down from a view block to its detail).
- **Traceability:** Partial (capability → app → data domain → hosting exists; tech platform → app and network → site do not).
- **Updatable:** Partial (everything is editable in the tool; exports are PNG/CSV/SVG, not native modelling formats).

### 2.6 Standards, roadmap and outcome

| Item | Status | Notes |
|---|---|---|
| TOGAF as primary framework | Covered | ADM-mapped screens, TOGAF-cited AI, compliance levels |
| TOGAF tailoring and deviations documented | **Not covered** | No tailoring/deviation register with approval |
| Framework CIL can run independently | Partial | Editable tool, ARB, decision log; no ownership and update-process recommendation |
| ISO/IEC/IEEE 42010 alignment | **Not covered** | Stakeholder viewpoints exist on Vision but are not mapped stakeholder → concern → viewpoint → view; no 42010 adoption statement |
| Roadmap: priorities, dependencies, sequencing, quick wins, medium/long term, effort and ₹ | Covered | Roadmap & Governance waves W0–W3, dependency push, FY budget |
| Roadmap: key risks and constraints | **Not covered** | Scope constraints sit on Approach & Plan only |
| Roadmap: expected benefits | Partial | Only as "outcomes" in the on-demand initiative briefs; no benefits stored per initiative |
| Expected outcome chain | Partial | Current state, gaps, standards and roadmap are covered; target and gap-filling architecture and documentation are partial |
| Proposal items: team, references, commercials | Out of scope | Proposal content, not tool content; scope, approach and plan are in Approach & Plan |

---

## 3. Gaps to close, in priority order

1. **Target and transition views.** Add a "Target" state to the layered views (each block gets a target status and target solution) and a transition toggle, so RFP view 13 and the Define objective are met.
2. **Assessment findings 4, 6 and 8.** Score technical debt (customisation, lifecycle, issues), flag single points of failure (single DC hosting with no DR, hotspot apps with no fallback), and surface scalability from the intake field. Add them to the gap register.
3. **Risk register and benefits on the roadmap.** Key risks and constraints per initiative; expected business and technology benefits as rule-based fields.
4. **Modern technology & engineering domain.** A short checklist (DevSecOps, CI/CD, IaC, containers, observability, vendor dependency) like the resilience checklist, feeding the gap register.
5. **ISO 42010 and TOGAF tailoring.** A viewpoint catalogue (stakeholder → concern → viewpoint → view) and a tailoring/deviation register on Vision & Guardrails.
6. **Network, cloud and security depth.** Restore the network-link and security-zone detail as drill-downs from the consolidated infrastructure view; add landing zones and cloud cost.
7. **Integration view.** Bring back a compact integration and API view (patterns, middleware, governance), since RFP view 5 is explicitly listed.
8. **Editable native export.** Export views as draw.io or ArchiMate exchange files, and add a repository/ownership recommendation page.

**Note on email domain:** discovery emails use `coromandel.com`, as requested on 2026-11-03. The RFP's SPOC addresses use `coromandel.murugappa.com`; confirm which domain CIL wants.

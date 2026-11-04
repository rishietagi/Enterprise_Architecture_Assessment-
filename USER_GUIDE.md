# EA Assessment Tool: User Guide

A quick guide to the Enterprise Architecture Assessment Tool and how to move through an engagement with it.

## What the tool does

It walks an Enterprise Architecture review from start to finish, following TOGAF:

1. Agree the **scope and plan**.
2. Set the **vision and the rules** the architecture must follow.
3. Find out **how things work today** (business, applications, data and technology).
4. Turn what you find into **gaps**.
5. Turn the gaps into a **costed roadmap**.

All scores, gaps and costs are calculated by fixed rules, not guessed by AI. AI only writes the narrative, and that narrative always cites TOGAF.

## Getting in

1. **Sign in** with the username and password you were given. This applies to the hosted version only; running locally has no login.
2. Click **Let's Begin**, then pick **Coromandel International Limited**.
3. Use the left sidebar to move between screens. **Switch Engagement** takes you back to the start.

## The workflow, screen by screen

Work roughly top to bottom. Each phase screen shows where the engagement is ("Where We Are"), then numbered steps.

| # | Screen | What you do here | What comes out |
|---|---|---|---|
| 1 | **Approach & Plan** | Upload the RFP, check the scope of work, follow the 16-week plan and update task status. | Agreed scope, phase plan, progress |
| 2 | **Vision & Guardrails** | Add context notes or documents, generate the vision statements, choose principles (CIL's own set or TOGAF's), set guardrails, patterns and rationalization rules, and review stakeholder viewpoints. | Vision, principles, decision rules |
| 3 | **Business Architecture** | **1 Discovery:** send a questionnaire for each process and record the answers. **2 Assessment:** see maturity, business criticality and business–IT alignment. **3 Gap Register:** review the business gaps. **4 Architecture Views:** draw process models. | Capability scores and business gaps |
| 4 | **Applications** | **1 Intake:** record each application. **2 Capability View:** see which processes each app supports. **3 Rationalization:** see the fit, technical health and recommended action per app. **4 Gap Register.** **5 Architecture Views.** | Invest / retain / modernise / replace decisions, and application gaps |
| 5 | **Data & Technology** | **1 Inputs:** data domains, platforms, sites and network. **2 Assessment:** data governance, resilience and engineering checks. **3 Gap Register.** **4 Architecture Views.** | Data and technology gaps |
| 6 | **IT Budget** | Enter IT costs by year, then review the ratios and benchmarks. | Spend profile, and whether the roadmap is affordable |
| 7 | **Roadmap & Governance** | **1 Long List:** gaps grouped into initiatives. **2 Prioritisation:** value against effort. **3 Roadmap:** waves, timeline and cost. **4 Governance:** EA maturity, Architecture Review Board, decisions and repository. | The prioritised, costed roadmap |
| — | **Dashboard** | Read the overall status at any time. | One-page summary for sponsors |

**How it connects:** the answers you capture in screens 3–5 create the gaps. All the gaps flow into the roadmap. The IT Budget shows whether the roadmap fits the money available. Change an input and everything downstream updates on its own.

## Discovery in four moves (Business Architecture)

1. **Generate:** create the questionnaire for a process (L3).
2. **Review and finalise:** edit the questions if needed, then lock them.
3. **Send:** email the questionnaire to the process owner, or fill it in during a workshop.
4. **Record and analyse:** when the replies are in, click **Analyse** on the capability (L2). Its scores are then worked out from the answers.

An owner can reply in three ways: submit the answers, redirect you to the right person, or ask for a walkthrough.

## Buttons you will see everywhere

- **(i) icon:** shows exactly how a number was calculated: the inputs, the rule used and the TOGAF reference.
- **Export:** downloads the view as a PNG image, CSV or draw.io file.
- **Edit / Add / delete:** every input can be changed, and the results recalculate as soon as you save.
- **AI Insights → Generate:** rewrites that step's findings as a TOGAF-cited narrative. If no AI key is set, it shows the rule-based version instead.
- **Regenerate with AI:** marks places where AI will draft content in a later release. For now, it refreshes the rule-based draft.
- **TOGAF Coach** (top right): ask questions about TOGAF or the current screen.

## Good to know

- **Demo data:** figures marked as assumptions are illustrative. Replace them with the client's real data as discovery goes on.
- **Settings** (sidebar): change the rule parameters, or **reset the demo** to its starting data.
- **Hosted version:** on the free plan, edits are lost when the server restarts, and the first load after a quiet spell can take up to a minute.

import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Boxes, CalendarRange, Compass, Database, IndianRupee, LayoutDashboard, Map, Network, type LucideIcon } from 'lucide-react'
import type { ScreenKey } from './api'

export interface ScreenSummaryMeta {
  /** Sections on the screen; `view` is the ?view= key the page uses to open a tab. */
  covers: { view: string; label: string }[]
  /** What the screen produces. */
  outputs: string[]
  /** RFP architecture views (1-14) this screen delivers. */
  rfp: number[]
}

export interface ScreenMeta {
  key: ScreenKey
  path: string
  title: string
  nav: string
  phases: string[]
  badges: string[]
  purpose: string
  icon: LucideIcon
  summary: ScreenSummaryMeta
}

export const SCREENS: ScreenMeta[] = [
  {
    key: 'overview', path: '/', title: 'EA Dashboard', nav: 'Dashboard', phases: ['ADM', 'Req. Mgmt'], badges: ['ADM'],
    purpose: 'Where the CIL assessment stands across the ADM cycle, and what matters most.', icon: LayoutDashboard,
    summary: {
      covers: [{ view: 'adm', label: 'ADM Status' }, { view: 'states', label: 'Current, Transition & Target States' },
        { view: 'landscape', label: 'Enterprise Landscape' }, { view: 'views', label: 'RFP Architecture Views' }],
      outputs: ['Assessment status per ADM phase', 'Projected state metrics per wave to 2030', 'One-page enterprise landscape', 'Coverage of the 14 RFP views'],
      rfp: [1, 13],
    },
  },
  {
    key: 'approach', path: '/approach', title: 'Approach & Plan', nav: 'Approach & Plan', phases: ['Prelim'], badges: ['P'],
    purpose: 'Scope of work, the phase-by-phase engagement approach and the detailed 16-week work plan.', icon: CalendarRange,
    summary: {
      covers: [{ view: 'approach', label: 'Engagement Approach' }, { view: 'plan', label: 'Detailed Work Plan' }],
      outputs: ['Scope of work, deliverables and assumptions', 'Engagement approach with phase gates', 'Detailed work plan with owners and live status'],
      rfp: [],
    },
  },
  {
    key: 'vision', path: '/vision', title: 'Vision & Guardrails', nav: 'Vision & Guardrails', phases: ['Prelim', 'A'], badges: ['P', 'A'],
    purpose: 'Architecture vision statements drawn from the client context, and the principles, guardrails and rules that govern decisions.', icon: Compass,
    summary: {
      covers: [{ view: 'principles', label: 'Principles' }, { view: 'guardrails', label: 'Guardrails & Patterns' },
        { view: 'rules', label: 'Rationalization Rules' }, { view: 'stakeholders', label: 'Stakeholder Viewpoints' }],
      outputs: ['Five architecture vision statements (export .md)', 'Adopted principles, guardrails and patterns', 'Configured rules that drive every app disposition'],
      rfp: [12],
    },
  },
  {
    key: 'business', path: '/business', title: 'Business Architecture', nav: 'Business Architecture', phases: ['B'], badges: ['B'],
    purpose: 'Current-state discovery on the standard capability model, then assessment, gap register and process views, down to L3.', icon: Boxes,
    summary: {
      covers: [{ view: 'discovery', label: '1 Current State Discovery' }, { view: 'heatmap', label: '2 Assessment' },
        { view: 'gaps', label: '3 Gap Register' }, { view: 'models', label: '4 Architecture Views' }],
      outputs: ['CIL capability catalogue L0–L3 adopted from the standard', 'L3 discovery questionnaires and L2 scores inferred from them', 'Maturity, business criticality, business–IT alignment and entanglement', 'Transactional and thematic gaps with target-state hypotheses; ARIS process views'],
      rfp: [2, 14],
    },
  },
  {
    key: 'applications', path: '/applications', title: 'Application Architecture', nav: 'Applications', phases: ['C · App'], badges: ['C'],
    purpose: 'Application intake, application support by capability down to L3, rule-based rationalization, and application architecture views.', icon: Network,
    summary: {
      covers: [{ view: 'inventory', label: '1 Application Intake' }, { view: 'capability', label: '2 Capability View' },
        { view: 'rationalization', label: '3 Rationalization' }, { view: 'gaps', label: '4 Gap Register' }, { view: 'architecture', label: '5 Architecture Views' }],
      outputs: ['Application Portfolio Catalog (Tech DD fields)', 'Application support by L1–L3 process', 'Disposition per app with a written rationale and overrides', 'Application architecture and interaction views'],
      rfp: [3, 4],
    },
  },
  {
    key: 'data_tech', path: '/data-tech', title: 'Data & Technology', nav: 'Data & Technology', phases: ['C · Data', 'D'], badges: ['C', 'D'],
    purpose: 'Data and technology inputs, their assessment, then the data and infrastructure architecture views.', icon: Database,
    summary: {
      covers: [{ view: 'inputs', label: '1 Inputs' }, { view: 'data', label: '2 Assessment' }, { view: 'gaps', label: '3 Gap Register' }, { view: 'data_arch', label: '4 Architecture Views' }],
      outputs: ['Data domains with data types, platforms, sites and network', 'Data-domain scores, resilience and engineering practices', 'Data architecture and the consolidated infrastructure and platform view'],
      rfp: [6, 7, 8, 9, 10, 11],
    },
  },
  {
    key: 'budget', path: '/budget', title: 'IT Budget', nav: 'IT Budget', phases: ['E', 'F'], badges: ['₹'],
    purpose: 'The IT cost baseline: overall IT costs, capex by initiative, opex by cost head and business factors, with the ratios every other screen uses.', icon: IndianRupee,
    summary: {
      covers: [{ view: 'inputs', label: '1 Cost Inputs' }, { view: 'analysis', label: '2 Cost Analysis' }],
      outputs: ['IT opex, salaries and capex by financial year', 'Capex by initiative and opex by cost head', 'Spend intensity, run vs change mix, growth and roadmap affordability'],
      rfp: [13],
    },
  },
  {
    key: 'roadmap', path: '/roadmap', title: 'Roadmap & Governance', nav: 'Roadmap & Governance', phases: ['E', 'F', 'G', 'H'], badges: ['E–H'],
    purpose: 'The long list of initiatives, their prioritisation, the roadmap to 2030 and EA governance.', icon: Map,
    summary: {
      covers: [{ view: 'longlist', label: '1 Initiative Long List' }, { view: 'priority', label: '2 Prioritisation' },
        { view: 'roadmap', label: '3 Roadmap' }, { view: 'governance', label: '4 EA Governance' }],
      outputs: ['Initiatives with the gaps they address, benefits, risks and constraints', 'Value × effort prioritisation', 'Wave roadmap with quick wins, cost by FY and affordability', 'ACMM, ARB, decisions and repository ownership'],
      rfp: [12, 13],
    },
  },]

export const SCREEN_BY_KEY = Object.fromEntries(SCREENS.map((s) => [s.key, s])) as Record<ScreenKey, ScreenMeta>

export function screenForPath(pathname: string): ScreenMeta {
  return SCREENS.find((s) => s.path !== '/' && pathname.startsWith(s.path)) ?? SCREENS[0]
}

/** The active tab/view of a screen, kept in ?view= so summary chips and the RFP view index can deep-link. */
export function useView(fallback: string, allowed: string[]): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams()
  const v = params.get('view')
  const value = v && allowed.includes(v) ? v : fallback
  const set = useCallback((next: string) => setParams((p) => {
    const q = new URLSearchParams(p)
    q.set('view', next)
    return q
  }, { replace: true }), [setParams])
  return [value, set]
}

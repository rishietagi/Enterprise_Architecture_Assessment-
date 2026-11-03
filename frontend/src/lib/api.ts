// Typed client for the FastAPI backend. Shapes mirror backend/app/views.py and app/llm/calls.py.

export type Source = 'deck' | 'public' | 'assumed' | 'client' | 'togaf'
export type ScreenKey = 'overview' | 'approach' | 'vision' | 'business' | 'applications' | 'data_tech' | 'budget' | 'roadmap'

export interface Explanation {
  title: string
  lines: { label: string; value: string }[]
  result: string
  rule?: string | null
  ref?: string | null
}
type Explains<K extends string> = Record<K, Explanation>

export interface Citation {
  n: number
  id: string
  label: string
  breadcrumb: string
  section_no: string | null
  page: number
  content_type: string
  source: 'course' | 'guide'
  text: string
}

export interface Gap {
  id: string
  kind: 'capability' | 'application' | 'duplication' | 'data' | 'technology' | 'governance' | 'business' | 'data_tech'
  ref: string
  severity?: Severity
  category?: string
  register?: string
  description?: string
  title: string
  impact: number
  urgency: number
  priority: number
  adm_phase: string
  togaf_ref: string
  theme?: string
  theme_name?: string
  explain: Explanation
}

export interface AiMeta {
  citations: Citation[]
  mode: 'ai' | 'cached' | 'fallback' | 'none'
  model: string | null
  reason?: string | null
}

export interface CitedItem {
  text: string
  cites: number[]
  rule?: string
}

// ---------------------------------------------------------------- overview
export interface Initiative {
  id: string
  name: string
  gaps: number
  priority: number
  size: 'S' | 'M' | 'L' | 'XL'
  wave: number
  wave_id: string
  depends_on: string[]
  focus: string[]
  foundation: boolean
  gap_ids: string[]
  by_register?: Record<string, number>
  high?: number
  cost_cr: [number, number]
  fy_split: Record<string, [number, number]>
  explain: Explanation
}

export interface StateMetric {
  key: string
  label: string
  unit: string
  better: 'higher' | 'lower'
  screen: ScreenKey
  values: (number | null)[]
  explain: Explanation
}

export interface States {
  columns: { id: string; name: string; window: string; wave?: number }[]
  metrics: StateMetric[]
  narrative: { current: string[]; target: string[]; transitions: Record<string, string[]> }
}

export interface Landscape {
  l0: { id: string; name: string }[]
  l1: { id: string; name: string; l0: string | null; maturity: number | null; band: string | null; gaps: number }[]
  layers: { layer: string; apps: { id: string; name: string; disposition: string; label: string; hosting: string; in_scope: boolean }[] }[]
  data: { id: string; name: string; score: number; band: string }[]
  hosting: { name: string; apps: number }[]
  platforms: { id: string; name: string; category: string; standard: string }[]
}

export interface ArchView {
  n: number
  name: string
  screen: ScreenKey
  view: string
  artifact: string
  togaf_ref: string
  records: number
  evidence: number
  status: 'evidenced' | 'draft'
}

export interface DomainHealth { key: string; label: string; screen: ScreenKey; view?: string; value: string; pct: number | null; band: string | null; note: string }

export interface Overview {
  engagement: { week: number; weeks: number; progress: number; phase: string | null; phase_weeks: string | null
    milestone: { name: string; week: number } | null; steerco: number | null; counts: Record<string, number> }
  health: DomainHealth[]
  cost: { fy: string; total: number | null; pct_revenue: number | null; benchmark: [number, number]; cagr: number | null; change_share: number | null
    afford: Afford[]; health: TechHealth['counts']; engineering: number | null; actions: number; in_scope: number }
  insights: Record<string, Insight[]>
  kpis: { acmm_mean: number; avg_cap_maturity: number; data_avg: number; total_cr: [number, number] }
  adm: { phase: string; label: string; screen: ScreenKey; status: 'assessed' | 'in_progress' | 'not_started'; explain: Explanation }[]
  explain: Explains<'acmm_mean' | 'avg_cap_maturity' | 'data_avg' | 'total_cr' | 'dispositions' | 'waves' | 'adm'>
  dispositions: { code: string; name: string; count: number }[]
  states: States
  landscape: Landscape
  views: ArchView[]
  top_gaps: Gap[]
  waves: {
    id: string
    name: string
    window: string
    cost_cr: [number, number]
    initiatives: Pick<Initiative, 'id' | 'name' | 'size' | 'cost_cr' | 'priority'>[]
  }[]
  counts: { gaps: number; initiatives: number; apps: number; capabilities: number }
}

// ---------------------------------------------------------------- vision
export interface Principle {
  id: string
  name: string
  number?: number
  category: string
  statement: string
  rationale?: string
  implications?: string[]
  togaf_basis?: string
  citation: Omit<Citation, 'n'> | null
  source: Source
  adopted: boolean
}

export interface PrinciplesView {
  togaf: Principle[]
  cil: Principle[]
  adopted: number
  limit: { min: number; max: number; ref: string }
  warning: string | null
}

export interface VisionDocT {
  vision_statement: string
  ai_ambition: string
  objectives: string[]
  success_measures: string[]
  citations: Citation[]
  source: Source
  mode: string
  updated: string | null
}

export interface AiInitiative {
  id: string
  name: string
  type: string
  status: string
  depends_on_data_domains: string[]
  source: Source
  ready: boolean
  blocking: { id: string; name: string; score: number }[]
  explain: Explanation
}

export type GuidelineKind = 'principle' | 'guardrail' | 'pattern' | 'viewpoint' | 'tailoring'

/** ISO/IEC/IEEE 42010 viewpoint: stakeholder concerns answered by one or more RFP views. */
export interface Viewpoint { id: string; name: string; stakeholder: string; concerns: string; views: number[]; model_kind: string; screen: string; source: Source }

/** TOGAF / 42010 tailoring register entry. */
export interface Tailoring { id: string; framework: string; element: string; decision: 'Adopted' | 'Tailored' | 'Excluded'; rationale: string; approval: string; source: Source }

export interface Guideline {
  id: string
  name: string
  statement?: string
  category?: string
  togaf_basis?: string
  enforced_by?: string
  use?: string
  principle?: string
  active?: boolean
  source: Source
}

export interface RuleT {
  id: string
  name: string
  when: string
  then: string
  enabled: boolean
  locked?: boolean
  params?: Record<string, number | string | string[]>
  basis: string[]
  togaf_ref: string
  why: string
  condition: string
}

export interface RulesConfig {
  threshold: number
  bf_weights: number[]
  tf_weights: number[]
  labels: Record<string, { label: string; desc: string }>
  rules: RuleT[]
  capability: { gap_importance_min: number; gap_maturity_max: number; target_maturity: Record<string, number> }
  defaults: { threshold: number }
}

export type PlanStatus = 'planned' | 'in_progress' | 'done' | 'at_risk' | 'milestone'

export interface PlanActivity {
  id: string
  name: string
  start_week: number
  weeks: number
  end_week: number
  kpmg: string
  cil: string
  deliverable: string
  status: PlanStatus
  status_source: Source
}

export interface EngagementPlan {
  start: string
  weeks: number
  as_of: string
  current_week: number
  week_dates: string[]
  note: string
  source: Source
  progress: number
  counts: Record<PlanStatus, number> & { total: number }
  phases: { id: string; name: string; short?: string; adm: string; start_week: number; end_week: number; progress: number; activities: PlanActivity[]; objective?: string; approach?: string[]; outputs?: string[]; gate?: string }[]
  cadence?: { weekly_connect: number[]; steerco: number[] }
  explain: Explanation
}

export interface ScopeOfWork {
  requirement: string
  objective: string
  items: { n: number; title: string; icon: string; activities: string }[]
  source: Source
}

export interface ApproachPhase {
  id: string; name: string; short?: string; adm: string; objective: string; approach: string[]; outputs: string[]; gate: string
  start_week: number; end_week: number; progress: number; activities: number; phase: PhasePlanT | null
}

export interface Approach {
  plan: EngagementPlan
  phases: ApproachPhase[]
  current_phase: string | null
  scope_of_work: ScopeOfWork
  engagement: { client: string; request: string; horizon: string; source: Source }
  scope: { in_scope: string[]; out_of_scope: string[]; constraints: string[]; source: Source }
  stakeholders: { viewpoint: string; concerns: string; screens: ScreenKey[]; source: Source }[]
  drivers: { id: string; driver: string; source: Source }[]
  focus_areas: { id: string; name: string; detail: string; source: Source }[]
  views: ArchView[]
}

export interface VisionStatement { title: string; statement: string; drivers: string[]; evidence: string[]; cites: number[] }

export interface VisionContext {
  text: string
  statements: VisionStatement[]
  mode: string
  citations: Citation[]
  updated: string | null
  source: Source
  docs: { id: number; name: string; kind: string; size: number; words: number; uploaded: string | null; preview: string; source?: Source }[]
  themes: { term: string; count: number }[]
  words: number
}

export interface StatementsResult extends AiMeta { statements: VisionStatement[]; themes: { term: string; count: number }[] }

export interface PrincipleSuggestion extends AiMeta {
  name: string; statement: string; rationale: string; implications: string[]; category: string; togaf_basis: string; cites: number[]
}

export interface Vision {
  plan: EngagementPlan
  phase: PhasePlanT | null
  scope_of_work: ScopeOfWork
  context: VisionContext
  engagement: { client: string; request: string; horizon: string; source: Source }
  drivers: { id: string; driver: string; source: Source }[]
  focus_areas: { id: string; name: string; detail: string; source: Source }[]
  scope: { in_scope: string[]; out_of_scope: string[]; constraints: string[]; source: Source }
  stakeholders: { viewpoint: string; concerns: string; screens: ScreenKey[]; source: Source }[]
  principles: PrinciplesView
  guardrails: Guideline[]
  patterns: Guideline[]
  viewpoints: Viewpoint[]
  tailoring: Tailoring[]
  rfp_views: Record<number, { name: string; screen: ScreenKey; view: string }>
  rules: RulesConfig
  ai_initiatives: AiInitiative[]
  vision_doc: VisionDocT
  ai_ready_min: number
  kpis: { drivers: number; principles_adopted: number; principles_max: number; ai_ready: number; ai_total: number; scope_exclusions: number; guardrails: number; rules_on: number }
  explain: Explains<'drivers' | 'principles_adopted' | 'ai_ready' | 'scope_exclusions' | 'rules_on'>
}

export interface VisionDraft extends AiMeta {
  vision_statement: string
  ai_ambition: string
  objectives: string[]
  success_measures: string[]
  cites: number[]
}

// ---------------------------------------------------------------- business
export interface AppRef {
  id: string
  name: string
  disposition: string
  label: string
}

export interface EntNode {
  id: string
  name: string
  l1: string
  upstream: string[]
  downstream: string[]
  shared: string[]
  score: number
  high: boolean
  explain: Explanation
}

/** An L2 catalog entry. Unassessed entries (assessed = false) have null scores. */
export interface CapRow {
  id: string
  l1_id: string
  l1: string
  name: string
  q: number[] | null
  maturity: number | null
  importance: number | null
  gap_score?: number
  band: string | null
  focus: string | null
  is_gap: boolean
  assessed: boolean
  source: Source
  catalog_source: Source
  gap: Gap | null
  explain: Explanation | null
  description: string
  owner: string
  ref: string | null
  depends_on: string[]
  automation: string
  apps: AppRef[]
  target: number | null
  to_target?: number
  ai_level: string | null
  entanglement: EntNode | null
  l3: L3Row[]
  discovery: {
    analysed: boolean
    analysed_at: string | null
    by: string | null
    comments: Record<string, string>
    inference: Inference
    rollup: Rollup
    stale: boolean
  }
  /** Where the L2 score comes from: analysed L3 discovery, the assumed baseline, or nothing yet. */
  basis: 'discovery' | 'baseline' | null
}

// ---------------------------------------------------------------- current-state discovery (L3)
export type DiscStatus = 'not_generated' | 'draft' | 'sent' | 'walkthrough' | 'redirected' | 'responded'

export interface SurveyQuestion {
  id: string
  dim: 'P' | 'T' | 'D' | 'I' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'IMP' | null
  type: 'text' | 'apps' | 'choice'
  label: string
  text: string
  help?: string
  options?: string[]
  generated?: boolean
}

export interface SurveyEvent {
  at: string
  event: string
  by: string
  note?: string
}

export interface Survey {
  id: string
  status: DiscStatus
  channel: 'email' | 'workshop'
  recipient: { role: string; email: string }
  outcome: 'submitted' | 'redirected' | 'walkthrough' | null
  redirect_to: string | null
  note: string
  answers: Record<string, unknown>
  questions: SurveyQuestion[]
  history: SurveyEvent[]
  source: Source
  finalised?: boolean
}

export interface L3Score {
  q: number[]
  maturity: number
  band: string
  importance: number | null
  fit: number | null
  partnering: number | null
  alignment: number | null
  alignment_parts: { label: string; value: number }[]
  is_gap: boolean
  weakest: string
  explain: Explanation
}

export interface L3Row {
  id: string
  name: string
  ref: string | null
  owner: string
  l2_id: string
  source: Source
  status: DiscStatus
  survey: Survey | null
  score: L3Score | null
  quadrant: { key: 'aligned' | 'underserved' | 'overserved' | 'low'; label: string } | null
}

export interface Rollup {
  l3: number
  not_generated: number
  draft: number
  sent: number
  walkthrough: number
  redirected: number
  responded: number
  generated: number
  pct_responded: number
}

export interface InferDim {
  key: 'P' | 'T' | 'D' | 'I' | 'IMP'
  label: string
  value: number | null
  mean: number | null
  inputs: { id: string; name: string; value: number }[]
  comment: string
}

export interface Inference {
  answered: number
  total: number
  pending: string[]
  ready: boolean
  q: number[] | null
  importance: number | null
  alignment: number | null
  dims: InferDim[]
  explain: Explanation | null
}

export interface EmailDraft {
  to_role: string
  to: string
  cc: string
  subject: string
  body: string
  kind: 'initial' | 'explain' | 'redirect'
  options: { key: string; label: string }[]
  domain: string
  attachment: { name: string; size_kb: number; sheets: string[]; columns: string[] }
}

export type Severity = 'High' | 'Medium' | 'Low'
export interface RegGap {
  id: string
  type: 'transactional' | 'thematic'
  level: 'L0' | 'L1' | 'L3'
  l0: { id: string; name: string }
  l1: { id: string; name: string } | null
  l2: { id: string; name: string } | null
  l3: { id: string; name: string } | null
  title: string
  dims: string[]
  description: string
  hypothesis: string
  severity: Severity
  criticality: number | null
  owner: string
  related?: string[]
  evidence: { label: string; answer: string; value: number | null }[]
  source: Source
  edited: boolean
  generated: { description: string; hypothesis: string; severity: Severity }
  explain: Explanation
}
export interface GapRegisterT {
  transactional: RegGap[]
  thematic: RegGap[]
  severities: Severity[]
  counts: { transactional: number; thematic: number } & Record<Severity, number>
}
export interface L3Ent {
  id: string; name: string; l2: string; apps: string[]; app_names: string[]; answered: boolean
  shared: { id: string; name: string; l2: string; apps: string[] }[]; cross: number; score: number | null; explain: Explanation
}

// ---------------------------------------------------------------- architecture views (ARIS-style EPC)
export type PNodeType = 'event' | 'function' | 'xor' | 'and' | 'system' | 'data'

export interface PNode {
  id: string
  type: PNodeType
  label: string
  lane: string
  x: number
  y: number
  w: number
  h: number
  cap?: string
  app?: string
}

export interface PEdge {
  id: string
  from: string
  to: string
  label?: string
  kind?: 'assoc'
}

export interface ProcessModelT {
  id: string
  name: string
  description: string
  notation: string
  lanes: { id: string; name: string }[]
  lane_h: number
  nodes: PNode[]
  edges: PEdge[]
  source: Source
  version: number
  updated?: string
  custom?: boolean
}

export interface PhasePlanT {
  id: string
  name: string
  start: string
  end: string
  as_of: string
  start_week: number
  end_week: number
  current_week: number
  weeks: number
  progress: number
  elapsed: number
  status: 'not_started' | 'in_progress' | 'at_risk' | 'overdue' | 'complete'
  source: Source
  counts: Record<PlanStatus, number>
  milestone: { name: string; week: number; date: string } | null
  activities: { id: string; name: string; start_week: number; end_week: number; status: PlanStatus; deliverable: string }[]
  explain: Explanation
}

export interface AppCapL3 { id: string; name: string; status: DiscStatus; apps: string[]; other: string; fit: number | null; alignment: number | null }
export interface AppCapL2 {
  id: string; name: string; owner: string; apps: string[]; maturity: number | null; band: string | null; is_gap: boolean
  importance: number | null; basis: 'discovery' | 'baseline' | null; l3: AppCapL3[]
}
export interface AppCapTree { l0: { id: string; name: string }[]; l1: { id: string; name: string; l0: string | null; children: AppCapL2[] }[] }

export interface Insight {
  text: string
  rule: string
}

export type L1Rollup = Rollup & { l2: number; analysed: number; maturity: number | null; gaps: number }

export interface L1Node {
  id: string
  name: string
  owner: string
  ref: string | null
  l0: string | null
  description: string
  source: Source
  children: CapRow[]
  rollup: L1Rollup
}

export interface RefNode {
  id: string
  level: 0 | 1 | 2 | 3
  parent: string | null
  name: string
  description?: string
  practice?: string
  adopted_by: string | null
}

export interface Question {
  key: string
  label: string
  text: string
  options: { n: number; label: string; hint: string }[]
}

export interface Business {
  l0: { id: string; name: string; owner: string; ref: string | null; source: Source; rollup: L1Rollup & { l1: number } }[]
  l1: L1Node[]
  questionnaire: { scale: Record<string, string>; questions: Question[] }
  reference: RefNode[]
  coverage: { by_l1: { id: string; name: string; total: number; adopted: number; adopted_ids: string[] }[]; adopted: number; total: number; custom: string[]; l3_total: number; l3_adopted: number; explain: Explanation }
  entanglement: { nodes: EntNode[]; dependencies: { from: string; to: string }[]; shared: { a: string; b: string; apps: string[] }[]; l1_links: { from: string; to: string; count: number }[]; high: number; threshold: number }
  discovery: {
    rollup: Rollup
    by_l1: (L1Rollup & { id: string; name: string })[]
    response_options: { key: string; label: string; hint: string }[]
    inference: string
    template: { id: string; label: string; dim: string | null; type: string }[]
  }
  models: ProcessModelT[]
  plan: PhasePlanT | null
  insights: Record<string, Insight[]>
  ladder: { n: number; label: string; hint: string; caps: string[] }[]
  apps: { id: string; name: string }[]
  gaps: Gap[]
  focus_areas: { id: string; name: string }[]
  bands: [number, number, string][]
  thresholds: { gap_importance_min: number; gap_maturity_max: number; alignment_min: number; quadrant_split: number }
  gap_register: GapRegisterT
  entanglement_l3: Record<string, L3Ent[]>
  target_maturity: Record<string, number>
  kpis: {
    avg_maturity: number; weak_critical: number; n_caps: number; n_catalog: number; n_l1: number; n_l0: number; gaps: number
    high_priority_gaps: number; focus_covered: number; focus_total: number; coverage_pct: number; ai_enabled: number; entangled: number
    n_l3: number; responded: number; generated: number; analysed_l2: number; alignment_avg: number | null; underserved: number
  }
  explain: Explains<'avg_maturity' | 'weak_critical' | 'gaps' | 'focus_covered' | 'coverage_pct' | 'ai_enabled' | 'entangled' | 'responded' | 'alignment_avg'>
  added?: string[]
  deleted?: string[]
}

// ---------------------------------------------------------------- applications
export interface AppComputed {
  id: string
  name: string
  business_fit: number
  technical_fit: number
  disposition: string
  label: string
  quadrant: string
  rule_disposition: string
  overridden: boolean
  rules_fired: string[]
  consolidate_into: string | null
  validate_lifecycle: boolean
  criticality: number
  rationale: string
  statement: string
  explain: Explanation
}

/** Application record: Tech DD intake fields plus rule inputs (caps, sor, criticality, lifecycle, bf, tf, in_scope). */
export interface AppFields {
  name: string
  description?: string
  vendor: string
  version?: string
  type: string
  layer?: string
  business_owner?: string
  it_owner?: string
  users?: string
  caps: string[]
  hosting: string
  platform?: string
  customisation?: string
  licence_model?: string
  support_model?: string
  contract_end?: string
  scalability?: string
  dr?: string
  tech_debt?: string
  peak_load?: string
  scale_model?: string
  failover_tested?: string
  key_person?: string
  vendor_lock?: string
  standards_class?: string
  lifecycle: string
  retire_date?: string
  sor: string[]
  pii?: boolean
  run_cost?: string
  criticality: number
  bf: number[]
  tf: number[]
  in_scope: boolean
  issues?: string
  note?: string
  override?: { disposition?: string; reason?: string }
}

export interface App extends AppFields {
  id: string
  cap_names: string[]
  source: Source
  assumed_fields?: string[]
  interfaces: number
  computed: AppComputed
}

export interface Cluster {
  cap: string
  cap_name: string
  apps: string[]
  survivor: string
  survivor_name: string
  members: { id: string; name: string; disposition: string; label: string }[]
  explain: Explanation
}

export interface Iface {
  id: string
  from: string
  to: string
  from_name: string
  to_name: string
  data: string
  domain: string | null
  pattern: string
  frequency: string
  via: string
  source: Source
}

export interface Integ {
  count: number
  by_pattern: Record<string, number>
  p2p: number
  p2p_share: number
  legacy: number
  legacy_share: number
  manual: number
  hotspots: { id: string; name: string; degree: number }[]
  degree: Record<string, number>
  hotspot_min: number
}

/** A gap in the Application or Data & Technology register (one per item, or a portfolio theme). */
export interface DomainGap {
  id: string
  scope: 'item' | 'portfolio'
  category: string
  where: { kind: string; id: string; name: string; group: string }
  title: string
  description: string
  hypothesis: string
  severity: Severity
  initiative: string
  initiative_name: string
  evidence: string[]
  edited: boolean
  generated: { description: string; hypothesis: string; severity: Severity }
  explain: Explanation
}
export interface DomainGapRegister {
  gaps: DomainGap[]
  severities: Severity[]
  categories: string[]
  counts: { item: number; portfolio: number; by_category: Record<string, number> } & Record<Severity, number>
}

export type RefStatus = 'ok' | 'partial' | 'missing' | 'validate'


/** A building block in a reference architecture view. Fields after `hosting` are computed by the API and not saved. */
export interface RefBlock {
  id: string
  name: string
  status: RefStatus
  apps: string[]
  note: string
  span: number
  group?: string | null
  check?: string | null
  hosting?: string | null
  derived?: string
  app_refs?: { id: string; name: string; disposition: string | null; label: string }[]
  hosted?: { id: string; name: string }[]
}

export interface RefLayer { id: string; name: string; rows: RefBlock[][] }

export interface RefView {
  id: string
  screen: ScreenKey
  kind: 'application' | 'data' | 'infrastructure'
  title: string
  subtitle: string
  source: Source
  functions: string[]
  layers: RefLayer[]
  aside: { title: string; boxes: RefBlock[] } | null
  edges: { from: string; to: string }[]
  counts: Record<RefStatus, number> & { total: number }
  explain: Explanation
}

export type RefViewIn = Pick<RefView, 'title' | 'subtitle' | 'functions' | 'layers' | 'aside' | 'edges'>

export interface Applications {
  plan: PhasePlanT | null
  cap_tree: AppCapTree
  ref_view: RefView | null
  gap_register: DomainGapRegister
  tech_health: TechHealth
  insights: Record<string, Insight[]>
  apps: App[]
  clusters: Cluster[]
  l2: { id: string; name: string; l1: string }[]
  labels: Record<string, string>
  label_desc: Record<string, string>
  threshold: number
  layers: string[]
  interfaces: Iface[]
  external: { id: string; name: string; source: Source }[]
  integration: Integ
  patterns: string[]
  domains: { id: string; name: string }[]
  options: Record<string, (string | number)[]>
  kpis: {
    inventoried: number; target: string; dispositions: Record<string, number>; clusters: number; lifecycle_unknown: number
    interfaces: number; p2p_share: number; overridden: number
  }
  explain: Explains<'inventoried' | 'dispositions' | 'clusters' | 'lifecycle_unknown' | 'p2p_share' | 'manual' | 'hotspots'>
}

export type IfaceIn = Pick<Iface, 'from' | 'to' | 'data' | 'domain' | 'pattern' | 'frequency' | 'via'>

export interface MapResult extends AiMeta {
  mappings: { app_id: string; app_name: string; caps: string[]; cap_names: string[]; confidence: number }[]
  method?: 'ai' | 'keyword'
}

// ---------------------------------------------------------------- data & tech
export interface Domain {
  id: string
  name: string
  owner: boolean
  sor: string
  mdm: 'none' | 'partial' | 'full'
  quality: number[]
  lineage: boolean
  pii: boolean
  classified: boolean
  consumers: string[]
  source: Source
  volume_hint?: string
  description?: string
  steward?: string
  data_types?: string[]
  sensitivity?: string
  retention?: string
  computed: { id: string; name: string; score: number; band: string; privacy_risk: boolean; is_gap: boolean; explain: Explanation }
}

export type DomainIn = Partial<Pick<Domain, 'name' | 'description' | 'owner' | 'steward' | 'sor' | 'consumers' | 'mdm' | 'lineage' | 'pii' | 'classified' | 'quality' | 'data_types' | 'sensitivity' | 'volume_hint' | 'retention'>>
export interface Site { id: string; name: string; type: string; source: Source }
export interface NetLink { id: string; from: string; to: string; type: string; note: string; source: Source }
export interface LandingZone { id: string; name: string; status: RefStatus; workloads: string; source: Source }
export interface PlatformIn { name: string; category: string; standard: string; lifecycle: string; version: string; location: string }

export interface Check {
  id: string
  check: string
  status: 'pass' | 'partial' | 'fail' | 'unknown'
  togaf_ref: string
  source: Source
  note?: string
}

export interface Platform {
  id: string
  name: string
  category: string
  lifecycle: string
  standard: string
  location?: string
  version?: string
  source: Source
}

export interface HostedApp {
  id: string
  name: string
  layer: string | null
  in_scope: boolean
  disposition: string
  label: string
}

export interface DataArch {
  sources: { id: string; name: string; hosting: string }[]
  domains: { id: string; name: string; sor: string; score: number; band: string; pii: boolean; privacy_risk: boolean }[]
  analytics: { id: string; name: string }[]
  ai: { id: string; name: string; ready: boolean; domains: string[] }[]
  platforms: Platform[]
  edges: { from: string; to: string; kind: 'sor' | 'feeds' | 'ai' }[]
}

export interface DataTech {
  plan: PhasePlanT | null
  engineering_checks: Check[]
  engineering: { score: number | null; counts: Record<string, number>; unknown: number; explain: Explanation }
  landing_zones: LandingZone[]
  sites_source: Source
  apps: { id: string; name: string; hosting: string }[]
  budget_fys: string[]
  budget_infra: BudgetLine[]
  options: Record<'mdm' | 'data_types' | 'sensitivity' | 'standards' | 'lifecycle' | 'check' | 'location_types', string[]>
  insights: Record<string, Insight[]>
  data_ref: RefView | null
  gap_register: DomainGapRegister
  infra_ref: RefView | null
  domains: Domain[]
  matrix: { app: string; name: string; cells: Record<string, '' | 'sor' | 'consumer'> }[]
  bands: [number, number, string][]
  weights: Record<string, number>
  facts: { k: string; v: string; source: Source }[]
  locations: { id: string; name: string; type: string; source: Source }[]
  platforms: Platform[]
  network: { id: string; from: string; to: string; type: string; note: string; source: Source }[]
  zones: { id: string; name: string; holds: string; checks: string[]; statuses: { id: string; status: Check['status'] }[]; source: Source }[]
  identity_plane: { name: string; check: string; source: Source } | null
  hosting: { name: string; location: string | null; apps: HostedApp[] }[]
  data_arch: DataArch
  checks: Check[]
  tech: { resilience_score: number | null; unknown: number; counts: Record<string, number>; explain: Explanation }
  kpis: { data_avg: number; privacy_risk: number; resilience_score: number | null; to_validate: number }
  explain: Explains<'data_avg' | 'privacy_risk' | 'resilience_score' | 'to_validate'>
  check_explain: Record<string, Explanation>
}

// ---------------------------------------------------------------- roadmap
export interface DecisionT {
  id: number
  title: string
  context: string
  decision: string
  principles: string[]
  status: string
  source: Source
  created: string
}

export interface Roadmap {
  gaps: Gap[]
  initiatives: Initiative[]
  waves: { id: string; name: string; window: string; fy_split: Record<string, number> }[]
  fy_budget: Record<string, [number, number]>
  total_cr: [number, number]
  rate_card: Record<'S' | 'M' | 'L' | 'XL', [number, number]>
  rate_card_note: string
  start: string
  acmm: { id: string; name: string; level: number; source: Source }[]
  acmm_levels: string[]
  acmm_mean: number
  arb: { chair: string; members: string[]; cadence: string; checkpoints: string[]; togaf_ref: string[] }
  compliance_levels: string[]
  compliance_ref: string
  decisions: DecisionT[]
  principles: { id: string; name: string }[]
  kpis: { gaps: number; initiatives: number; total_cr: [number, number]; acmm_mean: number }
  explain: Explains<'gaps' | 'initiatives' | 'total_cr' | 'acmm_mean' | 'fy_budget'>
  plan: PhasePlanT | null
  long_list: InitiativeRow[]
  budget: { afford: Afford[]; per_fy: BudgetFY[]; benchmark: [number, number] }
  repository: Repository
  prio_cfg: { value_split: number; effort_split: number; effort: Record<string, number>; quadrants: Record<string, string> }
  insights: Record<string, Insight[]>
}

// ---------------------------------------------------------------- IT budget
export interface BudgetLine { id: string; name: string; values: (number | null)[]; theme?: string | null; kind?: string | null; unit?: string | null }
export interface BudgetFY {
  fy: string; actual: boolean; opex: number | null; salaries: number | null; capex: number | null; total: number | null
  run_share: number | null; change_share: number | null; salary_share: number | null; pct_revenue: number | null
  per_employee_lakh: number | null; per_user_lakh: number | null; opex_heads_total: number | null; capex_lines_total: number | null
  opex_variance_pct: number | null; capex_variance_pct: number | null; cloud_share_opex: number | null
  opex_yoy?: number | null; salaries_yoy?: number | null; capex_yoy?: number | null; total_yoy?: number | null
}
export interface Afford { fy: string; capex: number; roadmap: [number, number]; share: [number | null, number | null] }
export interface BudgetInputs { fys: string[]; overall: BudgetLine[]; capex: BudgetLine[]; opex: BudgetLine[]; factors: BudgetLine[] }
export interface Budget {
  plan: PhasePlanT | null
  source: Source
  inputs: BudgetInputs
  themes: { id: string; name: string }[]
  kinds: string[]
  note: string
  analysis: {
    per_fy: BudgetFY[]; cagr: number | null; latest: BudgetFY; recon: string[]
    heads: { id: string; name: string; kind: string; latest: number | null; growth: number | null }[]
    benchmark: [number, number]; capex_target: [number, number]; afford: Afford[]; explain: Explanation
  }
  insights: Record<string, Insight[]>
}

// ---------------------------------------------------------------- technical health
export interface HealthRow {
  id: string; name: string; criticality: number; in_scope: boolean; debt: number | null; debt_band: 'High' | 'Medium' | 'Low' | null
  spof: string[]; spof_status: 'SPOF' | 'Check' | 'OK'; spof_checks: string[]; scal: string[]; scal_status: 'At risk' | 'Watch' | 'OK'
  evidence: Record<'peak' | 'fallback' | 'workarounds', string[]>; explain: Explanation
}
export interface TechHealth { rows: HealthRow[]; counts: { high_debt: number; spof: number; spof_check: number; scal_risk: number; avg_debt: number | null; in_scope: number } }

export interface InitiativeRow extends Initiative {
  prio: { id: string; value: number; effort: number; quadrant: 'quick_win' | 'strategic' | 'fill_in' | 'reconsider'; label: string; score: number; rank: number; explain: Explanation }
  benefits: string[]
  risks: string[]
  constraints: string[]
  notes_source: Source
  owner: string
  kpis: string
  theme_focus: string[]
  gap_list: { id: string; title: string; kind: string; priority: number; ref: string; severity?: Severity | null; register: string }[]
  budget_capex: number
}

export interface Repository { tooling: string; ownership: { view: string; owner: string; cadence: string }[]; process: string[]; source: Source }

export interface Briefs extends AiMeta {
  briefs: Record<string, { summary: string; outcomes: string[]; cites: number[] }>
}

// ---------------------------------------------------------------- AI
export interface CoachResult extends AiMeta {
  screen: ScreenKey
  guidance: CitedItem[]
  next_actions: string[]
}

export interface AskResult extends AiMeta {
  question: string
  answer: string
  cites: number[]
}

export interface FindingsResult extends AiMeta {
  screen: ScreenKey
  tab?: string | null
  findings: CitedItem[]
  recommendations: CitedItem[]
}

// ---------------------------------------------------------------- settings
export interface EditableConfig {
  capability_rules: { gap_importance_min: number; gap_maturity_max: number; critical_maturity_max: number }
  rationalization: { threshold: number }
  data_rules: { score_weights: Record<string, number>; gap_score_below: number; ai_ready_min: number }
  roadmap: { rate_card_inr_cr: Record<string, [number, number]> }
}

export interface SettingsT {
  config: EditableConfig
  defaults: EditableConfig
  rag: {
    ready: boolean
    mode: 'hybrid' | 'lexical' | 'none'
    n_chunks: number
    meta: { built?: string; dense?: boolean; model?: string | null }
    model_error: string | null
    reindex: { running: boolean; last: { status: string } | null }
  }
  llm: { has_key: boolean; model: string; fallback_model: string; rpm: number; last_mode: string | null; last_error: string | null }
}

export interface UploadResult {
  kind: string
  imported: number
  created: number
  errors: { row: number; column: string; message: string }[]
  warnings: { row: number; column: string; message: string }[]
}

// ---------------------------------------------------------------- client
/** Fired when the session has expired or is missing; the app shell then shows the login page. */
export const AUTH_EVENT = 'ea:auth-required'
export interface AuthState { required: boolean; user: string | null }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event(AUTH_EVENT))
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      msg = typeof j.detail === 'string' ? j.detail : msg
    } catch {
      /* keep status text */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

const put = <T>(path: string, body: unknown) => req<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const post = <T>(path: string, body?: unknown) =>
  req<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  me: () => req<AuthState>('/auth/me'),
  login: (username: string, password: string) => post<AuthState>('/auth/login', { username, password }),
  logout: () => post<AuthState>('/auth/logout'),
  overview: () => req<Overview>('/overview'),
  approach: () => req<Approach>('/approach'),
  putApproachPlan: (id: string, status: PlanStatus) => put<Approach>(`/approach/plan/${id}`, { status }),
  vision: () => req<Vision>('/vision'),
  putContext: (text: string) => put<Vision>('/vision/context', { text }),
  uploadContext: (files: File[]) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return req<Vision & { added: string[]; errors: string[] }>('/vision/context/docs', { method: 'POST', body: fd })
  },
  deleteContextDoc: (id: number) => req<Vision>(`/vision/context/docs/${id}`, { method: 'DELETE' }),
  sampleContext: () => post<Vision & { added: string[]; errors: string[] }>('/vision/context/sample'),
  budget: () => req<Budget>('/budget'),
  putBudget: (b: BudgetInputs) => put<Budget>('/budget', b),
  resetBudget: () => post<Budget>('/budget/reset'),
  putInitiative: (id: string, n: Pick<InitiativeRow, 'benefits' | 'risks' | 'constraints' | 'owner' | 'kpis'>) => put<Roadmap>(`/roadmap/initiatives/${id}`, n),
  resetInitiative: (id: string) => req<Roadmap>(`/roadmap/initiatives/${id}`, { method: 'DELETE' }),
  putRepository: (r: Omit<Repository, 'source'>) => put<Roadmap>('/roadmap/repository', r),
  addDomain: (d: DomainIn) => post<DataTech & { added: string }>('/data_tech/domains', d),
  putDomain: (id: string, d: DomainIn) => put<DataTech>(`/data_tech/domains/${id}`, d),
  deleteDomain: (id: string) => req<DataTech>(`/data_tech/domains/${id}`, { method: 'DELETE' }),
  addPlatform: (p: PlatformIn) => post<DataTech>('/data_tech/platforms', p),
  putPlatform: (id: string, p: PlatformIn) => put<DataTech>(`/data_tech/platforms/${id}`, p),
  deletePlatform: (id: string) => req<DataTech>(`/data_tech/platforms/${id}`, { method: 'DELETE' }),
  putSites: (locations: Site[], network: NetLink[]) => put<DataTech>('/data_tech/sites', { locations, network }),
  putZones: (items: LandingZone[]) => put<DataTech>('/data_tech/landing_zones', { items }),
  putScope: (s: Omit<ScopeOfWork, 'source'>) => put<Approach>('/approach/scope', s),
  resetScope: () => post<Approach>('/approach/scope/reset'),

  putRefView: <T,>(id: string, v: RefViewIn) => put<T>(`/arch_views/${id}`, v),
  resetRefView: <T,>(id: string) => post<T>(`/arch_views/${id}/reset`),
  genStatements: () => post<StatementsResult>('/vision/statements/generate'),
  putStatements: (statements: VisionStatement[], mode: string, citations?: Citation[]) => put<Vision>('/vision/statements', { statements, mode, citations }),
  suggestPrinciple: (hint = '') => post<PrincipleSuggestion>('/vision/principles/suggest', { hint }),
  business: () => req<Business>('/business'),
  applications: () => req<Applications>('/applications'),
  dataTech: () => req<DataTech>('/data_tech'),
  roadmap: () => req<Roadmap>('/roadmap'),
  settings: () => req<SettingsT>('/settings'),

  putVisionDoc: (doc: Omit<VisionDocT, 'source' | 'updated'>) => put<VisionDocT>('/vision/doc', doc),
  putPrinciple: (id: string, adopted: boolean) => put<PrinciplesView>(`/vision/principles/${id}`, { adopted }),
  draftVision: () => post<VisionDraft>('/vision/draft'),
  putCapability: (id: string, body: { q: number[]; importance: number; apps?: string[]; automation?: string; owner?: string }) =>
    put<Business>(`/business/capabilities/${id}`, body),
  addNode: (n: { level: number; parent: string | null; name: string; description?: string; owner?: string }) => post<Business>('/business/catalog', n),
  addFromRef: (ref: string, parent?: string) => post<Business>('/business/catalog/from_reference', { ref, parent: parent ?? null }),
  editNode: (id: string, fields: Partial<{ name: string; description: string; owner: string; depends_on: string[]; automation: string; parent: string }>) =>
    put<Business>(`/business/catalog/${id}`, { fields }),
  deleteNode: (id: string) => req<Business>(`/business/catalog/${id}`, { method: 'DELETE' }),
  genSurvey: (id: string) => post<Business>(`/business/discovery/${id}/generate`),
  finaliseSurvey: (id: string) => post<Business & { finalised: number }>(`/business/discovery/${id}/finalise`),
  putGap: (id: string, body: Partial<Pick<RegGap, 'description' | 'hypothesis' | 'severity'>>) => put<Business>(`/business/gaps/${id}`, body),
  resetGap: (id: string) => req<Business>(`/business/gaps/${id}`, { method: 'DELETE' }),
  putDomainGap: <T,>(screen: 'applications' | 'data_tech', id: string, body: Partial<Pick<DomainGap, 'description' | 'hypothesis' | 'severity'>>) => put<T>(`/${screen}/gaps/${id}`, body),
  resetDomainGap: <T,>(screen: 'applications' | 'data_tech', id: string) => req<T>(`/${screen}/gaps/${id}`, { method: 'DELETE' }),
  putQuestions: (id: string, questions: SurveyQuestion[]) =>
 put<Business>(`/business/discovery/${id}/questions`, { questions }),
  emailDraft: (id: string, kind: EmailDraft['kind'] = 'initial') => req<EmailDraft>(`/business/discovery/${id}/email?kind=${kind}`),
  sendSurvey: (id: string, body: { to_role: string; to: string; subject: string; kind: EmailDraft['kind'] }) => post<Business>(`/business/discovery/${id}/send`, body),
  respond: (id: string, body: { outcome: 'submitted' | 'redirected' | 'walkthrough'; channel: 'email' | 'workshop'; answers?: Record<string, unknown>; note?: string; redirect_to?: string | null }) =>
    post<Business>(`/business/discovery/${id}/response`, body),
  deleteSurvey: (id: string) => req<Business>(`/business/discovery/${id}`, { method: 'DELETE' }),
  analyse: (l2: string) => post<Business>(`/business/discovery/l2/${l2}/analyse`),
  putComments: (l2: string, comments: Record<string, string>) => put<Business>(`/business/discovery/l2/${l2}/comments`, { comments }),
  addModel: (m: { name: string; description?: string; lanes?: string[]; copy_from?: string | null }) => post<Business>('/business/models', m),
  deleteModel: (id: string) => req<Business>(`/business/models/${id}`, { method: 'DELETE' }),
  putModel: (id: string, m: Pick<ProcessModelT, 'lanes' | 'nodes' | 'edges'> & { name?: string; description?: string }) => put<Business>(`/business/models/${id}`, m),
  resetModel: (id: string) => post<Business>(`/business/models/${id}/reset`),
  putPlanStatus: (id: string, status: PlanStatus) => put<Vision>(`/vision/plan/${id}`, { status }),
  putApp: (id: string, fields: Partial<AppFields>) => put<{ ok: boolean }>(`/applications/${id}`, { fields }),
  addApp: (fields: Partial<AppFields>) => post<{ ok: boolean; id: string }>('/applications', { fields }),
  deleteApp: (id: string) => req<{ ok: boolean }>(`/applications/${id}`, { method: 'DELETE' }),
  addInterface: (i: IfaceIn) => post<Applications>('/applications/interfaces', i),
  putInterface: (id: string, i: IfaceIn) => put<Applications>(`/applications/interfaces/${id}`, i),
  deleteInterface: (id: string) => req<Applications>(`/applications/interfaces/${id}`, { method: 'DELETE' }),
  mapApps: (app_ids?: string[]) => post<MapResult>('/applications/map', { app_ids: app_ids ?? null }),
  addGuideline: (g: (Partial<Guideline> | Partial<Viewpoint> | Partial<Tailoring>) & { kind: GuidelineKind }) => post<Vision>('/vision/guidelines', g),
  putGuideline: (id: string, g: (Partial<Guideline> | Partial<Viewpoint> | Partial<Tailoring>) & { kind: GuidelineKind }) => put<Vision>(`/vision/guidelines/${id}`, g),
  deleteGuideline: (id: string) => req<Vision>(`/vision/guidelines/${id}`, { method: 'DELETE' }),
  putRules: (body: Partial<{ threshold: number; bf_weights: number[]; tf_weights: number[]; labels: RulesConfig['labels']; rules: { id: string; enabled?: boolean; params?: RuleT['params'] }[]; capability: Record<string, number> }>) =>
    put<Vision>('/vision/rules', body),
  resetRules: () => post<Vision>('/vision/rules/reset'),
  putCheck: (id: string, status: Check['status']) => put<DataTech>(`/data_tech/checks/${id}`, { status }),
  putAcmm: (id: string, level: number) => put<Roadmap>(`/roadmap/acmm/${id}`, { level }),
  addDecision: (d: Omit<DecisionT, 'id' | 'source' | 'created'>) => post<DecisionT>('/roadmap/decisions', d),
  putDecision: (id: number, d: Omit<DecisionT, 'id' | 'source' | 'created'>) => put<DecisionT>(`/roadmap/decisions/${id}`, d),
  deleteDecision: (id: number) => req<{ ok: boolean }>(`/roadmap/decisions/${id}`, { method: 'DELETE' }),
  putRateCard: (rate_card: Roadmap['rate_card']) => put<Roadmap>('/roadmap/rate_card', { rate_card }),
  briefs: () => post<Briefs>('/roadmap/briefs'),

  coach: (screen: ScreenKey) => post<CoachResult>(`/coach/${screen}`),
  ask: (q: string, screen: ScreenKey) => post<AskResult>('/coach/ask', { q, screen }),
  findings: (screen: ScreenKey, tab?: string) => post<FindingsResult>(`/findings/${screen}${tab ? `?tab=${tab}` : ''}`),

  putConfig: (patch: Partial<EditableConfig>) => put<SettingsT>('/settings/config', { patch }),
  reset: () => post<SettingsT>('/settings/reset'),
  reindex: () => post<SettingsT>('/settings/reindex'),
  upload: async (kind: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return req<UploadResult>(`/templates/${kind}/upload`, { method: 'POST', body: fd })
  },
}

export const templateUrl = (kind: 'applications' | 'technology' | 'questionnaire' | 'data_domains') => `/api/templates/${kind}`
export const exportUrl = (screen: ScreenKey) => `/api/export/${screen}`

export function fmtCr([lo, hi]: [number, number]): string {
  const f = (x: number) => (Number.isInteger(x) ? x.toFixed(0) : x.toFixed(1))
  return `₹${f(lo)}–${f(hi)} Cr`
}

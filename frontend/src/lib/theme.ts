// The only place colours are defined in TS. Band -> colour, disposition -> colour, provenance and status.

export const NAVY = '#0B2A6F'
export const SLATE = '#64748B'
export const SLATE_LIGHT = '#CBD5E1'
export const GRID = '#E2E8F0'
export const WHITE = '#FFFFFF'

export const BAND = {
  strong: '#0F9D8A',
  developing: '#D97706',
  weak: '#EA580C',
  critical: '#DC2626',
} as const
export type Band = keyof typeof BAND

export const BAND_LABEL: Record<Band, string> = {
  strong: 'Strong',
  developing: 'Developing',
  weak: 'Weak',
  critical: 'Critical',
}

/** Colour per internal disposition code. Labels shown to users come from the API (Tolerate -> Retain, Migrate ->
 * Modernise, Eliminate -> Replace, Retain (out of scope) -> Out of scope). */
export const DISPOSITION = {
  Invest: BAND.strong,
  Tolerate: BAND.developing,
  Migrate: BAND.weak,
  Eliminate: BAND.critical,
  Consolidate: '#3B5BA9',
  Retain: SLATE,
} as const
export type Disposition = keyof typeof DISPOSITION
export const DISPOSITION_CODES = ['Invest', 'Tolerate', 'Migrate', 'Eliminate', 'Consolidate', 'Retain (out of scope)'] as const

export function dispositionKey(d: string): Disposition {
  return (d.startsWith('Retain') ? 'Retain' : d) as Disposition
}

export function dispositionColor(d: string): string {
  return DISPOSITION[dispositionKey(d)] ?? SLATE
}

/** Application architecture layers (top = closest to farmers, dealers and customers). */
export const LAYER_COLOR: Record<string, string> = {
  'Customer & Sales': '#0F9D8A',
  'Logistics & Operations': '#B45309',
  'Enterprise Apps': NAVY,
  'Admin Apps': '#475569',
  'Data & AI': '#7C3AED',
}
export const DEFAULT_LAYER = 'Enterprise Apps'

/** Engagement cadence markers on the work plan (as in the proposal timeline). */
export const CADENCE = {
  weekly: { label: 'Weekly Connect', color: '#C2185B' },
  steerco: { label: 'Steerco', color: '#111827' },
  deliverable: { label: 'Deliverable Milestone', color: '#C2185B' },
} as const

/** Reference architecture building-block status (legend wording follows the client reference views). */
export const REF_STATUS: Record<'ok' | 'partial' | 'missing' | 'validate', { label: string; color: string }> = {
  ok: { label: 'No architectural gaps', color: '#15803D' },
  partial: { label: 'Some architectural gaps', color: '#C2410C' },
  missing: { label: 'Capability does not exist', color: '#B91C1C' },
  validate: { label: 'To validate', color: '#64748B' },
}

/** Technology & AI enablement ladder, 1 Manual ... 5 Agentic AI. */
export const LADDER_COLOR = ['#DC2626', '#EA580C', '#D97706', '#0F9D8A', '#7C3AED'] as const

export const PATTERN_COLOR: Record<string, string> = {
  API: BAND.strong,
  Event: '#7C3AED',
  'File / batch': BAND.developing,
  'DB link': BAND.weak,
  'Manual / re-key': BAND.critical,
}

export const SURFACE = { muted: '#F1F5F9', line: '#94A3B8', soft: '#E8EDF7' } as const

export function bandColor(b: string): string {
  return BAND[b as Band] ?? SLATE
}

/** Soft background tint for a band (hex + alpha). */
export function tint(hex: string, alpha = 0.12): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}

export const ADM_STATUS = {
  assessed: { color: BAND.strong, label: 'Assessed' },
  in_progress: { color: BAND.developing, label: 'In progress' },
  not_started: { color: SLATE_LIGHT, label: 'Not started' },
} as const
export type AdmStatus = keyof typeof ADM_STATUS

export const CHECK_STATUS = {
  pass: { color: BAND.strong, label: 'Pass' },
  partial: { color: BAND.developing, label: 'Partial' },
  fail: { color: BAND.critical, label: 'Fail' },
  unknown: { color: SLATE, label: 'Unknown' },
} as const
export type CheckStatus = keyof typeof CHECK_STATUS

export const PROVENANCE = {
  deck: { color: NAVY, label: 'Deck', title: 'KPMG proposal deck' },
  public: { color: BAND.strong, label: 'Public', title: 'Coromandel public disclosures' },
  assumed: { color: BAND.developing, label: 'Assumed', title: 'Demo placeholder, validate in discovery' },
  client: { color: '#7C3AED', label: 'Client', title: 'Entered or uploaded by the client' },
  togaf: { color: SLATE, label: 'TOGAF', title: 'TOGAF 9.1 §23.6 example principle' },
} as const
export type Provenance = keyof typeof PROVENANCE

export function priorityColor(p: number): string {
  if (p >= 20) return BAND.critical
  if (p >= 16) return BAND.weak
  if (p >= 9) return BAND.developing
  return SLATE
}

export const WAVE_COLOR = ['#0F9D8A', NAVY, '#3B5BA9', '#7C93C8'] as const

/** Current-state discovery survey status, in pipeline order. */
export const DISC_STATUS = {
  not_generated: { color: SLATE_LIGHT, label: 'Not generated' },
  draft: { color: '#7C93C8', label: 'Drafted' },
  sent: { color: '#3B5BA9', label: 'Awaiting reply' },
  walkthrough: { color: BAND.developing, label: 'Walkthrough requested' },
  redirected: { color: BAND.weak, label: 'Redirected' },
  responded: { color: BAND.strong, label: 'Responded' },
} as const
export type DiscStatusKey = keyof typeof DISC_STATUS

/** Business-IT alignment quadrants (business criticality x IT support). */
export const QUADRANT = {
  aligned: { color: BAND.strong, label: 'Aligned', action: 'Sustain' },
  underserved: { color: BAND.critical, label: 'Under-served', action: 'Invest' },
  overserved: { color: '#3B5BA9', label: 'Over-served', action: 'Rationalise' },
  low: { color: SLATE, label: 'Low priority', action: 'Monitor' },
} as const

/** Business criticality x maturity heat map quadrants. */
export const MATRIX = {
  fix: { color: BAND.critical, label: 'Fix now', sub: 'High criticality, low maturity' },
  build: { color: BAND.developing, label: 'Build next', sub: 'High criticality, developing' },
  sustain: { color: BAND.strong, label: 'Differentiate', sub: 'High criticality, strong' },
  monitor: { color: SLATE, label: 'Monitor', sub: 'Lower criticality, low maturity' },
  run: { color: '#3B5BA9', label: 'Run for cost', sub: 'Lower criticality, mature' },
} as const

/** ARIS EPC notation colours. */
export const EPC = {
  event: { fill: '#F9DDE8', stroke: '#B0306A' },
  function: { fill: '#DDF1E4', stroke: '#2E8B57' },
  gateway: { fill: '#FFFFFF', stroke: '#475569' },
  system: { fill: '#E3EAF8', stroke: '#3B5BA9' },
  data: { fill: '#F3F4F6', stroke: '#64748B' },
  lane: '#F8FAFC',
  laneHead: '#EEF2F8',
} as const

export const PLAN_STATUS = {
  done: { color: BAND.strong, label: 'Done' },
  in_progress: { color: '#3B5BA9', label: 'In progress' },
  at_risk: { color: BAND.critical, label: 'At risk' },
  planned: { color: SLATE_LIGHT, label: 'Planned' },
  milestone: { color: NAVY, label: 'Milestone' },
} as const

/** Status of an engagement phase on its screen's plan strip. */
export const PHASE_STATUS = {
  not_started: { color: SLATE, label: 'Not started' },
  in_progress: { color: '#3B5BA9', label: 'In progress' },
  at_risk: { color: BAND.critical, label: 'At risk' },
  overdue: { color: BAND.critical, label: 'Overdue' },
  complete: { color: BAND.strong, label: 'Complete' },
} as const

/** Discovery workflow state of an L2 capability (one colour per step, distinct from the maturity bands). */
export const L2_STATE = {
  not_adopted: { color: SLATE_LIGHT, label: 'Not adopted' },
  not_started: { color: SLATE, label: 'Not started' },
  collecting: { color: '#3B5BA9', label: 'Collecting' },
  ready: { color: '#7C3AED', label: 'Ready to analyse' },
  stale: { color: BAND.developing, label: 'Re-analyse' },
  analysed: { color: BAND.strong, label: 'Analysed' },
} as const
export type L2StateKey = keyof typeof L2_STATE

/** Gap register severity and gap type. */
export const SEVERITY = {
  High: { color: BAND.critical, label: 'High' },
  Medium: { color: BAND.developing, label: 'Medium' },
  Low: { color: SLATE, label: 'Low' },
} as const
export const GAP_TYPE = {
  transactional: { color: '#3B5BA9', label: 'Transactional', sub: 'L3 process' },
  thematic: { color: '#7C3AED', label: 'Thematic', sub: 'L0 / L1 area' },
} as const

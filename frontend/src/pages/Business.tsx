import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Entanglement } from '@/components/CapabilityModules'
import { CapabilitySheet } from '@/components/business/CapabilitySheet'
import { Discovery } from '@/components/business/Discovery'
import { GapRegister } from '@/components/business/GapRegister'
import { AlignmentView, Matrix, ProcessMaturity } from '@/components/business/HeatViews'
import { ProcessModeler } from '@/components/business/ProcessModeler'
import { ExportMenu } from '@/components/ExportMenu'
import { InsightsCard } from '@/components/InsightsCard'
import { PageHeader } from '@/components/PageHeader'
import { PhasePlan } from '@/components/PhasePlan'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { TemplateButtons } from '@/components/TemplateButtons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api, type CapRow } from '@/lib/api'
import { useView } from '@/lib/screens'
import { cn } from '@/lib/utils'

export const BA_STEPS = [
  { key: 'discovery', n: 1, label: 'Current State Discovery', sub: 'Adopt · generate · review · orchestrate' },
  { key: 'heatmap', n: 2, label: 'Assessment', sub: 'Maturity · criticality · alignment · coupling' },
  { key: 'gaps', n: 3, label: 'Gap Register', sub: 'Transactional and thematic gaps' },
  { key: 'models', n: 4, label: 'Architecture Views', sub: 'ARIS-style process models' },
]
const HEAT = [
  { key: 'heatmap', label: 'Process Maturity', insight: 'process' },
  { key: 'matrix', label: 'Business Criticality × Maturity', insight: 'matrix' },
  { key: 'alignment', label: 'Business–IT Alignment', insight: 'alignment' },
  { key: 'entanglement', label: 'Entanglement', insight: 'entanglement' },
]
// older deep links (RFP view index, bookmarks) land on the step that now holds them
const LEGACY: Record<string, string> = { reference: 'discovery', responses: 'discovery', assessment: 'discovery', questionnaire: 'discovery', catalog: 'discovery', scatter: 'matrix', value_streams: 'models' }
const VIEWS = ['discovery', ...HEAT.map((h) => h.key), 'gaps', 'models', ...Object.keys(LEGACY)]

const CARD: Record<string, { title: string; desc: string }> = {
  discovery: { title: 'Step 1 · Current State Discovery', desc: 'The standard agri-inputs capability model, L0 › L1 › L2 › L3. Adopt what applies to CIL; for every adopted L3, generate the questionnaire, review and finalise it, orchestrate it to the business owner or fill it in a workshop, then analyse the responses.' },
  heatmap: { title: 'Step 2 · Assessment', desc: 'Scores from the answered questionnaires only: process maturity from L1 to L3, business criticality × maturity, business–IT alignment and capability entanglement down to L3 (RFP view 2). Select a capability for its scores and comments.' },
  gaps: { title: 'Step 3 · Gap Register', desc: 'Gaps described from the discovery answers: transactional gaps on individual L3 processes and thematic gaps that recur across an L1 or L0, each with a severity and a target-state hypothesis. Edit any description before playback.' },
  models: { title: 'Step 4 · Architecture Views', desc: 'ARIS-style EPC swimlane models for priority end-to-end processes (RFP view 14). Functions link to L3 capabilities, so each step carries its discovered maturity. Add a view for any process the team needs to walk through.' },
}

export default function Business() {
  const q = useQuery({ queryKey: ['business'], queryFn: api.business })
  const [raw, setView] = useView('discovery', VIEWS)
  const view = LEGACY[raw] ?? raw
  const [pick, setPick] = useState<CapRow | null>(null)
  const b = q.data
  const step = HEAT.some((h) => h.key === view) ? 'heatmap' : view
  const heat = HEAT.find((h) => h.key === view) ?? HEAT[0]
  const insightKey = step === 'heatmap' ? heat.insight : step
  const heatBox = useRef<HTMLDivElement>(null)
  const gapBox = useRef<HTMLDivElement>(null)

  return (
    <>
      <PageHeader screen="business" actions={<TemplateButtons kind="questionnaire" label="L2 baseline" />} />
      {q.error ? <ScreenError error={q.error} /> : !b ? <ScreenSkeleton /> : (
        <>
          <PhasePlan p={b.plan} />

          <div id="sec-steps" className="grid scroll-mt-4 grid-cols-4 gap-1.5">
            {BA_STEPS.map((s, i) => (
              <button key={s.key} onClick={() => setView(s.key)}
                className={cn('relative flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  step === s.key ? 'border-navy bg-navy text-white' : 'bg-card hover:border-navy/50')}>
                <span className={cn('tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', step === s.key ? 'bg-white text-navy' : 'bg-navy-soft text-navy')}>{s.n}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold">{s.label}</span>
                  <span className={cn('block truncate text-[10.5px]', step === s.key ? 'text-white/75' : 'text-muted-foreground')}>{s.sub}</span>
                </span>
                {i < BA_STEPS.length - 1 && <ChevronRight className="absolute top-1/2 -right-[11px] z-10 size-3.5 -translate-y-1/2 rounded-full bg-background text-muted-foreground" />}
              </button>
            ))}
          </div>

          <Card className="gap-3">
            <CardHeader>
              <CardTitle>{CARD[step].title}</CardTitle>
              <CardDescription>{CARD[step].desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 'heatmap' && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ToggleGroup type="single" value={heat.key} onValueChange={(v) => v && setView(v)} variant="outline" size="sm">
                    {HEAT.map((h) => <ToggleGroupItem key={h.key} value={h.key} className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">{h.label}</ToggleGroupItem>)}
                  </ToggleGroup>
                  <ExportMenu target={heatBox} name={heat.label} csv={() => [['L1', 'L2 ID', 'L2 capability', 'Maturity', 'Business criticality', 'Band', 'Gap', 'Applications'],
                    ...b.l1.flatMap((l) => l.children.map((c) => [l.name, c.id, c.name, c.maturity ?? '', c.importance ?? '', c.band ?? '', c.is_gap ? 'Yes' : 'No', c.apps.map((x) => x.name).join('; ')]))]} />
                </div>
              )}
              {step === 'discovery' && <Discovery b={b} />}
              {step === 'heatmap' && (
                <div ref={heatBox} className="bg-card">
                  {heat.key === 'heatmap' && <ProcessMaturity b={b} onPick={setPick} />}
                  {heat.key === 'matrix' && <Matrix b={b} onPick={setPick} />}
                  {heat.key === 'alignment' && <AlignmentView b={b} onPick={setPick} />}
                  {heat.key === 'entanglement' && <Entanglement b={b} />}
                </div>
              )}
              {step === 'gaps' && (
                <>
                  <div className="flex justify-end">
                    <ExportMenu target={gapBox} name="Gap Register" csv={() => [['ID', 'Type', 'L0', 'L1', 'L2', 'L3', 'Gap', 'Description', 'Target-state hypothesis', 'Severity', 'Edited'],
                      ...[...b.gap_register.thematic, ...b.gap_register.transactional].map((g) => [g.id, g.type, g.l0.name, g.l1?.name ?? '', g.l2?.name ?? '', g.l3?.name ?? '', g.title, g.description, g.hypothesis, g.severity, g.edited ? 'Yes' : 'No'])]} />
                  </div>
                  <div ref={gapBox} className="bg-card"><GapRegister b={b} /></div>
                </>
              )}


              {step === 'models' && <ProcessModeler b={b} />}
              <InsightsCard key={insightKey} screen="business" tab={insightKey} items={b.insights[insightKey] ?? []} />
            </CardContent>
          </Card>

          <CapabilitySheet cap={pick ? b.l1.flatMap((l) => l.children).find((c) => c.id === pick.id) ?? null : null} b={b}
            onClose={() => setPick(null)} onDiscover={() => { setPick(null); setView('discovery') }} />
        </>
      )}
    </>
  )
}

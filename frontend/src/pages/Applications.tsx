import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Crown, Download, Loader2, Plus, Search, Sparkles } from 'lucide-react'
import { CartesianGrid, Cell, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts'
import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { AppCapabilityMap } from '@/components/AppCapabilityMap'
import { AppForm } from '@/components/AppForm'
import { IntegrationView, InteractionGraph } from '@/components/AppViews'
import { CiteMarks } from '@/components/CitationChip'
import { DomainGapRegister } from '@/components/DomainGapRegister'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { AiModeBadge } from '@/components/FindingsCard'
import { InsightsCard } from '@/components/InsightsCard'
import { PageHeader } from '@/components/PageHeader'
import { PhasePlan } from '@/components/PhasePlan'
import { RefArchitecture } from '@/components/RefArchitecture'
import { StepBar } from '@/components/StepBar'
import { TechHealth } from '@/components/TechHealth'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { TemplateButtons } from '@/components/TemplateButtons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, exportUrl, type App, type Applications as AppsT, type MapResult } from '@/lib/api'
import { useView } from '@/lib/screens'
import { BAND, DEFAULT_LAYER, DISPOSITION_CODES, dispositionColor, GRID, LAYER_COLOR, NAVY, SLATE, tint, WHITE } from '@/lib/theme'

const VIEWS = ['inventory', 'rationalization', 'health', 'gaps', 'capability', 'architecture', 'interaction', 'integration']
const ARCH = ['architecture', 'interaction', 'integration']

function Disp({ code, label, overridden }: { code: string; label: string; overridden?: boolean }) {
  const c = dispositionColor(code)
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold" style={{ color: c, background: tint(c, 0.12) }}>
      <span className="size-1.5 rounded-full" style={{ background: c }} />{label}{overridden && <span title="Overridden by an architect" className="font-bold">*</span>}
    </span>
  )
}

function CapChips({ a, l2 }: { a: App; l2: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {a.caps.map((c) => (
        <Tooltip key={c}>
          <TooltipTrigger asChild><span className="rounded bg-muted px-1.5 py-px text-[10.5px] font-medium text-foreground/80">{c}</span></TooltipTrigger>
          <TooltipContent>{l2[c] ?? c}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

function Quadrant({ a }: { a: AppsT }) {
  const seen: Record<string, number> = {}
  const pts = a.apps.map((x) => {
    const k = `${x.computed.technical_fit}-${x.computed.business_fit}`
    const n = (seen[k] = (seen[k] ?? 0) + 1) - 1
    const nudge = (v: number, d: number) => Math.min(4.92, Math.max(1.08, v + (v > 4.5 ? -d : d)))  // stay inside the 1-5 frame
    return { ...x.computed, x: nudge(x.computed.technical_fit, n * 0.07), y: nudge(x.computed.business_fit, n * 0.05), crit: x.criticality }
  })
  const th = a.threshold
  const Q = [
    { code: 'Migrate', x: 1.15, y: 4.85, anchor: 'start' }, { code: 'Invest', x: 4.85, y: 4.85, anchor: 'end' },
    { code: 'Eliminate', x: 1.15, y: 1.2, anchor: 'start' }, { code: 'Tolerate', x: 4.85, y: 1.2, anchor: 'end' },
  ]
  return (
    <ChartContainer config={{ app: { label: 'Application', color: NAVY } }} className="h-[372px] w-full">
      <ScatterChart margin={{ top: 22, right: 16, bottom: 18, left: 0 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false}
          label={{ value: 'Technical fit', position: 'insideBottom', offset: -10, fontSize: 11, fill: SLATE }} />
        <YAxis type="number" dataKey="y" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} width={40}
          label={{ value: 'Business fit', angle: -90, position: 'insideLeft', offset: 14, fontSize: 11, fill: SLATE }} />
        <ZAxis type="number" dataKey="crit" range={[50, 360]} domain={[1, 5]} />
        <ReferenceLine x={th} stroke={NAVY} strokeOpacity={0.55} strokeDasharray="5 4" label={{ value: `TF ${th.toFixed(1)}`, position: 'top', fontSize: 10, fill: NAVY }} />
        <ReferenceLine y={th} stroke={NAVY} strokeOpacity={0.55} strokeDasharray="5 4" label={{ value: `BF ${th.toFixed(1)}`, position: 'right', fontSize: 10, fill: NAVY }} />
        {Q.map((q) => (
          <ReferenceLine key={q.code} y={q.y} stroke="none" ifOverflow="visible"
            label={{ value: (a.labels[q.code] ?? q.code).toUpperCase(), position: q.anchor === 'start' ? 'insideLeft' : 'insideRight', fontSize: 11, fontWeight: 700, fill: dispositionColor(q.code), opacity: 0.75 }} />
        ))}
        <ChartTooltip cursor={false} content={({ payload }) => {
          const p = payload?.[0]?.payload as (typeof pts)[number] | undefined
          if (!p) return null
          return (
            <div className="max-w-xs rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
              <div className="flex items-center gap-2 font-semibold">{p.name} <Disp code={p.disposition} label={p.label} overridden={p.overridden} /></div>
              <div className="mt-1 text-muted-foreground">{p.statement}</div>
              <div className="mt-0.5 text-muted-foreground">Criticality {p.criticality}/5</div>
            </div>
          )
        }} />
        <Scatter data={pts}>
          {pts.map((p) => <Cell key={p.id} fill={dispositionColor(p.disposition)} fillOpacity={0.85} stroke={WHITE} strokeWidth={1.5} />)}
        </Scatter>
      </ScatterChart>
    </ChartContainer>
  )
}

function Clusters({ a }: { a: AppsT }) {
  return (
    <div className="scrollbar-thin h-[372px] space-y-2 overflow-y-auto pr-1">
      {a.clusters.map((c) => (
        <div key={c.cap} className="rounded-lg border p-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-bold text-navy">{c.cap}</span>
            <span className="truncate text-sm font-medium">{c.cap_name}</span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{c.members.length} apps</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {c.members.map((m) => (
                <span key={m.id} className="rounded-md border px-1.5 py-0.5 text-[11px]" title={m.label}
                  style={m.id === c.survivor ? { borderColor: BAND.strong, color: BAND.strong, fontWeight: 600 } : { color: SLATE }}>
                  {m.name}
                </span>
              ))}
            </div>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold" style={{ color: BAND.strong }}>
              <Crown className="size-3" /> {c.survivor}
            </span>
            <Explain x={c.explain} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MapDialog({ res, onClose }: { res: MapResult | null; onClose: () => void }) {
  const qc = useQueryClient()
  const apply = useMutation({
    mutationFn: async () => {
      for (const m of res!.mappings.filter((x) => x.caps.length)) await api.putApp(m.app_id, { caps: m.caps })
    },
    onSuccess: () => {
      qc.invalidateQueries({ predicate: (q) => !['coach', 'findings', 'settings', 'health'].includes(String(q.queryKey[0])) })
      toast.success('Capability mappings applied')
      onClose()
    },
  })
  return (
    <Dialog open={!!res} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Suggested Capability Mapping {res && <AiModeBadge meta={res} />}</DialogTitle>
          <DialogDescription>
            {res?.method === 'keyword' ? 'Keyword match on names and descriptions (no Gemini key).' : 'Gemini suggestion over the L2 list.'} Review before applying.
            {res && res.citations.length > 0 && <CiteMarks cites={res.citations.map((c) => c.n)} citations={res.citations} />}
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Application</TableHead><TableHead>Capabilities</TableHead><TableHead className="text-right">Confidence</TableHead></TableRow></TableHeader>
          <TableBody>
            {res?.mappings.map((m) => (
              <TableRow key={m.app_id}>
                <TableCell className="font-medium">{m.app_name}</TableCell>
                <TableCell className="text-xs">{m.caps.length ? m.caps.map((c, i) => `${c} ${m.cap_names[i]}`).join(' · ') : <span className="text-muted-foreground">No match</span>}</TableCell>
                <TableCell className="tabular text-right">{Math.round(m.confidence * 100)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => apply.mutate()} disabled={apply.isPending || !res?.mappings.some((m) => m.caps.length)}>Apply mapping</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const AA_STEPS = [
  { key: 'inventory', n: 1, label: 'Application Intake', sub: 'Portfolio catalog · Tech DD fields' },
  { key: 'capability', n: 2, label: 'Capability View', sub: 'Apps by L1 › L2 › L3 process' },
  { key: 'rationalization', n: 3, label: 'Rationalization', sub: 'Fit · dispositions · technical health' },
  { key: 'gaps', n: 4, label: 'Gap Register', sub: 'Application and portfolio gaps' },
  { key: 'architecture', n: 5, label: 'Architecture Views', sub: 'Architecture · interactions · integration' },
]
const INSIGHT: Record<string, string> = { gaps: 'gaps', inventory: 'intake', rationalization: 'rationalization', health: 'health', capability: 'capability', architecture: 'architecture', interaction: 'interaction', integration: 'integration' }
const CARD: Record<string, { title: string; desc: string }> = {
  inventory: { title: 'Step 1 · Application Intake', desc: 'Application Portfolio Catalog on the Tech DD intake fields (TOGAF §35.6.5), including technical debt, peak-season load, failover and key-person dependency. Add or edit an application here, or bulk-load with the intake template. Unknown vendors stay TBD.' },
  capability: { title: 'Step 2 · Capability View', desc: 'Which applications support each process, laid out L0 › L1 › L2 › L3 like the business architecture. Shows overlaps, processes with no system support and gaps sitting on weak applications, before the portfolio is rationalised.' },
  rationalization: { title: 'Step 3 · Rationalization', desc: 'Business fit × technical fit sets the quadrant; the rules configured on Vision & Guardrails then apply in order. Every disposition carries a written rationale and its rule trace, and can be overridden with a reason.' },
  health: { title: 'Step 3 · Rationalization · Technical Health', desc: 'Technical debt, single points of failure and scalability limits per application (RFP assessment items 4, 6 and 8), scored by rules from the intake and the L3 discovery answers. Fix the inputs in the intake record; the scores update on save.' },
  gaps: { title: 'Step 4 · Gap Register', desc: 'Application gaps generated from the assessment: one gap per application combining its disposition, technical debt, single points of failure, scalability and lifecycle findings, plus portfolio gaps for duplication, processes with no application support, point-to-point integration and missing building blocks. Each has a severity, a target-state hypothesis and the roadmap initiative that closes it; edit any of them.' },
  architecture: { title: 'Step 5 · Architecture Views', desc: 'The CIL application architecture, layered from cognitive and customer experiences down to operational technology and rated for architectural gaps (RFP view 3), application interactions and dependencies (RFP view 4), and integration, API and data-flow architecture (RFP view 5).' },
}
const ARCH_NOTE: Record<string, string> = {
  architecture: 'RFP view 3 · Application architecture · building blocks mapped to the Application Portfolio Catalog §35.6.5',
  interaction: 'RFP view 4 · Application Communication Diagram §35.6.5',
  integration: 'RFP view 5 · Interface Catalog, patterns, hotspots and integration governance',
}

export default function Applications() {
  const q = useQuery({ queryKey: ['applications'], queryFn: api.applications })
  const [mapRes, setMapRes] = useState<MapResult | null>(null)
  const [form, setForm] = useState<{ open: boolean; app: App | null }>({ open: false, app: null })
  const [view, setView] = useView('inventory', VIEWS)
  const map = useMutation({ mutationFn: api.mapApps, onSuccess: setMapRes, onError: (e: Error) => toast.error(e.message) })
  const a = q.data
  const l2 = a ? Object.fromEntries(a.l2.map((c) => [c.id, c.name])) : {}
  const unmapped = a?.apps.filter((x) => !x.caps.length) ?? []
  const step = ARCH.includes(view) ? 'architecture' : view === 'health' ? 'rationalization' : view
  const open = (app: App | null) => setForm({ open: true, app })
  const insightKey = INSIGHT[view] ?? 'intake'

  return (
    <>
      <PageHeader screen="applications" actions={
        <>
          <TemplateButtons kind="applications" label="intake template" />
          {unmapped.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => map.mutate(undefined)} disabled={map.isPending}>
              {map.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Map {unmapped.length} with AI
            </Button>
          )}
          <Button size="sm" onClick={() => open(null)}><Plus /> Add application</Button>
        </>
      } />
      {q.error ? <ScreenError error={q.error} /> : !a ? <ScreenSkeleton /> : (
        <>
          <PhasePlan p={a.plan} />
          <StepBar steps={AA_STEPS} active={step} onPick={setView} />

          <Card className="gap-3">
            <CardHeader>
              <CardTitle>{CARD[view === 'health' ? 'health' : step].title}</CardTitle>
              <CardDescription>{CARD[view === 'health' ? 'health' : step].desc}</CardDescription>
              {step === 'inventory' && (
                <CardAction className="flex gap-2">
                  <Button variant="ghost" size="sm" asChild><a href={exportUrl('applications')}><Download /> Export</a></Button>
                  <Button size="sm" variant="outline" onClick={() => open(null)}><Plus /> Add application</Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 'inventory' && <Intake a={a} l2={l2} onOpen={open} onMap={(id) => map.mutate([id])} />}
              {step === 'rationalization' && (
                <>
                  <ToggleGroup type="single" value={view === 'health' ? 'health' : 'rationalization'} onValueChange={(v) => v && setView(v)} variant="outline" size="sm">
                    <ToggleGroupItem value="rationalization" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">Fit & Dispositions</ToggleGroupItem>
                    <ToggleGroupItem value="health" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">Technical Health</ToggleGroupItem>
                  </ToggleGroup>
                  {view === 'health' ? <TechHealth a={a} onOpen={open} /> : <Rationalization a={a} onOpen={open} />}
                </>
              )}
              {step === 'capability' && <AppCapabilityMap a={a} onOpen={open} />}
              {step === 'gaps' && <DomainGapRegister reg={a.gap_register} screen="applications" name="Application Gap Register" />}
              {step === 'architecture' && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)} variant="outline" size="sm">
                      <ToggleGroupItem value="architecture" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">Application Architecture</ToggleGroupItem>
                      <ToggleGroupItem value="interaction" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">Interactions & Dependencies</ToggleGroupItem>
                      <ToggleGroupItem value="integration" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">Integration & API</ToggleGroupItem>
                    </ToggleGroup>
                    <span className="text-[11px] text-muted-foreground">{ARCH_NOTE[view]}</span>
                  </div>
                  {view === 'interaction' && <InteractionGraph a={a} />}
                  {view === 'integration' && <IntegrationView a={a} />}
                  {view === 'architecture' && a.ref_view && <RefArchitecture v={a.ref_view} queryKey="applications" appToggle ctx={{ apps: a.apps.map((x) => ({ id: x.id, name: x.name })) }} />}
                </>
              )}
              <InsightsCard key={insightKey} screen="applications" tab={insightKey} items={a.insights[insightKey] ?? []} />
            </CardContent>
          </Card>

          <MapDialog res={mapRes} onClose={() => setMapRes(null)} />
          <AppForm open={form.open} app={form.app} a={a} onClose={() => setForm({ open: false, app: null })} />
        </>
      )}
    </>
  )
}

function Intake({ a, l2, onOpen, onMap }: { a: AppsT; l2: Record<string, string>; onOpen: (x: App) => void; onMap: (id: string) => void }) {
  const [qs, setQs] = useState('')
  const [layer, setLayer] = useState('all')
  const rows = a.apps.filter((x) => (layer === 'all' || (x.layer ?? DEFAULT_LAYER) === layer) && (!qs || `${x.name} ${x.vendor} ${x.description ?? ''}`.toLowerCase().includes(qs.toLowerCase())))
  const tbd = a.apps.filter((x) => x.vendor === 'TBD').length
  const hostUnknown = a.apps.filter((x) => x.hosting === 'Unknown').length
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-1"><div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Inventoried</div><div className="tabular text-[15px] font-semibold">{a.kpis.inventoried}<span className="text-[11px] font-normal text-muted-foreground"> · target {a.kpis.target}</span></div></div><Explain x={a.explain.inventoried} /></div>
        <div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Hosting Unknown</div><div className="tabular text-[15px] font-semibold" style={{ color: BAND.developing }}>{hostUnknown} apps</div></div>
        <div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Vendor TBD</div><div className="tabular text-[15px] font-semibold">{tbd}</div></div>
        <div className="flex items-center gap-1"><div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Lifecycle to validate</div><div className="tabular text-[15px] font-semibold" style={{ color: BAND.weak }}>{a.kpis.lifecycle_unknown}</div></div><Explain x={a.explain.lifecycle_unknown} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={qs} onChange={(e) => setQs(e.target.value)} placeholder="Find an application or vendor" className="h-8 pl-8 text-[13px]" />
        </div>
        <ToggleGroup type="single" value={layer} onValueChange={(v) => v && setLayer(v)} variant="outline" size="sm">
          <ToggleGroupItem value="all" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">All Layers</ToggleGroupItem>
          {a.layers.map((ly) => <ToggleGroupItem key={ly} value={ly} className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">{ly}</ToggleGroupItem>)}
        </ToggleGroup>
        <span className="ml-auto text-[11px] text-muted-foreground">Select a row to open the intake form</span>
      </div>
      <div className="scrollbar-thin max-h-[620px] overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-14">ID</TableHead><TableHead>Application</TableHead><TableHead>Vendor</TableHead><TableHead>Layer</TableHead>
              <TableHead>Owners</TableHead><TableHead>Hosting</TableHead><TableHead>Capabilities</TableHead><TableHead className="text-right">Crit.</TableHead>
              <TableHead>Lifecycle</TableHead><TableHead>Disposition</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((x) => (
              <TableRow key={x.id} className="cursor-pointer" onClick={() => onOpen(x)}>
                <TableCell className="text-xs font-semibold text-muted-foreground">{x.id}</TableCell>
                <TableCell className="max-w-64">
                  <div className="truncate font-medium" title={x.description ?? x.note}>{x.name}</div>
                  <div className="truncate text-[10.5px] text-muted-foreground">{!x.in_scope ? 'Out of scope · dependencies only' : x.description}</div>
                </TableCell>
                <TableCell className={x.vendor === 'TBD' ? 'text-muted-foreground italic' : ''}>{x.vendor}</TableCell>
                <TableCell className="text-xs"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: LAYER_COLOR[x.layer ?? DEFAULT_LAYER] }} />{x.layer}</span></TableCell>
                <TableCell className="max-w-44 text-xs">
                  <div className="truncate">{x.business_owner || '–'}</div>
                  <div className="truncate text-muted-foreground">{x.it_owner || '–'}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">{x.hosting}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {x.caps.length ? <CapChips a={x} l2={l2} /> : <Button variant="outline" size="xs" onClick={() => onMap(x.id)}><Sparkles /> Map with AI</Button>}
                </TableCell>
                <TableCell className="tabular text-right">{x.criticality}</TableCell>
                <TableCell>
                  {x.lifecycle === 'Unknown'
                    ? <Badge variant="outline" className="gap-1 border-dashed text-[10.5px] text-muted-foreground"><AlertTriangle className="size-3" /> Validate</Badge>
                    : <span className="text-sm">{x.lifecycle}</span>}
                </TableCell>
                <TableCell><Disp code={x.computed.disposition} label={x.computed.label} overridden={x.computed.overridden} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function Rationalization({ a, onOpen }: { a: AppsT; onOpen: (x: App) => void }) {
  const disp = a.kpis.dispositions
  const quad = useRef<HTMLDivElement>(null)
  const clus = useRef<HTMLDivElement>(null)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-6 rounded-lg border bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-4">
          {DISPOSITION_CODES.filter((k) => k !== 'Consolidate' || disp[k]).map((k) => (
            <span key={k} className="flex flex-col" title={a.label_desc[k]}>
              <span className="tabular text-[18px] leading-tight font-bold" style={{ color: dispositionColor(k) }}>{disp[k]}</span>
              <span className="text-[10.5px] text-muted-foreground">{a.labels[k]}</span>
            </span>
          ))}
          <Explain x={a.explain.dispositions} />
        </div>
        <div className="flex items-center gap-1"><div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Duplication clusters</div><div className="tabular text-[15px] font-semibold" style={{ color: BAND.weak }}>{a.kpis.clusters}</div></div><Explain x={a.explain.clusters} /></div>
        <div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Overrides</div><div className="tabular text-[15px] font-semibold">{a.kpis.overridden}</div></div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div ref={quad} className="col-span-7 rounded-lg border bg-card p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[12.5px] font-semibold">Business Fit × Technical Fit <span
 className="font-normal text-muted-foreground">· threshold {a.threshold.toFixed(1)} · bubble = criticality</span></div>
            <div className="flex flex-wrap justify-end gap-2.5 text-[11px] text-muted-foreground">
              {DISPOSITION_CODES.map((k) => <span key={k} className="flex items-center gap-1" title={a.label_desc[k]}><span className="size-2.5 rounded-full" style={{ background: dispositionColor(k) }} />{a.labels[k]}</span>)}
            </div>
            <AiAction size="xs" what="Disposition rationale" from="the fit scores, technical health and capability overlap" />
            <ExportMenu target={quad} name="Fit Quadrant" size="xs" csv={() => [['ID', 'Application', 'Business fit', 'Technical fit', 'Criticality', 'Disposition', 'Rationale'],
              ...a.apps.map((x) => [x.id, x.name, x.computed.business_fit, x.computed.technical_fit, x.criticality, x.computed.label, x.computed.statement])]} />
          </div>
          <Quadrant a={a} />
        </div>
        <div ref={clus} className="col-span-5 rounded-lg border bg-card p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[12.5px] font-semibold">Duplication Clusters <span className="font-normal text-muted-foreground">· capability → apps → proposed survivor</span></div>
            <ExportMenu target={clus} name="Duplication Clusters" size="xs" csv={() => [['Capability', 'Name', 'Applications', 'Proposed survivor'],
              ...a.clusters.map((c) => [c.cap, c.cap_name, c.members.map((m) => m.name).join('; '), c.survivor])]} />
          </div>

          <Clusters a={a} />
        </div>
      </div>
      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-[12.5px] font-semibold">Dispositions <span className="font-normal text-muted-foreground">· rule-generated with a written rationale; the (i) shows the scores and rule trace. Open an app to override with a reason. * = overridden.</span></div>
          <Button variant="ghost" size="sm" asChild><a href={exportUrl('applications')}><Download /> Export</a></Button>
        </div>
        <div className="scrollbar-thin max-h-[360px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-14">ID</TableHead><TableHead>Application</TableHead><TableHead className="text-right">BF</TableHead>
                <TableHead className="text-right">TF</TableHead><TableHead>Disposition</TableHead><TableHead>Rationale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...a.apps].sort((x, y) => DISPOSITION_CODES.indexOf(x.computed.disposition as never) - DISPOSITION_CODES.indexOf(y.computed.disposition as never)).map((x) => (
                <TableRow key={x.id} className="cursor-pointer" onClick={() => onOpen(x)}>
                  <TableCell className="text-xs font-semibold text-muted-foreground">{x.id}</TableCell>
                  <TableCell className="font-medium">{x.name}</TableCell>
                  <TableCell className="tabular text-right">{x.computed.business_fit.toFixed(2)}</TableCell>
                  <TableCell className="tabular text-right">{x.computed.technical_fit.toFixed(2)}</TableCell>
                  <TableCell><span className="inline-flex items-center gap-1"><Explain x={x.computed.explain} /><Disp code={x.computed.disposition} label={x.computed.label} overridden={x.computed.overridden} /></span></TableCell>
                  <TableCell className="max-w-[460px] text-[11.5px] leading-snug whitespace-normal text-muted-foreground"><span className="line-clamp-2" title={x.computed.statement}>{x.computed.statement}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

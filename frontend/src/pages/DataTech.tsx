import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check as CheckIcon, ChevronRight, Download, MapPin, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { InsightsCard } from '@/components/InsightsCard'
import { PageHeader } from '@/components/PageHeader'
import { PhasePlan } from '@/components/PhasePlan'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { RefArchitecture } from '@/components/RefArchitecture'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { DataArchitecture, StandardsView } from '@/components/TechViews'
import { TemplateButtons } from '@/components/TemplateButtons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { api, exportUrl, type Check, type DataTech as DT } from '@/lib/api'
import { useView } from '@/lib/screens'
import { BAND, BAND_LABEL, CHECK_STATUS, GRID, NAVY, SLATE, SLATE_LIGHT, bandColor, tint, type Band, type CheckStatus } from '@/lib/theme'
import { cn } from '@/lib/utils'

const short = (n: string) => n.split(' (')[0]

function YesNo({ v, bad = false }: { v: boolean; bad?: boolean }) {
  return v
    ? <CheckIcon className="size-4" style={{ color: bad ? BAND.developing : BAND.strong }} />
    : <X className="size-4" style={{ color: bad ? SLATE_LIGHT : BAND.critical }} />
}

function ScoreBars({ d }: { d: DT }) {
  const rows = d.domains.map((x) => ({ id: x.id, name: short(x.name), score: x.computed.score, band: x.computed.band, risk: x.computed.privacy_risk }))
  return (
    <ChartContainer config={{ score: { label: 'Score', color: NAVY } }} className="h-[340px] w-full">
      <BarChart data={rows} layout="vertical" margin={{ top: 20, right: 36, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tickLine={false} fontSize={11} />
        <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} fontSize={11.5} />
        <ReferenceLine x={60} stroke={BAND.critical} strokeDasharray="4 4" label={{ value: 'gap < 60', position: 'top', fontSize: 10, fill: BAND.critical }} />
        <ChartTooltip cursor={{ fill: tint(NAVY, 0.04) }} content={({ payload }) => {
          const p = payload?.[0]?.payload as (typeof rows)[number] | undefined
          if (!p) return null
          return (
            <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
              <div className="font-semibold">{p.id} {p.name}</div>
              <div>Score <b>{p.score}</b> · {p.band}{p.risk && <span style={{ color: BAND.critical }}> · unclassified PII</span>}</div>
            </div>
          )
        }} />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
          {rows.map((r) => <Cell key={r.id} fill={bandColor(r.band)} />)}
          <LabelList dataKey="score" position="right" fontSize={11} fontWeight={600} fill={SLATE} />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function Matrix({ d }: { d: DT }) {
  return (
    <div className="scrollbar-thin max-h-[340px] overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-10 bg-card">
          <tr>
            <th className="py-1.5 pr-2 text-left font-medium text-muted-foreground">Application</th>
            {d.domains.map((x) => (
              <th key={x.id} className="w-9 px-0.5 py-1.5 font-medium text-muted-foreground">
                <Tooltip><TooltipTrigger asChild><span className="cursor-default">{x.id.replace('DD-', '')}</span></TooltipTrigger><TooltipContent>{x.id} {x.name}</TooltipContent></Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.matrix.map((r) => (
            <tr key={r.app} className="hover:bg-muted/40">
              <td className="max-w-44 truncate border-t py-1 pr-2" title={r.name}><span className="mr-1.5 font-semibold text-muted-foreground">{r.app}</span>{r.name}</td>
              {d.domains.map((x) => (
                <td key={x.id} className="border-t text-center">
                  {r.cells[x.id] === 'sor' && <span className="mx-auto block size-3.5 rounded-sm bg-navy" title="System of record" />}
                  {r.cells[x.id] === 'consumer' && <span className="mx-auto block size-2 rounded-full border-[1.5px] border-navy" title="Consumer" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Gauge({ score, counts }: { score: number | null; counts: Record<string, number> }) {
  const v = score ?? 0
  const r = 78
  const circ = Math.PI * r
  const col = v >= 80 ? BAND.strong : v >= 60 ? BAND.developing : v >= 40 ? BAND.weak : BAND.critical
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-[230px]">
        <path d={`M 22 100 A ${r} ${r} 0 0 1 178 100`} fill="none" stroke={GRID} strokeWidth={16} strokeLinecap="round" />
        <path d={`M 22 100 A ${r} ${r} 0 0 1 178 100`} fill="none" stroke={col} strokeWidth={16} strokeLinecap="round"
          strokeDasharray={`${(v / 100) * circ} ${circ}`} style={{ transition: 'stroke-dasharray 400ms ease' }} />
        <text x={100} y={88} textAnchor="middle" fontSize={34} fontWeight={700} fill={NAVY}>{score ?? '–'}</text>
        <text x={100} y={108} textAnchor="middle" fontSize={11} fill={SLATE}>of 100 · known checks</text>
      </svg>
      <div className="mt-3 grid w-full grid-cols-4 gap-2">
        {(Object.keys(CHECK_STATUS) as CheckStatus[]).map((k) => (
          <div key={k} className="rounded-lg border px-2 py-1.5 text-center">
            <div className="tabular text-lg font-semibold" style={{ color: CHECK_STATUS[k].color }}>{counts[k] ?? 0}</div>
            <div className="text-[10.5px] text-muted-foreground">{CHECK_STATUS[k].label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">Pass 100 · partial 50 · fail 0. Unknown checks are excluded and become “Validate in discovery” gaps.</p>
    </div>
  )
}

function Checklist({ checks, explain }: { checks: Check[]; explain: DT['check_explain'] }) {
  const qc = useQueryClient()
  const put = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Check['status'] }) => api.putCheck(id, status),
    onSuccess: (d) => {
      qc.setQueryData(['data_tech'], d)
      ;['overview', 'roadmap'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      toast.success(`Resilience score now ${d.tech.resilience_score ?? '–'}`)
    },
  })
  return (
    <div className="divide-y">
      {checks.map((c) => (
        <div key={c.id} className="flex items-center gap-3 py-1.5">
          <span className="w-8 text-[11px] font-semibold text-muted-foreground">{c.id}</span><Explain x={explain[c.id]} />
          <span className="min-w-0 flex-1 truncate text-sm" title={c.note ?? c.check}>{c.check}</span>
          <span className="rounded bg-navy-soft px-1.5 py-px text-[10.5px] font-semibold text-navy" title="TOGAF compliance checklist">§{c.togaf_ref}</span>
          <ProvenanceBadge source={c.source} />
          <Select value={c.status} onValueChange={(v) => put.mutate({ id: c.id, status: v as Check['status'] })}>
            <SelectTrigger size="sm" className="h-7 w-[108px] text-xs font-medium" style={{ color: CHECK_STATUS[c.status].color }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CHECK_STATUS) as CheckStatus[]).map((k) => (
                <SelectItem key={k} value={k}><span className="size-2 rounded-full" style={{ background: CHECK_STATUS[k].color }} />{CHECK_STATUS[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  )
}

const STANDARD_COLOR: Record<string, string> = {
  Standard: BAND.strong, 'Provisional Standard': NAVY, 'Proposed Standard': NAVY, 'Non-Standard': BAND.weak,
  'Phasing-Out Standard': BAND.developing, 'Retired Standard': SLATE,
}

export const DT_STEPS = [
  { key: 'data_arch', n: 1, label: 'Data Architecture', sub: 'Layered data view · data flow' },
  { key: 'data', n: 2, label: 'Data Assessment', sub: 'Domain scores · matrix · governance' },
  { key: 'infra', n: 3, label: 'Infrastructure & Platform', sub: 'DC · hybrid cloud · network · security' },
  { key: 'tech', n: 4, label: 'Technology Assessment', sub: 'Resilience · standards · portfolio' },
]
const CARD: Record<string, { title: string; desc: string }> = {
  data: { title: 'Step 2 · Data Assessment', desc: 'Weighted governance score per data domain on ownership, master data, quality, lineage and privacy (Data principles 10–15, §23.6.2), with the Application / Data matrix (§35.6.4). Quality values are assumed until discovery.' },
  data_arch: { title: 'Step 1 · Data Architecture', desc: 'Information & data architecture for CIL (RFP view 6): how plant, enterprise, channel and agronomy data is acquired, processed, stored, governed and consumed. Switch to Data Flow to trace systems of record into analytics and AI readiness.' },
  tech: { title: 'Step 4 · Technology Assessment', desc: 'Resilience and security checks against the TOGAF compliance checklists (§48.5), the Technology Standards Catalog by standards class and lifecycle (RFP view 11), and the estate facts from the proposal.' },
  infra: { title: 'Step 3 · Infrastructure & Platform', desc: 'One consolidated technology & infrastructure architecture (RFP views 7–10): data centres, hybrid and public cloud, network and connectivity, platform services and OT, with IT and OT cyber security as the cross-cutting column.' },
}
const LEGACY: Record<string, string> = { platform: 'infra', network: 'infra', cloud: 'infra', security: 'infra', standards: 'tech' }

export default function DataTech() {
  const q = useQuery({ queryKey: ['data_tech'], queryFn: api.dataTech })
  const [raw, setView] = useView('data_arch', ['data', 'data_arch', 'data_flow', 'tech', 'infra', ...Object.keys(LEGACY)])
  const view = LEGACY[raw] ?? raw
  const step = view === 'data_flow' ? 'data_arch' : view
  const d = q.data
  const bars = useRef<HTMLDivElement>(null)
  const mtx = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  const stds = useRef<HTMLDivElement>(null)
  const insightKey = step

  return (
    <>
      <PageHeader screen="data_tech" actions={<><TemplateButtons kind="data_domains" label="data template" /><TemplateButtons kind="technology" label="tech template" /></>} />
      {q.error ? <ScreenError error={q.error} /> : !d ? <ScreenSkeleton /> : (
        <>
          <PhasePlan p={d.plan} />

          <div className="grid grid-cols-4 gap-1.5">
            {DT_STEPS.map((s, i) => (
              <button key={s.key} onClick={() => setView(s.key)}
                className={cn('relative flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  step === s.key ? 'border-navy bg-navy text-white' : 'bg-card hover:border-navy/50')}>
                <span className={cn('tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', step === s.key ? 'bg-white text-navy' : 'bg-navy-soft text-navy')}>{s.n}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold">{s.label}</span>
                  <span className={cn('block truncate text-[10.5px]', step === s.key ? 'text-white/75' : 'text-muted-foreground')}>{s.sub}</span>
                </span>
                {i < DT_STEPS.length - 1 && <ChevronRight className="absolute top-1/2 -right-[11px] z-10 size-3.5 -translate-y-1/2 rounded-full bg-background text-muted-foreground" />}
              </button>
            ))}
          </div>

          <Card className="gap-3">
            <CardHeader>
              <CardTitle>{CARD[step].title}</CardTitle>
              <CardDescription>{CARD[step].desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 'data' && (
                <>
                  <div className="grid grid-cols-4 gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
                    <div className="flex items-center gap-1"><div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Avg Domain Score</div><div className="tabular text-[15px] font-semibold" style={{ color: bandColor(d.kpis.data_avg >= 60 ? 'developing' : 'weak') }}>{d.kpis.data_avg}<span className="text-[11px] font-normal text-muted-foreground"> / 100</span></div></div><Explain x={d.explain.data_avg} /></div>
                    <div className="flex items-center gap-1"><div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Privacy-Risk Domains</div><div className="tabular text-[15px] font-semibold" style={{ color: BAND.critical }}>{d.kpis.privacy_risk}<span className="text-[11px] font-normal text-muted-foreground"> · DPDP Act 2023</span></div></div><Explain x={d.explain.privacy_risk} /></div>
                    <div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Domains Without Owner</div><div className="tabular text-[15px] font-semibold" style={{ color: BAND.weak }}>{d.domains.filter((x) => !x.owner).length}<span className="text-[11px] font-normal text-muted-foreground"> / {d.domains.length}</span></div></div>
                    <div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Systems of Record</div><div className="tabular text-[15px] font-semibold">{d.matrix.filter((m) => Object.values(m.cells).includes('sor')).length}</div></div>
                  </div>
                  <div className="grid grid-cols-12 gap-4">
                    <div ref={bars} className="col-span-7 rounded-lg border bg-card p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="text-[12.5px] font-semibold">Data-Domain Governance Score <span className="font-normal text-muted-foreground">· weighted 0–100 · §35.6.4</span></div>
                        <span className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                          {(Object.keys(BAND) as Band[]).map((k) => <span key={k} className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: BAND[k] }} />{BAND_LABEL[k]}</span>)}
                          <ExportMenu target={bars} name="Data Domain Scores" size="xs" csv={() => [['ID', 'Domain', 'Score', 'Band', 'Privacy risk'], ...d.domains.map((x) => [x.id, x.name, x.computed.score, x.computed.band, x.computed.privacy_risk ? 'Yes' : 'No'])]} />
                        </span>
                      </div>
                      <ScoreBars d={d} />
                    </div>
                    <div ref={mtx} className="col-span-5 rounded-lg border bg-card p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="text-[12.5px] font-semibold">Application / Data Matrix</div>
                        <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-navy" /> System of record</span>
                          <span className="flex items-center gap-1"><span className="size-2 rounded-full border-[1.5px] border-navy" /> Consumer</span>
                          <ExportMenu target={mtx} name="Application Data Matrix" size="xs" csv={() => [['App', 'Name', ...d.domains.map((x) => `${x.id} ${x.name}`)], ...d.matrix.map((m) => [m.app, m.name, ...d.domains.map((x) => m.cells[x.id] === 'sor' ? 'System of record' : m.cells[x.id] === 'consumer' ? 'Consumer' : '')])]} />
                        </span>
                      </div>
                      <Matrix d={d} />
                    </div>
                  </div>
                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <div className="text-[12.5px] font-semibold">Data Governance <span className="font-normal text-muted-foreground">· TOGAF §34.6 Data Entity attributes; quality values are assumed until discovery</span></div>
                      <Button variant="ghost" size="sm" asChild><a href={exportUrl('data_tech')}><Download /> Export</a></Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">ID</TableHead><TableHead>Domain</TableHead><TableHead>Owner</TableHead><TableHead>SoR</TableHead>
                          <TableHead>MDM</TableHead><TableHead className="text-right">Quality</TableHead><TableHead>Lineage</TableHead><TableHead>PII</TableHead>
                          <TableHead>Classified</TableHead><TableHead className="text-right">Score</TableHead><TableHead className="w-24">Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {d.domains.map((x) => (
                          <TableRow key={x.id}>
                            <TableCell className="text-xs font-semibold text-muted-foreground">{x.id}</TableCell>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-1.5">{short(x.name)}
                                {x.computed.privacy_risk && <span className="rounded px-1 text-[10px] font-semibold" style={{ color: BAND.critical, background: tint(BAND.critical) }}>Privacy risk</span>}
                              </span>
                            </TableCell>
                            <TableCell><YesNo v={x.owner} /></TableCell>
                            <TableCell className="text-muted-foreground">{x.sor || '–'}</TableCell>
                            <TableCell className="text-muted-foreground capitalize">{x.mdm}</TableCell>
                            <TableCell className="tabular text-right">{(x.quality.reduce((a, b) => a + b, 0) / x.quality.length).toFixed(1)}</TableCell>
                            <TableCell><YesNo v={x.lineage} /></TableCell>
                            <TableCell><YesNo v={x.pii} bad /></TableCell>
                            <TableCell>{x.pii ? <YesNo v={x.classified} /> : <span className="text-xs text-muted-foreground">n/a</span>}</TableCell>
                            <TableCell className="tabular text-right font-semibold" style={{ color: bandColor(x.computed.band) }}><span className="inline-flex items-center gap-1"><Explain x={x.computed.explain} />{x.computed.score}</span></TableCell>
                            <TableCell><ProvenanceBadge source={x.source} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {step === 'data_arch' && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <ToggleGroup type="single" value={view === 'data_flow' ? 'data_flow' : 'data_arch'} onValueChange={(v) => v && setView(v)} variant="outline" size="sm">
                      <ToggleGroupItem value="data_arch" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">Data Architecture</ToggleGroupItem>
                      <ToggleGroupItem value="data_flow" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">Data Flow & AI Readiness</ToggleGroupItem>
                    </ToggleGroup>
                    <span className="text-[11px] text-muted-foreground">{view === 'data_flow' ? 'Data Dissemination view §35.6.4 · systems of record → domains → analytics → AI' : 'RFP view 6 · Information & data architecture for CIL'}</span>
                  </div>
                  {view === 'data_flow' ? (
                    <div className="space-y-2">
                      <div className="flex justify-end"><ExportMenu target={flow} name="Data Flow and AI Readiness" /></div>
                      <div ref={flow} className="bg-card"><DataArchitecture d={d} /></div>
                    </div>
                  ) : d.data_ref && (
                    <RefArchitecture v={d.data_ref} queryKey="data_tech" appToggle ctx={{ apps: d.matrix.map((m) => ({ id: m.app, name: m.name })) }} />
                  )}
                </>
              )}

              {step === 'tech' && (
                <>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-4 rounded-lg border p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold">Resilience Score <Explain x={d.tech.explain} /><span className="font-normal text-muted-foreground">· §48.5</span></div>
                      <Gauge score={d.tech.resilience_score} counts={d.tech.counts} />
                    </div>
                    <div className="col-span-8 rounded-lg border p-3">
                      <div className="mb-1 text-[12.5px] font-semibold">Resilience Checklist <span className="font-normal text-muted-foreground">· edit a status to recompute the score, the gap register and the linked blocks in the infrastructure view</span></div>
                      <Checklist checks={d.checks} explain={d.check_explain} />
                    </div>
                  </div>
                  <div ref={stds} className="rounded-lg border bg-card p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-[12.5px] font-semibold">Technology Standards & Lifecycle <span className="font-normal text-muted-foreground">· RFP view 11 · Technology Standards Catalog §35.6.6</span></div>
                      <ExportMenu target={stds} name="Technology Standards and Lifecycle" size="xs" csv={() => [['ID', 'Platform', 'Category', 'Standards class', 'Lifecycle', 'Version', 'Location', 'Source'], ...d.platforms.map((p) => [p.id, p.name, p.category, p.standard, p.lifecycle, p.version ?? 'TBD', p.location ?? '', p.source])]} />
                    </div>
                    <StandardsView d={d} />
                  </div>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-5 rounded-lg border p-3">
                      <div className="mb-2 text-[12.5px] font-semibold">Estate Facts <span className="font-normal text-muted-foreground">· baseline from the proposal deck</span></div>
                      <dl className="space-y-1.5 text-sm">
                        {d.facts.map((f) => (
                          <div key={f.k} className="flex gap-3">
                            <dt className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{f.k}</dt>
                            <dd className="flex-1 text-[13px] leading-snug">{f.v}</dd>
                            <ProvenanceBadge source={f.source} />
                          </div>
                        ))}
                      </dl>
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                        {d.locations.map((l) => (
                          <span key={l.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]" title={l.name}>
                            <MapPin className="size-3 text-navy" /> {short(l.name).split(' incl.')[0]} <span className="text-muted-foreground">· {l.type}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-7 rounded-lg border p-3">
                      <div className="mb-1 text-[12.5px] font-semibold">Technology Portfolio Catalog <span className="font-normal text-muted-foreground">· standards class per TOGAF §34.6</span></div>
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-12">ID</TableHead><TableHead>Platform</TableHead><TableHead>Standards class</TableHead><TableHead>Lifecycle</TableHead><TableHead className="w-24">Source</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {d.platforms.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs font-semibold text-muted-foreground">{p.id}</TableCell>
                              <TableCell><div className="font-medium">{p.name}</div><div className="text-[11px] text-muted-foreground">{p.category}</div></TableCell>
                              <TableCell>
                                <span className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium" style={{ color: STANDARD_COLOR[p.standard] ?? SLATE, borderColor: tint(STANDARD_COLOR[p.standard] ?? SLATE, 0.4) }}>{p.standard}</span>
                              </TableCell>
                              <TableCell className={p.lifecycle === 'Unknown' ? 'text-muted-foreground italic' : ''}>{p.lifecycle}</TableCell>
                              <TableCell><ProvenanceBadge source={p.source} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}

              {step === 'infra' && d.infra_ref && (
                <RefArchitecture v={d.infra_ref} queryKey="data_tech"
                  ctx={{ checks: d.checks.map((c) => ({ id: c.id, name: c.check, status: c.status })), hostings: d.hosting.map((h) => h.name) }} />
              )}

              <InsightsCard key={insightKey} screen="data_tech" tab={insightKey} items={d.insights[insightKey] ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

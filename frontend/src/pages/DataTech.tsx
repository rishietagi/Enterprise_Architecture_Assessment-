import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check as CheckIcon, Download, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { InsightsCard } from '@/components/InsightsCard'
import { PageHeader } from '@/components/PageHeader'
import { PhasePlan } from '@/components/PhasePlan'
import { CyberAssessment } from '@/components/Cyber'
import { DataTechInputs } from '@/components/DataTechInputs'
import { DomainGapRegister } from '@/components/DomainGapRegister'
import { infraDetail } from '@/components/InfraDetails'
import { RefArchitecture } from '@/components/RefArchitecture'
import { StepBar } from '@/components/StepBar'
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

function Checklist({ checks, explain }: { checks: Check[]; explain?: DT['check_explain'] }) {
  const qc = useQueryClient()
  const put = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Check['status'] }) => api.putCheck(id, status),
    onSuccess: (d) => {
      qc.setQueryData(['data_tech'], d)
      ;['overview', 'roadmap'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      toast.success(`Resilience ${d.tech.resilience_score ?? '–'} · engineering ${d.engineering.score ?? '–'}`)
    },
  })
  return (
    <div className="divide-y">
      {checks.map((c) => (
        <div key={c.id} className="flex items-center gap-3 py-1.5">
          <span className="w-8 text-[11px] font-semibold text-muted-foreground">{c.id}</span>{explain?.[c.id] && <Explain x={explain[c.id]} />}
          <span className="min-w-0 flex-1 truncate text-sm" title={c.note ?? c.check}>{c.check}</span>
          <span className="rounded bg-navy-soft px-1.5 py-px text-[10.5px] font-semibold text-navy" title="TOGAF compliance checklist">§{c.togaf_ref}</span>
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

export const DT_STEPS = [
  { key: 'inputs', n: 1, label: 'Inputs', sub: 'Data · platforms · sites · cyber' },
  { key: 'assess', n: 2, label: 'Assessment', sub: 'Data · resilience · cyber · engineering' },
  { key: 'gaps', n: 3, label: 'Gap Register', sub: 'Data, technology and platform gaps' },
  { key: 'views', n: 4, label: 'Architecture Views', sub: 'Data · data flow · infrastructure' },
]
const ASSESS = [['data', 'Data Governance'], ['tech', 'Resilience & Standards'], ['cyber', 'Cyber Security'], ['engineering', 'Engineering Practices']] as const
const VIEWS = [['data_arch', 'Data Architecture'], ['data_flow', 'Data Flow & AI Readiness'], ['infra', 'Infrastructure & Platform']] as const
const STEP_OF: Record<string, string> = { gaps: 'gaps', inputs: 'inputs', data: 'assess', tech: 'assess', cyber: 'assess', engineering: 'assess', data_arch: 'views', data_flow: 'views', infra: 'views' }
const CARD: Record<string, { title: string; desc: string }> = {
  inputs: { title: 'Step 1 · Inputs', desc: 'Everything this screen is computed from: what data CIL holds (domains, data types, sensitivity and systems of record), the technology platforms, the sites and network links, and the cyber security baseline. Edit in place; every assessment and view on this screen recomputes on save.' },
  data: { title: 'Step 2 · Assessment · Data Governance', desc: 'Weighted governance score per data domain on ownership, master data, quality, lineage and privacy (Data principles 10–15, §23.6.2), with the Application / Data matrix (§35.6.4).' },
  tech: { title: 'Step 2 · Assessment · Resilience & Standards', desc: 'Resilience and security checks against the TOGAF compliance checklists (§48.5), the Technology Standards Catalog by standards class and lifecycle (RFP view 11), and the estate facts from the proposal.' },
  cyber: { title: 'Step 2 · Assessment · Cyber Security', desc: 'Cyber security posture from the Step 1 inputs: mean control maturity per NIST CSF 2.0 function (Govern, Identify, Protect, Detect, Respond, Recover), metrics off target, tooling and compliance obligations. Weak controls and open items become gaps under Resilience & cyber security.' },
  engineering: { title: 'Step 2 · Assessment · Engineering Practices', desc: 'Modern technology and engineering (RFP domain 9): DevSecOps, CI/CD, infrastructure as code, containers, API-first design, platform engineering, observability, vendor dependency and emerging technology. Linked blocks in the infrastructure view follow these statuses.' },
  gaps: { title: 'Step 3 · Gap Register', desc: 'Data and technology gaps generated from the assessment: one gap per data domain, resilience or engineering check and platform, plus portfolio gaps for missing data and infrastructure building blocks, landing zones and data ownership. Each has a severity, a target-state hypothesis and the roadmap initiative that closes it; edit any of them.' },
  data_arch: { title: 'Step 4 · Architecture Views · Data Architecture', desc: 'Information & data architecture for CIL (RFP view 6): how plant, enterprise, channel and agronomy data is acquired, processed, stored, governed and consumed.' },
  data_flow: { title: 'Step 4 · Architecture Views · Data Flow & AI Readiness', desc: 'Data Dissemination view (§35.6.4): systems of record into governed domains, analytics and AI initiatives, coloured by domain score.' },
  infra: { title: 'Step 4 · Architecture Views · Infrastructure & Platform', desc: 'One consolidated technology & infrastructure architecture (RFP views 7–10). Use Details on a layer for network links, landing zones and hosting, private hosting and DR, and the security zones, each with its run cost from IT Budget.' },
}
const LEGACY: Record<string, string> = { platform: 'infra', network: 'infra', cloud: 'infra', security: 'infra', standards: 'tech' }

function SubToggle({ items, value, onPick }: { items: readonly (readonly [string, string])[]; value: string; onPick: (v: string) => void }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={(v) => v && onPick(v)} variant="outline" size="sm">
      {items.map(([k, l]) => <ToggleGroupItem key={k} value={k} className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">{l}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}

export default function DataTech() {
  const q = useQuery({ queryKey: ['data_tech'], queryFn: api.dataTech })
  const [raw, setView] = useView('inputs', [...Object.keys(STEP_OF), ...Object.keys(LEGACY), 'assess', 'views'])
  const view = LEGACY[raw] ?? (raw === 'assess' ? 'data' : raw === 'views' ? 'data_arch' : raw)
  const step = STEP_OF[view] ?? 'inputs'
  const d = q.data
  const bars = useRef<HTMLDivElement>(null)
  const mtx = useRef<HTMLDivElement>(null)
  const flow = useRef<HTMLDivElement>(null)
  const stds = useRef<HTMLDivElement>(null)
  const eng = useRef<HTMLDivElement>(null)
  return (
    <>
      <PageHeader screen="data_tech" actions={<><TemplateButtons kind="data_domains" label="data template" /><TemplateButtons kind="technology" label="tech template" /></>} />
      {q.error ? <ScreenError error={q.error} /> : !d ? <ScreenSkeleton /> : (
        <>
          <PhasePlan p={d.plan} />
          <StepBar steps={DT_STEPS} active={step} onPick={(k) => setView(k === 'assess' ? 'data' : k === 'views' ? 'data_arch' : k)} />
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>{CARD[view].title}</CardTitle>
              <CardDescription>{CARD[view].desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 'assess' && <SubToggle items={ASSESS} value={view} onPick={setView} />}
              {step === 'views' && <SubToggle items={VIEWS} value={view} onPick={setView} />}

              {view === 'inputs' && <DataTechInputs d={d} />}
              {view === 'gaps' && <DomainGapRegister reg={d.gap_register} screen="data_tech" name="Data and Technology Gap Register" />}

              {view === 'data' && (
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
                      <div className="text-[12.5px] font-semibold">Data Governance <span className="font-normal text-muted-foreground">· TOGAF §34.6 Data Entity attributes · edit them in Inputs</span></div>
                      <Button variant="ghost" size="sm" asChild><a href={exportUrl('data_tech')}><Download /> Export</a></Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">ID</TableHead><TableHead>Domain</TableHead><TableHead>Owner</TableHead><TableHead>SoR</TableHead>
                          <TableHead>MDM</TableHead><TableHead className="text-right">Quality</TableHead><TableHead>Lineage</TableHead><TableHead>PII</TableHead>
                          <TableHead>Classified</TableHead><TableHead className="text-right">Score</TableHead>
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {view === 'tech' && (
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
                      <div className="text-[12.5px] font-semibold">Technology Standards & Lifecycle <span className="font-normal text-muted-foreground">· RFP view 11 · edit platforms in Inputs</span></div>
                      <ExportMenu target={stds} name="Technology Standards and Lifecycle" size="xs" csv={() => [['ID', 'Platform', 'Category', 'Standards class', 'Lifecycle', 'Version', 'Location', 'Source'], ...d.platforms.map((p) => [p.id, p.name, p.category, p.standard, p.lifecycle, p.version ?? 'TBD', p.location ?? '', p.source])]} />
                    </div>
                    <StandardsView d={d} />
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 text-[12.5px] font-semibold">Estate Facts <span className="font-normal text-muted-foreground">· baseline from the proposal deck</span></div>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      {d.facts.map((f) => (
                        <div key={f.k} className="flex gap-3">
                          <dt className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{f.k}</dt>
                          <dd className="flex-1 text-[13px] leading-snug">{f.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </>
              )}

              {view === 'cyber' && <CyberAssessment c={d.cyber} />}

              {view === 'engineering' && (
                <div ref={eng} className="grid grid-cols-12 gap-4 bg-card">
                  <div className="col-span-4 rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between gap-1.5 text-[12.5px] font-semibold"><span className="flex items-center gap-1.5">Engineering Practices Score <Explain x={d.engineering.explain} /></span>
                      <ExportMenu target={eng} name="Engineering Practices" size="xs" csv={() => [['ID', 'Area', 'Practice', 'Status', 'Source'], ...d.engineering_checks.map((c) => [c.id, (c as { area?: string }).area ?? '', c.check, c.status, c.source])]} /></div>
                    <Gauge score={d.engineering.score} counts={d.engineering.counts} />
                  </div>
                  <div className="col-span-8 rounded-lg border p-3">
                    <div className="mb-1 text-[12.5px] font-semibold">Engineering Practices Checklist <span className="font-normal text-muted-foreground">· DevSecOps, CI/CD, IaC, containers, microservices, platform engineering, observability, vendor dependency</span></div>
                    <Checklist checks={d.engineering_checks} />
                  </div>
                </div>
              )}

              {view === 'data_arch' && d.data_ref && (
                <RefArchitecture v={d.data_ref} queryKey="data_tech" appToggle ctx={{ apps: d.apps.map((a) => ({ id: a.id, name: a.name })) }} />
              )}
              {view === 'data_flow' && (
                <div className="space-y-2">
                  <div className="flex justify-end"><ExportMenu target={flow} name="Data Flow and AI Readiness" /></div>
                  <div ref={flow} className="bg-card"><DataArchitecture d={d} /></div>
                </div>
              )}
              {view === 'infra' && d.infra_ref && (
                <RefArchitecture v={d.infra_ref} queryKey="data_tech" layerDetail={infraDetail(d)}
                  ctx={{ checks: [...d.checks, ...d.engineering_checks].map((c) => ({ id: c.id, name: c.check, status: c.status })), hostings: d.hosting.map((h) => h.name), apps: d.apps.map((a) => ({ id: a.id, name: a.name })) }} />
              )}

              <InsightsCard key={view} screen="data_tech" tab={view === 'data_flow' ? 'data_arch' : view} items={d.insights[view === 'data_flow' ? 'data_arch' : view] ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

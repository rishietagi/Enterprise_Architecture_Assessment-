import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppWindow, ArrowRight, ArrowUpRight, CalendarRange, Download, Flag, IndianRupee, Layers, ShieldCheck, Wrench } from 'lucide-react'
import { Cell, Label, Pie, PieChart } from 'recharts'
import { AdmLegend, AdmWheel } from '@/components/AdmWheel'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { InsightsCard } from '@/components/InsightsCard'
import { KpiCard } from '@/components/KpiCard'
import { ArchitectureStates, EnterpriseLandscape } from '@/components/Landscape'
import { PageHeader } from '@/components/PageHeader'
import { PriorityPill } from '@/components/PriorityPill'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, exportUrl, fmtCr, type ArchView, type Gap, type Overview } from '@/lib/api'
import { SCREEN_BY_KEY, SCREENS, useView } from '@/lib/screens'
import { BAND, NAVY, PLAN_STATUS, SLATE, WAVE_COLOR, bandColor, dispositionColor } from '@/lib/theme'

const GAP_SCREEN: Record<Gap['kind'], string> = {
  capability: '/business', application: '/applications', duplication: '/applications', data: '/data-tech',
  technology: '/data-tech', governance: '/roadmap?view=governance',
  business: '/business?view=gaps', data_tech: '/data-tech?view=gaps',
}
const ARCH_TABS = ['states', 'landscape', 'views']

function ViewsIndex({ views }: { views: ArchView[] }) {
  const nav = useNavigate()
  return (
    <div className="grid grid-cols-2 gap-x-6">
      {views.map((v) => (
        <button key={v.n} onClick={() => nav(`${SCREEN_BY_KEY[v.screen].path}?view=${v.view}`)}
          className="group flex items-center gap-3 border-b py-2 text-left">
          <span className="tabular inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-navy-soft text-[12px] font-bold text-navy">{v.n}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium group-hover:text-navy">{v.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{SCREEN_BY_KEY[v.screen].nav} · {v.artifact} · §{v.togaf_ref}</span>
          </span>
          <span className="tabular shrink-0 text-[11px] text-muted-foreground">{v.records} records</span>
          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  )
}

/** Engagement status: week, phase, progress, next steering committee and next deliverable. */
function EngagementStrip({ e }: { e: Overview['engagement'] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 text-[12.5px]">
      <span className="flex items-center gap-2 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase"><CalendarRange className="size-3.5 text-navy" />Where We Are</span>
      <span className="text-[15px] font-semibold">W{e.week} <span className="text-[12px] font-normal text-muted-foreground">of {e.weeks}</span></span>
      {e.phase && <span>Phase: <b>{e.phase}</b> <span className="text-muted-foreground">({e.phase_weeks})</span></span>}
      <span className="flex items-center gap-1.5"><span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${e.progress}%`, background: PLAN_STATUS.done.color }} /></span><b className="tabular">{e.progress}%</b> of tasks done</span>
      {e.steerco && <span className="text-muted-foreground">Next steerco <b className="text-foreground">W{e.steerco}</b></span>}
      {e.milestone && <span className="flex items-center gap-1.5"><Flag className="size-3.5 text-navy" />{e.milestone.name} <b>W{e.milestone.week}</b></span>}
      <Link to="/approach?view=plan" className="ml-auto flex items-center gap-1 text-[11.5px] text-navy hover:underline">Full plan <ArrowRight className="size-3" /></Link>
    </div>
  )
}

/** One line per architecture domain: score, band, the main issue and a link to the screen behind it. */
function DomainHealth({ d }: { d: Overview }) {
  const box = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  return (
    <Card className="col-span-7 gap-2">
      <CardHeader>
        <CardTitle>Domain Health</CardTitle>
        <CardDescription>Every score is computed by the rules on the screen it links to. Select a line to open it.</CardDescription>
        <CardAction><ExportMenu target={box} name="Domain Health" size="xs" csv={() => [['Domain', 'Score', 'Band', 'Main issue'], ...d.health.map((h) => [h.label, h.value, h.band ?? '', h.note])]} /></CardAction>
      </CardHeader>
      <CardContent>
        <div ref={box} className="divide-y bg-card">
          {d.health.map((h) => {
            const c = bandColor(h.band ?? '')
            return (
              <button key={h.key} onClick={() => nav(`${SCREEN_BY_KEY[h.screen].path}${h.view ? `?view=${h.view}` : ''}`)}
                className="group grid w-full grid-cols-[170px_96px_120px_minmax(0,1fr)_16px] items-center gap-3 py-2 text-left">
                <span className="text-[13px] font-medium group-hover:text-navy">{h.label}</span>
                <span className="tabular text-[13px] font-semibold" style={{ color: c }}>{h.value}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${Math.max(3, h.pct ?? 0)}%`, background: c }} /></span>
                <span className="truncate text-[12px] text-muted-foreground" title={h.note}>{h.note}</span>
                <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const q = useQuery({ queryKey: ['overview'], queryFn: api.overview })
  const nav = useNavigate()
  const [view, setView] = useView('states', ['adm', ...ARCH_TABS])
  const d = q.data

  const donutCfg = Object.fromEntries((d?.dispositions ?? []).map((x) => [x.name, { label: x.name, color: dispositionColor(x.code) }])) satisfies ChartConfig
  const totalApps = d?.dispositions.reduce((a, x) => a + x.count, 0) ?? 0
  const maxWaveCost = d ? Math.max(...d.waves.map((w) => w.cost_cr[1])) : 1
  const h = d ? Object.fromEntries(d.health.map((x) => [x.key, x])) : {}
  const col = (k: string) => bandColor(h[k]?.band ?? '')

  return (
    <>
      <PageHeader screen="overview" actions={
        <Button variant="outline" size="sm" asChild><a href={exportUrl('overview')}><Download /> Gap register</a></Button>
      } />
      {q.error ? <ScreenError error={q.error} /> : !d ? <ScreenSkeleton /> : (
        <>
          <EngagementStrip e={d.engagement} />

          <div className="grid grid-cols-6 gap-3">
            <KpiCard label="Capability maturity" value={<>{d.kpis.avg_cap_maturity.toFixed(2)}<span className="text-sm font-normal text-muted-foreground"> / 5</span></>}
              sub={`${d.counts.capabilities} L2 · ${h.business?.note.split(';')[0]}`} accent={col('business')} icon={<Layers />} explain={d.explain.avg_cap_maturity} />
            <KpiCard label="Apps needing action" value={<>{d.cost.actions}<span className="text-sm font-normal text-muted-foreground"> / {d.cost.in_scope}</span></>}
              sub="Modernise, replace or consolidate" accent={col('applications')} icon={<AppWindow />} explain={d.explain.dispositions} />
            <KpiCard label="Technical health" value={<>{d.cost.health.spof}<span className="text-sm font-normal text-muted-foreground"> SPOF</span></>}
              sub={`${d.cost.health.high_debt} high debt · ${d.cost.health.scal_risk} scalability risk`} accent={col('health')} icon={<Wrench />} />
            <KpiCard label="Data / resilience" value={<>{d.kpis.data_avg}<span className="text-sm font-normal text-muted-foreground"> / {h.resilience?.value.split(' ')[0]}</span></>}
              sub="Data governance / resilience score" accent={col('data')} icon={<ShieldCheck />} explain={d.explain.data_avg} />
            <KpiCard label={`IT spend ${d.cost.fy}`} value={`₹${d.cost.total} Cr`}
              sub={`${d.cost.pct_revenue}% of revenue · benchmark ${d.cost.benchmark[0]}–${d.cost.benchmark[1]}%`} accent={NAVY} icon={<IndianRupee />} />
            <KpiCard label="Roadmap investment" value={<span className="text-[20px] whitespace-nowrap">{fmtCr(d.kpis.total_cr)}</span>} sub={`${d.counts.initiatives} initiatives · ${d.counts.gaps} gaps · FY27–FY30`}
              accent={NAVY} icon={<IndianRupee />} explain={d.explain.total_cr} />
          </div>

          <div className="grid grid-cols-12 gap-4">
            <DomainHealth d={d} />
            <Card id="sec-adm" className="col-span-5 scroll-mt-4 gap-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">ADM Cycle <Explain x={d.explain.adm} /></CardTitle>
                <CardDescription>Assessment status by TOGAF phase. Select a phase to open its screen.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2">
                <div className="h-[330px] w-[312px]"><AdmWheel nodes={d.adm} onSelect={(s) => nav(SCREENS.find((x) => x.key === s)!.path)} /></div>
                <AdmLegend />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-12 gap-4">
            <Card className="col-span-4 gap-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">Application Dispositions <Explain x={d.explain.dispositions} /></CardTitle>
                <CardDescription>Fit quadrant and rationalization rules · §28.2</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-3">
                <ChartContainer config={donutCfg} className="aspect-square h-[150px] shrink-0">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" />} />
                    <Pie data={d.dispositions} dataKey="count" nameKey="name" innerRadius={46} outerRadius={70} strokeWidth={2} paddingAngle={1}>
                      {d.dispositions.map((x) => <Cell key={x.code} fill={dispositionColor(x.code)} />)}
                      <Label content={({ viewBox }) => {
                        const vb = viewBox as { cx: number; cy: number }
                        return (
                          <text x={vb.cx} y={vb.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={vb.cx} y={vb.cy - 6} className="fill-foreground text-xl font-semibold">{totalApps}</tspan>
                            <tspan x={vb.cx} y={vb.cy + 12} className="fill-muted-foreground text-[10px]">apps</tspan>
                          </text>
                        )
                      }} />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="flex-1 space-y-1.5 text-xs">
                  {d.dispositions.map((x) => (
                    <li key={x.code} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-sm" style={{ background: dispositionColor(x.code) }} />
                      <span className="flex-1 text-muted-foreground">{x.name}</span>
                      <span className="tabular font-semibold">{x.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="col-span-8 gap-1">
              <CardHeader>
                <CardTitle>Top Priority Gaps</CardTitle>
                <CardDescription>Impact × urgency · {d.counts.gaps} gaps in the register</CardDescription>
                <CardAction><Link to="/roadmap?view=longlist" className="flex items-center gap-1 text-[11.5px] text-navy hover:underline">Initiative long list <ArrowRight className="size-3" /></Link></CardAction>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {d.top_gaps.map((g) => (
                    <li key={g.id} className="flex items-center gap-1.5">
                      <Explain x={g.explain} />
                      <button onClick={() => nav(GAP_SCREEN[g.kind])} className="group flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left">
                        <PriorityPill p={g.priority} />
                        <span className="min-w-0 flex-1 truncate text-sm">{g.title}</span>
                        <span className="text-[10px] font-semibold text-muted-foreground">{g.adm_phase.replace('_', ' ')}</span>
                        <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">Transition Waves to 2030 <Explain x={d.explain.waves} /></CardTitle>
              <CardDescription>Initiatives sequenced by priority and dependency · §28, §36.2.14</CardDescription>
              {d.cost.afford.length > 0 && (
                <CardAction className="text-right text-[11.5px] text-muted-foreground">
                  {d.cost.afford.map((x) => <div key={x.fy}>{x.fy}: roadmap <b className="text-foreground">{x.share[0]}–{x.share[1]}%</b> of planned IT capex</div>)}
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-3">
              {d.waves.map((w, i) => (
                <button key={w.id} onClick={() => nav('/roadmap?view=roadmap')} className="flex flex-col rounded-lg border p-3 text-left transition-colors hover:bg-muted/40">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold" style={{ color: WAVE_COLOR[i] }}>{w.id}</span>
                    <span className="text-[10px] text-muted-foreground">{w.window}</span>
                  </div>
                  <div className="text-sm font-semibold">{w.name}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(w.cost_cr[1] / maxWaveCost) * 100}%`, background: WAVE_COLOR[i] }} />
                  </div>
                  <div className="tabular mt-1 text-[11px] text-muted-foreground">{fmtCr(w.cost_cr)}</div>
                  <ul className="mt-2 space-y-1">
                    {w.initiatives.map((x) => (
                      <li key={x.id} className="flex items-start gap-1.5 text-xs leading-snug">
                        <span className="mt-[5px] size-1.5 shrink-0 rounded-full" style={{ background: x.priority >= 20 ? BAND.critical : BAND.developing }} />
                        <span className="line-clamp-2">{x.name}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card id="sec-arch" className="scroll-mt-4 gap-3">
            <Tabs value={ARCH_TABS.includes(view) ? view : 'states'} onValueChange={setView}>
              <CardHeader className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Architecture Views</CardTitle>
                  <CardDescription>Current, transition and target states, the enterprise landscape, and where each RFP view lives.</CardDescription>
                </div>
                <TabsList>
                  <TabsTrigger value="states">Current → Target States</TabsTrigger>
                  <TabsTrigger value="landscape">Enterprise Landscape</TabsTrigger>
                  <TabsTrigger value="views">RFP Views (14)</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-3">
                <TabsContent value="states">
                  <p className="mb-3 text-xs text-muted-foreground">Projected by the rules: a gap closes when its initiative's wave completes and its measure moves to the rule target. Select a measure to open its screen; <span style={{ color: SLATE }}>(i)</span> shows the projection rule.</p>
                  <ArchitectureStates s={d.states} />
                </TabsContent>
                <TabsContent value="landscape"><EnterpriseLandscape l={d.landscape} /></TabsContent>
                <TabsContent value="views"><ViewsIndex views={d.views} /></TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          <InsightsCard screen="overview" tab="summary" items={d.insights.summary ?? []} />
        </>
      )}
    </>
  )
}

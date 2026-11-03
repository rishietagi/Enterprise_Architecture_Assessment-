import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Download, Gauge, IndianRupee, Layers, ShieldCheck } from 'lucide-react'
import { Cell, Label, Pie, PieChart } from 'recharts'
import { AdmLegend, AdmWheel } from '@/components/AdmWheel'
import { Explain } from '@/components/Explain'
import { FindingsCard } from '@/components/FindingsCard'
import { KpiCard, KpiRow } from '@/components/KpiCard'
import { ArchitectureStates, EnterpriseLandscape } from '@/components/Landscape'
import { PageHeader } from '@/components/PageHeader'
import { PriorityPill } from '@/components/PriorityPill'
import { ScreenSummary } from '@/components/ScreenSummary'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, exportUrl, fmtCr, type ArchView, type Gap } from '@/lib/api'
import { SCREEN_BY_KEY, SCREENS, useView } from '@/lib/screens'
import { BAND, NAVY, SLATE, WAVE_COLOR, bandColor, dispositionColor, tint } from '@/lib/theme'

const GAP_SCREEN: Record<Gap['kind'], string> = {
  capability: '/business', application: '/applications', duplication: '/applications', data: '/data-tech',
  technology: '/data-tech', governance: '/roadmap',
}
const ARCH_TABS = ['states', 'landscape', 'views']

function maturityBand(v: number, max: number) {
  const r = v / max
  return r >= 0.7 ? BAND.strong : r >= 0.5 ? BAND.developing : r >= 0.3 ? BAND.weak : BAND.critical
}

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
          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
            title={`${v.records} records behind this view; ${v.evidence}% from deck, public or client sources`}
            style={v.status === 'evidenced' ? { color: BAND.strong, background: tint(BAND.strong) } : { color: BAND.developing, background: tint(BAND.developing) }}>
            {v.status === 'evidenced' ? 'Evidenced' : 'Draft · assumed'} {v.evidence}%
          </span>
          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </button>
      ))}
    </div>
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
  const pick = (v: string) => {
    setView(v)
    document.getElementById(v === 'adm' ? 'sec-adm' : 'sec-arch')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <PageHeader screen="overview" actions={
        <Button variant="outline" size="sm" asChild><a href={exportUrl('overview')}><Download /> Gap register</a></Button>
      } />
      {q.error ? <ScreenError error={q.error} /> : !d ? <ScreenSkeleton /> : (
        <>
          <ScreenSummary screen="overview" active={view} onPick={pick}
            status={`${d.counts.capabilities} L2 assessed · ${d.counts.apps} applications · ${d.counts.gaps} gaps → ${d.counts.initiatives} initiatives · ${d.views.filter((v) => v.status === 'evidenced').length} of 14 RFP views evidenced, rest drafted on assumed data`} />
          <KpiRow>
            <KpiCard label="EA maturity (ACMM)" value={<>{d.kpis.acmm_mean.toFixed(2)}<span className="text-base font-normal text-muted-foreground"> / 5</span></>}
              sub="Mean of 9 ACMM elements · §51.3" accent={maturityBand(d.kpis.acmm_mean, 5)} icon={<ShieldCheck />} explain={d.explain.acmm_mean} />
            <KpiCard label="Avg capability maturity" value={<>{d.kpis.avg_cap_maturity.toFixed(2)}<span className="text-base font-normal text-muted-foreground"> / 5</span></>}
              sub={`${d.counts.capabilities} L2 capabilities · Phase B`} accent={maturityBand(d.kpis.avg_cap_maturity, 5)} icon={<Layers />} explain={d.explain.avg_cap_maturity} />
            <KpiCard label="Data governance score" value={<>{d.kpis.data_avg}<span className="text-base font-normal text-muted-foreground"> / 100</span></>}
              sub="Average across 10 data domains" accent={maturityBand(d.kpis.data_avg, 100)} icon={<Gauge />} explain={d.explain.data_avg} />
            <KpiCard label="Roadmap investment" value={fmtCr(d.kpis.total_cr)} sub={`${d.counts.initiatives} initiatives · FY27–FY30 · indicative`}
              accent={NAVY} icon={<IndianRupee />} explain={d.explain.total_cr} />
          </KpiRow>

          <div id="sec-adm" className="grid scroll-mt-4 grid-cols-12 gap-4">
            <Card className="col-span-5 gap-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">ADM Cycle <Explain x={d.explain.adm} /></CardTitle>
                <CardDescription>Assessment status by phase. Select a phase to open its view.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2">
                <div className="h-[392px] w-[370px]"><AdmWheel nodes={d.adm} onSelect={(s) => nav(SCREENS.find((x) => x.key === s)!.path)} /></div>
                <AdmLegend />
              </CardContent>
            </Card>

            <div className="col-span-7 grid grid-rows-[auto_1fr] gap-4">
              <div className="grid grid-cols-7 gap-4">
                <Card className="col-span-3 gap-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-1.5">Application Dispositions <Explain x={d.explain.dispositions} /></CardTitle>
                    <CardDescription>Fit quadrant + rules · §28.2</CardDescription>
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

                <Card className="col-span-4 gap-1">
                  <CardHeader>
                    <CardTitle>Top Priority Gaps</CardTitle>
                    <CardDescription>Impact × urgency · {d.counts.gaps} gaps in register</CardDescription>
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
                </CardHeader>
                <CardContent className="grid grid-cols-4 gap-3">
                  {d.waves.map((w, i) => (
                    <button key={w.id} onClick={() => nav('/roadmap')} className="flex flex-col rounded-lg border p-3 text-left transition-colors hover:bg-muted/40">
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
                            <span className="mt-[5px] size-1.5 shrink-0 rounded-full" style={{ background: bandColor(x.priority >= 20 ? 'critical' : 'developing') }} />
                            <span className="line-clamp-2">{x.name}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

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

          <FindingsCard screen="overview" />
        </>
      )}
    </>
  )
}

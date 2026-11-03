import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { InsightsCard } from '@/components/InsightsCard'
import { PageHeader } from '@/components/PageHeader'
import { PhasePlan } from '@/components/PhasePlan'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { StepBar } from '@/components/StepBar'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, type Budget as BudgetT, type BudgetInputs, type BudgetLine } from '@/lib/api'
import { useView } from '@/lib/screens'
import { BAND, COST_COLOR, GRID, NAVY, SLATE, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

const STEPS = [
  { key: 'inputs', n: 1, label: 'Cost Inputs', sub: 'Overall · capex · opex · business factors' },
  { key: 'analysis', n: 2, label: 'Cost Analysis', sub: 'Mix · intensity · growth · affordability' },
]
const NONE = '__none'
const num = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '–' : v.toLocaleString('en-IN', { maximumFractionDigits: d }))
const newId = (prefix: string, rows: BudgetLine[]) => `${prefix}${String(Math.max(0, ...rows.map((r) => parseInt(r.id.replace(/\D/g, '')) || 0)) + 1).padStart(2, '0')}`

type Section = 'overall' | 'capex' | 'opex' | 'factors'

/** One cost table in the client's template layout: navy title bar, INR (Cr) header, one column per financial year. */
function CostTable({ title, section, b, setB, extra, fixedRows, totals, unit = 'INR (Cr)' }: {
  title: string; section: Section; b: BudgetInputs; setB: (x: BudgetInputs) => void
  extra?: { label: string; options: { id: string; name: string }[]; key: 'theme' | 'kind' }
  fixedRows?: boolean; totals?: (number | null)[]; unit?: string
}) {
  const rows = b[section]
  const box = useRef<HTMLDivElement>(null)
  const set = (i: number, patch: Partial<BudgetLine>) => setB({ ...b, [section]: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const setVal = (i: number, k: number, v: string) => set(i, { values: rows[i].values.map((x, j) => (j === k ? (v === '' ? null : Number(v)) : x)) })
  const prefix = section === 'capex' ? 'CX' : section === 'opex' ? 'OX' : 'F'
  const cols = `minmax(140px,1fr) ${extra ? '128px ' : ''}repeat(${b.fys.length}, 62px)${fixedRows ? '' : ' 26px'}`
  const sum = (k: number) => rows.reduce((s, r) => s + (typeof r.values[k] === 'number' ? (r.values[k] as number) : 0), 0)
  return (
    <div ref={box} className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center justify-between px-2.5 py-1 text-[12.5px] font-semibold text-white" style={{ background: NAVY }}>
        {title}
        <span className="flex items-center gap-1" data-export-ignore>
          <ExportMenu target={box} name={title} size="xs" csv={() => [[unit, ...(extra ? [extra.label] : []), ...b.fys], ...rows.map((r) => [r.name, ...(extra ? [extra.options.find((o) => o.id === r[extra.key])?.name ?? ''] : []), ...r.values.map((v) => v ?? '')])]} className="h-6 border-white/40 bg-transparent text-white hover:bg-white/15 hover:text-white" />
        </span>
      </div>
      <div className="grid border-b text-[11px] font-semibold" style={{ gridTemplateColumns: cols }}>
        <span className="px-2 py-1">{unit}</span>
        {extra && <span className="px-1 py-1 text-muted-foreground">{extra.label}</span>}
        {b.fys.map((fy) => <span key={fy} className="py-1 pr-2 text-right">{fy}</span>)}
        {!fixedRows && <span />}
      </div>
      {rows.map((r, i) => (
        <div key={r.id} className="group grid items-center border-b last:border-0" style={{ gridTemplateColumns: cols }}>
          {fixedRows ? <span className="px-2 py-1 text-[12px]">{r.name}</span>
            : <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} className="h-7 min-w-0 bg-transparent px-2 text-[12px] outline-none focus:bg-navy-soft/40" />}
          {extra && (
            <Select value={(r[extra.key] as string | null) ?? NONE} onValueChange={(v) => set(i, { [extra.key]: v === NONE ? null : v })}>
              <SelectTrigger size="sm" className="h-6 w-full rounded-none border-0 border-l px-1 text-[11px] shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72"><SelectItem value={NONE}>—</SelectItem>{extra.options.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {b.fys.map((_, k) => (
            <input key={k} type="number" min={0} step="any" value={r.values[k] ?? ''} onChange={(e) => setVal(i, k, e.target.value)}
              className="tabular h-7 min-w-0 border-l bg-transparent pr-2 text-right text-[12px] outline-none focus:bg-navy-soft/40" />
          ))}
          {!fixedRows && <button data-export-ignore onClick={() => setB({ ...b, [section]: rows.filter((_, j) => j !== i) })} title="Remove row"
            className="flex justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"><Trash2 className="size-3.5" /></button>}
        </div>
      ))}
      {totals && (
        <div className="grid border-t bg-muted/40 text-[11.5px] font-semibold" style={{ gridTemplateColumns: cols }}>
          <span className="px-2 py-1">Total of lines</span>
          {extra && <span />}
          {b.fys.map((_, k) => {
            const t = sum(k), o = totals[k]
            const off = o !== null && o !== undefined && o > 0 && Math.abs(t - o) / o > 0.05
            return <span key={k} className="tabular py-1 pr-2 text-right" style={off ? { color: BAND.critical } : undefined} title={off ? `Overall row says ${o}` : undefined}>{num(t)}</span>
          })}
          {!fixedRows && <span />}
        </div>
      )}
      {!fixedRows && (
        <button data-export-ignore onClick={() => setB({ ...b, [section]: [...rows, { id: newId(prefix, rows), name: 'New line', values: b.fys.map(() => null), ...(section === 'opex' ? { kind: 'other' } : {}) }] })}
          className="flex w-full items-center gap-1 px-2 py-1 text-[11.5px] font-medium text-navy hover:bg-muted/50"><Plus className="size-3.5" /> Add line</button>
      )}
    </div>
  )
}

function Inputs({ d, b, setB }: { d: BudgetT; b: BudgetInputs; setB: (x: BudgetInputs) => void }) {
  const overall = (id: string) => b.overall.find((r) => r.id === id)?.values ?? []
  const renameFy = (i: number, v: string) => setB({ ...b, fys: b.fys.map((f, j) => (j === i ? v : f)) })
  const addFy = () => {
    const last = b.fys[b.fys.length - 1] ?? 'FY27P'
    const n = parseInt(last.replace(/\D/g, '')) + 1
    const pad = (rows: BudgetLine[]) => rows.map((r) => ({ ...r, values: [...r.values, null] }))
    setB({ fys: [...b.fys, `FY${n}P`], overall: pad(b.overall), capex: pad(b.capex), opex: pad(b.opex), factors: pad(b.factors) })
  }
  const dropFy = (i: number) => {
    const cut = (rows: BudgetLine[]) => rows.map((r) => ({ ...r, values: r.values.filter((_, j) => j !== i) }))
    setB({ fys: b.fys.filter((_, j) => j !== i), overall: cut(b.overall), capex: cut(b.capex), opex: cut(b.opex), factors: cut(b.factors) })
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-[12px]">
        <span className="font-semibold">Financial years</span>
        {b.fys.map((fy, i) => (
          <span key={i} className="flex items-center rounded-md border bg-card">
            <input value={fy} onChange={(e) => renameFy(i, e.target.value)} className="h-7 w-16 bg-transparent px-1.5 text-center text-[12px] outline-none" />
            {b.fys.length > 2 && <button onClick={() => dropFy(i)} title="Remove year" className="px-1 text-muted-foreground hover:text-destructive"><X className="size-3" /></button>}
          </span>
        ))}
        <Button size="xs" variant="outline" onClick={addFy}><Plus /> Year</Button>
        <span className="text-muted-foreground">Suffix A = actual, P = projected. Values in INR crore; leave blank if unknown.</span>
      </div>
      <div className="grid grid-cols-2 items-start gap-4">
        <div className="space-y-4">
          <CostTable title="Overall IT Costs" section="overall" b={b} setB={setB} fixedRows />
          <CostTable title="IT Capex" section="capex" b={b} setB={setB} totals={overall('capex')}
            extra={{ label: 'Roadmap initiative', key: 'theme', options: d.themes }} />
        </div>
        <div className="space-y-4">
          <CostTable title="IT Opex" section="opex" b={b} setB={setB} totals={overall('opex')}
            extra={{ label: 'Cost type', key: 'kind', options: d.kinds.map((k) => ({ id: k, name: k[0].toUpperCase() + k.slice(1) })) }} />
          <CostTable title="Business Factors" section="factors" b={b} setB={setB} unit="Factor" />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{d.note} Line totals turn red when they differ from the overall row by more than 5%. Tagging a capex line to a roadmap initiative lets the roadmap test affordability.</p>
    </div>
  )
}

function Analysis({ d }: { d: BudgetT }) {
  const a = d.analysis
  const lt = a.latest
  const [lo, hi] = a.benchmark
  const chart = useRef<HTMLDivElement>(null)
  const ratios = useRef<HTMLDivElement>(null)
  const rows = a.per_fy.map((x) => ({ fy: x.fy, opex: x.opex ?? 0, salaries: x.salaries ?? 0, capex: x.capex ?? 0, total: x.total ?? 0 }))
  const kpi = 'text-[10px] font-semibold tracking-wide text-muted-foreground uppercase'
  const pctCol = lt.pct_revenue === null ? SLATE : lt.pct_revenue < lo ? BAND.developing : lt.pct_revenue > hi ? BAND.weak : BAND.strong
  const R: [string, (x: (typeof a.per_fy)[number]) => string][] = [
    ['Total IT spend (₹ Cr)', (x) => num(x.total)], ['Growth YoY', (x) => (x.total_yoy !== undefined && x.total_yoy !== null ? `${x.total_yoy}%` : '–')],
    ['IT spend % of revenue', (x) => (x.pct_revenue !== null ? `${x.pct_revenue}%` : '–')], ['Run share (opex + salaries)', (x) => (x.run_share !== null ? `${x.run_share}%` : '–')],
    ['Change share (capex)', (x) => (x.change_share !== null ? `${x.change_share}%` : '–')], ['Salaries share', (x) => (x.salary_share !== null ? `${x.salary_share}%` : '–')],
    ['IT cost per employee (₹ lakh)', (x) => num(x.per_employee_lakh, 2)], ['IT cost per end user (₹ lakh)', (x) => num(x.per_user_lakh, 2)],
    ['Cloud share of opex', (x) => (x.cloud_share_opex !== null ? `${x.cloud_share_opex}%` : '–')],
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 px-3 py-2"><div><div className={kpi}>{lt.fy} IT Spend</div><div className="tabular text-[18px] font-semibold">₹{num(lt.total)} Cr</div></div><Explain x={a.explain} /></div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2"><div className={kpi}>% of Revenue</div><div className="tabular text-[18px] font-semibold" style={{ color: pctCol }}>{lt.pct_revenue ?? '–'}%<span className="text-[11px] font-normal text-muted-foreground"> · benchmark {lo}–{hi}%</span></div></div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2"><div className={kpi}>Run vs Change</div><div className="tabular text-[18px] font-semibold">{lt.run_share ?? '–'}% / {lt.change_share ?? '–'}%</div></div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2"><div className={kpi}>Growth (CAGR)</div><div className="tabular text-[18px] font-semibold">{a.cagr ?? '–'}%<span className="text-[11px] font-normal text-muted-foreground"> · {a.per_fy[0]?.fy}–{a.per_fy[a.per_fy.length - 1]?.fy}</span></div></div>
      </div>
      <div className="grid grid-cols-12 gap-4">
        <div ref={chart} className="col-span-7 rounded-lg border bg-card p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-[12.5px] font-semibold">IT Spend by Financial Year <span className="font-normal text-muted-foreground">· ₹ Cr</span></div>
            <ExportMenu target={chart} name="IT Spend by FY" size="xs" csv={() => [['FY', 'Opex', 'Salaries', 'Capex', 'Total'], ...rows.map((r) => [r.fy, r.opex, r.salaries, r.capex, r.total])]} />
          </div>
          <ChartContainer config={{ opex: { label: 'IT Opex', color: COST_COLOR.opex }, salaries: { label: 'IT Salaries', color: COST_COLOR.salaries }, capex: { label: 'IT Capex', color: COST_COLOR.capex } }} className="h-[280px] w-full">
            <BarChart data={rows} margin={{ top: 20, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="fy" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="opex" stackId="a" fill={COST_COLOR.opex} />
              <Bar dataKey="salaries" stackId="a" fill={COST_COLOR.salaries} />
              <Bar dataKey="capex" stackId="a" fill={COST_COLOR.capex} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="total" position="top" fontSize={11} fontWeight={600} fill={NAVY} />
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">{Object.entries({ 'IT Opex': COST_COLOR.opex, 'IT Salaries': COST_COLOR.salaries, 'IT Capex': COST_COLOR.capex }).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: c }} />{k}</span>)}</div>
        </div>
        <div className="col-span-5 rounded-lg border p-3">
          <div className="mb-2 text-[12.5px] font-semibold">Largest Opex Heads <span className="font-normal text-muted-foreground">· latest year · growth over the period</span></div>
          <div className="space-y-1.5">
            {a.heads.map((h) => (
              <div key={h.id} className="grid grid-cols-[minmax(0,1fr)_90px_88px] items-center gap-2 text-[12px]">
                <span className="truncate" title={h.name}>{h.name}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-navy" style={{ width: `${Math.min(100, ((h.latest ?? 0) / Math.max(1, a.heads[0]?.latest ?? 1)) * 100)}%` }} /></span>
                <span className="tabular text-right font-semibold whitespace-nowrap">{num(h.latest)} <span className="font-normal" style={{ color: (h.growth ?? 0) > 50 ? BAND.weak : SLATE }}>{h.growth !== null ? `${h.growth > 0 ? '+' : ''}${h.growth}%` : ''}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div ref={ratios} className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-[12.5px] font-semibold">Ratios by Year <span className="font-normal text-muted-foreground">· computed from the inputs</span></div>
          <ExportMenu target={ratios} name="IT Cost Ratios" size="xs" csv={() => [['Measure', ...a.per_fy.map((x) => x.fy)], ...R.map(([l, f]) => [l, ...a.per_fy.map(f)])]} />
        </div>
        <table className="w-full text-[12px]">
          <thead><tr className="border-b bg-muted/40 text-[11px]"><th className="px-3 py-1.5 text-left font-semibold">Measure</th>{a.per_fy.map((x) => <th key={x.fy} className="px-3 py-1.5 text-right font-semibold">{x.fy}</th>)}</tr></thead>
          <tbody>{R.map(([l, f]) => <tr key={l} className="border-b last:border-0"><td className="px-3 py-1.5">{l}</td>{a.per_fy.map((x) => <td key={x.fy} className="tabular px-3 py-1.5 text-right">{f(x)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-3">
          <div className="mb-2 text-[12.5px] font-semibold">Roadmap Affordability <span className="font-normal text-muted-foreground">· roadmap investment against planned IT capex</span></div>
          {a.afford.length ? (
            <table className="w-full text-[12px]">
              <thead><tr className="text-[11px] text-muted-foreground"><th className="py-1 text-left font-medium">Year</th><th className="py-1 text-right font-medium">IT capex</th><th className="py-1 text-right font-medium">Roadmap (low–high)</th><th className="py-1 text-right font-medium">Share of capex</th></tr></thead>
              <tbody>{a.afford.map((x) => <tr key={x.fy} className="border-t"><td className="py-1.5">{x.fy}</td><td className="tabular py-1.5 text-right">₹{num(x.capex)} Cr</td><td className="tabular py-1.5 text-right">₹{num(x.roadmap[0])}–{num(x.roadmap[1])} Cr</td><td className="tabular py-1.5 text-right font-semibold" style={{ color: (x.share[1] ?? 0) > 100 ? BAND.critical : NAVY }}>{x.share[0]}–{x.share[1]}%</td></tr>)}</tbody>
            </table>
          ) : <p className="text-[12px] text-muted-foreground">No financial year overlaps the roadmap's FY budget. Add projected years to test affordability.</p>}
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-2 text-[12.5px] font-semibold">Reconciliation</div>
          {a.recon.length ? <ul className="space-y-1 text-[12px]">{a.recon.map((r) => <li key={r} className="flex gap-1.5" style={{ color: BAND.critical }}><span className="mt-[7px] size-1 shrink-0 rounded-full bg-current" />{r}</li>)}</ul>
            : <p className="text-[12px]" style={{ color: BAND.strong }}>Capex lines and opex heads add up to the overall rows within 5% for every year.</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">Every other screen's insights and AI prompts use these figures: application support spend on Applications, cloud and infrastructure spend on Data & Technology, and affordability on the Roadmap.</p>
        </div>
      </div>
    </div>
  )
}

export default function Budget() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['budget'], queryFn: api.budget })
  const [view, setView] = useView('inputs', ['inputs', 'analysis'])
  const d = q.data
  const [b, setB] = useState<BudgetInputs | null>(null)
  useEffect(() => { if (d) setB(d.inputs) }, [d])
  const dirty = useMemo(() => !!d && !!b && JSON.stringify(b) !== JSON.stringify(d.inputs), [b, d])
  const after = (x: BudgetT, msg: string) => {
    qc.setQueryData(['budget'], x)
    ;['overview', 'roadmap', 'applications', 'data_tech'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    toast.success(msg)
  }
  const save = useMutation({ mutationFn: () => api.putBudget(b!), onSuccess: (x) => after(x, 'IT budget saved; ratios and insights recomputed'), onError: (e: Error) => toast.error(e.message) })
  const reset = useMutation({ mutationFn: api.resetBudget, onSuccess: (x) => after(x, 'Restored the baseline') })
  return (
    <>
      <PageHeader screen="budget" actions={
        <>
          <Button size="sm" variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending}><RotateCcw /> Restore Baseline</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}><Save /> Save Inputs</Button>
        </>
      } />
      {q.error ? <ScreenError error={q.error} /> : !d || !b ? <ScreenSkeleton /> : (
        <>
          <PhasePlan p={d.plan} />
          <StepBar steps={STEPS} active={view} onPick={setView} />
          <Card className="gap-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">{view === 'inputs' ? 'Step 1 · Cost Inputs' : 'Step 2 · Cost Analysis'}
                {dirty && <span className="rounded-full px-2 py-px text-[10.5px] font-semibold" style={{ color: BAND.developing, background: tint(BAND.developing, 0.12) }}>Unsaved changes</span>}</CardTitle>
              <CardDescription>{view === 'inputs'
                ? 'The IT cost baseline in the client template: overall IT costs, IT capex by initiative and IT opex by cost head for actual and projected years, plus the business factors used for intensity ratios. Edit any cell, add or remove lines and years, then save.'
                : 'Run vs change mix, spend intensity against revenue, headcount and users, growth by cost head, and whether the roadmap fits the planned capex. All figures are computed by rules from the inputs.'}</CardDescription>
              <CardAction>{view === 'inputs'
                ? <AiAction label="Extract from Files with AI" what="Cost inputs" from="uploaded budget files and the finance cost-centre extract" />
                : <AiAction what="Cost commentary" from="the computed ratios, benchmarks and roadmap affordability" />}</CardAction>
            </CardHeader>
            <CardContent className={cn('space-y-4')}>
              {view === 'inputs' ? <Inputs d={d} b={b} setB={setB} /> : <Analysis d={d} />}
              <InsightsCard key={view} screen="budget" tab={view} items={d.insights[view] ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}

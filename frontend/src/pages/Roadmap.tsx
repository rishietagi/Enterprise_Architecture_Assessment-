import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ChevronDown, Download, Gavel, Link2, Loader2, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceArea, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from 'recharts'
import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { CiteMarks } from '@/components/CitationChip'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { AiModeBadge } from '@/components/FindingsCard'
import { InsightsCard } from '@/components/InsightsCard'
import { PageHeader } from '@/components/PageHeader'
import { PhasePlan } from '@/components/PhasePlan'
import { PriorityPill } from '@/components/PriorityPill'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { StepBar } from '@/components/StepBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api, exportUrl, fmtCr, type Briefs, type DecisionT, type Initiative, type InitiativeRow, type Repository, type Roadmap as RoadmapT } from '@/lib/api'
import { useView } from '@/lib/screens'
import { BAND, GRID, NAVY, SLATE, WAVE_COLOR, WHITE, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

const SIZE_COLOR: Record<Initiative['size'], string> = { S: BAND.strong, M: NAVY, L: BAND.developing, XL: BAND.weak }
const ACMM_SHORT: Record<string, string> = {
  G1: 'Process', G2: 'Development', G3: 'Business linkage', G4: 'Senior mgmt', G5: 'Unit participation',
  G6: 'Communication', G7: 'IT security', G8: 'Governance', G9: 'IT investment',
}

function InitiativeCard({ i, color, brief, briefs }: { i: Initiative; color: string; brief?: Briefs['briefs'][string]; briefs?: Briefs }) {
  return (
    <div className="rounded-lg border bg-card p-2.5 shadow-xs" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold text-muted-foreground">{i.id}</div>
          <div className="text-[13px] leading-snug font-semibold">{i.name}</div>
        </div>
        <span className="flex shrink-0 items-center gap-1"><Explain x={i.explain} /><span className="rounded px-1.5 py-px text-[10.5px] font-bold" style={{ color: SIZE_COLOR[i.size], background: tint(SIZE_COLOR[i.size]) }}>{i.size}</span></span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="tabular font-semibold text-foreground">{fmtCr(i.cost_cr)}</span>
        <span>·</span><span>{i.gaps} gaps</span><span>·</span><span>P{i.priority}</span>
      </div>
      {i.depends_on.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
          <Link2 className="size-3" /> after {i.depends_on.map((d) => <span key={d} className="rounded bg-muted px-1 font-semibold">{d}</span>)}
        </div>
      )}
      {brief && (
        <div className="mt-2 border-t pt-2 text-[11.5px] leading-snug">
          <p>{brief.summary}{briefs && <CiteMarks cites={brief.cites} citations={briefs.citations} />}</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {brief.outcomes.map((o, k) => <li key={k} className="flex gap-1"><ArrowRight className="mt-0.5 size-3 shrink-0" />{o}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function Swimlane({ r }: { r: RoadmapT }) {
  const briefs = useQuery({ queryKey: ['briefs'], queryFn: api.briefs, enabled: false, staleTime: Infinity })
  const box = useRef<HTMLDivElement>(null)
  const run = async () => {
    const res = await briefs.refetch()
    if (res.error) toast.error(res.error.message)
    else if (res.data?.mode === 'fallback') toast.info('No Gemini key: briefs are assembled from each initiative’s gaps')
  }
  return (
    <Card ref={box} className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Transition Waves {briefs.data && <AiModeBadge meta={briefs.data} />}</CardTitle>
        <CardDescription>Wave by rule (size, priority, foundation), pushed after dependencies · §28, §36.2.14. Start {r.start}.</CardDescription>
        <CardAction className="flex gap-2">
          <Button size="sm" variant="outline" onClick={run} disabled={briefs.isFetching} data-export-ignore>
            {briefs.isFetching ? <Loader2 className="animate-spin" /> : <Sparkles />} Write initiative briefs
          </Button>
          <ExportMenu target={box} name="Transition Waves" csv={() => [['Wave', 'Initiative', 'Name', 'Gaps', 'Size', 'Cost low (Cr)', 'Cost high (Cr)'],
            ...r.initiatives.map((i) => [r.waves[i.wave]?.id ?? '', i.id, i.name, i.gaps, i.size, i.cost_cr[0], i.cost_cr[1]])]} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-3">
        {r.waves.map((w, wi) => {
          const ins = r.initiatives.filter((i) => i.wave === wi)
          const cost: [number, number] = [ins.reduce((a, i) => a + i.cost_cr[0], 0), ins.reduce((a, i) => a + i.cost_cr[1], 0)]
          return (
            <div key={w.id} className="flex flex-col rounded-xl p-2.5" style={{ background: tint(WAVE_COLOR[wi], 0.06) }}>
              <div className="mb-2 px-0.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold" style={{ color: WAVE_COLOR[wi] }}>{w.id} · {w.name}</span>
                  <span className="tabular text-[11px] font-semibold text-muted-foreground">{fmtCr(cost)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{w.window} · {Object.keys(w.fy_split).join(', ')}</div>
              </div>
              <div className="space-y-2">
                {ins.map((i) => <InitiativeCard key={i.id} i={i} color={WAVE_COLOR[wi]} brief={briefs.data?.briefs[i.id]} briefs={briefs.data} />)}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function Budget({ r }: { r: RoadmapT }) {
  const qc = useQueryClient()
  const rows = Object.entries(r.fy_budget).map(([fy, [lo, hi]]) => ({ fy, lo: +lo.toFixed(1), range: +(hi - lo).toFixed(1), hi: +hi.toFixed(1) }))
  const [rc, setRc] = useState(r.rate_card)
  useEffect(() => setRc(r.rate_card), [r.rate_card])
  const save = useMutation({
    mutationFn: () => api.putRateCard(rc),
    onSuccess: (d) => {
      qc.setQueryData(['roadmap'], d)
      qc.invalidateQueries({ queryKey: ['overview'] })
      toast.success(`Budget recomputed: ${fmtCr(d.total_cr)}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const dirty = JSON.stringify(rc) !== JSON.stringify(r.rate_card)
  const box = useRef<HTMLDivElement>(null)
  return (
    <div className="grid grid-cols-12 gap-4">
      <Card ref={box} className="col-span-8 gap-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">Indicative Budget by Financial Year <Explain x={r.explain.fy_budget} /></CardTitle>
          <CardDescription>Low–high range from the rate card, split across FYs by wave. {r.rate_card_note}</CardDescription>
          <CardAction className="flex items-start gap-3 text-right">
            <div>
              <div className="tabular text-lg font-semibold text-navy">{fmtCr(r.total_cr)}</div>
              <div className="text-[11px] text-muted-foreground">total FY27–FY30</div>
            </div>
            <ExportMenu target={box} name="Budget by FY" csv={() => [['FY', 'Low (Cr)', 'High (Cr)'], ...rows.map((x) => [x.fy, x.lo, x.hi])]} />
          </CardAction>

        </CardHeader>
        <CardContent>
          <ChartContainer config={{ lo: { label: 'Low', color: NAVY }, range: { label: 'Range to high', color: tint(NAVY, 0.3) } }} className="h-[220px] w-full">
            <BarChart data={rows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="fy" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={56} unit=" Cr" fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v, n, item) => (n === 'range'
                ? <span>High <b>₹{(item.payload as { hi: number }).hi} Cr</b></span>
                : <span>Low <b>₹{String(v)} Cr</b></span>)} />} />
              <Bar dataKey="lo" stackId="a" fill="var(--color-lo)" radius={[0, 0, 4, 4]} barSize={56} />
              <Bar dataKey="range" stackId="a" fill="var(--color-range)" radius={[4, 4, 0, 0]} barSize={56}>
                <LabelList dataKey="hi" position="top" fontSize={11} fill={SLATE} formatter={(v: unknown) => `₹${v}`} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card className="col-span-4 gap-2">
        <CardHeader>
          <CardTitle>Rate Card</CardTitle>
          <CardDescription>₹ Cr one-time, by initiative size. Editable.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(rc) as (keyof RoadmapT['rate_card'])[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className="w-8 rounded px-1.5 py-0.5 text-center text-[11px] font-bold" style={{ color: SIZE_COLOR[s], background: tint(SIZE_COLOR[s]) }}>{s}</span>
              <Input type="number" step={0.5} value={rc[s][0]} className="tabular h-8 text-right" onChange={(e) => setRc({ ...rc, [s]: [Number(e.target.value), rc[s][1]] })} />
              <span className="text-muted-foreground">–</span>
              <Input type="number" step={0.5} value={rc[s][1]} className="tabular h-8 text-right" onChange={(e) => setRc({ ...rc, [s]: [rc[s][0], Number(e.target.value)] })} />
            </div>
          ))}
          <Button size="sm" className="mt-1 w-full" onClick={() => save.mutate()} disabled={!dirty || save.isPending}><Save /> Recompute budget</Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Acmm({ r }: { r: RoadmapT }) {
  const qc = useQueryClient()
  const [lv, setLv] = useState<Record<string, number>>({})
  useEffect(() => setLv(Object.fromEntries(r.acmm.map((a) => [a.id, a.level]))), [r.acmm])
  const put = useMutation({
    mutationFn: ({ id, level }: { id: string; level: number }) => api.putAcmm(id, level),
    onSuccess: (d) => {
      qc.setQueryData(['roadmap'], d)
      qc.invalidateQueries({ queryKey: ['overview'] })
    },
  })
  const data = r.acmm.map((a) => ({ name: ACMM_SHORT[a.id] ?? a.name, level: lv[a.id] ?? a.level, target: 3 }))
  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-5 gap-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">ACMM Profile <Explain x={r.explain.acmm_mean} /></CardTitle>
          <CardDescription>Architecture Capability Maturity · §51.3 · mean {r.acmm_mean.toFixed(2)} / 5</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ level: { label: 'Current', color: NAVY }, target: { label: 'Indicative target', color: BAND.strong } }} className="mx-auto h-[300px] w-full">
            <RadarChart data={data} outerRadius={92}>
              <PolarGrid />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 10.5, fill: SLATE }} />
              <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Radar dataKey="target" stroke="var(--color-target)" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
              <Radar dataKey="level" stroke="var(--color-level)" fill="var(--color-level)" fillOpacity={0.18} strokeWidth={2} dot={{ r: 3 }} />
            </RadarChart>
          </ChartContainer>
          <div className="flex justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-navy" /> Current</span>
            <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-[1.5px] border-dashed" style={{ borderColor: BAND.strong }} /> Level 3 reference</span>
          </div>
        </CardContent>
      </Card>
      <Card className="col-span-7 gap-1">
        <CardHeader>
          <CardTitle>Element Levels</CardTitle>
          <CardDescription>Level ≤ 1 raises a 4×4 gap, level 2 a 3×3 gap.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {r.acmm.map((a) => {
            const v = lv[a.id] ?? a.level
            return (
              <div key={a.id} className="flex items-center gap-3">
                <span className="w-56 truncate text-sm">{a.name}</span>
                <Slider min={0} max={5} step={1} value={[v]} className="flex-1"
                  onValueChange={([x]) => setLv((o) => ({ ...o, [a.id]: x }))} onValueCommit={([x]) => put.mutate({ id: a.id, level: x })} />
                <span className="tabular w-36 text-xs" style={{ color: v <= 1 ? BAND.critical : v === 2 ? BAND.developing : BAND.strong }}>{r.acmm_levels[v]}</span>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

type DecisionDraft = Omit<DecisionT, 'id' | 'source' | 'created'>
const EMPTY: DecisionDraft = { title: '', context: '', decision: '', principles: [], status: 'Proposed' }

function DecisionLog({ r }: { r: RoadmapT }) {
  const qc = useQueryClient()
  const [edit, setEdit] = useState<{ id: number | null; d: DecisionDraft } | null>(null)
  const done = (msg: string) => {
    qc.invalidateQueries({ queryKey: ['roadmap'] })
    qc.invalidateQueries({ queryKey: ['overview'] })
    toast.success(msg)
    setEdit(null)
  }
  const save = useMutation({
    mutationFn: () => (edit!.id ? api.putDecision(edit!.id, edit!.d) : api.addDecision(edit!.d)),
    onSuccess: () => done('Decision saved'),
    onError: (e: Error) => toast.error(e.message),
  })
  const del = useMutation({ mutationFn: api.deleteDecision, onSuccess: () => done('Decision removed') })
  const pname = Object.fromEntries(r.principles.map((p) => [p.id, p.name]))
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>Decision Log</CardTitle>
        <CardDescription>Architecture decisions with the principles they rely on · §47, §50</CardDescription>
        <CardAction><Button size="sm" onClick={() => setEdit({ id: null, d: { ...EMPTY } })}><Plus /> Add decision</Button></CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Decision</TableHead><TableHead>Principles</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {r.decisions.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="tabular text-muted-foreground">{d.id}</TableCell>
                <TableCell className="max-w-xl whitespace-normal">
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-muted-foreground">{d.decision}</div>
                </TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{d.principles.map((p) => <Badge key={p} variant="outline" className="text-[10px]" title={pname[p]}>{pname[p] ?? p}</Badge>)}</div></TableCell>
                <TableCell><Badge variant={d.status === 'Approved' ? 'default' : 'secondary'}>{d.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => setEdit({ id: d.id, d: { title: d.title, context: d.context, decision: d.decision, principles: d.principles, status: d.status } })}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => del.mutate(d.id)}><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{edit?.id ? 'Edit decision' : 'New decision'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Title</Label><Input value={edit.d.title} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, title: e.target.value } })} /></div>
              <div className="space-y-1"><Label>Context</Label><Textarea rows={2} value={edit.d.context} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, context: e.target.value } })} /></div>
              <div className="space-y-1"><Label>Decision</Label><Textarea rows={2} value={edit.d.decision} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, decision: e.target.value } })} /></div>
              <div className="space-y-1">
                <Label>Principles referenced (adopted only)</Label>
                <div className="grid max-h-36 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border p-2">
                  {r.principles.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs">
                      <Checkbox checked={edit.d.principles.includes(p.id)} onCheckedChange={(c) => setEdit({ ...edit, d: { ...edit.d, principles: c ? [...edit.d.principles, p.id] : edit.d.principles.filter((x) => x !== p.id) } })} />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={edit.d.status} onValueChange={(v) => setEdit({ ...edit, d: { ...edit.d, status: v } })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{['Proposed', 'Approved', 'Superseded', 'Rejected'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!edit?.d.title.trim() || save.isPending}>Save decision</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Charter({ r }: { r: RoadmapT }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-5 gap-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="size-4 text-navy" /> Architecture Review Board</CardTitle>
          <CardDescription>Charter · §47 · {r.arb.togaf_ref.map((x) => `§${x}`).join(' ')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2"><span className="w-20 text-xs font-medium text-muted-foreground">Chair</span>{r.arb.chair}</div>
          <div className="flex gap-2"><span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">Members</span><ul className="space-y-0.5">{r.arb.members.map((m) => <li key={m}>{m}</li>)}</ul></div>
          <div className="flex gap-2"><span className="w-20 text-xs font-medium text-muted-foreground">Cadence</span>{r.arb.cadence}</div>
        </CardContent>
      </Card>
      <Card className="col-span-4 gap-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gavel className="size-4 text-navy" /> Review checkpoints</CardTitle>
          <CardDescription>Implementation governance · Phase G</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {r.arb.checkpoints.map((c, i) => (
              <li key={c} className="flex items-center gap-2.5 text-sm">
                <span className="tabular flex size-6 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white">{i + 1}</span>{c}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card className="col-span-3 gap-2">
        <CardHeader>
          <CardTitle>Compliance Levels</CardTitle>
          <CardDescription>§{r.compliance_ref} architecture compliance</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {r.compliance_levels.map((c) => {
              const col = c === 'Non-conformant' ? BAND.critical : c === 'Irrelevant' ? SLATE : c.includes('Fully') ? BAND.strong : NAVY
              return <li key={c} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: col }} />{c}</li>
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

const STEPS = [
  { key: 'longlist', n: 1, label: 'Initiative Long List', sub: 'Gaps addressed · cost · benefits · risks' },
  { key: 'priority', n: 2, label: 'Prioritisation', sub: 'Value × effort · ranked list' },
  { key: 'roadmap', n: 3, label: 'Roadmap', sub: 'Waves · timeline · cost · affordability' },
  { key: 'governance', n: 4, label: 'EA Governance', sub: 'ACMM · ARB · decisions · repository' },
]
const STEP_CARD: Record<string, { title: string; desc: string }> = {
  longlist: { title: 'Step 1 · Initiative Long List', desc: 'Every gap from Business, Applications, Data & Technology and governance, grouped into initiatives (TOGAF §27, §32). Each row shows the gaps it closes, size, indicative cost, wave, dependencies, the IT capex already planned for it, and its benefits, risks and constraints. Select a row to see its gaps; edit to change benefits, risks and constraints.' },
  priority: { title: 'Step 2 · Prioritisation', desc: 'Value (highest gap priority, impact × urgency) against effort (size). Quick wins are high value and low effort; strategic bets are high value and high effort. The rank orders quadrants, then value per unit of effort (§28.4).' },
  roadmap: { title: 'Step 3 · Roadmap', desc: 'Initiatives sequenced into four waves by rule (size, priority, foundation) and pushed after their dependencies, then laid out by financial year with indicative cost and tested against the IT capex plan (§28, §36.2.14).' },
  governance: { title: 'Step 4 · EA Governance', desc: 'Architecture capability maturity (ACMM §51.3), the Architecture Review Board and its checkpoints, compliance levels, the decision log, and who owns and maintains each part of the architecture repository after the engagement.' },
}
const QUAD_COLOR: Record<string, string> = { quick_win: BAND.strong, strategic: NAVY, fill_in: SLATE, reconsider: BAND.weak }
const LEGACY: Record<string, string> = { gaps: 'longlist', budget: 'roadmap' }

function Lines({ items, color, empty = '–' }: { items: string[]; color?: string; empty?: string }) {
  if (!items.length) return <span className="text-muted-foreground">{empty}</span>
  return <ul className="space-y-0.5">{items.map((x) => <li key={x} className="flex gap-1.5"><span className="mt-[6px] size-1 shrink-0 rounded-full" style={{ background: color ?? NAVY }} />{x}</li>)}</ul>
}

function NotesDialog({ i, onClose }: { i: InitiativeRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ benefits: '', risks: '', constraints: '', owner: '', kpis: '' })
  useEffect(() => { if (i) setF({ benefits: i.benefits.join('\n'), risks: i.risks.join('\n'), constraints: i.constraints.join('\n'), owner: i.owner, kpis: i.kpis }) }, [i])
  const done = (d: RoadmapT, msg: string) => { qc.setQueryData(['roadmap'], d); toast.success(msg); onClose() }
  const split = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
  const save = useMutation({ mutationFn: () => api.putInitiative(i!.id, { benefits: split(f.benefits), risks: split(f.risks), constraints: split(f.constraints), owner: f.owner, kpis: f.kpis }),
    onSuccess: (d) => done(d, 'Initiative updated'), onError: (e: Error) => toast.error(e.message) })
  const reset = useMutation({ mutationFn: () => api.resetInitiative(i!.id), onSuccess: (d) => done(d, 'Restored the default benefits, risks and constraints') })
  const area = (k: 'benefits' | 'risks' | 'constraints', label: string) => (
    <div className="space-y-1"><Label>{label} <span className="font-normal text-muted-foreground">(one per line)</span></Label><Textarea rows={3} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="text-[13px]" /></div>
  )
  return (
    <Dialog open={!!i} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{i?.id} · {i?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {area('benefits', 'Expected benefits')}
          {area('risks', 'Key risks')}
          {area('constraints', 'Constraints and dependencies')}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Accountable owner</Label><Input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} placeholder="e.g. Head of Digital" /></div>
            <div className="space-y-1"><Label>Success measures</Label><Input value={f.kpis} onChange={(e) => setF({ ...f, kpis: e.target.value })} placeholder="e.g. 60% interfaces via API by FY29" /></div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => reset.mutate()} disabled={i?.notes_source !== 'client'}><RotateCcw /> Restore default</Button>
          <span className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LongList({ r }: { r: RoadmapT }) {
  const [open, setOpen] = useState<string | null>(null)
  const [edit, setEdit] = useState<InitiativeRow | null>(null)
  const [wave, setWave] = useState('all')
  const box = useRef<HTMLDivElement>(null)
  const rows = r.long_list.filter((i) => wave === 'all' || i.wave_id === wave)
  const csv = () => [['ID', 'Initiative', 'Gaps', 'Gap IDs', 'Top priority', 'Size', 'Cost low (Cr)', 'Cost high (Cr)', 'Wave', 'Depends on', 'Planned IT capex (Cr)', 'Quadrant', 'Benefits', 'Risks', 'Constraints', 'Owner'],
    ...r.long_list.map((i) => [i.id, i.name, i.gaps, i.gap_list.map((g) => g.id).join('; '), i.priority, i.size, i.cost_cr[0], i.cost_cr[1], i.wave_id, i.depends_on.join('; '), i.budget_capex, i.prio.label, i.benefits.join('; '), i.risks.join('; '), i.constraints.join('; '), i.owner])]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={wave} onValueChange={setWave}>
          <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All waves</SelectItem>{r.waves.map((w) => <SelectItem key={w.id} value={w.id}>{w.id} · {w.name}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[11.5px] text-muted-foreground">{r.kpis.gaps} gaps → {r.long_list.length} initiatives · {fmtCr(r.kpis.total_cr)} indicative <Explain x={r.explain.initiatives} /></span>
        <span className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" asChild><a href={exportUrl('roadmap')}><Download /> Gap register (.xlsx)</a></Button>
          <AiAction what="Initiative benefits, risks and KPIs" from="the gaps each initiative closes and the IT budget" />
          <ExportMenu target={box} name="Initiative Long List" csv={csv} />
        </span>
      </div>
      <div ref={box} className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" /><TableHead className="w-12">ID</TableHead><TableHead>Initiative</TableHead><TableHead className="text-right">Gaps</TableHead>
              <TableHead>Top Priority</TableHead><TableHead>Size</TableHead><TableHead className="text-right">Cost (₹ Cr)</TableHead><TableHead>Wave</TableHead>
              <TableHead>Depends On</TableHead><TableHead className="text-right">IT Capex Plan</TableHead><TableHead>Benefits</TableHead><TableHead>Risks</TableHead><TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((i) => (
              <Fragment key={i.id}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === i.id ? null : i.id)}>
                  <TableCell><ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open === i.id && 'rotate-180')} /></TableCell>
                  <TableCell className="text-xs font-semibold text-muted-foreground">{i.id}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal"><div className="font-medium">{i.name}</div><div className="text-[10.5px] text-muted-foreground">{i.prio.label}{i.foundation ? ' · foundation' : ''}</div>
                    {i.by_register && <div className="text-[10.5px] text-muted-foreground">{Object.entries(i.by_register).map(([k, v]) => `${k.replace(' Architecture', '')} ${v}`).join(' · ')}</div>}</TableCell>
                  <TableCell className="tabular text-right font-semibold">{i.gaps}</TableCell>
                  <TableCell><PriorityPill p={i.priority} /></TableCell>
                  <TableCell><span className="rounded px-1.5 py-px text-[10.5px] font-bold" style={{ color: SIZE_COLOR[i.size], background: tint(SIZE_COLOR[i.size]) }}>{i.size}</span></TableCell>
                  <TableCell className="tabular text-right">{i.cost_cr[0]}–{i.cost_cr[1]}</TableCell>
                  <TableCell><span className="inline-flex items-center gap-1"><Explain x={i.explain} /><span className="text-[11px] font-semibold" style={{ color: WAVE_COLOR[i.wave] }}>{i.wave_id}</span></span></TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{i.depends_on.join(', ') || '–'}</TableCell>
                  <TableCell className="tabular text-right text-[12px]">{i.budget_capex ? `₹${i.budget_capex} Cr` : <span className="text-muted-foreground">none</span>}</TableCell>
                  <TableCell className="max-w-52 text-[11.5px] whitespace-normal"><span className="line-clamp-2">{i.benefits.join('; ') || '–'}</span></TableCell>
                  <TableCell className="max-w-44 text-[11.5px] whitespace-normal"><span className="line-clamp-2">{i.risks.join('; ') || '–'}</span></TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                    <span className="inline-flex items-center gap-1"><Button variant="ghost" size="icon-sm" onClick={() => setEdit(i)} aria-label="Edit initiative"><Pencil /></Button></span>
                  </TableCell>
                </TableRow>
                {open === i.id && (
                  <TableRow className="bg-muted/25 hover:bg-muted/25">
                    <TableCell />
                    <TableCell colSpan={12} className="whitespace-normal">
                      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 py-1">
                        <div>
                          <div className="mb-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Gaps Addressed ({i.gap_list.length})</div>
                          <div className="scrollbar-thin max-h-72 overflow-y-auto"><table className="w-full text-[12px]"><tbody>
                            {i.gap_list.map((g) => (
                              <tr key={g.id} className="border-t first:border-0">
                                <td className="w-12 py-1"><PriorityPill p={g.priority} /></td>
                                <td className="py-1"><span className="mr-1.5 text-[10.5px] font-semibold text-muted-foreground">{g.id}</span>{g.title}</td>
                                <td className="py-1 pl-2 text-right text-[11px] whitespace-nowrap text-muted-foreground">{g.register}{g.severity ? ` · ${g.severity}` : ''}</td>
                              </tr>
                            ))}
                          </tbody></table></div>
                        </div>
                        <div className="space-y-2 text-[12px]">
                          <div><div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Expected Benefits</div><Lines items={i.benefits} color={BAND.strong} /></div>
                          <div><div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Key Risks</div><Lines items={i.risks} color={BAND.weak} /></div>
                          <div><div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Constraints</div><Lines items={i.constraints} color={SLATE} /></div>
                          {(i.owner || i.kpis) && <div className="text-[11.5px] text-muted-foreground">{i.owner && <>Owner: <b className="text-foreground">{i.owner}</b> · </>}{i.kpis && <>Measures: {i.kpis}</>}</div>}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <NotesDialog i={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

function Prioritisation({ r }: { r: RoadmapT }) {
  const box = useRef<HTMLDivElement>(null)
  const c = r.prio_cfg
  const pts = r.long_list.map((i) => ({ id: i.id, name: i.name, x: i.prio.effort, y: i.prio.value, z: i.gaps, q: i.prio.quadrant, label: i.prio.label }))
  const seen: Record<string, number> = {}
  // initiatives sharing a value and size are stacked downward so bubbles and labels stay readable
  for (const p of pts) { const k = `${p.x}-${p.y}`; const n = (seen[k] = (seen[k] ?? 0) + 1) - 1; p.y -= n * 1.8 }
  const maxV = Math.max(25, ...r.long_list.map((i) => i.prio.value)) + 4
  const ranked = [...r.long_list].sort((a, b) => a.prio.rank - b.prio.rank)
  return (
    <div ref={box} className="grid grid-cols-12 gap-4 bg-card">
      <div className="col-span-7 rounded-lg border p-3">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[12.5px] font-semibold">Value × Effort <span className="font-normal text-muted-foreground">· bubble = gaps closed</span></div>
          <ExportMenu target={box} name="Initiative Prioritisation" size="xs" csv={() => [['Rank', 'ID', 'Initiative', 'Quadrant', 'Value', 'Effort', 'Value per effort'], ...ranked.map((i) => [i.prio.rank, i.id, i.name, i.prio.label, i.prio.value, i.prio.effort, i.prio.score])]} />
        </div>
        <ChartContainer config={{ v: { label: 'Value', color: NAVY } }} className="h-[360px] w-full">
          <ScatterChart margin={{ top: 22, right: 22, bottom: 22, left: 4 }}>
            <ReferenceArea x1={0.5} x2={c.effort_split + 0.5} y1={c.value_split} y2={maxV} fill={QUAD_COLOR.quick_win} fillOpacity={0.06} label={{ value: c.quadrants.quick_win, position: 'insideTopLeft', fontSize: 11, fontWeight: 700, fill: QUAD_COLOR.quick_win }} />
            <ReferenceArea x1={c.effort_split + 0.5} x2={4.6} y1={c.value_split} y2={maxV} fill={QUAD_COLOR.strategic} fillOpacity={0.05} label={{ value: c.quadrants.strategic, position: 'insideTopRight', fontSize: 11, fontWeight: 700, fill: QUAD_COLOR.strategic }} />
            <ReferenceArea x1={0.5} x2={c.effort_split + 0.5} y1={0} y2={c.value_split} fill={QUAD_COLOR.fill_in} fillOpacity={0.05} label={{ value: c.quadrants.fill_in, position: 'insideBottomLeft', fontSize: 11, fontWeight: 700, fill: QUAD_COLOR.fill_in }} />
            <ReferenceArea x1={c.effort_split + 0.5} x2={4.6} y1={0} y2={c.value_split} fill={QUAD_COLOR.reconsider} fillOpacity={0.05} label={{ value: c.quadrants.reconsider, position: 'insideBottomRight', fontSize: 11, fontWeight: 700, fill: QUAD_COLOR.reconsider }} />
            <CartesianGrid stroke={GRID} />
            <XAxis type="number" dataKey="x" domain={[0.5, 4.6]} ticks={[1, 2, 3, 4]} tickFormatter={(v: number) => ['', 'S', 'M', 'L', 'XL'][v] ?? ''} tickLine={false}
              label={{ value: 'Effort (size)', position: 'insideBottom', offset: -12, fontSize: 11, fill: SLATE }} />
            <YAxis type="number" dataKey="y" domain={[0, maxV]} ticks={[0, 5, 10, 15, 20, 25]} tickLine={false} width={46}
              label={{ value: 'Value (gap priority)', angle: -90, position: 'insideLeft', offset: 4, dy: 50, fontSize: 11, fill: SLATE }} />
            <ZAxis type="number" dataKey="z" range={[90, 520]} />
            <ChartTooltip cursor={false} content={({ payload }) => {
              const p = payload?.[0]?.payload as (typeof pts)[number] | undefined
              return p ? <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md"><div className="font-semibold">{p.id} {p.name}</div><div className="text-muted-foreground">{p.label} · value {p.y} · {p.z} gaps</div></div> : null
            }} />
            <Scatter data={pts}>
              {pts.map((p) => <Cell key={p.id} fill={QUAD_COLOR[p.q]} fillOpacity={0.85} stroke={WHITE} strokeWidth={1.5} />)}
              <LabelList dataKey="id" position="right" fontSize={10.5} fontWeight={600} fill={SLATE} />
            </Scatter>
          </ScatterChart>
        </ChartContainer>
      </div>
      <div className="col-span-5 rounded-lg border p-3">
        <div className="mb-2 text-[12.5px] font-semibold">Ranked Initiatives</div>
        <div className="space-y-1">
          {ranked.map((i) => (
            <div key={i.id} className="grid grid-cols-[22px_minmax(0,1fr)_96px_44px] items-center gap-2 rounded-md px-1 py-1 text-[12px] hover:bg-muted/40">
              <span className="tabular text-[11px] font-bold text-muted-foreground">{i.prio.rank}</span>
              <span className="truncate" title={i.name}><span className="mr-1 text-[10.5px] font-semibold text-muted-foreground">{i.id}</span>{i.name}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: QUAD_COLOR[i.prio.quadrant] }}><span className="size-2 rounded-full" style={{ background: QUAD_COLOR[i.prio.quadrant] }} />{i.prio.label}</span>
              <span className="tabular inline-flex items-center justify-end gap-1 text-[11px]"><Explain x={i.prio.explain} />{i.prio.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Timeline({ r }: { r: RoadmapT }) {
  const box = useRef<HTMLDivElement>(null)
  const fys = Object.keys(r.fy_budget)
  return (
    <div ref={box} className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="text-[12.5px] font-semibold">Timeline by Financial Year <span className="font-normal text-muted-foreground">· bar = years the initiative spends in · ₹ Cr low–high</span></div>
        <ExportMenu target={box} name="Roadmap Timeline" size="xs" csv={() => [['ID', 'Initiative', 'Wave', ...fys], ...r.initiatives.map((i) => [i.id, i.name, i.wave_id, ...fys.map((y) => (i.fy_split[y] ? `${i.fy_split[y][0].toFixed(1)}-${i.fy_split[y][1].toFixed(1)}` : ''))])]} />
      </div>
      <div className="grid border-b bg-muted/40 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase" style={{ gridTemplateColumns: `260px repeat(${fys.length}, minmax(0,1fr))` }}>
        <span className="px-3 py-1.5">Initiative</span>{fys.map((y) => <span key={y} className="border-l py-1.5 text-center">{y}</span>)}
      </div>
      {r.initiatives.map((i) => (
        <div key={i.id} className="grid items-center border-b text-[12px] last:border-0" style={{ gridTemplateColumns: `260px repeat(${fys.length}, minmax(0,1fr))` }}>
          <span className="truncate px-3 py-1.5" title={i.name}><span className="mr-1.5 text-[10.5px] font-semibold" style={{ color: WAVE_COLOR[i.wave] }}>{i.wave_id}</span>{i.name}</span>
          {fys.map((y) => (
            <span key={y} className="h-full border-l px-1 py-1.5">
              {i.fy_split[y] && <span className="flex h-5 items-center justify-center rounded text-[10px] font-semibold text-white" style={{ background: WAVE_COLOR[i.wave] }}>{i.fy_split[y][0].toFixed(1)}–{i.fy_split[y][1].toFixed(1)}</span>}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function RisksAndAffordability({ r }: { r: RoadmapT }) {
  const box = useRef<HTMLDivElement>(null)
  const risks = r.long_list.flatMap((i) => [...i.risks.map((x) => ({ i, kind: 'Risk', text: x })), ...i.constraints.map((x) => ({ i, kind: 'Constraint', text: x }))])
  return (
    <div className="grid grid-cols-12 gap-4">
      <div ref={box} className="col-span-7 rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-[12.5px] font-semibold">Key Risks & Constraints <span className="font-normal text-muted-foreground">· edit them on the long list</span></div>
          <span className="flex gap-2"><AiAction size="xs" what="Risks and constraints" from="the initiative scope, dependencies and wave plan" />
          <ExportMenu target={box} name="Roadmap Risks and Constraints" size="xs" csv={() => [['Initiative', 'Wave', 'Type', 'Description'], ...risks.map((x) => [`${x.i.id} ${x.i.name}`, x.i.wave_id, x.kind, x.text])]} /></span>
        </div>
        <div className="scrollbar-thin max-h-72 overflow-y-auto">
          <table className="w-full text-[12px]"><tbody>
            {risks.map((x, n) => (
              <tr key={n} className="border-b last:border-0"><td className="w-40 px-3 py-1.5 text-[11px] text-muted-foreground">{x.i.id} · {x.i.wave_id}</td>
                <td className="w-24 py-1.5"><span className="rounded px-1.5 text-[10.5px] font-semibold" style={x.kind === 'Risk' ? { color: BAND.weak, background: tint(BAND.weak) } : { color: SLATE, background: tint(SLATE) }}>{x.kind}</span></td>
                <td className="py-1.5 pr-3">{x.text}</td></tr>
            ))}
          </tbody></table>
        </div>
      </div>
      <div className="col-span-5 rounded-lg border p-3">
        <div className="mb-2 text-[12.5px] font-semibold">Affordability <span className="font-normal text-muted-foreground">· against the IT capex plan on IT Budget</span></div>
        {r.budget.afford.length ? (
          <table className="w-full text-[12px]">
            <thead><tr className="text-[11px] text-muted-foreground"><th className="py-1 text-left font-medium">Year</th><th className="py-1 text-right font-medium">IT capex</th><th className="py-1 text-right font-medium">Roadmap</th><th className="py-1 text-right font-medium">Share</th></tr></thead>
            <tbody>{r.budget.afford.map((x) => <tr key={x.fy} className="border-t"><td className="py-1.5">{x.fy}</td><td className="tabular py-1.5 text-right">₹{x.capex}</td><td className="tabular py-1.5 text-right">₹{x.roadmap[0]}–{x.roadmap[1]}</td><td className="tabular py-1.5 text-right font-semibold" style={{ color: (x.share[1] ?? 0) > 100 ? BAND.critical : NAVY }}>{x.share[0]}–{x.share[1]}%</td></tr>)}</tbody>
          </table>
        ) : <p className="text-[12px] text-muted-foreground">No projected capex for the roadmap years yet.</p>}
        <Link to="/budget?view=analysis" className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-navy hover:underline">Open IT Budget <ArrowRight className="size-3" /></Link>
      </div>
    </div>
  )
}

function RepositoryCard({ r }: { r: RoadmapT }) {
  const qc = useQueryClient()
  const [f, setF] = useState<Omit<Repository, 'source'> | null>(null)
  const repo = r.repository
  const save = useMutation({ mutationFn: () => api.putRepository(f!), onSuccess: (d) => { qc.setQueryData(['roadmap'], d); toast.success('Repository model saved'); setF(null) }, onError: (e: Error) => toast.error(e.message) })
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Repository & Ownership</CardTitle>
        <CardDescription>How the architecture stays current after the engagement: tooling, an owner and cadence for every view family, and the update process (RFP: documentation & repository).</CardDescription>
        <CardAction><Button size="sm" variant="outline" onClick={() => setF({ tooling: repo.tooling, ownership: repo.ownership.map((o) => ({ ...o })), process: [...repo.process] })}><Pencil /> Edit</Button></CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-12 gap-4 text-[12.5px]">
        <div className="col-span-7">
          <table className="w-full"><thead><tr className="text-[11px] text-muted-foreground"><th className="py-1 text-left font-medium">View family</th><th className="py-1 text-left font-medium">Owner</th><th className="py-1 text-left font-medium">Update cadence</th></tr></thead>
            <tbody>{repo.ownership.map((o) => <tr key={o.view} className="border-t"><td className="py-1.5">{o.view}</td><td className="py-1.5">{o.owner}</td><td className="py-1.5 text-muted-foreground">{o.cadence}</td></tr>)}</tbody></table>
        </div>
        <div className="col-span-5 space-y-2">
          <div><div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Tooling</div><p>{repo.tooling}</p></div>
          <div><div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Update Process</div>
            <ol className="space-y-1">{repo.process.map((p, n) => <li key={p} className="flex gap-2"><span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white">{n + 1}</span>{p}</li>)}</ol></div>
        </div>
      </CardContent>
      <Dialog open={!!f} onOpenChange={(o) => !o && setF(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Repository & Ownership</DialogTitle></DialogHeader>
          {f && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Tooling recommendation</Label><Textarea rows={2} value={f.tooling} onChange={(e) => setF({ ...f, tooling: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Ownership</Label>
                {f.ownership.map((o, n) => (
                  <div key={n} className="grid grid-cols-[1fr_1fr_140px_32px] gap-1.5">
                    {(['view', 'owner', 'cadence'] as const).map((k) => <Input key={k} value={o[k]} placeholder={k} className="h-8" onChange={(e) => setF({ ...f, ownership: f.ownership.map((x, j) => (j === n ? { ...x, [k]: e.target.value } : x)) })} />)}
                    <Button variant="ghost" size="icon-sm" onClick={() => setF({ ...f, ownership: f.ownership.filter((_, j) => j !== n) })}><Trash2 /></Button>
                  </div>
                ))}
                <Button size="xs" variant="outline" onClick={() => setF({ ...f, ownership: [...f.ownership, { view: '', owner: '', cadence: 'Quarterly' }] })}><Plus /> Add view family</Button>
              </div>
              <div className="space-y-1"><Label>Update process <span className="font-normal text-muted-foreground">(one step per line)</span></Label><Textarea rows={4} value={f.process.join('\n')} onChange={(e) => setF({ ...f, process: e.target.value.split('\n') })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setF(null)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default function Roadmap() {
  const q = useQuery({ queryKey: ['roadmap'], queryFn: api.roadmap })
  const [raw, setView] = useView('longlist', [...STEPS.map((s) => s.key), ...Object.keys(LEGACY)])
  const view = LEGACY[raw] ?? raw
  const r = q.data
  return (
    <>
      <PageHeader screen="roadmap" />
      {q.error ? <ScreenError error={q.error} /> : !r ? <ScreenSkeleton /> : (
        <>
          <PhasePlan p={r.plan} />
          <StepBar steps={STEPS} active={view} onPick={setView} />
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>{STEP_CARD[view].title}</CardTitle>
              <CardDescription>{STEP_CARD[view].desc}</CardDescription>
            </CardHeader>
            {(view === 'longlist' || view === 'priority') && (
              <CardContent>{view === 'longlist' ? <LongList r={r} /> : <Prioritisation r={r} />}</CardContent>
            )}
          </Card>
          {view === 'roadmap' && (
            <>
              <Swimlane r={r} />
              <Card><CardContent className="space-y-4"><Timeline r={r} /><RisksAndAffordability r={r} /></CardContent></Card>
              <Budget r={r} />
            </>
          )}
          {view === 'governance' && <><Acmm r={r} /><Charter r={r} /><DecisionLog r={r} /><RepositoryCard r={r} /></>}
          <InsightsCard key={view} screen="roadmap" tab={view} items={r.insights[view] ?? []} />
        </>
      )}
    </>
  )
}

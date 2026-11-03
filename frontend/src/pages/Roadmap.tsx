import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Download, Gavel, Link2, Loader2, Pencil, Plus, Save, Sparkles, Trash2, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, LabelList, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { CiteMarks } from '@/components/CitationChip'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { AiModeBadge, FindingsCard } from '@/components/FindingsCard'
import { KpiCard, KpiRow } from '@/components/KpiCard'
import { PageHeader } from '@/components/PageHeader'
import { ScreenSummary } from '@/components/ScreenSummary'
import { useView } from '@/lib/screens'
import { PriorityPill } from '@/components/PriorityPill'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { api, exportUrl, fmtCr, type Briefs, type DecisionT, type Initiative, type Roadmap as RoadmapT } from '@/lib/api'
import { BAND, NAVY, SLATE, WAVE_COLOR, tint } from '@/lib/theme'

const SIZE_COLOR: Record<Initiative['size'], string> = { S: BAND.strong, M: NAVY, L: BAND.developing, XL: BAND.weak }
const ACMM_SHORT: Record<string, string> = {
  G1: 'Process', G2: 'Development', G3: 'Business linkage', G4: 'Senior mgmt', G5: 'Unit participation',
  G6: 'Communication', G7: 'IT security', G8: 'Governance', G9: 'IT investment',
}
const KIND_LABEL: Record<string, string> = {
  capability: 'Capability', application: 'Application', duplication: 'Duplication', data: 'Data', technology: 'Technology', governance: 'Governance',
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
              <YAxis tickLine={false} axisLine={false} width={40} unit=" Cr" fontSize={11} />
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

function GapRegister({ r }: { r: RoadmapT }) {
  const [phase, setPhase] = useState('all')
  const [kind, setKind] = useState('all')
  const phases = useMemo(() => [...new Set(r.gaps.map((g) => g.adm_phase))], [r.gaps])
  const rows = r.gaps.filter((g) => (phase === 'all' || g.adm_phase === phase) && (kind === 'all' || g.kind === kind))
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>Gap Register</CardTitle>
        <CardDescription>{rows.length} of {r.gaps.length} gaps from Phases B–D and governance · priority = impact × urgency · §27</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select value={phase} onValueChange={setPhase}>
            <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All phases</SelectItem>{phases.map((p) => <SelectItem key={p} value={p}>{p.replace('_', ' ')}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All kinds</SelectItem>{Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="ghost" size="sm" asChild><a href={exportUrl('roadmap')}><Download /> Export</a></Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-thin max-h-[380px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-16">Priority</TableHead><TableHead>Gap</TableHead><TableHead>Kind</TableHead><TableHead>Phase</TableHead>
                <TableHead>Initiative</TableHead><TableHead className="text-right">Impact</TableHead><TableHead className="text-right">Urgency</TableHead><TableHead>TOGAF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((g) => (
                <TableRow key={g.id}>
                  <TableCell><span className="inline-flex items-center gap-1"><Explain x={g.explain} /><PriorityPill p={g.priority} /></span></TableCell>
                  <TableCell className="font-medium">{g.title}</TableCell>
                  <TableCell className="text-muted-foreground">{KIND_LABEL[g.kind]}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{g.adm_phase.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground" title={g.theme_name}>{g.theme} · {g.theme_name}</TableCell>
                  <TableCell className="tabular text-right">{g.impact}</TableCell>
                  <TableCell className="tabular text-right">{g.urgency}</TableCell>
                  <TableCell className="text-xs font-semibold text-navy">§{g.togaf_ref}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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
          <CardDescription>Level ≤ 1 raises a 4×4 gap, level 2 a 3×3 gap. Seed levels are assumed.</CardDescription>
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
                <ProvenanceBadge source={a.source} />
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
          <TableHeader><TableRow><TableHead className="w-10">#</TableHead><TableHead>Decision</TableHead><TableHead>Principles</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Source</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
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
                <TableCell><ProvenanceBadge source={d.source} /></TableCell>
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

export default function Roadmap() {
  const q = useQuery({ queryKey: ['roadmap'], queryFn: api.roadmap })
  const [view, setView] = useView('roadmap', ['roadmap', 'budget', 'gaps', 'governance'])
  const r = q.data
  const tab = view === 'governance' ? 'governance' : 'roadmap'
  const pick = (v: string) => {
    setView(v)
    setTimeout(() => document.getElementById(`sec-${v}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  return (
    <>
      <PageHeader screen="roadmap" />
      {q.error ? <ScreenError error={q.error} /> : !r ? <ScreenSkeleton /> : (
        <>
          <ScreenSummary screen="roadmap" active={view} onPick={pick}
            status={`${r.kpis.gaps} gaps → ${r.kpis.initiatives} initiatives in ${r.waves.length} waves · ${fmtCr(r.kpis.total_cr)} indicative · ${r.decisions.length} decisions logged`} />
          <KpiRow>
            <KpiCard label="Gaps in register" value={r.kpis.gaps} sub={`${r.gaps.filter((g) => g.priority >= 20).length} at priority ≥ 20`} accent={BAND.critical} explain={r.explain.gaps} />
            <KpiCard label="Initiatives" value={r.kpis.initiatives} sub={`${r.initiatives.filter((i) => i.foundation).length} foundation themes · 4 waves`} accent={NAVY} explain={r.explain.initiatives} />
            <KpiCard label="Investment range" value={fmtCr(r.kpis.total_cr)} sub="Indicative, rate-card based, not a quote" accent={NAVY} explain={r.explain.total_cr} />
            <KpiCard label="ACMM mean" value={<>{r.kpis.acmm_mean.toFixed(2)}<span className="text-base font-normal text-muted-foreground"> / 5</span></>}
              sub="9 elements · §51.3" accent={r.kpis.acmm_mean < 2 ? BAND.weak : BAND.developing} explain={r.explain.acmm_mean} />
          </KpiRow>
          <Tabs value={tab} onValueChange={setView} className="gap-4">
            <TabsList id="sec-roadmap" className="scroll-mt-4">
              <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
              <TabsTrigger value="governance">Governance</TabsTrigger>
            </TabsList>
            <TabsContent value="roadmap" className="space-y-4">
              <Swimlane r={r} />
              <div id="sec-budget" className="scroll-mt-4"><Budget r={r} /></div>
              <div id="sec-gaps" className="scroll-mt-4"><GapRegister r={r} /></div>
            </TabsContent>
            <TabsContent value="governance" id="sec-governance" className="scroll-mt-4 space-y-4">
              <Acmm r={r} />
              <Charter r={r} />
              <DecisionLog r={r} />
            </TabsContent>
          </Tabs>
          <FindingsCard screen="roadmap" />
        </>
      )}
    </>
  )
}

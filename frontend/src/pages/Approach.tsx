import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BrainCircuit, CheckCircle2, Flag, Landmark, ListChecks, Pencil, Plus, RotateCcw, Route, ScanSearch, Server, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CadenceLegend, CadenceRow, EngagementPlan } from '@/components/EngagementPlan'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { PageHeader } from '@/components/PageHeader'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type Approach as ApproachT, type ApproachPhase, type ScopeOfWork as ScopeOfWorkT } from '@/lib/api'

import { useView } from '@/lib/screens'
import { NAVY, PHASE_STATUS, PLAN_STATUS, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

const ICON: Record<string, React.ReactNode> = {
  discovery: <ScanSearch />, assessment: <ListChecks />, target: <Server />, ai: <BrainCircuit />, governance: <Landmark />, roadmap: <Route />,
}

/** The scope of work exactly as agreed in the proposal: CIL's requirement, the objective and six scope items with key activities. */
function ScopeDialog({ a, open, onClose }: { a: ApproachT; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState<Omit<ScopeOfWorkT, 'source'>>({ requirement: '', objective: '', items: [] })
  useEffect(() => { if (open) setF({ requirement: a.scope_of_work.requirement, objective: a.scope_of_work.objective, items: a.scope_of_work.items.map((x) => ({ ...x })) }) }, [open, a.scope_of_work])
  const done = (d: ApproachT, msg: string) => { qc.setQueryData(['approach'], d); qc.invalidateQueries({ queryKey: ['vision'] }); toast.success(msg); onClose() }
  const save = useMutation({ mutationFn: () => api.putScope(f), onSuccess: (d) => done(d, 'Scope of work saved'), onError: (e: Error) => toast.error(e.message) })
  const reset = useMutation({ mutationFn: api.resetScope, onSuccess: (d) => done(d, 'Scope of work restored to the proposal') })
  const setItem = (i: number, p: Partial<ScopeOfWorkT['items'][number]>) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>Edit Scope of Work</DialogTitle><DialogDescription>Changes here update the scope shown to every screen and the AI context.</DialogDescription></DialogHeader>
        <div className="scrollbar-thin max-h-[66vh] space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1"><Label>CIL's requirement</Label><Textarea rows={2} value={f.requirement} onChange={(e) => setF({ ...f, requirement: e.target.value })} /></div>
          <div className="space-y-1"><Label>Objective</Label><Textarea rows={2} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} /></div>
          <Label>Scope items</Label>
          {f.items.map((x, i) => (
            <div key={i} className="grid grid-cols-[28px_minmax(0,1fr)_140px_32px] items-start gap-2 rounded-md border p-2">
              <span className="tabular pt-1.5 text-center text-[13px] font-bold text-navy">{i + 1}</span>
              <div className="space-y-1.5">
                <Input value={x.title} onChange={(e) => setItem(i, { title: e.target.value })} className="h-8 font-medium" />
                <Textarea rows={2} value={x.activities} onChange={(e) => setItem(i, { activities: e.target.value })} className="text-[12.5px]" placeholder="Key activities" />
              </div>
              <Select value={x.icon} onValueChange={(v) => setItem(i, { icon: v })}>
                <SelectTrigger size="sm" className="h-8 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(ICON).map((k) => <SelectItem key={k} value={k}><span className="[&_svg]:size-3.5">{ICON[k]}</span>{k}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="ghost" size="icon-sm" onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} disabled={f.items.length <= 1}><Trash2 /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, items: [...f.items, { n: f.items.length + 1, title: 'New scope item', icon: 'discovery', activities: '' }] })}><Plus /> Add scope item</Button>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => reset.mutate()} disabled={a.scope_of_work.source !== 'client'}><RotateCcw /> Restore proposal</Button>
          <span className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending || f.requirement.trim().length < 5 || f.objective.trim().length < 5 || f.items.some((x) => x.title.trim().length < 2)}>Save</Button></span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScopeOfWork({ a }: { a: ApproachT }) {
  const s = a.scope_of_work
  const box = useRef<HTMLDivElement>(null)
  const [editing, setEditing] = useState(false)
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Scope of Work</CardTitle>
        <CardDescription>Comprehensive Enterprise Architecture for {a.engagement.client} · as proposed</CardDescription>
        <CardAction className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
          <ExportMenu target={box} name="Scope of Work" csv={() => [['#', 'Scope of work', 'Key activities'], ...s.items.map((x) => [x.n, x.title, x.activities])]} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div ref={box} className="space-y-2.5 bg-card">
          <div className="grid grid-cols-[150px_minmax(0,1fr)] items-stretch gap-3">
            <span className="flex items-center justify-center rounded-lg px-3 py-2 text-center text-[12.5px] font-semibold text-white" style={{ background: NAVY }}>CIL's Requirement</span>
            <p className="rounded-lg bg-muted px-3.5 py-2.5 text-[13px] leading-snug font-semibold">{s.requirement}</p>
          </div>
          <div className="grid grid-cols-[150px_minmax(0,1fr)] items-stretch gap-3">
            <span className="flex items-center justify-center rounded-lg px-3 py-2 text-center text-[12.5px] font-semibold text-white" style={{ background: NAVY }}>Objective</span>
            <p className="rounded-lg border-[1.5px] border-dashed border-navy/50 px-3.5 py-2.5 text-[13px] leading-snug text-navy">{s.objective}</p>
          </div>
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1.5 pt-1">
            <span className="rounded-md py-1.5 text-center text-[12px] font-semibold text-white" style={{ background: NAVY }}>Scope of Work</span>
            <span className="rounded-md py-1.5 text-center text-[12px] font-semibold text-white" style={{ background: NAVY }}>Key Activities</span>
            {s.items.map((x) => (
              <div key={x.n} className="contents">
                <div className="flex items-center gap-3 rounded-md bg-navy-soft/40 px-3 py-2">
                  <span className="tabular w-5 text-[20px] font-bold text-navy">{x.n}</span>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-navy [&_svg]:size-5">{ICON[x.icon]}</span>
                  <span className="text-[13px] leading-snug font-semibold text-navy">{x.title}</span>
                </div>
                <div className="flex items-center rounded-md bg-navy-soft/40 px-3 py-2 text-[12.5px] leading-snug">
                  <span className="flex gap-2"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-navy/70" />{x.activities}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <ScopeDialog a={a} open={editing} onClose={() => setEditing(false)} />
    </Card>
  )
}

function PhaseCard({ ph, n, current }: { ph: ApproachPhase; n: number; current: boolean }) {
  const st = ph.phase ? PHASE_STATUS[ph.phase.status] : PHASE_STATUS.not_started
  return (
    <div className={cn('flex flex-col rounded-xl border bg-card', current && 'border-navy shadow-sm')}>
      <div className="flex items-center gap-2.5 border-b px-3.5 py-2.5" style={{ background: current ? tint(NAVY, 0.06) : undefined }}>
        <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] leading-tight font-semibold">{ph.name}</div>
          <div className="text-[11px] text-muted-foreground">W{ph.start_week}–W{ph.end_week} · ADM {ph.adm} · {ph.activities - 1} tasks</div>
        </div>
        <span className="rounded-full px-2 py-px text-[10.5px] font-semibold whitespace-nowrap" style={{ color: st.color, background: tint(st.color, 0.12) }}>{current ? 'Current' : st.label}</span>
      </div>
      <div className="flex-1 space-y-2.5 px-3.5 py-3 text-[12.5px] leading-snug">
        <p className="font-medium">{ph.objective}</p>
        <div>
          <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">How We Do It</div>
          <ul className="space-y-1">{ph.approach.map((x) => <li key={x} className="flex gap-1.5"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-navy/60" />{x}</li>)}</ul>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Outputs</div>
          <div className="flex flex-wrap gap-1">{ph.outputs.map((x) => <span key={x} className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px]">{x}</span>)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t px-3.5 py-2 text-[11.5px]">
        <Flag className="size-3.5 shrink-0 text-navy" /><span className="min-w-0 flex-1 truncate" title={ph.gate}>{ph.gate}</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${ph.progress}%`, background: PLAN_STATUS.done.color }} /></span><b className="tabular">{ph.progress}%</b></span>
      </div>
    </div>
  )
}

function EngagementApproach({ a }: { a: ApproachT }) {
  const p = a.plan
  const now = ((p.current_week - 0.5) / p.weeks) * 100
  const box = useRef<HTMLDivElement>(null)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <CadenceLegend />
        <ExportMenu target={box} name="Engagement Approach" csv={() => [['Phase', 'Weeks', 'ADM', 'Objective', 'Outputs', 'Gate'], ...a.phases.map((ph, i) => [`Phase ${i + 1}: ${ph.name}`, `W${ph.start_week}-W${ph.end_week}`, ph.adm, ph.objective, ph.outputs.join('; '), ph.gate])]} />
      </div>
      <div ref={box} className="space-y-4 bg-card">
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[260px_minmax(0,1fr)] border-b bg-navy text-[10px] font-semibold tracking-wide text-white uppercase">
            <span className="px-3 py-1.5">Phase</span>
            <span className="grid border-l border-white/20" style={{ gridTemplateColumns: `repeat(${p.weeks}, minmax(0,1fr))` }}>
              {Array.from({ length: p.weeks }, (_, i) => <span key={i} className={cn('border-r border-white/20 py-1.5 text-center last:border-0', i + 1 === p.current_week && 'bg-white text-navy')}>W{i + 1}</span>)}
            </span>
          </div>
          <div className="grid grid-cols-[260px_minmax(0,1fr)] border-b bg-muted/30">
            <span className="px-3 py-0.5 text-[10.5px] text-muted-foreground">Governance cadence</span>
            <span className="border-l"><CadenceRow p={p} /></span>
          </div>
          {a.phases.map((ph, i) => (
            <div key={ph.id} className="grid grid-cols-[260px_minmax(0,1fr)] items-center border-b text-[12.5px] last:border-0">
              <span className="flex items-center gap-2 px-3 py-2"><span className="tabular text-[11px] font-bold text-navy">{i + 1}</span><span className="truncate font-medium" title={ph.name}>{ph.name}</span></span>
              <span className="relative h-9 border-l">
                <span className="absolute inset-y-0 z-10 w-px bg-navy/70" style={{ left: `${now}%` }} />
                <span className="absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-md" style={{ left: `calc(${((ph.start_week - 1) / p.weeks) * 100}% + 2px)`, width: `calc(${((ph.end_week - ph.start_week + 1) / p.weeks) * 100}% - 4px)`, background: tint(NAVY, 0.16) }}>
                  <span className="absolute inset-y-0 left-0" style={{ width: `${ph.progress}%`, background: NAVY }} />
                  <span className="relative px-2 text-[10.5px] leading-5 font-semibold" style={{ color: (ph.progress / 100) * (ph.end_week - ph.start_week + 1) >= 1 ? 'white' : NAVY }}>W{ph.start_week}–W{ph.end_week}</span>
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {a.phases.map((ph, i) => <PhaseCard key={ph.id} ph={ph} n={i + 1} current={ph.id === a.current_phase} />)}
        </div>
      </div>
    </div>
  )
}

export default function Approach() {
  const q = useQuery({ queryKey: ['approach'], queryFn: api.approach })
  const [view, setView] = useView('approach', ['approach', 'plan'])
  const plan = useRef<HTMLDivElement>(null)
  const a = q.data
  const cur = a?.phases.find((x) => x.id === a.current_phase)
  return (
    <>
      <PageHeader screen="approach" />
      {q.error ? <ScreenError error={q.error} /> : !a ? <ScreenSkeleton /> : (
        <>
          <ScopeOfWork a={a} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border bg-card px-4 py-2.5 text-[12.5px]">
            <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Where We Are</span>
            <span className="font-semibold">W{a.plan.current_week} of {a.plan.weeks}</span>
            {cur && <span>Current phase: <b>{cur.name}</b> (W{cur.start_week}–W{cur.end_week})</span>}
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-navy" style={{ width: `${a.plan.progress}%` }} /></span><b className="tabular">{a.plan.progress}%</b> of tasks done <Explain x={a.plan.explain} /></span>
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground"><CheckCircle2 className="size-3.5" style={{ color: PLAN_STATUS.done.color }} />{a.plan.counts.done} done · {a.plan.counts.in_progress} in progress · {a.plan.counts.planned} planned</span>
          </div>
          <Card>
            <Tabs value={view} onValueChange={setView}>
              <CardHeader>
                <TabsList>
                  <TabsTrigger value="approach">Engagement Approach</TabsTrigger>
                  <TabsTrigger value="plan">Detailed Work Plan</TabsTrigger>
                </TabsList>
                <CardDescription className="pt-1">{view === 'approach'
                  ? 'Four phases over 16 weeks, aligned to the TOGAF ADM: what each phase sets out to do, how we run it, what it produces and the gate that closes it.'
                  : 'The project timeline as proposed: every task by week with weekly connects, steering committees and deliverable milestones, the KPMG lead, the CIL counterpart and live status.'}</CardDescription>
                {view === 'plan' && <CardAction><ExportMenu target={plan} name="Detailed Work Plan" csv={() => [['Phase', 'ID', 'Task', 'Start', 'End', 'KPMG lead', 'CIL', 'Deliverable', 'Status'],
                  ...a.plan.phases.flatMap((ph, i) => ph.activities.map((t) => [`Phase ${i + 1}: ${ph.name}`, t.id, t.name, `W${t.start_week}`, `W${t.end_week}`, t.kpmg, t.cil, t.deliverable, t.status]))]} /></CardAction>}
              </CardHeader>
              <CardContent className="pt-3">
                <TabsContent value="approach"><EngagementApproach a={a} /></TabsContent>
                <TabsContent value="plan"><div ref={plan} className="bg-card"><EngagementPlan p={a.plan} /></div></TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </>
      )}
    </>
  )
}

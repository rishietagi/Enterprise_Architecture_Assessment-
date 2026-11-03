import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkle, Star } from 'lucide-react'
import { toast } from 'sonner'
import { Explain } from '@/components/Explain'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, type EngagementPlan as PlanT, type PlanActivity, type PlanStatus } from '@/lib/api'
import { CADENCE, NAVY, PLAN_STATUS, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Caret } from './business/shared'

const LEFT = 'minmax(0,1fr) 128px 108px'

/** Weekly connects, steering committees and deliverable milestones, each drawn at the end of its week. */
export function CadenceRow({ p, className }: { p: PlanT; className?: string }) {
  const at = (w: number) => `${(w / p.weeks) * 100}%`
  const ms = p.phases.flatMap((ph) => ph.activities.filter((a) => a.status === 'milestone'))
  return (
    <span className={cn('relative block h-5', className)}>
      {p.cadence?.weekly_connect.map((w) => <Sparkle key={`w${w}`} className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2" style={{ left: at(w), color: CADENCE.weekly.color, fill: CADENCE.weekly.color }}><title>{`${CADENCE.weekly.label} · end of W${w}`}</title></Sparkle>)}
      {p.cadence?.steerco.map((w) => <Sparkle key={`s${w}`} className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2" style={{ left: at(w), color: CADENCE.steerco.color, fill: CADENCE.steerco.color }}><title>{`${CADENCE.steerco.label} · end of W${w}`}</title></Sparkle>)}
      {ms.map((m) => <Star key={m.id} className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2" style={{ left: `calc(${at(m.start_week)} - 9px)`, color: CADENCE.deliverable.color }}><title>{`${m.name} · W${m.start_week}`}</title></Star>)}
    </span>
  )
}

export function CadenceLegend() {
  return (
    <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1"><Sparkle className="size-3.5" style={{ color: CADENCE.weekly.color, fill: CADENCE.weekly.color }} />{CADENCE.weekly.label}</span>
      <span className="flex items-center gap-1"><Sparkle className="size-3.5" style={{ color: CADENCE.steerco.color, fill: CADENCE.steerco.color }} />{CADENCE.steerco.label}</span>
      <span className="flex items-center gap-1"><Star className="size-3.5" style={{ color: CADENCE.deliverable.color }} />{CADENCE.deliverable.label}</span>
    </span>
  )
}

function Bar({ a, weeks }: { a: Pick<PlanActivity, 'start_week' | 'end_week' | 'status' | 'name'>; weeks: number }) {
  const left = ((a.start_week - 1) / weeks) * 100
  const width = ((a.end_week - a.start_week + 1) / weeks) * 100
  const c = PLAN_STATUS[a.status].color
  if (a.status === 'milestone')
    return (
      <span className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap" style={{ right: `${100 - left - width}%` }}>
        <span className="text-[10px] font-semibold text-navy">{a.name}</span>
        <Star className="size-4 shrink-0" style={{ color: CADENCE.deliverable.color }} />
      </span>
    )
  return (
    <span className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full" style={{ left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)`, background: a.status === 'planned' ? tint(NAVY, 0.14) : c }}>
      {a.status === 'in_progress' && <span className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-white/25" />}
    </span>
  )
}

/** The detailed work plan as a Gantt in engagement weeks: phases with activities, owners, deliverables, cadence and live status. */
export function EngagementPlan({ p }: { p: PlanT }) {
  const qc = useQueryClient()
  const [closed, setClosed] = useState<Set<string>>(() => new Set())
  const set = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PlanStatus }) => api.putApproachPlan(id, status),
    onSuccess: (d) => {
      qc.setQueryData(['approach'], d)
      ;['vision', 'business', 'applications', 'data_tech'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      toast.success('Plan updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const cols = `${LEFT} minmax(0,2.2fr)`
  const weekPct = ((p.current_week - 0.5) / p.weeks) * 100
  const grid = `repeating-linear-gradient(90deg, transparent 0, transparent calc(${100 / p.weeks}% - 1px), rgba(148,163,184,0.18) calc(${100 / p.weeks}% - 1px), rgba(148,163,184,0.18) ${100 / p.weeks}%)`
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
        <span className="font-semibold">Week {p.current_week} of {p.weeks}</span>
        <span className="text-muted-foreground">W1–W{p.weeks} · {p.phases.length} phases</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-navy" style={{ width: `${p.progress}%` }} /></span><b className="tabular">{p.progress}%</b> done <Explain x={p.explain} /></span>
        <CadenceLegend />
        <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          {(Object.keys(PLAN_STATUS) as PlanStatus[]).filter((k) => k !== 'milestone').map((k) => <span key={k} className="flex items-center gap-1"><span className="h-2 w-3.5 rounded-full" style={{ background: k === 'planned' ? tint(NAVY, 0.14) : PLAN_STATUS[k].color }} />{PLAN_STATUS[k].label} {p.counts[k]}</span>)}
          <ProvenanceBadge source={p.source} />
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="grid border-b bg-navy text-[10px] font-semibold tracking-wide text-white uppercase" style={{ gridTemplateColumns: cols }}>
          <span className="px-3 py-1.5">Task Description · Deliverable</span><span className="py-1.5">KPMG Lead · CIL</span><span className="py-1.5">Status</span>
          <span className="relative grid border-l border-white/20" style={{ gridTemplateColumns: `repeat(${p.weeks}, minmax(0,1fr))` }}>
            {Array.from({ length: p.weeks }, (_, i) => (
              <span key={i} className={cn('border-r border-white/20 py-1.5 text-center last:border-0', i + 1 === p.current_week && 'bg-white text-navy')} title={i + 1 === p.current_week ? `Week ${i + 1} (current)` : `Week ${i + 1}`}>W{i + 1}</span>
            ))}
          </span>
        </div>
        <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: cols }}>
          <span className="col-span-3 px-3 py-0.5 text-[10.5px] text-muted-foreground">Governance cadence</span>
          <span className="border-l"><CadenceRow p={p} /></span>
        </div>

        {p.phases.map((ph, n) => {
          const open = !closed.has(ph.id)
          return (
            <div key={ph.id} className="border-b last:border-0">
              <div role="button" tabIndex={0} onClick={() => setClosed((s) => { const x = new Set(s); if (x.has(ph.id)) x.delete(ph.id); else x.add(ph.id); return x })}
                className="grid cursor-pointer items-center bg-navy-soft/45 text-[12.5px] hover:bg-navy-soft/70" style={{ gridTemplateColumns: cols }}>
                <span className="flex min-w-0 items-center gap-2 px-3 py-1.5"><Caret open={open} /><span className="truncate font-semibold">Phase {n + 1}: {ph.name}</span>
                  <span className="rounded bg-navy px-1.5 text-[9.5px] font-bold whitespace-nowrap text-white">ADM {ph.adm}</span></span>
                <span className="text-[11px] text-muted-foreground">W{ph.start_week}–W{ph.end_week} · {ph.activities.filter((a) => a.status !== 'milestone').length} tasks</span>
                <span className="flex items-center gap-1.5 text-[11px]"><span className="h-1.5 w-12 overflow-hidden rounded-full bg-white"><span className="block h-full rounded-full" style={{ width: `${ph.progress}%`, background: PLAN_STATUS.done.color }} /></span>{ph.progress}%</span>
                <span className="relative h-full min-h-7 border-l">
                  <span className="absolute inset-y-0 w-px bg-navy/60" style={{ left: `${weekPct}%` }} />
                  <span className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm" style={{ left: `${((ph.start_week - 1) / p.weeks) * 100}%`, width: `${((ph.end_week - ph.start_week + 1) / p.weeks) * 100}%`, background: NAVY }} />
                </span>
              </div>
              {open && ph.activities.map((a) => (
                <div key={a.id} className="grid items-center border-t border-dashed text-[12px]" style={{ gridTemplateColumns: cols }}>
                  <span className="min-w-0 py-1.5 pr-2 pl-9">
                    <span className={cn('block leading-snug', a.status === 'milestone' && 'font-semibold text-navy')}>{a.status === 'milestone' ? `Deliverable: ${a.name}` : a.name}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">{a.id} · {a.deliverable}</span>
                  </span>
                  <span className="min-w-0 pr-2 text-[11px] leading-tight"><span className="block truncate">{a.kpmg}</span><span className="block truncate text-muted-foreground">{a.cil || '–'}</span></span>
                  <span className="pr-2">
                    <Select value={a.status} onValueChange={(s) => set.mutate({ id: a.id, status: s as PlanStatus })}>
                      <SelectTrigger size="sm" className="h-6 w-full gap-1 px-1.5 text-[11px]" style={{ color: a.status === 'planned' ? undefined : PLAN_STATUS[a.status].color }}><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(PLAN_STATUS) as PlanStatus[]).map((k) => <SelectItem key={k} value={k} className="text-[12px]">{PLAN_STATUS[k].label}</SelectItem>)}</SelectContent>
                    </Select>
                  </span>
                  <span className="relative h-full min-h-9 border-l" style={{ backgroundImage: grid }}>
                    <span className="absolute inset-y-0 w-px bg-navy/60" style={{ left: `${weekPct}%` }} />
                    <Bar a={a} weeks={p.weeks} />
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">*{p.note} The vertical line marks the current week. Change a task's status to keep the plan live; each screen's "Where We Are" strip reads it.</p>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarRange, ChevronDown, Flag } from 'lucide-react'
import { Explain } from '@/components/Explain'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import type { PhasePlanT } from '@/lib/api'
import { NAVY, PHASE_STATUS, PLAN_STATUS, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

/** Compact "where we are" strip for a phase screen: weeks, progress and activities, from the work plan on Approach & Plan. */
export function PhasePlan({ p }: { p: PhasePlanT | null }) {
  const [open, setOpen] = useState(false)
  if (!p) return null
  const st = PHASE_STATUS[p.status]
  const span = p.end_week - p.start_week + 1
  const pos = (w: number) => ((w - p.start_week) / span) * 100
  const today = p.elapsed > 0 && p.elapsed < 100 ? p.elapsed : null
  const work = p.activities.filter((a) => a.status !== 'milestone')
  const startsIn = p.status === 'not_started' ? Math.max(0, p.start_week - p.current_week) : 0
  return (
    <div className="rounded-xl border bg-card">
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] items-center gap-6 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            <CalendarRange className="size-3.5 text-navy" /> {p.name} · Where We Are
            <span className="rounded-full px-1.5 py-px text-[10px] font-semibold normal-case" style={{ color: st.color, background: tint(st.color, 0.12) }}>{st.label}</span>
          </div>
          <div className="mt-0.5 text-[15px] font-semibold">W{p.start_week} → W{p.end_week} <span className="text-[12px] font-normal text-muted-foreground">of {p.weeks}</span></div>
          <div className="text-[11px] text-muted-foreground">
            {p.status === 'not_started' ? `Starts in ${startsIn} week${startsIn === 1 ? '' : 's'}` : `Engagement now in W${p.current_week}`}
          </div>
        </div>

        <div className="min-w-0">
          <div className="relative h-6">
            <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-muted" />
            <div className="absolute top-2 left-0 h-2 rounded-full" style={{ width: `${p.elapsed}%`, background: tint(NAVY, 0.22) }} title={`${p.elapsed}% of the phase window elapsed`} />
            <div className="absolute top-2 left-0 h-2 rounded-full" style={{ width: `${p.progress}%`, background: PLAN_STATUS.done.color }} title={`${p.progress}% of activities done`} />
            {today !== null && (
              <div className="absolute top-0 h-6 w-[2px] rounded bg-navy" style={{ left: `${Math.min(99.5, today)}%` }}>
                <span className="absolute -top-0.5 left-1 text-[9px] font-bold whitespace-nowrap text-navy">Today</span>
              </div>
            )}
            {p.milestone && <Flag className="absolute top-[3px] -right-1 size-3.5" style={{ color: NAVY }} />}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {Array.from({ length: span }, (_, i) => <span key={i} className="tabular">W{p.start_week + i}</span>)}
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="tabular text-[22px] leading-none font-bold" style={{ color: PLAN_STATUS.done.color }}>{p.progress}%</div>
            <div className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-muted-foreground">done · {p.counts.done}/{work.length} activities <Explain x={p.explain} /></div>
          </div>
          <div className="hidden text-[11px] leading-snug xl:block">
            {(['in_progress', 'planned'] as const).map((k) => (
              <div key={k} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: PLAN_STATUS[k].color }} />{p.counts[k]} {PLAN_STATUS[k].label.toLowerCase()}</div>
            ))}
            {p.milestone && <div className="text-muted-foreground">Sign-off W{p.milestone.week}</div>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[11.5px] font-medium text-navy hover:underline">
              Activities <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
            </button>
            <Link to="/approach?view=plan" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-navy">Full plan <ArrowRight className="size-3" /></Link>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t px-4 py-2.5">
          {p.activities.map((a) => {
            const c = PLAN_STATUS[a.status]
            return (
              <div key={a.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_96px] items-center gap-4 py-[3px] text-[11.5px]">
                <span className="truncate" title={`${a.name} · ${a.deliverable}`}><span className="mr-1.5 text-[10px] text-muted-foreground">{a.id}</span>{a.name}</span>
                <span className="relative h-3.5 rounded bg-muted/50">
                  {a.status === 'milestone'
                    ? <span className="absolute top-0.5 size-2.5 rotate-45" style={{ left: `calc(${pos(a.start_week) + 100 / span / 2}% - 5px)`, background: c.color }} />
                    : <span className="absolute inset-y-0 rounded" style={{ left: `${pos(a.start_week)}%`, width: `${((a.end_week - a.start_week + 1) / span) * 100}%`, background: a.status === 'planned' ? tint(NAVY, 0.15) : c.color }} />}
                  {today !== null && <span className="absolute inset-y-[-2px] w-px bg-navy" style={{ left: `${today}%` }} />}
                </span>
                <span className="flex items-center gap-1.5 text-[10.5px]"><span className="size-1.5 rounded-full" style={{ background: c.color }} />{c.label}</span>
              </div>
            )
          })}
          <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground"><ProvenanceBadge source={p.source} /> Status is maintained on Approach &amp; Plan › Detailed Work Plan.</div>

        </div>
      )}
    </div>
  )
}

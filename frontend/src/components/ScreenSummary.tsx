import type { ReactNode } from 'react'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ScreenKey } from '@/lib/api'
import { SCREEN_BY_KEY } from '@/lib/screens'
import { cn } from '@/lib/utils'

/** RFP architecture views (Coromandel RFP, Architecture Documentation & Repository) by number. */
export const RFP_VIEWS: Record<number, string> = {
  1: 'Enterprise-level architecture and overall technology landscape',
  2: 'Business capability and business-IT alignment views',
  3: 'Application portfolio and application architecture',
  4: 'Application dependencies and interaction views',
  5: 'Integration, API and data-flow architecture',
  6: 'Data and analytics architecture',
  7: 'Infrastructure and platform architecture',
  8: 'Network and connectivity architecture',
  9: 'Cloud and hybrid architecture',
  10: 'Cybersecurity and resilience architecture',
  11: 'Technology standards and technology lifecycle views',
  12: 'Key architecture decisions, principles, standards and patterns',
  13: 'Current-state, target-state and transition-state views',
  14: 'E2E views for critical business processes / services',
}

/** Status line under the page header: what the screen covers (deep links), what it produces, which RFP views it delivers. */
export function ScreenSummary({ screen, active, onPick, status }: { screen: ScreenKey; active?: string; onPick: (view: string) => void; status?: ReactNode }) {
  const s = SCREEN_BY_KEY[screen].summary
  return (
    <section className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-5 rounded-xl border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">On this screen</div>
        <div className="flex flex-wrap gap-1.5">
          {s.covers.map((c) => (
            <button key={c.view} onClick={() => onPick(c.view)}
              className={cn('inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11.5px] font-medium transition-colors hover:border-navy hover:text-navy',
                active === c.view ? 'border-navy bg-navy text-white hover:text-white' : 'bg-card text-foreground/80')}>
              {c.label}
            </button>
          ))}
        </div>
        {status && <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><ArrowRight className="size-3 shrink-0" /><span>{status}</span></div>}
      </div>
      <div className="min-w-0 border-l pl-5">
        <div className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">What you get</div>
        <ul className="space-y-0.5">
          {s.outputs.map((o) => (
            <li key={o} className="flex items-start gap-1.5 text-[12px] leading-snug">
              <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-navy" />{o}
            </li>
          ))}
        </ul>
      </div>
      <div className="border-l pl-5">
        <div className="mb-1.5 text-[10.5px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase">RFP views</div>
        <div className="grid grid-cols-3 gap-1">
          {s.rfp.map((n) => (
            <Tooltip key={n}>
              <TooltipTrigger asChild>
                <span className="tabular inline-flex size-7 cursor-default items-center justify-center rounded-md bg-navy-soft text-[12px] font-bold text-navy">{n}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">View {n}: {RFP_VIEWS[n]}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </section>
  )
}

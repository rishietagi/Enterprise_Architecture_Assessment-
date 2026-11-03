import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Step { key: string; n: number; label: string; sub: string }

/** Numbered step strip used at the top of every phase screen. */
export function StepBar({ steps, active, onPick }: { steps: Step[]; active: string; onPick: (k: string) => void }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => (
        <button key={s.key} onClick={() => onPick(s.key)}
          className={cn('relative flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
            active === s.key ? 'border-navy bg-navy text-white' : 'bg-card hover:border-navy/50')}>
          <span className={cn('tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', active === s.key ? 'bg-white text-navy' : 'bg-navy-soft text-navy')}>{s.n}</span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold">{s.label}</span>
            <span className={cn('block truncate text-[10.5px]', active === s.key ? 'text-white/75' : 'text-muted-foreground')}>{s.sub}</span>
          </span>
          {i < steps.length - 1 && <ChevronRight className="absolute top-1/2 -right-[11px] z-10 size-3.5 -translate-y-1/2 rounded-full bg-background text-muted-foreground" />}
        </button>
      ))}
    </div>
  )
}

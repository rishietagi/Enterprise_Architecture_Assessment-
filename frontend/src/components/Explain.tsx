import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Explanation } from '@/lib/api'
import { cn } from '@/lib/utils'

/** (i) icon that opens the rule trace behind a number: inputs, formula result, rule fired, TOGAF ref. */
export function Explain({ x, className, label = 'How is this calculated?' }: { x?: Explanation | null; className?: string; label?: string }) {
  if (!x) return null
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={label}
          title={label}
          onClick={(e) => e.stopPropagation()}
          className={cn('inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-navy', className)}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] p-0" onClick={(e) => e.stopPropagation()}>
        <ExplainBody x={x} />
      </PopoverContent>
    </Popover>
  )
}

export function ExplainBody({ x }: { x: Explanation }) {
  return (
    <div className="text-xs">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-2.5">
        <div>
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">How this is calculated</div>
          <div className="text-[13px] font-semibold text-foreground">{x.title}</div>
        </div>
        {x.ref && <span className="mt-0.5 shrink-0 rounded bg-navy-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-navy">TOGAF {x.ref}</span>}
      </div>
      {x.lines.length > 0 && (
        <div className="scrollbar-thin max-h-60 overflow-y-auto px-4 py-2">
          <table className="w-full">
            <tbody>
              {x.lines.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="w-[42%] py-1 pr-3 text-muted-foreground">{l.label}</td>
                  <td className="tabular py-1 font-medium text-foreground">{l.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="tabular border-t bg-navy-soft/50 px-4 py-2 font-semibold text-navy">{x.result}</div>
      {x.rule && <div className="border-t px-4 py-2 leading-snug text-muted-foreground"><span className="font-semibold text-foreground">Rule. </span>{x.rule}</div>}
    </div>
  )
}

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PROVENANCE, type Provenance } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function ProvenanceBadge({ source, className }: { source: string; className?: string }) {
  const p = PROVENANCE[(source in PROVENANCE ? source : 'assumed') as Provenance]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex h-[18px] shrink-0 items-center rounded-full border px-1.5 text-[10px] font-medium leading-none tracking-wide uppercase',
            source === 'assumed' && 'border-dashed',
            className,
          )}
          style={{ color: p.color, borderColor: p.color }}
        >
          {p.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{p.title}</TooltipContent>
    </Tooltip>
  )
}

export function ProvenanceLegend() {
  return (
    <div className="flex items-center gap-1.5">
      {(['deck', 'public', 'assumed', 'client'] as const).map((s) => (
        <ProvenanceBadge key={s} source={s} />
      ))}
    </div>
  )
}

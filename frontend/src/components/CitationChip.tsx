import { BookOpen } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Citation } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Inline [n] marker; click to see the TOGAF excerpt and its breadcrumb. */
export function CiteMarks({ cites, citations }: { cites: number[]; citations: Citation[] }) {
  if (!cites.length) return null
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {cites.map((n) => {
        const c = citations.find((x) => x.n === n)
        return c ? <CitationChip key={n} c={c} compact /> : null
      })}
    </span>
  )
}

export function CitationChip({ c, compact = false }: { c: Citation; compact?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex max-w-full items-center gap-1 rounded-md border border-navy/15 bg-navy-soft/60 font-medium text-navy transition-colors hover:bg-navy-soft',
            compact ? 'h-[18px] px-1 text-[10px]' : 'h-6 px-2 text-[11px]',
          )}
        >
          {compact ? (
            <span className="tabular">[{c.n}]</span>
          ) : (
            <>
              <BookOpen className="size-3 shrink-0" />
              <span className="tabular shrink-0">[{c.n}]</span>
              <span className="truncate">{c.label}</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[440px] p-0">
        <CitationBody c={c} />
      </PopoverContent>
    </Popover>
  )
}

export function CitationBody({ c }: { c: Citation }) {
  return (
    <div>
      <div className="border-b px-4 py-3">
        <div className="text-xs font-semibold text-navy">{c.label}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{c.breadcrumb}</div>
      </div>
      <div className="scrollbar-thin max-h-64 overflow-y-auto">
        <p className="px-4 py-3 text-xs leading-relaxed whitespace-pre-line text-foreground/90">{c.text}</p>
      </div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Lightbulb, Loader2, Sparkles, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, type Insight, type ScreenKey } from '@/lib/api'
import { CiteMarks } from './CitationChip'
import { AiModeBadge } from './FindingsCard'

/** AI insights for one tab: 3-4 rule-derived insights from the tab's data, rewritten and TOGAF-grounded on request. */
export function InsightsCard({ screen, tab, items }: { screen: ScreenKey; tab: string; items: Insight[] }) {
  // keyed to the tab's rule-based insights: when the data changes, an earlier AI rewrite is dropped instead of shown as current
  const sig = items.map((i) => i.text).join('|')
  const q = useQuery({ queryKey: ['insights', screen, tab, sig], queryFn: () => api.findings(screen, tab), enabled: false, staleTime: Infinity })
  const run = async () => {
    const r = await q.refetch()
    if (r.error) toast.error(`Insights failed: ${r.error.message}`)
    else if (r.data?.mode === 'fallback') toast.info('No Gemini key: insights stay rule-based, recommendations come from TOGAF excerpts')
  }
  const d = q.data
  const ai = d && d.mode !== 'fallback'
  const shown = ai ? d.findings.map((f) => ({ text: f.text, cites: f.cites, rule: f.rule })) : items.map((i) => ({ text: i.text, cites: [] as number[], rule: i.rule }))
  if (!items.length) return null
  return (
    <section className="rounded-xl border bg-gradient-to-br from-navy-soft/50 to-card px-4 py-3">
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="size-4 text-navy" />
        <span className="text-[13px] font-semibold">AI Insights</span>
        {d ? <AiModeBadge meta={d} /> : <Badge variant="outline" className="font-medium text-muted-foreground">From this tab's data</Badge>}
        <Button size="xs" variant="outline" className="ml-auto" onClick={run} disabled={q.isFetching}>
          {q.isFetching ? <Loader2 className="animate-spin" /> : <Sparkles />} {d ? 'Regenerate' : 'Generate with AI'}
        </Button>
      </div>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-2 xl:grid-cols-4">
        {shown.map((it, i) => (
          <li key={i} className="flex min-w-0 gap-2 text-[12.5px] leading-snug">
            <span className="tabular mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-navy text-[10.5px] font-bold text-white">{i + 1}</span>
            <span className="min-w-0 break-words">
              {it.text}
              {d && <CiteMarks cites={it.cites} citations={d.citations} />}
              {!ai && it.rule && <span className="ml-1 rounded bg-muted px-1 py-px text-[10px] font-medium text-muted-foreground">rule: {it.rule}</span>}
            </span>
          </li>
        ))}
      </ol>
      {d && d.recommendations.length > 0 && (
        <div className="mt-3 border-t pt-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"><Target className="size-3.5" /> What TOGAF suggests next</div>
          <ul className="grid grid-cols-3 gap-x-6 gap-y-1.5">
            {d.recommendations.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-[12px] leading-snug"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-navy" /><span>{r.text}<CiteMarks cites={r.cites} citations={d.citations} /></span></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

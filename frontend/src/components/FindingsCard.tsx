import { useQuery } from '@tanstack/react-query'
import { Lightbulb, Loader2, Sparkles, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type AiMeta, type CitedItem, type ScreenKey } from '@/lib/api'
import { CiteMarks } from './CitationChip'

export function AiModeBadge({ meta }: { meta: Pick<AiMeta, 'mode' | 'model'> }) {
  if (meta.mode === 'ai' || meta.mode === 'cached')
    return (
      <Badge variant="secondary" className="gap-1 font-medium">
        <Sparkles className="size-3" /> {meta.mode === 'cached' ? 'Cached' : 'Gemini'} · grounded
      </Badge>
    )
  return (
    <Badge variant="outline" className="font-medium text-muted-foreground">
      Offline · TOGAF excerpts
    </Badge>
  )
}

function ItemList({ items, meta, icon }: { items: CitedItem[]; meta: AiMeta; icon: React.ReactNode }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-snug">
          <span className="mt-0.5 text-navy [&_svg]:size-4">{icon}</span>
          <span>
            {it.text}
            <CiteMarks cites={it.cites} citations={meta.citations} />
            {it.rule && (
              <span className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] font-medium text-muted-foreground">rule: {it.rule}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function FindingsCard({ screen, sig = '' }: { screen: ScreenKey; sig?: string }) {
  const q = useQuery({ queryKey: ['findings', screen, sig], queryFn: () => api.findings(screen), enabled: false, staleTime: Infinity })
  const run = async () => {
    const r = await q.refetch()
    if (r.error) toast.error(`Insights failed: ${r.error.message}`)
    else if (r.data?.mode === 'fallback') toast.info('No Gemini key: insights come from rules, recommendations from TOGAF excerpts')
  }
  const d = q.data
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI Insights {d && <AiModeBadge meta={d} />}
        </CardTitle>
        <CardDescription>Narrative over the computed results. Every recommendation cites TOGAF 9.1.</CardDescription>
        <CardAction>
          <Button size="sm" onClick={run} disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="animate-spin" /> : <Sparkles />} {d ? 'Regenerate' : 'Generate insights'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {q.isFetching && !d ? (
          <div className="grid grid-cols-2 gap-8">
            {[0, 1].map((c) => (
              <div key={c} className="space-y-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ))}
          </div>
        ) : d ? (
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Insights</div>
              <ItemList items={d.findings} meta={d} icon={<Lightbulb />} />
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Recommendations</div>
              <ItemList items={d.recommendations} meta={d} icon={<Target />} />
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed py-5 text-center text-sm text-muted-foreground">
            Generate insights to get three insights and three TOGAF-grounded recommendations for this view.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

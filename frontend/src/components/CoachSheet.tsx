import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronDown, GraduationCap, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type AskResult, type Citation } from '@/lib/api'
import { screenForPath } from '@/lib/screens'
import { useShell } from '@/lib/shell'
import { CitationBody, CiteMarks } from './CitationChip'
import { AiModeBadge } from './FindingsCard'

function SourceRow({ c }: { c: Citation }) {
  return (
    <Collapsible className="rounded-lg border bg-card">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left">
        <span className="tabular flex size-5 shrink-0 items-center justify-center rounded bg-navy-soft text-[10px] font-semibold text-navy">
          {c.n}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{c.label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">
        <CitationBody c={c} />
      </CollapsibleContent>
    </Collapsible>
  )
}

export function CoachSheet() {
  const { coachOpen, setCoachOpen } = useShell()
  const screen = screenForPath(useLocation().pathname)
  const [q, setQ] = useState('')
  const [answers, setAnswers] = useState<AskResult[]>([])
  const coach = useQuery({
    queryKey: ['coach', screen.key],
    queryFn: () => api.coach(screen.key),
    enabled: coachOpen,
    staleTime: Infinity,
  })
  const ask = useMutation({
    mutationFn: (question: string) => api.ask(question, screen.key),
    onSuccess: (r) => {
      setAnswers((a) => [r, ...a].slice(0, 3))
      setQ('')
    },
    onError: (e: Error) => toast.error(`Ask failed: ${e.message}`),
  })
  const d = coach.data

  return (
    <Sheet open={coachOpen} onOpenChange={setCoachOpen}>
      <SheetContent side="right" className="flex w-[480px] flex-col gap-0 p-0 sm:max-w-[480px] [&>[data-slot=sheet-close]]:text-white [&>[data-slot=sheet-close]:hover]:bg-white/15">
        <SheetHeader className="border-b bg-navy px-5 py-4 text-white">
          <SheetTitle className="flex items-center gap-2 text-white">
            <GraduationCap className="size-5" /> TOGAF Coach
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-white/75">
            {screen.title}
            <span className="flex gap-1">
              {screen.phases.map((p) => (
                <span key={p} className="rounded bg-white/15 px-1.5 py-px text-[10px] font-semibold text-white">{p}</span>
              ))}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {coach.isLoading || !d ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">What TOGAF Says</h3>
                  <AiModeBadge meta={d} />
                </div>
                <ul className="space-y-2.5">
                  {d.guidance.map((g, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-snug">
                      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-navy" />
                      <span>
                        {g.text}
                        <CiteMarks cites={g.cites} citations={d.citations} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Next Actions</h3>
                <div className="space-y-1.5">
                  {d.next_actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg bg-navy-soft/60 px-3 py-2 text-sm text-navy">
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0" /> {a}
                    </div>
                  ))}
                </div>
              </section>

              {answers.map((a, i) => (
                <section key={i} className="rounded-lg border p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-foreground">{a.question}</div>
                    <AiModeBadge meta={a} />
                  </div>
                  <p className="text-sm leading-relaxed">
                    {a.answer}
                    <CiteMarks cites={a.cites} citations={a.citations} />
                  </p>
                </section>
              ))}

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <BookOpen className="size-3.5" /> Sources
                </h3>
                <div className="space-y-1.5">
                  {d.citations.map((c) => <SourceRow key={c.id} c={c} />)}
                </div>
              </section>
            </>
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t bg-muted/40 px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim().length >= 3) ask.mutate(q.trim())
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask TOGAF about this screen…" className="bg-card" />
          <Button type="submit" size="icon" disabled={ask.isPending || q.trim().length < 3}>
            {ask.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

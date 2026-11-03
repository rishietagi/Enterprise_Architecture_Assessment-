import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Grid3x3, Loader2, MessageSquareText, Sigma } from 'lucide-react'
import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { useBusinessUpdate } from '@/components/CapabilityModules'
import { Explain } from '@/components/Explain'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { api, type Business, type CapRow } from '@/lib/api'
import { BAND, NAVY, SLATE, bandColor, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { ScoreChip, StatusPill, answerLabel } from './shared'

export function l2Ready(c: CapRow): 'stale' | 'analysed' | 'ready' | 'collecting' | 'not_started' {
  const d = c.discovery
  if (d.analysed && d.stale) return 'stale'
  if (d.analysed) return 'analysed'
  if (d.inference.ready) return 'ready'
  if (d.rollup.generated) return 'collecting'
  return 'not_started'
}

/** Every L3 answer for one L2 side by side, with free-text comments under each answer. */
export function ResponseMatrix({ b, c, onClose }: { b: Business; c: CapRow | null; onClose: () => void }) {
  const qs = c?.l3.find((x) => x.survey)?.survey?.questions ?? []
  return (
    <Dialog open={!!c} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-6xl">
        {c && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Response Matrix · {c.name}</DialogTitle>
              <DialogDescription>{c.id} · {c.discovery.rollup.responded} of {c.l3.length} L3 answered.</DialogDescription>
            </DialogHeader>
            <div className="scrollbar-thin min-h-0 flex-1 overflow-auto rounded-lg border">
              <table className="w-full min-w-[800px] text-[11.5px]">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b text-left">
                    <th className="w-[220px] px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Question</th>
                    {c.l3.map((x) => <th key={x.id} className="px-2 py-1.5 align-bottom"><div className="text-[11px] font-semibold">{x.name}</div><div className="mt-0.5"><StatusPill s={x.status} small /></div></th>)}
                  </tr>
                </thead>
                <tbody>
                  {qs.map((q, i) => (
                    <tr key={q.id} className={cn('border-b align-top last:border-0', q.dim && 'bg-navy-soft/15')}>
                      <td className="px-2.5 py-1.5"><div className="text-[10px] font-bold text-navy">Q{i + 1}{q.dim ? ` · ${q.dim}` : ''}</div><div className="font-medium">{q.label}</div></td>
                      {c.l3.map((x) => {
                        const sq = x.survey?.questions.find((y) => y.id === q.id) ?? q
                        const v = x.survey?.answers[q.id]
                        const note = (x.survey?.answers.comments as Record<string, string> | undefined)?.[q.id]
                        if (x.status !== 'responded') return <td key={x.id} className="px-2 py-1.5 text-[10.5px] text-muted-foreground italic">Pending</td>
                        return (
                          <td key={x.id} className="px-2 py-1.5">
                            {typeof v === 'number' ? <span className="flex items-start gap-1"><ScoreChip v={v} size="sm" /><span className="line-clamp-2 leading-snug">{sq.options?.[v - 1]}</span></span>
                              : <span className="line-clamp-3 leading-snug">{answerLabel(sq, v, b.apps) || <span className="text-muted-foreground">–</span>}</span>}
                            {note && <div className="mt-0.5 text-[10.5px] text-muted-foreground italic">“{note}”</div>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** L2 scores inferred from the L3 responses: one card per dimension with the L3 inputs, an auto comment and the consultant's comment. */
export function L2Scores({ b, c }: { b: Business; c: CapRow }) {
  const done = useBusinessUpdate()
  const inf = c.discovery.inference
  const [com, setCom] = useState<Record<string, string>>(c.discovery.comments)
  const [matrix, setMatrix] = useState(false)
  useEffect(() => setCom(c.discovery.comments), [c.id, c.discovery.comments])
  const save = useMutation({
    mutationFn: () => api.putComments(c.id, com),
    onSuccess: (d) => done(d, `Comments saved for ${c.name}`),
    onError: (e: Error) => toast.error(e.message),
  })
  const an = useMutation({
    mutationFn: () => api.analyse(c.id),
    onSuccess: (d) => done(d, `${c.name} analysed`),
    onError: (e: Error) => toast.error(e.message),
  })
  const dirty = JSON.stringify(com) !== JSON.stringify(c.discovery.comments)
  const k = l2Ready(c)
  if (!inf.ready) return <p className="rounded-lg border border-dashed px-3 py-6 text-center text-[12px] text-muted-foreground">Scores appear once the first L3 questionnaire for this capability is answered.</p>
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[12.5px] font-semibold">Inferred from {inf.answered} of {inf.total} L3 responses</div>
        {inf.pending.length > 0 && <span className="text-[11px] text-muted-foreground">pending: {inf.pending.join(', ')}</span>}
        <span className="ml-auto flex items-center gap-2">
          <Button size="xs" variant="outline" onClick={() => setMatrix(true)}><Grid3x3 /> Response Matrix</Button>
          {(k === 'ready' || k === 'stale') && <Button size="xs" onClick={() => an.mutate()} disabled={an.isPending}>{an.isPending ? <Loader2 className="animate-spin" /> : <Sigma />} {k === 'stale' ? 'Re-analyse' : 'Analyse & Adopt'}</Button>}
        </span>
      </div>
      {k === 'ready' && <p className="text-[11.5px] text-muted-foreground">Inferred values. They feed the assessment and gap register once analysed.</p>}
      {k === 'stale' && <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: BAND.developing }}><AlertTriangle className="size-3.5" /> New responses since the last analysis change the inference to {inf.q?.join(' / ')}.</p>}
      <div className="grid grid-cols-5 gap-2">
        {inf.dims.map((d) => {
          const col = d.key === 'IMP' ? NAVY : d.value !== null ? bandColor(d.value >= 3.5 ? 'strong' : d.value >= 2.5 ? 'developing' : d.value >= 1.5 ? 'weak' : 'critical') : SLATE
          return (
            <div key={d.key} className="flex flex-col rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-2 border-b px-2.5 py-1.5" style={{ borderTop: `3px solid ${col}`, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                <div className="text-[11.5px] leading-tight font-semibold">{d.label}</div>
                <span className="tabular text-[22px] leading-none font-bold" style={{ color: col }}>{d.value ?? '–'}</span>
              </div>
              <div className="space-y-0.5 px-2.5 py-1.5">
                {d.inputs.map((x) => (
                  <div key={x.id} className="flex items-center gap-1.5 text-[10.5px]">
                    <span className="min-w-0 flex-1 truncate" title={x.name}>{x.name}</span>
                    <span className="flex gap-[2px]">{[1, 2, 3, 4, 5].map((n) => <span key={n} className="size-[7px] rounded-[2px]" style={{ background: n <= x.value ? col : tint(SLATE, 0.18) }} />)}</span>
                  </div>
                ))}
                <div className="pt-0.5 text-[10px] text-muted-foreground">{d.key === 'IMP' ? 'highest' : 'mean'} of {d.inputs.length} = {d.key === 'IMP' ? d.value : d.mean}</div>
              </div>
              <div className="border-t px-2.5 py-1.5 text-[10.5px] leading-snug text-muted-foreground">{d.comment}</div>
              <div className="mt-auto border-t px-2 py-1.5">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><MessageSquareText className="size-3" /> Consultant Comment</div>
                <Textarea value={com[d.key] ?? ''} onChange={(e) => setCom({ ...com, [d.key]: e.target.value })} placeholder="Context, caveats, validation notes" className="min-h-12 text-[11px] md:text-[11px]" />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Explain x={inf.explain} label="How the L2 is inferred" />
        <span className="text-[10.5px] text-muted-foreground">{b.discovery.inference}</span>
        <AiAction size="xs" label="Draft Comments with AI" what="Consultant comments" from="the L3 answers and free-text comments" />
        <Button size="xs" variant="outline" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>Save comments</Button>
      </div>
      <ResponseMatrix b={b} c={matrix ? c : null} onClose={() => setMatrix(false)} />
    </div>
  )
}

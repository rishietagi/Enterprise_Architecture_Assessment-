import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRightLeft, CalendarClock, Check, ClipboardCheck, ClipboardCopy, FileSpreadsheet, HelpCircle, Loader2, Lock, Mail, Paperclip, Pencil, Plus, Send, Sparkles, Trash2, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { useBusinessUpdate } from '@/components/CapabilityModules'
import { Explain } from '@/components/Explain'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { api, type Business, type CapRow, type EmailDraft, type L3Row, type SurveyQuestion } from '@/lib/api'
import { BAND, DISC_STATUS, NAVY, QUADRANT, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { DIMS, ScoreChip, StatusPill, answerLabel } from './shared'

const DIM_LABEL: Record<string, string> = { P: 'Process', T: 'Technology & AI', D: 'Data', I: 'Integration', A1: 'Alignment · fit', A2: 'Alignment · partnering',
  A3: 'Alignment · reporting', A4: 'Alignment · change', A5: 'Alignment · adoption', IMP: 'Business criticality' }
const LOCKED = new Set(['P', 'T', 'D', 'I', 'IMP'])  // drive the maturity score and the gap rule, so they stay in every questionnaire
const DEFAULT_OPTS = ['Not in place', 'Ad hoc', 'Defined', 'Managed', 'Optimised']
export type SheetTab = 'questions' | 'orchestrate' | 'response' | 'history'

function when(at?: string) {
  if (!at) return ''
  const d = new Date(at)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function DimTag({ dim }: { dim: string | null }) {
  if (!dim) return <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">Fact</span>
  const align = dim.startsWith('A')
  return <span className="rounded px-1.5 py-px text-[10px] font-semibold" style={{ color: align ? QUADRANT.overserved.color : NAVY, background: tint(align ? QUADRANT.overserved.color : NAVY, 0.1) }}>{DIM_LABEL[dim]}</span>
}

// ---------------------------------------------------------------- email draft (orchestrate survey)
export function EmailDialog({ l3, kind, open, onClose }: { l3: L3Row; kind: EmailDraft['kind']; open: boolean; onClose: () => void }) {
  const done = useBusinessUpdate()
  const q = useQuery({ queryKey: ['email', l3.id, kind, l3.survey?.history.length], queryFn: () => api.emailDraft(l3.id, kind), enabled: open })
  const [f, setF] = useState<EmailDraft | null>(null)
  useEffect(() => { if (q.data) setF(q.data) }, [q.data])
  const send = useMutation({
    mutationFn: () => api.sendSurvey(l3.id, { to_role: f!.to_role, to: f!.to, subject: f!.subject, kind }),
    onSuccess: (d) => { done(d, `Survey orchestrated to ${f!.to_role} for ${l3.name}`); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  const mailto = f ? `mailto:${encodeURIComponent(f.to)}?cc=${encodeURIComponent(f.cc)}&subject=${encodeURIComponent(f.subject)}&body=${encodeURIComponent(f.body)}` : '#'
  const title = { initial: 'Orchestrate Survey', explain: 'Resend with Explanations', redirect: 'Send to the Redirected Owner' }[kind]
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Mail className="size-4 text-navy" /> {title}</DialogTitle>
          <DialogDescription>Auto-drafted from the finalised questionnaire, which goes out as an attached Excel workbook. Edit the message, then send.</DialogDescription>
        </DialogHeader>
        {!f ? <div className="flex h-40 items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div> : (
          <div className="grid gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">To (business owner)
                <Input value={f.to_role} onChange={(e) => setF({ ...f, to_role: e.target.value })} className="h-8 text-foreground" />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Email address
                <Input value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="h-8 text-foreground" placeholder={`name@${f.domain}`} />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Cc
              <Input value={f.cc} onChange={(e) => setF({ ...f, cc: e.target.value })} className="h-8 text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Subject
              <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} className="h-8 text-foreground" />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Message
              <Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="scrollbar-thin h-56 font-mono text-[11.5px] leading-relaxed text-foreground md:text-[11.5px]" />
            </label>
            <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md" style={{ background: tint(BAND.strong, 0.12) }}><FileSpreadsheet className="size-4.5" style={{ color: BAND.strong }} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold">{f.attachment.name}</span>
                <span className="block truncate text-[10.5px] text-muted-foreground">{f.attachment.size_kb} KB · sheets: {f.attachment.sheets.join(', ')} · columns: {f.attachment.columns.join(' | ')}</span>
              </span>
              <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">Attached</span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-2.5">
              <div className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Reply options in the email</div>
              <div className="flex flex-wrap gap-2">
                {f.options.map((o) => {
                  const Icon = o.key === 'submitted' ? Check : o.key === 'redirected' ? ArrowRightLeft : HelpCircle
                  const c = o.key === 'submitted' ? BAND.strong : o.key === 'redirected' ? BAND.weak : BAND.developing
                  return <span key={o.key} className="inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-semibold" style={{ color: c, borderColor: tint(c, 0.5), background: tint(c, 0.08) }}><Icon className="size-3.5" />{o.label}</span>
                })}
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-[11px] text-muted-foreground">In the POC, Send records the survey as orchestrated; no mail leaves the tool.</span>
          <span className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={!f} onClick={() => { navigator.clipboard?.writeText(`${f!.subject}\n\n${f!.body}`); toast.success('Email copied') }}><ClipboardCopy /> Copy</Button>
            <Button variant="outline" size="sm" asChild disabled={!f}><a href={mailto}><Mail /> Open in mail app</a></Button>
            <Button size="sm" disabled={!f || send.isPending} onClick={() => send.mutate()}>{send.isPending ? <Loader2 className="animate-spin" /> : <Send />} Send</Button>

          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- questionnaire editor (review, edit, finalise)
function QuestionsTab({ l3, b, onGenerated, onFinalised }: { l3: L3Row; b: Business; onGenerated: () => void; onFinalised: (next: L3Row | null) => void }) {
  const done = useBusinessUpdate()
  const sv = l3.survey
  const editable = !!sv && ['draft', 'walkthrough', 'redirected'].includes(sv.status)
  const [edit, setEdit] = useState(false)
  const [qs, setQs] = useState<SurveyQuestion[]>([])
  useEffect(() => { setQs(sv?.questions ?? []); setEdit(!!sv && sv.status === 'draft' && !sv.finalised) }, [sv])
  const dirty = JSON.stringify(qs) !== JSON.stringify(sv?.questions ?? [])
  const nextToReview = () => b.l1.flatMap((l) => l.children).find((c) => c.id === l3.l2_id)?.l3.find((x) => x.id !== l3.id && x.status === 'draft' && !x.survey?.finalised) ?? null
  const gen = useMutation({
    mutationFn: () => api.genSurvey(l3.id),
    onSuccess: (d) => { done(d, `Questionnaire generated for ${l3.name}: review it, then finalise`); onGenerated() },
    onError: (e: Error) => toast.error(e.message),
  })
  const save = useMutation({
    mutationFn: () => api.putQuestions(l3.id, qs),
    onSuccess: (d) => done(d, 'Questionnaire saved'),
    onError: (e: Error) => toast.error(e.message),
  })
  const fin = useMutation({
    mutationFn: async () => {
      if (dirty) await api.putQuestions(l3.id, qs)
      return api.finaliseSurvey(l3.id)
    },
    onSuccess: (d) => { done(d, `Questionnaire finalised for ${l3.name}`); setEdit(false); onFinalised(nextToReview()) },
    onError: (e: Error) => toast.error(e.message),
  })
  const reopen = useMutation({
    mutationFn: () => api.putQuestions(l3.id, sv!.questions),
    onSuccess: (d) => { done(d, 'Questionnaire reopened for edits'); setEdit(true) },
    onError: (e: Error) => toast.error(e.message),
  })
  const upd = (id: string, patch: Partial<SurveyQuestion>) => setQs(qs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const add = (type: 'text' | 'choice') => setQs([...qs, { id: `custom-${Date.now().toString(36)}`, dim: null, type, label: type === 'choice' ? 'Additional rated question' : 'Additional question', text: '', ...(type === 'choice' ? { options: [...DEFAULT_OPTS] } : {}) }])
  if (!sv)
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center">
        <Sparkles className="size-6 text-navy" />
        <div className="text-sm font-semibold">No questionnaire yet</div>
        <p className="max-w-md text-[12.5px] text-muted-foreground">
          Generates 13 questions for this L3: owner and systems, the four maturity dimensions, five business–IT alignment questions, business criticality, and one question specific to this process. You then review, edit and finalise it before it goes out.
        </p>
        <Button onClick={() => gen.mutate()} disabled={gen.isPending}>{gen.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate Questionnaire</Button>
      </div>
    )
  return (
    <div className="space-y-2">
      {sv.status === 'draft' && (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px]" style={sv.finalised ? { borderColor: tint(BAND.strong, 0.5), background: tint(BAND.strong, 0.06) } : { borderColor: tint(NAVY, 0.3), background: tint(NAVY, 0.04) }}>
          {sv.finalised ? <Lock className="size-4" style={{ color: BAND.strong }} /> : <ClipboardCheck className="size-4 text-navy" />}
          <span className="flex-1">{sv.finalised ? <><b>Finalised.</b> The questionnaire is locked and ready to orchestrate.</> : <><b>Review before it goes out.</b> Edit the wording, add or delete questions, then finalise.</>}</span>
          {sv.finalised && <Button size="xs" variant="ghost" onClick={() => reopen.mutate()} disabled={reopen.isPending}><Pencil /> Reopen</Button>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-muted-foreground">{qs.length} questions · {qs.filter((q) => q.dim).length} scored · every question has a free-text comment</span>
        {edit ? (
          <span className="ml-auto flex gap-1.5">
            <Button size="xs" variant="outline" onClick={() => add('text')}><Plus /> Text question</Button>
            <Button size="xs" variant="outline" onClick={() => add('choice')}><Plus /> Rated question</Button>
            {!(sv.status === 'draft' && !sv.finalised) && <Button size="xs" variant="ghost" onClick={() => { setQs(sv.questions); setEdit(false) }}><X /> Cancel</Button>}
            <Button size="xs" variant="outline" onClick={() => save.mutate()} disabled={!dirty || save.isPending || qs.some((q) => !q.text.trim())}>Save</Button>
          </span>
        ) : (
          <span className="ml-auto flex gap-1.5">
            {editable && <Button size="xs" variant="ghost" onClick={() => window.confirm('Regenerate from the template? Edits are replaced.') && gen.mutate()} disabled={gen.isPending}><Sparkles /> Regenerate</Button>}
            {editable && !(sv.status === 'draft' && sv.finalised) && <Button size="xs" variant="outline" onClick={() => setEdit(true)}><Pencil /> Edit</Button>}
          </span>
        )}
      </div>
      <ol className="space-y-1.5">
        {qs.map((q, i) => (
          <li key={q.id} className="rounded-lg border px-3 py-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="tabular text-[11px] font-bold text-navy">Q{i + 1}</span>
              {edit ? <Input value={q.label} onChange={(e) => upd(q.id, { label: e.target.value })} className="h-6 max-w-72 px-1.5 text-[12px] font-semibold" />
                : <span className="text-[12px] font-semibold">{q.label}</span>}
              <DimTag dim={q.dim} />
              {q.generated && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-navy"><Sparkles className="size-3" /> process-specific</span>}
              {edit && (LOCKED.has(q.dim ?? '') || q.id === 'owner'
                ? <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground" title="Drives the maturity score, so it stays in every questionnaire"><Lock className="size-3" /> Required</span>
                : <Button variant="ghost" size="icon-sm" className="ml-auto size-6 text-muted-foreground hover:text-destructive" onClick={() => setQs(qs.filter((x) => x.id !== q.id))} aria-label="Delete question"><Trash2 /></Button>)}
            </div>
            {edit ? <Textarea value={q.text} placeholder="Question text" onChange={(e) => upd(q.id, { text: e.target.value })} className="min-h-12 text-[12.5px] md:text-[12.5px]" />
              : <div className="text-[12.5px] leading-snug">{q.text}</div>}
            {q.options && (
              <div className="mt-1.5 grid grid-cols-5 gap-1">
                {q.options.map((o, n) => edit && !q.dim
                  ? <Input key={n} value={o} onChange={(e) => upd(q.id, { options: q.options!.map((x, j) => (j === n ? e.target.value : x)) })} className="h-7 px-1.5 text-[10.5px]" />
                  : <div key={n} className="rounded border bg-muted/30 px-1.5 py-1 text-[10px] leading-tight"><b className="text-navy">{n + 1}</b> {o}</div>)}
              </div>
            )}
            <div className="mt-1 text-[10.5px] text-muted-foreground italic">{q.type === 'text' ? 'Answer in free text' : `${q.options ? 'Answer 1–5' : 'Select systems'} · plus a free-text comment`}</div>
          </li>
        ))}
      </ol>
      {sv.status === 'draft' && !sv.finalised && (
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-background pt-2">
          <span className="mr-auto text-[11px] text-muted-foreground">Finalising locks the questionnaire; you can reopen it until it is sent.</span>
          <Button size="sm" onClick={() => fin.mutate()} disabled={fin.isPending || qs.some((q) => !q.text.trim())}>{fin.isPending ? <Loader2 className="animate-spin" /> : <Check />} Finalise Questionnaire</Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- response form / filled form
function ChoiceInput({ q, v, onChange }: { q: SurveyQuestion; v: number | undefined; onChange: (n: number) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {q.options!.map((o, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1)}
          className={cn('flex flex-col items-start gap-0.5 rounded-md border px-1.5 py-1 text-left transition-colors', v === i + 1 ? 'border-navy bg-navy-soft' : 'hover:bg-muted/50')}>
          <span className="tabular text-[11px] font-bold text-navy">{i + 1}</span>
          <span className="line-clamp-3 text-[10px] leading-[12px]">{o}</span>
        </button>
      ))}
    </div>
  )
}

function FilledForm({ l3, b }: { l3: L3Row; b: Business }) {
  const sv = l3.survey!
  const sc = l3.score
  const notes = (sv.answers.comments as Record<string, string> | undefined) ?? {}
  return (
    <div className="space-y-3">
      {sc && (
        <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto_auto] items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          {DIMS.map((d, i) => <div key={d.key} className="text-center"><div className="text-[10px] font-semibold text-muted-foreground uppercase">{d.label}</div><ScoreChip v={sc.q[i]} /></div>)}
          <div className="border-l pl-3 text-center"><div className="text-[10px] font-semibold text-muted-foreground uppercase">L3 maturity</div><span className="inline-flex items-center gap-1"><ScoreChip v={sc.maturity} band={sc.band} size="lg" /><Explain x={sc.explain} /></span></div>
          <div className="border-l pl-3 text-center"><div className="text-[10px] font-semibold text-muted-foreground uppercase">Alignment</div>
            <span className="text-[12px] font-semibold" style={{ color: l3.quadrant ? QUADRANT[l3.quadrant.key].color : undefined }}>{sc.alignment?.toFixed(1) ?? '–'} · {l3.quadrant ? QUADRANT[l3.quadrant.key].label : '–'}</span></div>
        </div>
      )}
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        {sv.channel === 'workshop' ? <><Users className="size-3.5" /> Captured in a workshop</> : <><Mail className="size-3.5" /> Returned by email</>}
        <ProvenanceBadge source={sv.source} />
        {sc?.is_gap && <span className="rounded px-1.5 text-[10.5px] font-semibold" style={{ color: BAND.critical, background: tint(BAND.critical) }}>L3 gap · weakest: {sc.weakest}</span>}
      </div>
      <table className="w-full text-[12.5px]">
        <tbody>
          {sv.questions.map((q, i) => {
            const v = sv.answers[q.id]
            return (
              <tr key={q.id} className="border-b align-top last:border-0">
                <td className="w-[46%] py-1.5 pr-3"><div className="text-[11px] font-semibold text-muted-foreground">Q{i + 1} · {q.label}</div><div className="leading-snug">{q.text}</div></td>
                <td className="py-1.5">
                  {typeof v === 'number' ? <span className="flex items-start gap-1.5"><ScoreChip v={v} size="sm" /><span className="leading-snug">{q.options?.[v - 1]}</span></span>
                    : answerLabel(q, v, b.apps) || <span className="text-muted-foreground">Not answered</span>}
                  {notes[q.id] && <div className="mt-0.5 text-[11.5px] text-muted-foreground italic">“{notes[q.id]}”</div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sv.note && <div className="rounded-lg border-l-[3px] border-navy bg-navy-soft/40 px-3 py-2 text-[12.5px]"><span className="font-semibold">Owner's note. </span>{sv.note}</div>}
    </div>
  )
}

function ResponseTab({ l3, b, workshop, onDone }: { l3: L3Row; b: Business; workshop: boolean; onDone: () => void }) {
  const done = useBusinessUpdate()
  const sv = l3.survey
  const [mode, setMode] = useState<'workshop' | 'email'>(workshop ? 'workshop' : 'email')
  const [outcome, setOutcome] = useState<'submitted' | 'redirected' | 'walkthrough'>('submitted')
  const [ans, setAns] = useState<Record<string, unknown>>({})
  const [note, setNote] = useState('')
  const [redirect, setRedirect] = useState('')
  useEffect(() => { setMode(workshop ? 'workshop' : 'email'); setAns({}); setNote(''); setOutcome('submitted') }, [l3.id, workshop])
  const save = useMutation({
    mutationFn: () => api.respond(l3.id, { outcome: mode === 'workshop' ? 'submitted' : outcome, channel: mode, answers: ans, note, redirect_to: redirect || null }),
    onSuccess: (d) => {
      done(d, outcome === 'submitted' || mode === 'workshop' ? `Response recorded for ${l3.name}` : outcome === 'walkthrough' ? 'Walkthrough requested: resend with explanations' : 'Redirect recorded')
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  if (!sv) return <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Generate the questionnaire first.</p>
  if (sv.status === 'responded') return <FilledForm l3={l3} b={b} />
  const answering = mode === 'workshop' || outcome === 'submitted'
  const scored = sv.questions.filter((q) => q.dim)
  const notes = (ans.comments as Record<string, string> | undefined) ?? {}
  const setQNote = (id: string, v: string) => setAns({ ...ans, comments: { ...notes, [id]: v } })
  const complete = scored.every((q) => typeof ans[q.id] === 'number')
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {([['email', Mail, "Record the owner's email reply"], ['workshop', Users, 'Fill in during a workshop']] as const).map(([k, Icon, label]) => (
          <button key={k} onClick={() => setMode(k)} className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] font-medium', mode === k ? 'border-navy bg-navy-soft text-navy' : 'hover:bg-muted/40')}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>
      {mode === 'email' && (
        <div className="flex gap-1.5">
          {b.discovery.response_options.map((o) => (
            <button key={o.key} onClick={() => setOutcome(o.key as typeof outcome)} title={o.hint}
              className={cn('flex-1 rounded-md border px-2 py-1.5 text-[12px] font-semibold', outcome === o.key ? 'border-navy bg-navy text-white' : 'hover:bg-muted/40')}>{o.label}</button>
          ))}
        </div>
      )}
      {mode === 'email' && outcome === 'redirected' && (
        <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Redirected to (role, email)
          <Input value={redirect} onChange={(e) => setRedirect(e.target.value)} className="h-8 text-foreground" placeholder="e.g. Finance Controller, Dhaksha" />
        </label>
      )}
      {answering && (
        <ol className="space-y-2.5">
          {sv.questions.map((q, i) => (
            <li key={q.id} className="space-y-1">
              <div className="flex items-start gap-2 text-[12.5px] leading-snug"><span className="tabular font-bold text-navy">Q{i + 1}</span><span className="flex-1">{q.text}</span><DimTag dim={q.dim} /></div>
              {q.type === 'choice' ? <ChoiceInput q={q} v={ans[q.id] as number | undefined} onChange={(n) => setAns({ ...ans, [q.id]: n })} />
                : q.type === 'apps' ? (
                  <div className="space-y-1.5">
                    <div className="scrollbar-thin grid max-h-28 grid-cols-2 gap-x-3 gap-y-0.5 overflow-y-auto rounded-md border p-2">
                      {b.apps.map((a) => {
                        const cur = (ans[q.id] as { apps?: string[]; other?: string }) ?? {}
                        const on = cur.apps?.includes(a.id) ?? false
                        return (
                          <label key={a.id} className="flex items-center gap-1.5 text-[11.5px]">
                            <Checkbox checked={on} onCheckedChange={() => setAns({ ...ans, [q.id]: { ...cur, apps: on ? cur.apps!.filter((x) => x !== a.id) : [...(cur.apps ?? []), a.id] } })} />
                            <span className="truncate">{a.name}</span>
                          </label>
                        )
                      })}
                    </div>
                    <Input placeholder="Other tools: Excel trackers, email, portals" className="h-8 text-[12.5px]"
                      onChange={(e) => setAns({ ...ans, [q.id]: { ...((ans[q.id] as object) ?? {}), other: e.target.value } })} />
                  </div>
                ) : <Input className="h-8 text-[12.5px]" value={(ans[q.id] as string) ?? ''} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} />}
              {q.type !== 'text' && <Input className="h-7 border-dashed text-[11.5px]" placeholder="Comments (optional free text)" value={notes[q.id] ?? ''} onChange={(e) => setQNote(q.id, e.target.value)} />}
            </li>
          ))}
        </ol>
      )}
      <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">{outcome === 'walkthrough' && mode === 'email' ? 'What they want walked through' : 'Notes, pain points, ideas'}
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-14 text-[12.5px] text-foreground md:text-[12.5px]" />
      </label>
      <div className="flex items-center justify-between border-t pt-2.5">
        <span className="text-[11px] text-muted-foreground">{answering ? `${scored.filter((q) => typeof ans[q.id] === 'number').length} of ${scored.length} scored questions answered` : ''}</span>
        <Button onClick={() => save.mutate()} disabled={save.isPending || (answering && !complete)}>{save.isPending && <Loader2 className="animate-spin" />} {answering ? 'Submit response' : 'Record reply'}</Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the sheet
export function SurveySheet({ l3, b, tab, onTab, onClose, onNext }: { l3: L3Row | null; b: Business; tab: SheetTab; onTab: (t: SheetTab) => void; onClose: () => void; onNext?: (id: string, tab: SheetTab) => void }) {
  const [mail, setMail] = useState<EmailDraft['kind'] | null>(null)
  const [workshop, setWorkshop] = useState(false)
  const l2 = useMemo(() => (l3 ? b.l1.flatMap((l) => l.children).find((c) => c.id === l3.l2_id) : undefined), [l3, b])
  useEffect(() => { setWorkshop(false) }, [l3?.id])
  const steps = l3 ? [
    { label: 'Generated', on: l3.status !== 'not_generated' },
    { label: 'Finalised', on: l3.status !== 'not_generated' && (l3.status !== 'draft' || !!l3.survey?.finalised) },
    { label: 'Orchestrated', on: ['sent', 'walkthrough', 'redirected', 'responded'].includes(l3.status) },
    { label: 'Responded', on: l3.status === 'responded' },
    { label: 'Analysed at L2', on: !!l2?.discovery.analysed && l3.status === 'responded' },
  ] : []
  return (
    <Dialog open={!!l3} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {l3 && l2 && (
          <>
            <DialogHeader className="border-b px-5 py-3.5 text-left">
              <DialogTitle className="pr-8">{l3.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">{l3.id} · {l2.l1} › {l2.name} <StatusPill s={l3.status} small /></DialogDescription>
              <div className="mt-1 flex items-center gap-1">
                {steps.map((s, i) => (
                  <span key={s.label} className="flex items-center gap-1">
                    <span className={cn('inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold', s.on ? 'bg-navy text-white' : 'bg-muted text-muted-foreground')}>{s.on && <Check className="size-3" />}{s.label}</span>
                    {i < steps.length - 1 && <span className="h-px w-4 bg-border" />}
                  </span>
                ))}
              </div>
            </DialogHeader>
            <Tabs value={tab} onValueChange={(v) => onTab(v as SheetTab)} className="flex min-h-0 flex-1 flex-col gap-0">
              <TabsList className="mx-5 mt-3 w-fit">
                <TabsTrigger value="questions">Questionnaire</TabsTrigger>
                <TabsTrigger value="orchestrate">Orchestrate</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-3">
                <TabsContent value="questions"><QuestionsTab l3={l3} b={b} onGenerated={() => onTab('questions')}
                  onFinalised={(next) => (next && onNext && window.confirm(`Finalised. Review the next questionnaire, ${next.name}?`) ? onNext(next.id, 'questions') : onTab('orchestrate'))} /></TabsContent>
                <TabsContent value="orchestrate">
                  {!l3.survey ? <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Generate the questionnaire first.</p>
                    : l3.status === 'draft' && !l3.survey.finalised ? (
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
                        <ClipboardCheck className="size-5 text-navy" />
                        <div className="text-sm font-semibold">Review and finalise the questionnaire first</div>
                        <p className="max-w-sm text-[12px] text-muted-foreground">Only a finalised questionnaire can be orchestrated to the business owner.</p>
                        <Button size="sm" variant="outline" onClick={() => onTab('questions')}>Open Questionnaire</Button>
                      </div>
                    ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border px-3 py-2 text-[12.5px]">
                        <div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Business owner</div>
                        <div className="font-medium">{l3.survey.recipient.role || l3.owner}{l3.survey.recipient.email && <span className="text-muted-foreground"> · {l3.survey.recipient.email}</span>}</div>
                        {l3.survey.redirect_to && <div className="mt-1 text-[12px]" style={{ color: BAND.weak }}>Redirected to: {l3.survey.redirect_to}</div>}
                      </div>
                      {l3.status === 'walkthrough' && (
                        <div className="rounded-lg border px-3 py-2 text-[12.5px]" style={{ borderColor: tint(BAND.developing, 0.6), background: tint(BAND.developing, 0.06) }}>
                          <b>Walkthrough requested.</b> {l3.survey.note} Resend the questions with an explanation under each, or take them through it live in a workshop.
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setMail(l3.status === 'walkthrough' ? 'explain' : l3.status === 'redirected' ? 'redirect' : 'initial')} disabled={l3.status === 'responded'}
                          className="flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-colors hover:border-navy disabled:opacity-50">
                          <Mail className="size-5 text-navy" />
                          <span className="text-[13px] font-semibold">{l3.status === 'walkthrough' ? 'Resend with explanations' : l3.status === 'redirected' ? 'Send to the redirected owner' : l3.status === 'sent' ? 'Resend survey email' : 'Orchestrate survey'}</span>
                          <span className="text-[11.5px] text-muted-foreground">Drafts an email to the business owner with the questionnaire attached as Excel and three reply options: submit, redirect, or request a walkthrough.</span>
                        </button>
                        <button onClick={() => { setWorkshop(true); onTab('response') }} disabled={l3.status === 'responded'}
                          className="flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-colors hover:border-navy disabled:opacity-50">
                          <Users className="size-5 text-navy" />
                          <span className="text-[13px] font-semibold">Fill in during a workshop</span>
                          <span className="text-[11.5px] text-muted-foreground">The consultant captures answers live with the owner. Recorded as a workshop response.</span>
                        </button>
                      </div>
                      {l3.status !== 'draft' && l3.status !== 'responded' && (
                        <Button variant="outline" size="sm" onClick={() => { setWorkshop(false); onTab('response') }}><CalendarClock /> Record the owner's reply</Button>
                      )}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="response"><ResponseTab l3={l3} b={b} workshop={workshop} onDone={() => onTab('response')} /></TabsContent>
                <TabsContent value="history">
                  <ol className="relative space-y-3 border-l pl-4">
                    {(l3.survey?.history ?? []).slice().reverse().map((h, i) => {
                      const c = h.event === 'submitted' || h.event === 'workshop' ? BAND.strong : h.event === 'walkthrough' ? BAND.developing : h.event === 'redirected' ? BAND.weak : NAVY
                      return (
                        <li key={i} className="relative">
                          <span className="absolute top-1 -left-[21px] size-2.5 rounded-full border-2 border-card" style={{ background: c }} />
                          <div className="text-[12.5px] font-semibold capitalize">{h.event}</div>
                          <div className="text-[11px] text-muted-foreground">{when(h.at)} · {h.by}</div>
                          {h.note && <div className="text-[12px]">{h.note}</div>}
                        </li>
                      )
                    })}
                    {!l3.survey && <li className="text-[12px] text-muted-foreground">Nothing yet.</li>}
                  </ol>
                </TabsContent>
              </div>
            </Tabs>
            {mail && <EmailDialog l3={l3} kind={mail} open onClose={() => setMail(null)} />}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function statusAction(s: L3Row['status'], finalised?: boolean): { label: string; tab: SheetTab } {
  switch (s) {
    case 'not_generated': return { label: 'Generate', tab: 'questions' }
    case 'draft': return finalised ? { label: 'Orchestrate', tab: 'orchestrate' } : { label: 'Review & Finalise', tab: 'questions' }

    case 'sent': return { label: 'Record reply', tab: 'response' }
    case 'walkthrough': return { label: 'Resend', tab: 'orchestrate' }
    case 'redirected': return { label: 'Redirect', tab: 'orchestrate' }
    default: return { label: 'View', tab: 'response' }
  }
}

export const STATUS_ORDER = Object.keys(DISC_STATUS) as L3Row['status'][]
export type { CapRow }

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileText, Loader2, Pencil, Plus, Save, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { CitationChip } from '@/components/CitationChip'
import { Explain } from '@/components/Explain'
import { AiModeBadge, FindingsCard } from '@/components/FindingsCard'
import { PageHeader } from '@/components/PageHeader'
import { TailoringRegister, ViewpointCatalog } from '@/components/Frameworks'
import { PhasePlan } from '@/components/PhasePlan'

import { RulesConfig } from '@/components/RulesConfig'
import { ScreenError, ScreenSkeleton } from '@/components/ScreenSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api, exportUrl, type Citation, type GuidelineKind, type Principle, type PrincipleSuggestion, type Vision as VisionT, type VisionStatement } from '@/lib/api'
import { useView } from '@/lib/screens'
import { BAND, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

type St = VisionStatement

/** Context box: free-text notes plus uploaded documents, read into themes that ground the vision statements. */
function ContextCard({ v }: { v: VisionT }) {
  const qc = useQueryClient()
  const c = v.context
  const [text, setText] = useState(c.text)
  const [drag, setDrag] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => setText(c.text), [c.text])
  const done = (d: VisionT, msg?: string) => { qc.setQueryData(['vision'], d); if (msg) toast.success(msg) }
  const save = useMutation({ mutationFn: () => api.putContext(text), onSuccess: (d) => done(d, 'Context saved'), onError: (e: Error) => toast.error(e.message) })
  const up = useMutation({
    mutationFn: (fs: File[]) => api.uploadContext(fs),
    onSuccess: (d) => {
      done(d)
      if (d.added.length) toast.success(`Read ${d.added.join(', ')}`)
      d.errors.forEach((e) => toast.error(e))
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const del = useMutation({ mutationFn: api.deleteContextDoc, onSuccess: (d) => done(d, 'Document removed') })
  const sample = useMutation({
    mutationFn: api.sampleContext,
    onSuccess: (d) => { done(d); setText(d.context.text); toast.success(`Sample context loaded: ${d.added.length} documents`) },
    onError: (e: Error) => toast.error(e.message),
  })
  const pick = (fl: FileList | null) => fl && fl.length && up.mutate(Array.from(fl))
  const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
  return (
    <Card className="col-span-5 gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Context & Documents</CardTitle>
        <CardDescription>Everything the vision should reflect: strategy notes, board papers, annual reports, RFP extracts. Documents are read on upload; only their text is kept.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => sample.mutate()} disabled={sample.isPending} title="Loads sample notes and three sample documents (labelled Sample)">
            {sample.isPending ? <Loader2 className="animate-spin" /> : <FileText />} Load Sample Context
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            <span>Context Notes</span>
            <Button size="xs" variant="ghost" onClick={() => save.mutate()} disabled={text === c.text || save.isPending}><Save /> Save</Button>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type context: strategic priorities, sponsor expectations, constraints, what success looks like by 2030."
            className="scrollbar-thin h-32 resize-none text-[12.5px] md:text-[12.5px]" />
        </div>
        <div role="button" tabIndex={0} onClick={() => file.current?.click()} onKeyDown={(e) => e.key === 'Enter' && file.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files) }}
          className={cn('flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 transition-colors hover:border-navy', drag && 'border-navy bg-navy-soft/40')}>
          {up.isPending ? <Loader2 className="size-5 animate-spin text-navy" /> : <Upload className="size-5 text-navy" />}
          <div className="text-[12px]"><span className="font-semibold">Upload documents</span><span className="block text-[11px] text-muted-foreground">PDF, Word, PowerPoint, Excel, text or Markdown · drop here or click · up to 10 at a time</span></div>
          <input ref={file} type="file" multiple hidden accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv" onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
        </div>
        {c.docs.length > 0 && (
          <div className="space-y-1">
            {c.docs.map((d) => (
              <div key={d.id} className="group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px]" title={d.preview}>
                <FileText className="size-4 shrink-0 text-navy" />
                <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                

                <span className="text-[10.5px] text-muted-foreground">{d.kind.toUpperCase()} · {kb(d.size)} · {d.words.toLocaleString('en-IN')} words</span>
                <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground opacity-0 group-hover:opacity-100" aria-label={`Remove ${d.name}`} onClick={() => del.mutate(d.id)}><Trash2 /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <div className="mb-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">What the Context Says</div>
          {c.themes.length ? (
            <div className="flex flex-wrap gap-1">{c.themes.map((t) => <span key={t.term} className="rounded-full border bg-card px-2 py-0.5 text-[11px]">{t.term} <span className="text-muted-foreground">{t.count}</span></span>)}</div>
          ) : <p className="text-[11.5px] text-muted-foreground">Add notes or upload documents to see the recurring themes.</p>}
          <div className="mt-2 text-[10.5px] text-muted-foreground">Also in context: {v.drivers.length} business drivers and {v.focus_areas.length} digital focus areas from the proposal ({v.focus_areas.map((f) => f.name).join(', ')}).</div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatementsCard({ v }: { v: VisionT }) {
  const qc = useQueryClient()
  const c = v.context
  const [sts, setSts] = useState<St[]>(c.statements)
  const [mode, setMode] = useState(c.mode)
  const [cits, setCits] = useState<Citation[]>(c.citations)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (!dirty) { setSts(c.statements); setMode(c.mode); setCits(c.citations) } }, [c.statements, c.mode, c.citations, dirty])
  const gen = useMutation({
    mutationFn: api.genStatements,
    onSuccess: (r) => {
      setSts(r.statements); setMode(r.mode); setCits(r.citations); setDirty(true)
      toast.success(r.mode === 'fallback' ? 'Five statements drafted from the context (no Gemini key). Review, edit and save.' : 'Five statements drafted. Review, edit and save.')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const save = useMutation({
    mutationFn: () => api.putStatements(sts, mode || 'edited', cits),
    onSuccess: (d) => { setDirty(false); qc.setQueryData(['vision'], d); qc.invalidateQueries({ queryKey: ['overview'] }); toast.success('Architecture vision saved') },
    onError: (e: Error) => toast.error(e.message),
  })
  const edit = (i: number, patch: Partial<St>) => { setSts(sts.map((x, j) => (j === i ? { ...x, ...patch } : x))); setMode('edited'); setDirty(true) }
  return (
    <Card className="col-span-7 gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Architecture Vision Statements 
          {(mode === 'ai' || mode === 'cached' || mode === 'fallback') && <AiModeBadge meta={{ mode, model: null }} />}
        </CardTitle>
        <CardDescription>Phase A deliverable · TOGAF §7.4, §36.2.8. Five statements of the target state, drawn from the context documents.</CardDescription>
        <CardAction className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>{gen.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} {sts.length ? 'Regenerate' : 'Analyse & Generate'}</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending || !sts.length}><Save /> Save</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {!sts.length && !gen.isPending ? (
          <div className="flex h-[360px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
            <Sparkles className="size-6 text-navy" />
            <div className="text-sm font-medium">No vision statements yet</div>
            <p className="max-w-sm text-xs text-muted-foreground">Add context and documents on the left, then analyse them to draft five architecture vision statements grounded in TOGAF Phase A.</p>
            <Button size="sm" className="mt-1" onClick={() => gen.mutate()}><Sparkles /> Analyse & Generate</Button>
          </div>
        ) : gen.isPending ? (
          <div className="flex h-[360px] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Reading the context…</div>
        ) : (
          sts.map((x, i) => (
            <div key={i} className="group rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-navy text-[10.5px] font-bold text-white">{i + 1}</span>
                <Input value={x.title} onChange={(e) => edit(i, { title: e.target.value })} className="h-7 border-0 px-1 text-[13px] font-semibold shadow-none focus-visible:ring-1" />
                <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground opacity-0 group-hover:opacity-100" aria-label="Remove" onClick={() => { setSts(sts.filter((_, j) => j !== i)); setMode('edited'); setDirty(true) }}><X /></Button>
              </div>
              <Textarea value={x.statement} onChange={(e) => edit(i, { statement: e.target.value })} className="mt-1 min-h-12 resize-none border-0 px-1 text-[12.5px] leading-snug shadow-none focus-visible:ring-1 md:text-[12.5px]" />
              {x.evidence.length > 0 && <div className="mt-0.5 border-l-2 pl-2 text-[11px] text-muted-foreground italic">{x.evidence.map((e) => `“${e}”`).join(' ')}</div>}
            </div>
          ))
        )}
        {sts.length > 0 && sts.length < 5 && <Button size="xs" variant="ghost" onClick={() => { setSts([...sts, { title: '', statement: '', drivers: [], evidence: [], cites: [] }]); setDirty(true) }}><Plus /> Add statement</Button>}
        {cits.length > 0 && sts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
            <span className="text-[11px] text-muted-foreground">Grounded in</span>
            {cits.slice(0, 4).map((ct) => <CitationChip key={ct.id} c={ct} />)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type GEdit = { kind: GuidelineKind; id?: string; name: string; statement?: string; category?: string; togaf_basis?: string; rationale?: string; implications?: string[]; enforced_by?: string; use?: string; principle?: string; active?: boolean }

function GuidelineDialog({ edit, onClose, onAdded, principles }: { edit: GEdit | null; onClose: () => void; onAdded: (id: string) => void; principles: Principle[] }) {
  const qc = useQueryClient()
  const [f, setF] = useState<GEdit | null>(null)
  const [hint, setHint] = useState('')
  const [ai, setAi] = useState<PrincipleSuggestion | null>(null)
  useEffect(() => { setF(edit); setAi(null); setHint('') }, [edit])
  const save = useMutation({
    mutationFn: () => {
      const g = { ...f!, implications: (f!.implications ?? []).map((x) => x.trim()).filter(Boolean) }
      return g.id ? api.putGuideline(g.id, g) : api.addGuideline(g)
    },
    onSuccess: (d) => {
      const ids = (x?: VisionT) => new Set(x ? [...x.principles.cil.map((p) => p.id), ...x.guardrails.map((g) => g.id), ...x.patterns.map((p) => p.id)] : [])
      const before = ids(qc.getQueryData<VisionT>(['vision']))
      const added = [...ids(d)].find((id) => !before.has(id))
      qc.setQueryData(['vision'], d)
      qc.invalidateQueries({ queryKey: ['overview'] })
      toast.success(`${f!.name} saved`)
      if (added) onAdded(added)
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const suggest = useMutation({
    mutationFn: () => api.suggestPrinciple(hint),
    onSuccess: (r) => {
      setAi(r)
      setF((x) => x && { ...x, name: r.name, statement: r.statement, rationale: r.rationale, implications: r.implications, category: r.category, togaf_basis: r.togaf_basis })
      toast.success(r.mode === 'fallback' ? 'Principle suggested from the context (no Gemini key). Edit before saving.' : 'Principle suggested. Edit before saving.')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const field = (label: string, key: keyof GEdit, area = false) => (
    <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">{label}
      {area
        ? <Textarea value={String(f?.[key] ?? '')} onChange={(e) => setF({ ...f!, [key]: e.target.value })} className="min-h-16 text-sm text-foreground" />
        : <Input value={String(f?.[key] ?? '')} onChange={(e) => setF({ ...f!, [key]: e.target.value })} className="h-8 text-foreground" />}
    </label>
  )
  const isP = f?.kind === 'principle'
  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', isP ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        {f && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">{f.id ? `Edit ${f.id}` : `Add ${f.kind === 'principle' ? 'Principle' : f.kind === 'guardrail' ? 'Guardrail' : 'Pattern'}`} {ai && <AiModeBadge meta={ai} />}</DialogTitle>
              <DialogDescription>{isP ? 'Architecture principle · TOGAF §23.4 template (name, statement, rationale, implications)' : f.kind === 'guardrail' ? 'Guardrail: a non-negotiable rule checked at design review or go-live' : 'Architecture pattern: a reusable solution approach tied to a principle'}</DialogDescription>
            </DialogHeader>
            {isP && !f.id && (
              <div className="flex items-center gap-2 rounded-lg border bg-navy-soft/30 px-3 py-2">
                <Sparkles className="size-4 shrink-0 text-navy" />
                <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Optional focus, e.g. drone telemetry, partner onboarding" className="h-8 bg-card text-[12.5px]" />
                <Button size="sm" variant="outline" onClick={() => suggest.mutate()} disabled={suggest.isPending}>{suggest.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest with AI</Button>
              </div>
            )}
            <div className="grid gap-3">
              {field('Name', 'name')}
              {f.kind !== 'pattern' && field('Statement', 'statement', true)}
              {isP && field('Rationale', 'rationale', true)}
              {isP && (
                <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Implications (one per line)
                  <Textarea value={(f.implications ?? []).join('\n')} onChange={(e) => setF({ ...f, implications: e.target.value.split('\n') })} className="min-h-16 text-sm text-foreground" />
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                {f.kind !== 'pattern' && field('Category (Business, Data, Application, Technology, Security, AI)', 'category')}
                {isP && field('TOGAF basis', 'togaf_basis')}
                {f.kind === 'guardrail' && field('Enforced by', 'enforced_by')}
              </div>
              {f.kind === 'pattern' && field('Use', 'use', true)}
              {f.kind === 'pattern' && (
                <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Implements principle
                  <select value={f.principle ?? ''} onChange={(e) => setF({ ...f, principle: e.target.value })} className="h-8 rounded-md border bg-card px-2 text-sm text-foreground">
                    <option value="">None</option>
                    {principles.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
                  </select>
                </label>
              )}
              {ai && ai.citations.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-muted-foreground">Grounded in</span>{ai.citations.slice(0, 3).map((c) => <CitationChip key={c.id} c={c} />)}</div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!f.name.trim() || save.isPending}>Save</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PrincipleRow({ p, onToggle, onEdit, onDelete }: { p: Principle; onToggle: (v: boolean) => void; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <Collapsible className="rounded-lg border bg-card data-[state=open]:shadow-sm">
      <div className="flex items-center gap-3 px-3 py-2">
        <Switch checked={p.adopted} onCheckedChange={onToggle} aria-label={`Adopt ${p.name}`} />
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="tabular w-11 shrink-0 text-[11px] font-semibold text-muted-foreground">{p.number ? `P${p.number}` : p.id.replace('P-', '')}</span>
          <span className="truncate text-sm font-medium">{p.name}</span>
          <Badge variant="outline" className="shrink-0 text-[10px] font-medium">{p.category}</Badge>
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        {onEdit && <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" onClick={onEdit} aria-label="Edit"><Pencil /></Button>}
        {onDelete && <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" onClick={onDelete} aria-label="Delete"><Trash2 /></Button>}
      </div>
      <CollapsibleContent className="space-y-2 border-t px-4 py-3 text-[13px] leading-relaxed">
        <p><span className="font-semibold">Statement. </span>{p.statement}</p>
        {p.rationale && <p><span className="font-semibold">Rationale. </span>{p.rationale}</p>}
        {p.implications && p.implications.length > 0 && (
          <div>
            <span className="font-semibold">Implications.</span>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{p.implications.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {p.togaf_basis && <p className="text-muted-foreground">TOGAF basis: {p.togaf_basis}</p>}
        {p.citation && <CitationChip c={{ ...p.citation, n: p.number ?? 0 }} />}
      </CollapsibleContent>
    </Collapsible>
  )
}

function useGuidelineDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteGuideline,
    onSuccess: (d) => { qc.setQueryData(['vision'], d); qc.invalidateQueries({ queryKey: ['overview'] }); toast.success('Removed') },
  })
}

type Kind = 'principle' | 'guardrail' | 'pattern'
const KIND_LABEL: Record<Kind, string> = { principle: 'Principles', guardrail: 'Guardrails', pattern: 'Patterns & Standards' }

/** Principles, guardrails and patterns in one list. CIL holds the client's own set (principles, guardrails, patterns);
 *  TOGAF holds the §23.6 example principles, so overlapping ideas are chosen from one source instead of listed twice. */
function Guidelines({ v, onEdit, fresh }: { v: VisionT; onEdit: (g: GEdit) => void; fresh: string | null }) {
  const qc = useQueryClient()
  const [src, setSrc] = useState<'cil' | 'togaf'>('cil')
  const [kind, setKind] = useState<'all' | Kind>('all')
  const del = useGuidelineDelete()
  const adopt = useMutation({
    mutationFn: ({ id, adopted }: { id: string; adopted: boolean }) => api.putPrinciple(id, adopted),
    onSuccess: (pv) => {
      qc.setQueryData<VisionT>(['vision'], (old) => old && { ...old, principles: pv, kpis: { ...old.kpis, principles_adopted: pv.adopted } })
      qc.invalidateQueries({ queryKey: ['overview'] })
    },
  })
  const activate = useMutation({
    mutationFn: (g: GEdit) => api.putGuideline(g.id!, g),
    onSuccess: (d) => { qc.setQueryData(['vision'], d); qc.invalidateQueries({ queryKey: ['overview'] }) },
  })
  // a newly added item: show its source and type, scroll to it and highlight it
  useEffect(() => {
    if (!fresh) return
    setSrc('cil')
    setKind('all')
    const t = setTimeout(() => document.getElementById(`g-${fresh}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    return () => clearTimeout(t)
  }, [fresh])
  const pv = v.principles
  const ok = !pv.warning
  const pname = Object.fromEntries([...pv.cil, ...pv.togaf].map((p) => [p.id, p.name]))
  const counts: Record<Kind, number> = { principle: pv.cil.length, guardrail: v.guardrails.length, pattern: v.patterns.length }
  const shows = (k: Kind) => kind === 'all' || kind === k
  const ring = (id: string) => (id === fresh ? 'ring-2 ring-navy ring-offset-1' : '')
  const heading = (k: Kind, extra: string) => kind === 'all' && (
    <div className="pt-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{KIND_LABEL[k]} <span className="font-normal normal-case">{extra}</span></div>
  )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={src} onValueChange={(x) => x && setSrc(x as 'cil' | 'togaf')} variant="outline" size="sm">
          <ToggleGroupItem value="cil" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">CIL ({pv.cil.length + v.guardrails.length + v.patterns.length})</ToggleGroupItem>
          <ToggleGroupItem value="togaf" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">TOGAF §23.6 ({pv.togaf.length})</ToggleGroupItem>
        </ToggleGroup>
        {src === 'cil' && (
          <ToggleGroup type="single" value={kind} onValueChange={(x) => x && setKind(x as 'all' | Kind)} variant="outline" size="sm">
            <ToggleGroupItem value="all" className="px-2.5 data-[state=on]:bg-navy-soft data-[state=on]:text-navy">All</ToggleGroupItem>
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => <ToggleGroupItem key={k} value={k} className="px-2.5 data-[state=on]:bg-navy-soft data-[state=on]:text-navy">{KIND_LABEL[k]} ({counts[k]})</ToggleGroupItem>)}
          </ToggleGroup>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium" style={{ color: ok ? BAND.strong : BAND.developing }}>
          {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {pv.warning ?? `${pv.adopted} principles adopted · within TOGAF §${pv.limit.ref} range of ${pv.limit.min}–${pv.limit.max}`}
          <Explain x={v.explain.principles_adopted} />
        </span>
        {src === 'cil' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="sm" variant="outline"><Plus /> Add <ChevronDown /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit({ kind: 'principle', name: '', category: 'Application' })}>Principle</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit({ kind: 'guardrail', name: '', category: 'Application', active: true })}>Guardrail</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit({ kind: 'pattern', name: '', active: true })}>Pattern</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {src === 'togaf' ? (
        <>
          <p className="text-[11.5px] text-muted-foreground">TOGAF's example principles. Adopt one here only where CIL has no equivalent of its own, so the same idea is not adopted twice.</p>
          <div className="grid grid-cols-2 gap-2">
            {pv.togaf.map((p) => <PrincipleRow key={p.id} p={p} onToggle={(adopted) => adopt.mutate({ id: p.id, adopted })} />)}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {shows('principle') && heading('principle', `· ${pv.cil.filter((p) => p.adopted).length} of ${pv.cil.length} adopted`)}
          {shows('principle') && (
            <div className="grid grid-cols-2 gap-2">
              {pv.cil.map((p) => (
                <div key={p.id} id={`g-${p.id}`} className={cn('rounded-lg', ring(p.id))}>
                  <PrincipleRow p={p} onToggle={(adopted) => adopt.mutate({ id: p.id, adopted })}
                    onEdit={() => onEdit({ kind: 'principle', id: p.id, name: p.name, statement: p.statement, category: p.category, togaf_basis: p.togaf_basis, rationale: p.rationale, implications: p.implications })}
                    onDelete={() => window.confirm(`Remove ${p.name}?`) && del.mutate(p.id)} />
                </div>
              ))}
            </div>
          )}
          {shows('guardrail') && heading('guardrail', `· ${v.guardrails.filter((g) => g.active !== false).length} active`)}
          {shows('guardrail') && (
            <div className="grid grid-cols-2 gap-2">
              {v.guardrails.map((g) => (
                <div key={g.id} id={`g-${g.id}`} className={cn('flex items-start gap-3 rounded-lg border bg-card px-3 py-2', g.active === false && 'opacity-60', ring(g.id))}>
                  <Switch checked={g.active !== false} onCheckedChange={(on) => activate.mutate({ kind: 'guardrail', id: g.id, name: g.name, statement: g.statement, category: g.category, enforced_by: g.enforced_by, active: on })} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-muted-foreground">{g.id}</span>
                      <span className="text-[13px] font-semibold">{g.name}</span>
                      <Badge variant="outline" className="text-[10px]">{g.category}</Badge>
                    </div>
                    <div className="text-[12px] text-muted-foreground">{g.statement}</div>
                    {g.enforced_by && <div className="mt-0.5 text-[11px]"><span className="font-medium">Enforced by:</span> {g.enforced_by}</div>}
                  </div>
                  <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" aria-label="Edit"
                    onClick={() => onEdit({ kind: 'guardrail', id: g.id, name: g.name, statement: g.statement, category: g.category, enforced_by: g.enforced_by, active: g.active })}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" aria-label="Delete" onClick={() => window.confirm(`Remove ${g.name}?`) && del.mutate(g.id)}><Trash2 /></Button>
                </div>
              ))}
            </div>
          )}
          {shows('pattern') && heading('pattern', '· reusable solution approaches tied to a principle')}
          {shows('pattern') && (
            <div className="grid grid-cols-2 gap-2">
              {v.patterns.map((p) => (
                <div key={p.id} id={`g-${p.id}`} className={cn('flex items-start gap-2 rounded-lg border bg-card px-3 py-2', ring(p.id))}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-muted-foreground">{p.id}</span>
                      <span className="text-[13px] font-semibold">{p.name}</span>
                    </div>
                    <div className="text-[12px] text-muted-foreground">{p.use}</div>
                    {p.principle && <div className="mt-0.5 text-[11px]"><span className="font-medium">Implements:</span> {p.principle} {pname[p.principle] ?? ''}</div>}
                  </div>
                  <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" aria-label="Edit"
                    onClick={() => onEdit({ kind: 'pattern', id: p.id, name: p.name, use: p.use, principle: p.principle, active: p.active })}><Pencil /></Button>
                  <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" aria-label="Delete" onClick={() => window.confirm(`Remove ${p.name}?`) && del.mutate(p.id)}><Trash2 /></Button>
                </div>
              ))}
            </div>
          )}
          {shows('pattern') && <p className="pt-1 text-[11px] text-muted-foreground">Technology standards (standards class per platform) live on Data & Technology; architecture decisions in the Roadmap & Governance decision log.</p>}
        </div>
      )}
    </div>
  )
}

function AiInitiatives({ v }: { v: VisionT }) {
  return (
    <Collapsible className="rounded-xl border bg-card">
      <div className="flex items-center gap-3 px-5 py-3">
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          <span className="text-sm font-semibold">AI Initiatives</span>
          <span className="truncate text-xs text-muted-foreground">{v.kpis.ai_ready} of {v.kpis.ai_total} data-ready · each needs every dependent data domain ≥ {v.ai_ready_min}</span>
        </CollapsibleTrigger>
        <Explain x={v.explain.ai_ready} />
        <Button variant="ghost" size="sm" asChild><a href={exportUrl('vision')}><Download /> Export</a></Button>
      </div>
      <CollapsibleContent className="border-t px-5 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead><TableHead>Initiative</TableHead><TableHead>Type</TableHead>
              <TableHead>Status</TableHead><TableHead>Data readiness</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {v.ai_initiatives.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="text-xs font-semibold text-muted-foreground">{i.id}</TableCell>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell className="text-muted-foreground">{i.type}</TableCell>
                <TableCell className="text-muted-foreground">{i.status}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <Explain x={i.explain} />
                    {i.ready ? (
                      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium" style={{ color: BAND.strong, background: tint(BAND.strong) }}>
                        <CheckCircle2 className="size-3" /> Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium" style={{ color: BAND.critical, background: tint(BAND.critical) }}
                        title={i.blocking.map((b) => `${b.name}: ${b.score}`).join(', ')}>
                        <AlertTriangle className="size-3" /> Blocked by {i.blocking.map((b) => `${b.id} (${b.score})`).join(', ')}
                      </span>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  )
}

const VIEWS = ['principles', 'rules', 'stakeholders', 'tailoring', 'ai']

export default function Vision() {
  const q = useQuery({ queryKey: ['vision'], queryFn: api.vision })
  const [view, setView] = useView('principles', VIEWS)
  const [gEdit, setGEdit] = useState<GEdit | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const v = q.data
  return (
    <>
      <PageHeader screen="vision" actions={
        <Button variant="outline" size="sm" asChild><a href="/api/vision/export.md"><Download /> Vision.md</a></Button>
      } />
      {q.error ? <ScreenError error={q.error} /> : !v ? <ScreenSkeleton /> : (
        <>
          <PhasePlan p={v.phase} />

          <div className="grid grid-cols-12 gap-4">
            <ContextCard v={v} />
            <StatementsCard v={v} />
          </div>

          <Card id="sec-tabs" className="scroll-mt-4">
            <CardHeader>
              <CardTitle>Guidelines and Principles</CardTitle>
              <CardDescription>Principles, guardrails, rationalization rules, the ISO/IEC/IEEE 42010 viewpoint catalogue and the framework tailoring register govern every architecture decision; the rules turn them into application dispositions.</CardDescription>
            </CardHeader>
            <Tabs value={view === 'ai' ? 'principles' : view} onValueChange={setView}>
              <CardContent className="space-y-3">
                <TabsList>
                  <TabsTrigger value="principles">Principles, Guardrails & Patterns</TabsTrigger>
                  <TabsTrigger value="rules">Rationalization Rules</TabsTrigger>
                  <TabsTrigger value="stakeholders">Stakeholder Viewpoints</TabsTrigger>
                  <TabsTrigger value="tailoring">Framework Tailoring</TabsTrigger>
                </TabsList>
                <TabsContent value="principles"><Guidelines v={v} onEdit={setGEdit} fresh={fresh} /></TabsContent>
                <TabsContent value="rules"><RulesConfig v={v} /></TabsContent>
                <TabsContent value="stakeholders"><ViewpointCatalog v={v} /></TabsContent>
                <TabsContent value="tailoring"><TailoringRegister v={v} /></TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          <FindingsCard screen="vision" sig={JSON.stringify(v.kpis)} />
          <div id="sec-ai" className="scroll-mt-4"><AiInitiatives v={v} /></div>
          <GuidelineDialog edit={gEdit} onClose={() => setGEdit(null)} onAdded={(id) => { setFresh(id); setTimeout(() => setFresh(null), 4000) }} principles={[...v.principles.cil, ...v.principles.togaf]} />
        </>
      )}
    </>
  )
}

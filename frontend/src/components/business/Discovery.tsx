import { Fragment, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ChevronsDownUp, ChevronsUpDown, ClipboardCheck, Mail, Minus, Plus, Search, Sigma, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { NodeDialog, useBusinessUpdate, type NodeEdit } from '@/components/CapabilityModules'
import { Explain } from '@/components/Explain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api, type Business, type CapRow, type L1Node, type L3Row, type RefNode } from '@/lib/api'
import { DISC_STATUS, L2_STATE, NAVY, tint, type L2StateKey } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { Caret, PipelineBar, StatusPill, allL2 } from './shared'
import { SurveySheet, statusAction, type SheetTab } from './SurveySheet'

type Filter = 'all' | 'adopted' | 'missing'
// one grid for L1, L2 and L3 rows so the columns line up down the tree
const COLS = 'grid grid-cols-[minmax(0,1fr)_150px_118px_168px_206px] items-center gap-3'

export function l2State(c: CapRow): L2StateKey {
  const d = c.discovery
  if (d.analysed && d.stale) return 'stale'
  if (d.analysed) return 'analysed'
  if (d.inference.ready) return 'ready'
  if (d.rollup.generated) return 'collecting'
  return 'not_started'
}

function StateBadge({ k }: { k: L2StateKey }) {
  const s = L2_STATE[k]
  return <span className="inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold whitespace-nowrap" style={{ color: s.color, background: tint(s.color, 0.12) }}>
    <span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
}

const toReview = (x: L3Row) => x.status === 'draft' && !x.survey?.finalised
const toSend = (x: L3Row) => x.status === 'draft' && !!x.survey?.finalised

/** Questionnaire state of the L3s under an L2: how many still need review, how many are finalised and ready to send. */
function QState({ xs }: { xs: L3Row[] }) {
  const rv = xs.filter(toReview).length
  const sd = xs.filter(toSend).length
  const out = xs.filter((x) => ['sent', 'walkthrough', 'redirected'].includes(x.status)).length
  if (!rv && !sd && !out) return <span className="text-[10.5px] text-muted-foreground">{xs.some((x) => x.status === 'responded') ? 'All returned' : '–'}</span>
  return (
    <span className="flex flex-wrap gap-x-2 text-[10.5px]">
      {rv > 0 && <span style={{ color: DISC_STATUS.draft.color }} className="font-semibold">{rv} to review</span>}
      {sd > 0 && <span style={{ color: NAVY }} className="font-semibold">{sd} ready to send</span>}
      {out > 0 && <span className="text-muted-foreground">{out} out</span>}
    </span>
  )
}

function Progress({ r }: { r: CapRow['discovery']['rollup'] }) {
  return (
    <span className="flex items-center gap-1.5">
      <PipelineBar r={r} className="flex-1" />
      <span className="tabular w-10 text-right text-[10.5px] text-muted-foreground">{r.responded}/{r.l3}</span>
    </span>
  )
}

function IconBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground hover:text-destructive" disabled={disabled} title={title} aria-label={title}
    onClick={(e) => { e.stopPropagation(); onClick() }}>{children}</Button>
}

function AdoptBtn({ onClick, disabled, label = 'Adopt' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return <Button variant="outline" size="xs" className="h-6 px-2 text-[11px]" disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick() }}><Plus className="size-3" /> {label}</Button>
}

// ---------------------------------------------------------------- module
/** Current state discovery: the standard L0-L3 model with the CIL catalogue adopted from it, and the L3 surveys,
 * orchestration and inferred L2 scores worked in the same tree. */
export function Discovery({ b }: { b: Business }) {
  const done = useBusinessUpdate()
  const l2s = allL2(b)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [edit, setEdit] = useState<NodeEdit | null>(null)
  const [sheet, setSheet] = useState<{ id: string; tab: SheetTab } | null>(null)
  const best = useMemo(() => [...l2s].map((c) => ({ c, n: new Set(c.l3.map((x) => x.status)).size + c.discovery.rollup.generated / 10 })).sort((a, z) => z.n - a.n)[0]?.c, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<Set<string>>(() => {
    const ref1 = best ? b.l1.find((l) => l.id === best.l1_id)?.ref : null
    return new Set([ref1, best?.ref ?? best?.id].filter(Boolean) as string[])
  })
  const toggle = (id: string, set = setOpen) => set((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x })

  // indexes: reference tree, and CIL nodes by id
  const kids = useMemo(() => {
    const m: Record<string, RefNode[]> = {}
    for (const n of b.reference) if (n.parent) (m[n.parent] ??= []).push(n)
    return m
  }, [b.reference])
  const refIds = useMemo(() => new Set(b.reference.map((n) => n.id)), [b.reference])
  const l1ById = useMemo(() => Object.fromEntries(b.l1.map((l) => [l.id, l])), [b.l1])
  const l2ById = useMemo(() => Object.fromEntries(l2s.map((c) => [c.id, c])), [l2s])
  const l3ById = useMemo(() => Object.fromEntries(l2s.flatMap((c) => c.l3.map((x) => [x.id, x]))), [l2s])
  const l3 = sheet ? l3ById[sheet.id] ?? null : null

  const add = useMutation({ mutationFn: (ref: string) => api.addFromRef(ref), onSuccess: (d) => done(d, d.added?.length ? `Adopted ${d.added.join(', ')} into the CIL catalogue` : 'Already in the catalogue'), onError: (e: Error) => toast.error(e.message) })
  const del = useMutation({ mutationFn: api.deleteNode, onSuccess: (d) => done(d, `Removed ${d.deleted?.join(', ')} from the CIL catalogue`), onError: (e: Error) => toast.error(e.message) })
  const gen = useMutation({
    mutationFn: (c: CapRow) => api.genSurvey(c.id),
    onSuccess: (d, c) => {
      const x = d.l1.flatMap((l) => l.children).find((y) => y.id === c.id)
      const first = x?.l3.find(toReview)
      done(d, `Questionnaires generated for ${c.name}: review, edit and finalise each one before it goes out`)
      if (first) { setOpen((s) => new Set(s).add(c.ref ?? c.id)); setSheet({ id: first.id, tab: 'questions' }) }
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const an = useMutation({
    mutationFn: (c: CapRow) => api.analyse(c.id),
    onSuccess: (d, c) => done(d, `${c.name} analysed: scores are on the Assessment step`),
    onError: (e: Error) => toast.error(e.message),
  })
  const busy = add.isPending || del.isPending
  const remove = (id: string, name: string) => window.confirm(`Remove ${id} ${name} (and anything under it, including discovery answers) from the CIL catalogue?`) && del.mutate(id)

  const desc = (id: string): RefNode[] => (kids[id] ?? []).flatMap((k) => [k, ...desc(k.id)])
  const okQ = (names: string[]) => !q || names.some((n) => n.toLowerCase().includes(q.toLowerCase()))
  const showRef = (n: RefNode) => {
    const all = [n, ...desc(n.id)]
    const f = filter === 'all' || all.some((x) => x.level >= 2 && (filter === 'adopted' ? !!x.adopted_by : !x.adopted_by))
    return f && okQ(all.map((x) => x.name))
  }
  const isOpen = (id: string) => open.has(id) || q.length > 1
  const r = b.discovery.rollup
  const cov = b.coverage

  // ---------------------------------------------------------------- rows
  const L3Line = (x?: L3Row, refNode?: RefNode) => {
    if (!x) return (
      <div className={cn(COLS, 'py-1 pr-3 pl-[86px] text-[12px] text-muted-foreground')}>
        <span className="flex min-w-0 items-center gap-2"><span className="w-16 shrink-0 text-[10px]">{refNode!.id}</span><span className="truncate">{refNode!.name}</span></span>
        <span /><span className="text-[10.5px]">Not Adopted</span><span /><span className="flex justify-end"><AdoptBtn disabled={busy} onClick={() => add.mutate(refNode!.id)} /></span>
      </div>
    )
    const a = statusAction(x.status, x.survey?.finalised)
    const last = x.survey?.history[x.survey.history.length - 1]
    return (
      <div role="button" tabIndex={0} onClick={() => setSheet({ id: x.id, tab: a.tab })} onKeyDown={(e) => e.key === 'Enter' && setSheet({ id: x.id, tab: a.tab })}
        className={cn(COLS, 'cursor-pointer py-1 pr-3 pl-[86px] text-[12px] hover:bg-navy-soft/40')}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{x.id}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
          <span className="hidden max-w-40 truncate text-[10.5px] text-muted-foreground xl:inline">{x.survey?.channel === 'workshop' ? 'Workshop' : x.survey?.recipient.role || x.owner}</span>
        </span>
        <span className="truncate text-[10.5px] text-muted-foreground">{last ? `${new Date(last.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${last.event}` : ''}</span>
        <span><StatusPill s={x.status} small /></span>
        <span className="text-[10.5px]">{toReview(x) ? <span className="font-semibold" style={{ color: DISC_STATUS.draft.color }}>To review</span> : toSend(x) ? <span className="font-semibold text-navy">Finalised · ready to send</span>
          : x.survey ? <span className="text-muted-foreground">{x.survey.questions.length} questions</span> : null}</span>
        <span className="flex items-center justify-end gap-1">
          <Button size="xs" variant={x.status === 'responded' ? 'ghost' : 'outline'} className="w-[124px]" onClick={(e) => { e.stopPropagation(); setSheet({ id: x.id, tab: a.tab }) }}>
            {toReview(x) ? <ClipboardCheck /> : x.status === 'draft' ? <Mail /> : x.status === 'not_generated' ? <Sparkles /> : null}{a.label}
          </Button>
          <IconBtn title={`Remove ${x.name}`} disabled={busy} onClick={() => remove(x.id, x.name)}><Minus /></IconBtn>
        </span>
      </div>
    )
  }

  const L2Block = (c?: CapRow, refNode?: RefNode) => {
    const rid = c?.ref ?? c?.id ?? refNode!.id
    const o = isOpen(rid)
    const refL3 = refNode ? kids[refNode.id] ?? [] : []
    if (!c) {
      const n = refNode!
      return (
        <div className="border-t">
          <div role="button" tabIndex={0} onClick={() => toggle(rid)} onKeyDown={(e) => e.key === 'Enter' && toggle(rid)}
            className={cn(COLS, 'cursor-pointer bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(148,163,184,0.07)_6px,rgba(148,163,184,0.07)_12px)] py-1.5 pr-3 pl-9 hover:bg-muted/30')}>
            <span className="flex min-w-0 items-center gap-2.5"><Caret open={o} /><span className="w-14 shrink-0 text-[10.5px] text-muted-foreground">{n.id}</span>
              <span className="min-w-0"><span className="block truncate text-[12.5px] text-muted-foreground">{n.name}</span>
                {n.practice && <span className="block truncate text-[10.5px] text-muted-foreground/80">Standard practice: {n.practice}</span>}</span></span>
            <span className="text-[10.5px] text-muted-foreground">{refL3.length} L3 in standard</span>
            <StateBadge k="not_adopted" /><span />
            <span className="flex justify-end"><AdoptBtn disabled={busy} onClick={() => add.mutate(n.id)} label="Adopt L2" /></span>
          </div>
          {o && refL3.map((x) => <Fragment key={x.id}>{L3Line(undefined, x)}</Fragment>)}
        </div>
      )
    }
    const cr = c.discovery.rollup
    const k = l2State(c)
    const review = c.l3.filter(toReview)
    const ready = c.l3.filter(toSend)
    // L3 rows in standard-model order, then CIL-specific L3s; standard L3s not adopted are shown greyed
    const own = new Set(c.l3.map((x) => x.id))
    const rows: { x?: L3Row; ref?: RefNode }[] = refL3.filter((n) => filter !== 'adopted' || n.adopted_by).map((n) => (n.adopted_by && l3ById[n.adopted_by] ? { x: l3ById[n.adopted_by] } : { ref: n }))
    rows.forEach((row) => row.x && own.delete(row.x.id))
    c.l3.filter((x) => own.has(x.id)).forEach((x) => rows.push({ x }))
    return (
      <div className="border-t">
        <div role="button" tabIndex={0} onClick={() => toggle(rid)} onKeyDown={(e) => e.key === 'Enter' && toggle(rid)}
          className={cn(COLS, 'cursor-pointer py-1.5 pr-3 pl-9 hover:bg-muted/30', o && 'bg-navy-soft/25')}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Caret open={o} />
            <span className="w-14 shrink-0 text-[10.5px] font-semibold text-navy">{c.id}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5"><span className="truncate text-[12.5px] font-semibold">{c.name}</span>{c.focus && <span className="rounded bg-navy px-1 text-[9.5px] font-bold text-white">{c.focus}</span>}{!c.ref && <span className="rounded bg-muted px-1 text-[9.5px] font-semibold text-muted-foreground">CIL-specific</span>}</span>
              <span className="block truncate text-[10.5px] text-muted-foreground">{c.owner || 'Owner TBC'} · {c.l3.length} L3</span>
            </span>
          </span>
          <Progress r={cr} />
          <StateBadge k={k} />
          <QState xs={c.l3} />
          <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {cr.not_generated > 0 && <Button size="xs" variant="outline" disabled={gen.isPending} onClick={() => gen.mutate(c)}><Sparkles /> Generate {cr.not_generated}</Button>}
            {review.length > 0 && <Button size="xs" variant="outline" onClick={() => { setOpen((s) => new Set(s).add(rid)); setSheet({ id: review[0].id, tab: 'questions' }) }}><ClipboardCheck /> Review {review.length}</Button>}
            {ready.length > 0 && <Button size="xs" variant="outline" onClick={() => { setOpen((s) => new Set(s).add(rid)); setSheet({ id: ready[0].id, tab: 'orchestrate' }) }}><Mail /> Orchestrate {ready.length}</Button>}
            {(k === 'ready' || k === 'stale') && <Button size="xs" onClick={() => an.mutate(c)} disabled={an.isPending}><Sigma /> Analyse</Button>}
            <IconBtn title={`Remove ${c.name}`} disabled={busy} onClick={() => remove(c.id, c.name)}><Minus /></IconBtn>
          </span>
        </div>
        {o && (
          <div className="border-t border-dashed bg-card">
            {rows.map((row) => <Fragment key={row.x?.id ?? row.ref!.id}>{L3Line(row.x, row.ref)}</Fragment>)}
            <div className="flex items-center gap-2 border-t border-dashed py-1.5 pr-3 pl-[86px]">
              <span className="text-[11px] text-muted-foreground">
                {k === 'analysed' ? 'Analysed: scores are on the Assessment step.' : k === 'ready' || k === 'stale' ? `${c.discovery.inference.answered} response${c.discovery.inference.answered > 1 ? 's' : ''} in: analyse to carry them into the assessment.` : 'Generate, review and finalise the questionnaires, then orchestrate them to the owners.'}
              </span>
              <button className="ml-auto text-[11px] font-medium text-muted-foreground hover:text-navy" onClick={() => setEdit({ mode: 'add', level: 3, parent: c.id })}><Plus className="inline size-3" /> CIL-specific L3</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const L1Block = (l1?: L1Node, refNode?: RefNode) => {
    const rid = l1?.ref ?? l1?.id ?? refNode!.id
    const o = isOpen(rid)
    const refL2 = refNode ? (kids[refNode.id] ?? []).filter(showRef) : []
    const custom = l1 ? l1.children.filter((c) => !c.ref || !refIds.has(c.ref)).filter((c) => filter !== 'missing' && okQ([c.name, ...c.l3.map((x) => x.name)])) : []
    const items: { c?: CapRow; ref?: RefNode }[] = [
      ...refL2.map((n) => (n.adopted_by && l2ById[n.adopted_by] ? { c: l2ById[n.adopted_by], ref: n } : { ref: n })), ...custom.map((c) => ({ c })),
    ]
    if (!l1) {
      const all = desc(refNode!.id)
      return (
        <div className="border-t">
          <div role="button" tabIndex={0} onClick={() => toggle(rid)} onKeyDown={(e) => e.key === 'Enter' && toggle(rid)} className={cn(COLS, 'cursor-pointer bg-muted/25 px-3 py-1.5 text-muted-foreground hover:bg-muted/50')}>
            <span className="flex min-w-0 items-center gap-2.5"><Caret open={o} /><span className="w-10 text-[11px] font-bold">{refNode!.id}</span><span className="truncate text-[13px] font-semibold">{refNode!.name}</span></span>
            <span className="text-[10.5px]">{all.filter((x) => x.level === 2).length} L2 · {all.filter((x) => x.level === 3).length} L3</span>
            <StateBadge k="not_adopted" /><span />
            <span className="flex justify-end"><AdoptBtn disabled={busy} onClick={() => add.mutate(refNode!.id)} label="Adopt all" /></span>
          </div>
          {o && items.map((it) => <Fragment key={it.ref?.id ?? it.c!.id}>{L2Block(it.c, it.ref)}</Fragment>)}
        </div>
      )
    }
    const ro = l1.rollup
    const missing = refNode ? desc(refNode.id).filter((x) => !x.adopted_by).length : 0
    return (
      <div className="border-t">
        <div role="button" tabIndex={0} onClick={() => toggle(rid)} onKeyDown={(e) => e.key === 'Enter' && toggle(rid)} className={cn(COLS, 'cursor-pointer bg-muted/50 px-3 py-2 hover:bg-muted/80')}>
          <span className="flex min-w-0 items-center gap-2.5">
            <Caret open={o} /><span className="w-10 text-[11px] font-bold text-navy">{l1.id}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold">{l1.name}</span>
              <span className="block truncate text-[10.5px] text-muted-foreground">{l1.owner} · {ro.l2} L2 · {ro.l3} L3 processes</span>
            </span>
          </span>
          <Progress r={ro} />
          <span className="text-[10.5px] text-muted-foreground"><b className="tabular text-foreground">{ro.analysed}</b>/{ro.l2} L2 analysed</span>
          <QState xs={l1.children.flatMap((c) => c.l3)} />
          <span className="flex justify-end">{missing > 0 && <AdoptBtn disabled={busy} onClick={() => add.mutate(refNode!.id)} label={`Adopt ${missing} more`} />}</span>
        </div>
        {o && items.map((it) => <Fragment key={it.ref?.id ?? it.c!.id}>{L2Block(it.c, it.ref)}</Fragment>)}
      </div>
    )
  }

  const l0Ref = b.reference.filter((n) => n.level === 0)
  const orphanL1 = b.l1.filter((l) => !l.ref || !refIds.has(l.ref))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="rounded-lg border px-3.5 py-2.5">
          <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            <span>Survey pipeline · {r.l3} L3 processes in the CIL catalogue</span><span className="tabular text-[12px] text-navy">{r.pct_responded}% answered</span>
          </div>
          <PipelineBar r={r} className="h-2.5" />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {(['responded', 'sent', 'walkthrough', 'redirected', 'draft', 'not_generated'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: DISC_STATUS[s].color }} />{DISC_STATUS[s].label} <b className="tabular">{r[s]}</b></span>
            ))}
            <span className="ml-auto text-muted-foreground"><b className="tabular text-foreground">{b.kpis.analysed_l2}</b> of {b.kpis.n_catalog} L2 analysed</span>
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-lg border px-3.5 py-2.5 text-[11px]">
          <div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Adopted from the standard</div>
          <div className="tabular text-[15px] font-semibold">{cov.adopted}<span className="text-[11px] font-normal text-muted-foreground">/{cov.total} L2</span> · {cov.l3_adopted}<span className="text-[11px] font-normal text-muted-foreground">/{cov.l3_total} L3</span></div>
          <div className="flex items-center gap-1.5 text-muted-foreground"> agri-inputs standard <Explain x={cov.explain} /></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a capability or process" className="h-8 pl-8 text-[13px]" />
        </div>
        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as Filter)} variant="outline" size="sm">
          <ToggleGroupItem value="all" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">Full Standard Model</ToggleGroupItem>
          <ToggleGroupItem value="adopted" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">CIL Catalogue Only</ToggleGroupItem>
          <ToggleGroupItem value="missing" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">Not Adopted</ToggleGroupItem>
        </ToggleGroup>
        <Button variant="ghost" size="sm" onClick={() => setOpen(new Set([...b.reference.filter((n) => n.level === 1 || n.level === 2).map((n) => n.id), ...l2s.map((c) => c.id), ...b.l1.map((l) => l.id)]))}><ChevronsUpDown /> Expand all</Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(new Set())}><ChevronsDownUp /> Collapse</Button>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEdit({ mode: 'add', level: 2 })}><Plus /> CIL-specific capability</Button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-muted-foreground">
        <span className="font-semibold text-foreground">L2 status</span>
        {(Object.keys(L2_STATE) as L2StateKey[]).map((k) => <span key={k} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: L2_STATE[k].color }} />{L2_STATE[k].label}</span>)}
        <span className="ml-auto">Hatched rows are standard capabilities not adopted · select an L3 to generate, review, orchestrate or record its response</span>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className={cn(COLS, 'border-b bg-card px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase')}>
          <span>L0 › L1 › L2 › L3</span><span>Responses</span><span>Status</span><span>Questionnaire</span><span className="text-right">Actions</span>
        </div>
        {l0Ref.map((l0) => {
          const cil0 = b.l0.find((x) => x.ref === l0.id)
          const l1Refs = (kids[l0.id] ?? []).filter(showRef)
          const orphans = orphanL1.filter((l) => cil0 && l.l0 === cil0.id)
          if (!l1Refs.length && !orphans.length) return null
          return (
            <div key={l0.id}>
              <div className="flex items-center gap-3 bg-navy px-3 py-1.5 text-white">
                <span className="rounded bg-white/15 px-1.5 text-[10px] font-bold">L0</span>
                <span className="text-[13px] font-semibold">{l0.name}</span>
                {cil0 && <span className="ml-auto flex items-center gap-3 text-[11px] opacity-90">
                  <span>{cil0.rollup.l1} L1 · {cil0.rollup.l2} L2 · {cil0.rollup.l3} L3</span>
                  <span className="flex w-28 items-center gap-1.5"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20"><span className="block h-full rounded-full bg-white" style={{ width: `${cil0.rollup.pct_responded}%` }} /></span><span className="tabular">{cil0.rollup.pct_responded}%</span></span>
                  <span>{cil0.rollup.analysed} L2 analysed</span>
                </span>}
              </div>
              {l1Refs.map((n) => <Fragment key={n.id}>{L1Block(n.adopted_by ? l1ById[n.adopted_by] : undefined, n)}</Fragment>)}
              {orphans.map((l) => <Fragment key={l.id}>{L1Block(l)}</Fragment>)}
            </div>
          )
        })}
      </div>

      <SurveySheet l3={l3} b={b} tab={sheet?.tab ?? 'questions'} onTab={(t) => setSheet((s) => (s ? { ...s, tab: t } : s))} onClose={() => setSheet(null)}
        onNext={(id, tab) => setSheet({ id, tab })} />

      <NodeDialog b={b} edit={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

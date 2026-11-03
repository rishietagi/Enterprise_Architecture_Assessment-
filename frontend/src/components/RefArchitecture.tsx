import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Info, Link2, Pencil, Plus, RotateCcw, Server, Trash2, X } from 'lucide-react'

import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { ExportMenu } from '@/components/ExportMenu'
import { Explain } from '@/components/Explain'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { refViewDrawio } from '@/lib/drawio'
import { api, type RefBlock, type RefLayer, type RefStatus, type RefView, type RefViewIn } from '@/lib/api'
import { NAVY, REF_STATUS, SLATE, dispositionColor, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

const STATUSES = Object.keys(REF_STATUS) as RefStatus[]
const newId = () => `b-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const NONE = '__none'

type Opt = { id: string; name: string }
type Ctx = { apps?: Opt[]; checks?: (Opt & { status: string })[]; hostings?: string[] }

/** Strip the computed fields so the view can be sent back as-is. */
function clean(v: RefView | RefViewIn): RefViewIn {
  const b = ({ app_refs: _a, hosted: _h, derived: _d, ...x }: RefBlock): RefBlock => x
  return {
    title: v.title, subtitle: v.subtitle, functions: [...v.functions], edges: v.edges.map((e) => ({ ...e })),
    layers: v.layers.map((l) => ({ ...l, rows: l.rows.map((r) => r.map(b)) })),
    aside: v.aside ? { title: v.aside.title, boxes: v.aside.boxes.map(b) } : null,
  }
}

function allBlocks(v: RefViewIn): RefBlock[] {
  return [...v.layers.flatMap((l) => l.rows.flat()), ...(v.aside?.boxes ?? [])]
}

/** Visit every block list (layer rows and the cross-cutting column) so one edit function covers both. */
function mapLists(v: RefViewIn, f: (list: RefBlock[]) => RefBlock[]): RefViewIn {
  return { ...v, layers: v.layers.map((l) => ({ ...l, rows: l.rows.map(f) })), aside: v.aside ? { ...v.aside, boxes: f(v.aside.boxes) } : null }
}

function Block({ b, showApps, hot, onOpen, setRef, onHover }: {
  b: RefBlock; showApps: boolean; hot: boolean | null; onOpen: () => void; setRef: (el: HTMLElement | null) => void; onHover: (on: boolean) => void
}) {
  const c = REF_STATUS[b.status].color
  const apps = b.app_refs ?? []
  return (
    <button ref={setRef} onClick={onOpen} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
      title={[b.name, REF_STATUS[b.status].label, b.derived, b.note].filter(Boolean).join('\n')}
      className={cn('relative z-[2] flex min-h-[38px] min-w-0 flex-col justify-center rounded-md border px-2 py-1 text-center transition-[box-shadow,opacity] hover:shadow-md',
        hot === false && 'opacity-45')}
      style={{ flex: `${b.span} 1 0`, borderColor: tint(c, 0.55), backgroundColor: 'var(--card)', backgroundImage: `linear-gradient(${tint(c, 0.13)}, ${tint(c, 0.13)})` }}>
      <span className="text-[11.5px] leading-[14px] font-medium text-foreground">{b.name}</span>
      {(apps.length > 0 || b.check || b.hosted) && (
        <span className="mt-0.5 flex flex-wrap items-center justify-center gap-x-1.5 text-[9.5px] text-muted-foreground">
          {b.check && <span className="inline-flex items-center gap-0.5" style={{ color: c }}><Link2 className="size-2.5" />{b.check}</span>}
          {b.hosted && <span className="inline-flex items-center gap-0.5"><Server className="size-2.5" />{b.hosted.length} app{b.hosted.length === 1 ? '' : 's'}</span>}
          {apps.length > 0 && !showApps && <span>{apps.length} app{apps.length === 1 ? '' : 's'}</span>}
        </span>
      )}
      {showApps && apps.length > 0 && (
        <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
          {apps.map((a) => (
            <span key={a.id} className="max-w-full truncate rounded px-1 text-[9.5px] font-medium" style={{ color: dispositionColor(a.disposition ?? ''), background: tint(dispositionColor(a.disposition ?? ''), 0.1) }} title={`${a.name} · ${a.label}`}>
              {a.name.split(' (')[0]}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

/** One row of blocks; consecutive blocks with the same `group` sit in a dashed, labelled container. */
function Row({ row, render, edit, onAdd, onDropRow }: { row: RefBlock[]; render: (b: RefBlock) => React.ReactNode; edit: boolean; onAdd: () => void; onDropRow: () => void }) {
  const runs: { group: string | null; items: RefBlock[] }[] = []
  for (const b of row) {
    const g = b.group || null
    const last = runs[runs.length - 1]
    if (last && last.group === g && g) last.items.push(b)
    else runs.push({ group: g, items: [b] })
  }
  return (
    <div className="flex items-stretch gap-1.5">
      {runs.map((r, i) => r.group ? (
        <div key={i} className="relative flex items-stretch gap-1.5 rounded-md border-[1.5px] border-dashed px-1.5 pt-3.5 pb-1.5" style={{ flex: `${r.items.reduce((s, b) => s + b.span, 0)} 1 0`, borderColor: tint(SLATE, 0.6) }}>
          <span className="absolute top-0.5 left-1.5 text-[9.5px] font-semibold text-muted-foreground">{r.group}</span>
          {r.items.map(render)}
        </div>
      ) : <Fragment key={i}>{r.items.map(render)}</Fragment>)}
      {!row.length && <span className="flex flex-1 items-center text-[11px] text-muted-foreground italic">Empty row</span>}
      {edit && (
        <span className="flex shrink-0 flex-col justify-center gap-0.5" data-export-ignore>
          <Button size="icon-xs" variant="outline" onClick={onAdd} title="Add block"><Plus /></Button>
          {!row.length && <Button size="icon-xs" variant="ghost" onClick={onDropRow} title="Remove row"><X /></Button>}
        </span>
      )}
    </div>
  )
}

function BlockDialog({ v, block, ctx, kind, onClose, onSave, onDelete, onMove }: {
  v: RefViewIn; block: RefBlock | null; ctx: Ctx; kind: RefView['kind']; onClose: () => void
  onSave: (b: RefBlock, flowsTo: string[]) => void; onDelete: (id: string) => void; onMove: (id: string, d: -1 | 1) => void
}) {
  const [f, setF] = useState<RefBlock | null>(null)
  const [flows, setFlows] = useState<string[]>([])
  const [seen, setSeen] = useState<RefBlock | null>(null)
  if (block !== seen) {
    setSeen(block)
    setF(block ? { ...block, apps: [...block.apps] } : null)
    setFlows(block ? v.edges.filter((e) => e.from === block.id).map((e) => e.to) : [])
  }
  if (!f || !block) return <Dialog open={false} />
  const linked = ctx.checks?.find((c) => c.id === f.check)
  const others = allBlocks(v).filter((b) => b.id !== f.id)
  const isNew = !allBlocks(v).some((b) => b.id === f.id)
  const set = (p: Partial<RefBlock>) => setF({ ...f, ...p })
  const label = 'flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground'
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add Building Block' : 'Edit Building Block'}</DialogTitle>
          <DialogDescription>Rate the block against the CIL estate, map what realises it and note the evidence.</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin grid max-h-[62vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
          <label className={cn(label, 'col-span-2')}>Name<Input value={f.name} onChange={(e) => set({ name: e.target.value })} className="h-8 text-foreground" /></label>
          <label className={label}>Status
            <Select value={f.status} onValueChange={(s) => set({ status: s as RefStatus })} disabled={!!linked}>
              <SelectTrigger size="sm" className="h-8 w-full text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}><span className="size-2 rounded-full" style={{ background: REF_STATUS[s].color }} />{REF_STATUS[s].label}</SelectItem>)}</SelectContent>
            </Select>
            {linked && <span className="text-[10.5px] font-normal">Follows check {linked.id} ({linked.status}). Unlink to rate it by hand.</span>}
          </label>
          <label className={label}>Width (relative)
            <Select value={String(f.span)} onValueChange={(s) => set({ span: Number(s) })}>
              <SelectTrigger size="sm" className="h-8 w-full text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3, 4, 5, 6, 8].map((n) => <SelectItem key={n} value={String(n)}>{n}×</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className={cn(label, 'col-span-2')}>Assessment note<Textarea value={f.note} onChange={(e) => set({ note: e.target.value })} rows={2} className="text-[13px] text-foreground" /></label>
          <label className={label}>Group (dashed container)<Input value={f.group ?? ''} onChange={(e) => set({ group: e.target.value || null })} placeholder="e.g. Process & Store" className="h-8 text-foreground" /></label>
          {ctx.checks && (
            <label className={label}>Linked resilience check
              <Select value={f.check ?? NONE} onValueChange={(s) => set({ check: s === NONE ? null : s })}>
                <SelectTrigger size="sm" className="h-8 w-full text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72"><SelectItem value={NONE}>Not linked</SelectItem>{ctx.checks.map((c) => <SelectItem key={c.id} value={c.id}>{c.id} · {c.name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          )}
          {ctx.hostings && (
            <label className={label}>Hosting it represents
              <Select value={f.hosting ?? NONE} onValueChange={(s) => set({ hosting: s === NONE ? null : s })}>
                <SelectTrigger size="sm" className="h-8 w-full text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>None</SelectItem>{ctx.hostings.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          )}
          {block.hosted && block.hosting === f.hosting && (
            <div className={cn(label, 'col-span-2')}>Applications hosted here ({block.hosted.length}, from the intake records)
              <div className="flex flex-wrap gap-1 text-[11.5px] font-normal text-foreground">
                {block.hosted.map((a) => <span key={a.id} className="rounded border bg-muted/40 px-1.5 py-px">{a.id} · {a.name.split(' (')[0]}</span>)}
                {!block.hosted.length && <span className="text-muted-foreground">None recorded</span>}
              </div>
            </div>
          )}
          {ctx.apps && (
            <div className={cn(label, 'col-span-2')}>Applications that realise it ({f.apps.length})
              <div className="scrollbar-thin grid max-h-40 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-md border p-2 text-[12px] font-normal text-foreground">
                {ctx.apps.map((a) => (
                  <label key={a.id} className="flex items-center gap-1.5">
                    <Checkbox checked={f.apps.includes(a.id)} onCheckedChange={(c) => set({ apps: c ? [...f.apps, a.id] : f.apps.filter((x) => x !== a.id) })} />
                    <span className="truncate">{a.id} · {a.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {kind === 'data' && (
            <div className={cn(label, 'col-span-2')}>Flows to ({flows.length})
              <div className="scrollbar-thin grid max-h-36 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-md border p-2 text-[12px] font-normal text-foreground">
                {others.map((o) => (
                  <label key={o.id} className="flex items-center gap-1.5">
                    <Checkbox checked={flows.includes(o.id)} onCheckedChange={(c) => setFlows(c ? [...flows, o.id] : flows.filter((x) => x !== o.id))} />
                    <span className="truncate">{o.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <span className="flex gap-1.5">
            {!isNew && <Button variant="outline" size="sm" onClick={() => onDelete(f.id)}><Trash2 /> Delete</Button>}
            {!isNew && <Button variant="ghost" size="icon-sm" onClick={() => onMove(f.id, -1)} title="Move left"><ArrowLeft /></Button>}
            {!isNew && <Button variant="ghost" size="icon-sm" onClick={() => onMove(f.id, 1)} title="Move right"><ArrowRight /></Button>}
          </span>
          <span className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave({ ...f, name: f.name.trim() }, flows)} disabled={!f.name.trim()}>Save</Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Reference architecture view (layers of building blocks rated for architectural gaps), editable in place and exportable
 * as an image or CSV. Used for the application, data and infrastructure views. */
export function RefArchitecture({ v, queryKey, ctx = {}, appToggle = false, layerDetail }: {
  v: RefView; queryKey: string; ctx?: Ctx; appToggle?: boolean
  /** Optional drill-down for a layer (or 'aside'): opens a panel with the detail behind it. */
  layerDetail?: (layerId: string) => { title: string; body: React.ReactNode } | null
}) {
  const qc = useQueryClient()
  const [edit, setEdit] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const det = detail && layerDetail ? layerDetail(detail) : null
  const [showApps, setShowApps] = useState(false)
  const [open, setOpen] = useState<{ b: RefBlock; at?: { list: 'aside' } | { layer: string; row: number } } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [fn, setFn] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLElement>())
  const [paths, setPaths] = useState<{ id: string; d: string; from: string; to: string }[]>([])

  const save = useMutation({
    mutationFn: (x: RefViewIn) => api.putRefView<unknown>(v.id, x),
    onSuccess: (d) => { qc.setQueryData([queryKey], d); qc.invalidateQueries({ queryKey: ['overview'] }) },
    onError: (e: Error) => toast.error(e.message),
  })
  const reset = useMutation({
    mutationFn: () => api.resetRefView<unknown>(v.id),
    onSuccess: (d) => { qc.setQueryData([queryKey], d); toast.success('View restored to the default layout') },
  })
  const base = useMemo(() => clean(v), [v])
  const commit = (x: RefViewIn) => save.mutate(x)

  const draw = useCallback(() => {
    const root = area.current
    if (!root || !v.edges.length) return setPaths([])
    const o = root.getBoundingClientRect()
    const out: typeof paths = []
    v.edges.forEach((e, i) => {
      const a = refs.current.get(e.from)?.getBoundingClientRect()
      const b = refs.current.get(e.to)?.getBoundingClientRect()
      if (!a || !b) return
      const ax = a.left + a.width / 2 - o.left, bx = b.left + b.width / 2 - o.left
      const up = b.bottom <= a.top + 2
      const ay = (up ? a.top : a.bottom) - o.top, by = (up ? b.bottom : b.top) - o.top
      const my = (ay + by) / 2
      out.push({ id: `${i}`, from: e.from, to: e.to, d: `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}` })
    })
    setPaths(out)
  }, [v.edges])
  useLayoutEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (area.current) ro.observe(area.current)
    return () => ro.disconnect()
  }, [draw, v, showApps, edit])

  const hotOf = (id: string) => {
    if (!hover || !v.edges.length) return null
    return id === hover || v.edges.some((e) => (e.from === hover && e.to === id) || (e.to === hover && e.from === id))
  }
  const render = (b: RefBlock) => (
    <Block key={b.id} b={b} showApps={showApps} hot={hotOf(b.id)} onOpen={() => setOpen({ b })} onHover={(on) => setHover(on ? b.id : null)}
      setRef={(el) => { if (el) refs.current.set(b.id, el); else refs.current.delete(b.id) }} />
  )

  // --- edits (each one saves the whole view)
  const saveBlock = (b: RefBlock, flowsTo: string[]) => {
    const exists = allBlocks(base).some((x) => x.id === b.id)
    let next: RefViewIn = exists ? mapLists(base, (l) => l.map((x) => (x.id === b.id ? b : x))) : base
    if (!exists && open?.at) {
      const at = open.at
      next = 'list' in at
        ? { ...base, aside: base.aside ? { ...base.aside, boxes: [...base.aside.boxes, b] } : null }
        : { ...base, layers: base.layers.map((l) => (l.id !== at.layer ? l : { ...l, rows: l.rows.map((r, i) => (i === at.row ? [...r, b] : r)) })) }
    }
    if (v.kind === 'data') next = { ...next, edges: [...next.edges.filter((e) => e.from !== b.id), ...flowsTo.map((to) => ({ from: b.id, to }))] }
    commit(next)
    setOpen(null)
  }
  const delBlock = (id: string) => {
    commit({ ...mapLists(base, (l) => l.filter((x) => x.id !== id)), edges: base.edges.filter((e) => e.from !== id && e.to !== id) })
    setOpen(null)
  }
  const moveBlock = (id: string, d: -1 | 1) => commit(mapLists(base, (l) => {
    const i = l.findIndex((x) => x.id === id)
    if (i < 0 || i + d < 0 || i + d >= l.length) return l
    const c = [...l]
    ;[c[i], c[i + d]] = [c[i + d], c[i]]
    return c
  }))
  const setLayers = (layers: RefLayer[]) => commit({ ...base, layers })
  const addBlock = (at: { list: 'aside' } | { layer: string; row: number }) =>
    setOpen({ b: { id: newId(), name: '', status: 'partial', apps: [], note: '', span: 1 }, at })

  const csv = () => [
    ['View', 'Layer', 'Row', 'Building block', 'Status', 'Applications', 'Linked check', 'Hosting', 'Group', 'Note'],
    ...v.layers.flatMap((l) => l.rows.flatMap((r, i) => r.map((b) => [v.title, l.name, i + 1, b.name, REF_STATUS[b.status].label,
      (b.app_refs ?? []).map((a) => a.name).join('; '), b.check ?? '', b.hosting ?? '', b.group ?? '', b.note]))),
    ...(v.aside?.boxes ?? []).map((b) => [v.title, v.aside!.title, 1, b.name, REF_STATUS[b.status].label, '', b.check ?? '', '', '', b.note]),
  ]

  const headCls = 'text-[11px] font-semibold leading-tight text-white'
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-export-ignore>
        <span className="flex flex-wrap items-center gap-3 text-[11px]">
          {STATUSES.filter((s) => s !== 'validate' || v.counts.validate).map((s) => (
            <span key={s} className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border" style={{ borderColor: tint(REF_STATUS[s].color, 0.55), background: tint(REF_STATUS[s].color, 0.16) }} />{REF_STATUS[s].label} <b className="tabular">{v.counts[s]}</b></span>
          ))}
          <Explain x={v.explain} />
        </span>
        <span className="ml-auto flex items-center gap-2">
          {appToggle && <label className="flex items-center gap-1.5 text-[11.5px] font-medium"><Switch checked={showApps} onCheckedChange={setShowApps} /> Show Applications</label>}
          {edit && <Button size="sm" variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending}><RotateCcw /> Restore Default</Button>}
          <Button size="sm" variant={edit ? 'default' : 'outline'} onClick={() => setEdit(!edit)}>{edit ? 'Done Editing' : <><Pencil /> Edit Layout</>}</Button>
          <AiAction what="Architecture view" from="the application, data and technology inventory" />
          <ExportMenu target={box} name={v.title} csv={csv} drawio={() => refViewDrawio(v)} />
        </span>
      </div>

      <div ref={box} className="space-y-2 rounded-lg bg-card p-1">
        {edit ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr]" data-export-ignore>
            <Input defaultValue={v.title} onBlur={(e) => e.target.value.trim() && e.target.value !== v.title && commit({ ...base, title: e.target.value.trim() })} className="h-8 font-semibold" />
            <Input defaultValue={v.subtitle} onBlur={(e) => e.target.value !== v.subtitle && commit({ ...base, subtitle: e.target.value })} className="h-8" />
          </div>
        ) : (
          <div className="px-1">
            <div className="text-[14px] font-semibold text-navy">{v.title}</div>
            <div className="text-[11.5px] text-muted-foreground">{v.subtitle}</div>
          </div>
        )}

        {(v.functions.length > 0 || edit) && v.kind === 'application' && (
          <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-1.5">
            <span className="flex items-center rounded-md px-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">CIL Functions</span>
            <div className="flex flex-wrap gap-1">
              {v.functions.map((f, i) => (
                <span key={f + i} className="flex min-w-[88px] flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-center text-[10.5px] leading-tight font-semibold text-white" style={{ background: NAVY }}>
                  {f}
                  {edit && <button data-export-ignore onClick={() => commit({ ...base, functions: base.functions.filter((_, j) => j !== i) })} title="Remove function"><X className="size-3" /></button>}
                </span>
              ))}
              {edit && (
                <span className="flex items-center gap-1" data-export-ignore>
                  <Input value={fn} onChange={(e) => setFn(e.target.value)} placeholder="Add function" className="h-7 w-36 text-[12px]"
                    onKeyDown={(e) => { if (e.key === 'Enter' && fn.trim()) { commit({ ...base, functions: [...base.functions, fn.trim()] }); setFn('') } }} />
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={area} className={cn('relative grid gap-1.5', v.aside && 'grid-cols-[minmax(0,1fr)_190px]')}>
          <svg className="pointer-events-none absolute inset-0 z-[1] size-full overflow-visible">
            <defs><marker id={`arr-${v.id}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill={NAVY} /></marker></defs>
            {paths.map((p) => {
              const on = hover && (p.from === hover || p.to === hover)
              return <path key={p.id} d={p.d} fill="none" stroke={NAVY} strokeWidth={on ? 1.8 : 1.1} strokeOpacity={hover ? (on ? 0.9 : 0.12) : 0.45} markerEnd={`url(#arr-${v.id})`} />
            })}
          </svg>
          <div className="space-y-1.5">
            {v.layers.map((l, li) => (
              <div key={l.id} className="grid grid-cols-[150px_minmax(0,1fr)] gap-1.5 rounded-lg p-1" style={{ background: tint(NAVY, 0.05) }}>
                <div className="flex flex-col justify-center gap-1 rounded-md px-2 py-1.5" style={{ background: NAVY }}>
                  {edit ? (
                    <>
                      <Input defaultValue={l.name} data-export-ignore className="h-7 bg-white text-[11.5px] text-foreground"
                        onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && setLayers(base.layers.map((x) => (x.id === l.id ? { ...x, name: e.target.value.trim() } : x)))} />
                      <span className="flex gap-0.5" data-export-ignore>
                        {[[ArrowUp, -1, 'Move up'], [ArrowDown, 1, 'Move down']].map(([Icon, d, t]) => {
                          const I = Icon as typeof ArrowUp
                          return <Button key={t as string} size="icon-xs" variant="secondary" title={t as string} disabled={li + (d as number) < 0 || li + (d as number) >= v.layers.length}
                            onClick={() => { const c = [...base.layers]; [c[li], c[li + (d as number)]] = [c[li + (d as number)], c[li]]; setLayers(c) }}><I /></Button>
                        })}
                        <Button size="icon-xs" variant="secondary" title="Add row" onClick={() => setLayers(base.layers.map((x) => (x.id === l.id ? { ...x, rows: [...x.rows, []] } : x)))}><Plus /></Button>
                        <Button size="icon-xs" variant="secondary" title="Delete layer" onClick={() => {
                          const ids = new Set(l.rows.flat().map((b) => b.id))
                          commit({ ...base, layers: base.layers.filter((x) => x.id !== l.id), edges: base.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to)) })
                        }}><Trash2 /></Button>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={cn(headCls, 'uppercase')}>{l.name}</span>
                      {layerDetail?.(l.id) && <button data-export-ignore onClick={() => setDetail(l.id)} className="flex w-fit items-center gap-1 rounded bg-white/15 px-1.5 py-px text-[10px] font-medium text-white hover:bg-white/25"><Info className="size-3" /> Details</button>}
                    </>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-1.5">
                  {l.rows.map((r, ri) => (
                    <Row key={ri} row={r} render={render} edit={edit} onAdd={() => addBlock({ layer: l.id, row: ri })}
                      onDropRow={() => setLayers(base.layers.map((x) => (x.id === l.id ? { ...x, rows: x.rows.filter((_, j) => j !== ri) } : x)))} />
                  ))}
                  {!l.rows.length && edit && <Button size="xs" variant="outline" className="self-start" data-export-ignore onClick={() => setLayers(base.layers.map((x) => (x.id === l.id ? { ...x, rows: [[]] } : x)))}><Plus /> Add Row</Button>}
                </div>
              </div>
            ))}
            {edit && (
              <Button size="sm" variant="outline" data-export-ignore onClick={() => setLayers([...base.layers, { id: `l-${newId()}`, name: 'New Layer', rows: [[]] }])}><Plus /> Add Layer</Button>
            )}
          </div>
          {v.aside && (
            <div className="flex flex-col gap-1.5 rounded-lg p-1" style={{ background: tint(NAVY, 0.05) }}>
              <div className="rounded-md px-2 py-1.5 text-center" style={{ background: NAVY }}>
                {edit
                  ? <Input defaultValue={v.aside.title} data-export-ignore className="h-7 bg-white text-[11.5px] text-foreground" onBlur={(e) => e.target.value.trim() && commit({ ...base, aside: base.aside && { ...base.aside, title: e.target.value.trim() } })} />
                  : <span className={cn(headCls, 'uppercase')}>{v.aside.title}</span>}
                {!edit && layerDetail?.('aside') && <button data-export-ignore onClick={() => setDetail('aside')} className="mx-auto mt-1 flex w-fit items-center gap-1 rounded bg-white/15 px-1.5 py-px text-[10px] font-medium text-white hover:bg-white/25"><Info className="size-3" /> Details</button>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 [&>button]:flex-1">{v.aside.boxes.map(render)}</div>
              {edit && <Button size="xs" variant="outline" data-export-ignore onClick={() => addBlock({ list: 'aside' })}><Plus /> Add Block</Button>}
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground" data-export-ignore>
        Select a block to rate it, map applications{v.kind === 'data' ? ', set its flows' : ''} and add evidence. {v.edges.length ? 'Hover a block to trace its flows. ' : ''}
        {edit ? 'Edit Layout adds, renames, reorders and deletes layers, rows and blocks.' : 'Use Edit Layout to add or remove layers, rows and blocks.'}
      </p>
      <Dialog open={!!det} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader><DialogTitle>{det?.title}</DialogTitle></DialogHeader>
          <div className="scrollbar-thin max-h-[70vh] overflow-y-auto">{det?.body}</div>
        </DialogContent>
      </Dialog>
      <BlockDialog v={base} block={open?.b ?? null} ctx={ctx} kind={v.kind} onClose={() => setOpen(null)} onSave={saveBlock} onDelete={delBlock} onMove={moveBlock} />
    </div>
  )
}

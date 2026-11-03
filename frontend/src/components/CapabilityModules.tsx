import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Explain } from '@/components/Explain'
import { FlowDiagram } from '@/components/FlowDiagram'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api, type Business } from '@/lib/api'
import { BAND, LADDER_COLOR, NAVY, SLATE, SLATE_LIGHT, dispositionColor, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function useBusinessUpdate() {
  const qc = useQueryClient()
  return (d: Business, msg?: string) => {
    qc.setQueryData(['business'], d)
    ;['overview', 'roadmap', 'applications'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    if (msg) toast.success(msg)
  }
}

export function LadderChip({ level, label }: { level: number | null | undefined; label: string | null }) {
  if (!level || !label) return <span className="text-[11px] text-muted-foreground">–</span>
  const c = LADDER_COLOR[level - 1]
  return <span className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10.5px] font-semibold whitespace-nowrap" style={{ color: c, background: tint(c, 0.12) }}>{level} · {label}</span>
}

export function AppChip({ a }: { a: { id: string; name: string; disposition: string; label: string } }) {
  return (
    <span title={`${a.name} · ${a.label}`} className="inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10.5px]">
      <span className="size-1.5 rounded-full" style={{ background: dispositionColor(a.disposition) }} />{a.name.split(' (')[0]}
    </span>
  )
}

// ---------------------------------------------------------------- catalogue node dialog (CIL-specific capabilities)
export type NodeEdit = { mode: 'add' | 'edit'; level: 0 | 1 | 2 | 3; id?: string; parent?: string | null; name?: string; description?: string; owner?: string; depends_on?: string[]; automation?: string }

export function NodeDialog({ b, edit, onClose }: { b: Business; edit: NodeEdit | null; onClose: () => void }) {
  const done = useBusinessUpdate()
  const [f, setF] = useState<NodeEdit | null>(null)
  const [depQ, setDepQ] = useState('')
  useEffect(() => { setF(edit); setDepQ('') }, [edit])
  const save = useMutation({
    mutationFn: () => {
      const x = f!
      if (x.mode === 'add') return api.addNode({ level: x.level, parent: x.parent ?? null, name: x.name ?? '', description: x.description, owner: x.owner })
      const fields: Record<string, unknown> = { name: x.name, description: x.description ?? '', owner: x.owner ?? '' }
      if (x.level > 0 && x.parent) fields.parent = x.parent
      if (x.level === 2) { fields.depends_on = x.depends_on ?? []; fields.automation = x.automation ?? '' }
      return api.editNode(x.id!, fields)
    },
    onSuccess: (d) => { done(d, f?.mode === 'add' ? `${f.name} added` : `${f?.name} updated`); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  const l2 = b.l1.flatMap((l) => l.children).filter((c) => c.id !== f?.id && `${c.id} ${c.name}`.toLowerCase().includes(depQ.toLowerCase()))
  const parents = f?.level === 1 ? b.l0.map((x) => ({ id: x.id, name: x.name })) : f?.level === 2 ? b.l1.map((x) => ({ id: x.id, name: x.name }))
    : f?.level === 3 ? b.l1.flatMap((x) => x.children).map((x) => ({ id: x.id, name: x.name })) : []
  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {f && (
          <>
            <DialogHeader>
              <DialogTitle>{f.mode === 'add' ? `Add CIL-specific L${f.level} capability` : `Edit ${f.id}`}</DialogTitle>
              <DialogDescription>For capabilities the standard model does not cover · L0 › L1 › L2 › L3 · §8.4, §32</DialogDescription>
              {f.mode === 'add' && (
                <ToggleGroup type="single" value={String(f.level)} onValueChange={(v) => v && setF({ ...f, level: Number(v) as 2 | 3, parent: null })} variant="outline" size="sm" className="mt-1 w-fit">
                  <ToggleGroupItem value="2" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">L2 Capability</ToggleGroupItem>
                  <ToggleGroupItem value="3" className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">L3 Process</ToggleGroupItem>
                </ToggleGroup>
              )}
            </DialogHeader>
            <div className="grid gap-3">
              <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Name
                <Input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-8 text-foreground" />
              </label>
              {f.level > 0 && (
                <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Parent (L{f.level - 1})
                  <Select value={f.parent ?? undefined} onValueChange={(v) => setF({ ...f, parent: v })}>
                    <SelectTrigger size="sm" className="h-8 w-full text-[13px] text-foreground"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.id} · {p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              )}
              <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Owner (role)
                <Input value={f.owner ?? ''} onChange={(e) => setF({ ...f, owner: e.target.value })} className="h-8 text-foreground" placeholder="e.g. Head of Supply Chain" />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Description
                <Textarea value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-14 text-sm text-foreground" />
              </label>
              {f.level === 2 && f.mode === 'edit' && (
                <>
                  <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Automation / tools in use
                    <Input value={f.automation ?? ''} onChange={(e) => setF({ ...f, automation: e.target.value })} className="h-8 text-foreground" />
                  </label>
                  <div className="text-[11.5px] font-medium text-muted-foreground">Depends on (upstream L2 whose outputs it consumes) · {f.depends_on?.length ?? 0}</div>
                  <Input value={depQ} onChange={(e) => setDepQ(e.target.value)} placeholder="Filter" className="h-8" />
                  <div className="scrollbar-thin grid max-h-36 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-md border p-2">
                    {l2.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-[12px]">
                        <Checkbox checked={!!f.depends_on?.includes(c.id)}
                          onCheckedChange={() => setF({ ...f, depends_on: f.depends_on?.includes(c.id) ? f.depends_on.filter((x) => x !== c.id) : [...(f.depends_on ?? []), c.id] })} />
                        <span className="w-11 shrink-0 font-semibold text-muted-foreground">{c.id}</span><span className="truncate">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!f.name?.trim() || (f.level > 0 && !f.parent) || save.isPending}>Save</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Step 5: entanglement
function L1Network({ b, focus, onFocus }: { b: Business; focus: string | null; onFocus: (id: string | null) => void }) {
  const R = 150, C = 200
  const pos = Object.fromEntries(b.l1.map((l, i) => {
    const t = (i / b.l1.length) * Math.PI * 2 - Math.PI / 2
    return [l.id, { x: C + R * Math.cos(t), y: C + R * Math.sin(t), t }]
  }))
  const maxN = Math.max(1, ...b.entanglement.l1_links.map((l) => l.count))
  return (
    <svg viewBox="-95 20 590 360" className="h-[380px] w-full">
      {b.entanglement.l1_links.map((l, i) => {
        const a = pos[l.from], z = pos[l.to]
        if (!a || !z) return null
        const on = !focus || focus === l.from || focus === l.to
        return (
          <path key={i} d={`M ${a.x} ${a.y} Q ${C} ${C} ${z.x} ${z.y}`} fill="none" stroke={on ? NAVY : SLATE_LIGHT}
            strokeWidth={1 + (l.count / maxN) * 4} opacity={on ? 0.55 : 0.2}>
            <title>{`${l.from} → ${l.to}: ${l.count} dependencies`}</title>
          </path>
        )
      })}
      {b.l1.map((l) => {
        const p = pos[l.id]
        const kids = l.children.filter((c) => c.maturity !== null)
        const m = kids.length ? kids.reduce((s, c) => s + (c.maturity ?? 0), 0) / kids.length : null
        const col = m === null ? SLATE : m >= 3.5 ? BAND.strong : m >= 2.5 ? BAND.developing : m >= 1.5 ? BAND.weak : BAND.critical
        const right = Math.cos(p.t) >= 0
        return (
          <g key={l.id} className="cursor-pointer" onClick={() => onFocus(focus === l.id ? null : l.id)} opacity={focus && focus !== l.id ? 0.55 : 1}>
            <circle cx={p.x} cy={p.y} r={focus === l.id ? 15 : 12} fill={col} stroke="white" strokeWidth={2} />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="white">{l.id}</text>
            <text x={p.x + (right ? 18 : -18)} y={p.y + 3} textAnchor={right ? 'start' : 'end'} fontSize={9.5} fill={SLATE}>{l.name.length > 22 ? `${l.name.slice(0, 21)}…` : l.name}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function Entanglement({ b }: { b: Business }) {
  const nodes = b.entanglement.nodes
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes])
  const ranked = [...nodes].sort((x, y) => y.score - x.score)
  const [sel, setSel] = useState<string>(ranked[0]?.id ?? '')
  const [l1Focus, setL1Focus] = useState<string | null>(null)
  const n = byId[sel]
  const name = (id: string) => byId[id]?.name ?? id
  const cols = n ? [
    { key: 'up', title: 'Depends on (upstream)', nodes: n.upstream.map((id) => ({ id, label: name(id), sub: id, color: NAVY })) },
    { key: 'me', title: 'Selected capability', nodes: [{ id: n.id, label: n.name, sub: `${n.id} · score ${n.score}`, color: n.high ? BAND.critical : BAND.developing }] },
    { key: 'down', title: 'Feeds (downstream)', nodes: n.downstream.map((id) => ({ id, label: name(id), sub: id, color: NAVY })) },
  ] : []
  const edges = n ? [...n.upstream.map((u) => ({ from: u, to: n.id, color: NAVY })), ...n.downstream.map((d) => ({ from: n.id, to: d, color: NAVY }))] : []
  const sharedApps = b.entanglement.shared.filter((s) => s.a === sel || s.b === sel)
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4 rounded-lg border p-3">
        <div className="text-xs font-semibold">L1 Dependency Map</div>
        <div className="text-[11px] text-muted-foreground">Line weight = number of L2 dependencies between L1 areas. Select an L1 to focus.</div>
        <L1Network b={b} focus={l1Focus} onFocus={setL1Focus} />
      </div>
      <div className="col-span-8 space-y-3">
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold">Capability Traceability</span>
            <Select value={sel} onValueChange={setSel}>
              <SelectTrigger size="sm" className="h-7 w-[320px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{ranked.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} · {x.name} ({x.score})</SelectItem>)}</SelectContent>
            </Select>
            {n && <Explain x={n.explain} />}
            {n && <span className="ml-auto text-[11px] text-muted-foreground">{b.l0.find((l) => l.id === b.l1.find((x) => x.id === n.l1)?.l0)?.name} › {b.l1.find((x) => x.id === n.l1)?.name} › {n.name}</span>}
          </div>
          {n && <FlowDiagram columns={cols} edges={edges} selected={sel} onSelect={(id) => id && byId[id] && setSel(id)} nodeH={36} minHeight={80} />}
          {sharedApps.length > 0 && (
            <div className="mt-2 border-t pt-2 text-[11.5px]">
              <span className="font-semibold">Coupled through shared applications: </span>
              {sharedApps.map((s) => {
                const other = s.a === sel ? s.b : s.a
                return <button key={other} onClick={() => setSel(other)} className="mr-2 underline decoration-dotted hover:text-navy">{other} {name(other)} ({s.apps.join(', ')})</button>
              })}
            </div>
          )}
          {n && (b.entanglement_l3[sel]?.length ?? 0) > 0 && (
            <div className="mt-3 border-t pt-2">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold">L3 Drill-Down <span className="font-normal text-muted-foreground">· coupling through the systems each process owner named in discovery, plus the L2's own dependencies</span></div>
              <div className="overflow-hidden rounded-md border">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_60px] gap-3 border-b bg-muted/40 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  <span>L3 Process</span><span>Systems Used</span><span>Shares Systems With (Other L2s)</span><span className="text-right">Score</span>
                </div>
                {b.entanglement_l3[sel].map((x) => {
                  const cross = x.shared.filter((s) => s.l2 !== x.l2)
                  return (
                    <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_60px] items-start gap-3 border-b px-2.5 py-1.5 text-[11.5px] last:border-0">
                      <span className="min-w-0"><span className="mr-1 text-[10px] text-muted-foreground">{x.id}</span>{x.name}</span>
                      <span className="text-muted-foreground">{x.answered ? (x.app_names.join(', ') || 'None named') : <i>Awaiting discovery</i>}</span>
                      <span className="flex flex-wrap gap-1">
                        {cross.slice(0, 4).map((s) => <button key={s.id} onClick={() => setSel(s.l2)} title={`via ${s.apps.join(', ')}`} className="rounded border px-1.5 py-px text-[10.5px] hover:border-navy hover:text-navy">{s.name} <span className="text-muted-foreground">({s.l2})</span></button>)}
                        {cross.length > 4 && <span className="text-[10.5px] text-muted-foreground">+{cross.length - 4} more</span>}
                        {x.answered && !cross.length && <span className="text-[10.5px] text-muted-foreground">None</span>}
                      </span>
                      <span className="flex items-center justify-end gap-1">{x.score !== null ? <><Explain x={x.explain} /><span className="tabular rounded px-1.5 font-semibold" style={x.score >= b.entanglement.threshold ? { color: BAND.critical, background: tint(BAND.critical) } : undefined}>{x.score}</span></> : <span className="text-muted-foreground">–</span>}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div className="scrollbar-thin max-h-[250px] overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow><TableHead className="w-16">ID</TableHead><TableHead>Capability</TableHead><TableHead className="text-center">Up</TableHead><TableHead className="text-center">Down</TableHead><TableHead className="text-center">Shared app</TableHead><TableHead className="text-right">Score</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {ranked.filter((x) => !l1Focus || x.l1 === l1Focus).map((x) => (
                <TableRow key={x.id} className={cn('cursor-pointer', x.id === sel && 'bg-navy-soft/60')} onClick={() => setSel(x.id)}>
                  <TableCell className="text-xs font-semibold text-muted-foreground">{x.id}</TableCell>
                  <TableCell className="font-medium">{x.name}</TableCell>
                  <TableCell className="tabular text-center">{x.upstream.length}</TableCell>
                  <TableCell className="tabular text-center">{x.downstream.length}</TableCell>
                  <TableCell className="tabular text-center">{x.shared.length}</TableCell>
                  <TableCell className="text-right"><span className="inline-flex items-center gap-1"><Explain x={x.explain} />
                    <span className="tabular rounded px-1.5 font-semibold" style={x.high ? { color: BAND.critical, background: tint(BAND.critical) } : undefined}>{x.score}</span></span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

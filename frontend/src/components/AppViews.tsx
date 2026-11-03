import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { FlowDiagram, Legend, type FNode } from '@/components/FlowDiagram'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { interactionDrawio } from '@/lib/drawio'
import { api, type Applications, type Iface, type IfaceIn } from '@/lib/api'
import { BAND, DEFAULT_LAYER, LAYER_COLOR, PATTERN_COLOR, SLATE, tint } from '@/lib/theme'

const short = (n: string) => n.split(' (')[0]

/** RFP view 4: application communication diagram from the Interface Catalog (§35.6.5), with the catalog editable in place. */
export function InteractionGraph({ a }: { a: Applications }) {
  const [sel, setSel] = useState<string | null>(null)
  const [catalog, setCatalog] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const deg = a.integration.degree
  const columns = a.layers.map((ly) => ({
    key: ly, title: <span style={{ color: LAYER_COLOR[ly] }}>{ly}</span>,
    nodes: a.apps.filter((x) => (x.layer ?? DEFAULT_LAYER) === ly && (deg[x.id] ?? 0) > 0)
      .sort((x, y) => (deg[y.id] ?? 0) - (deg[x.id] ?? 0))
      .map((x): FNode => ({ id: x.id, label: short(x.name), sub: `${x.id} · ${deg[x.id] ?? 0} interfaces`, color: LAYER_COLOR[ly], dashed: !x.in_scope,
        badge: (deg[x.id] ?? 0) >= a.integration.hotspot_min ? <span className="rounded px-1 text-[9.5px] font-bold" style={{ color: BAND.critical, background: tint(BAND.critical) }}>HOT</span> : undefined })),
  }))
  columns.push({ key: 'ext', title: <span>External</span>, nodes: a.external.map((x) => ({ id: x.id, label: x.name, sub: 'External party', color: SLATE, dashed: true })) })
  const edges = a.interfaces.map((i) => ({ from: i.from, to: i.to, color: PATTERN_COLOR[i.pattern] ?? SLATE, dashed: i.pattern === 'Manual / re-key',
    title: `${i.id} ${i.from_name} → ${i.to_name}: ${i.data} (${i.pattern}, ${i.frequency})` }))
  const focus = sel ? a.interfaces.filter((i) => i.from === sel || i.to === sel) : []
  const csv = () => [['ID', 'From', 'To', 'Data', 'Domain', 'Pattern', 'Routing', 'Frequency', 'Source'],
    ...a.interfaces.map((i) => [i.id, i.from_name, i.to_name, i.data, i.domain ?? '', i.pattern, i.via, i.frequency, i.source])]
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Legend items={Object.entries(PATTERN_COLOR).map(([k, c]) => ({ label: k, color: c, line: true, dashed: k === 'Manual / re-key' }))} />
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Select an application to trace it · HOT = ≥ {a.integration.hotspot_min} interfaces</span>
          <AiAction label="Infer Interfaces with AI" what="Interface catalogue" from="the intake records and integration documents" />
          <Button size="sm" variant="outline" onClick={() => setCatalog(true)}><Pencil /> Edit Interfaces ({a.interfaces.length})</Button>
          <ExportMenu target={box} name="Application Interactions" csv={csv} drawio={() => interactionDrawio(a)} />
        </span>
      </div>
      <div ref={box} className="bg-card"><FlowDiagram columns={columns} edges={edges} selected={sel} onSelect={setSel} nodeH={38} /></div>
      {sel && (
        <div className="rounded-lg border p-3">
          <div className="mb-1 text-xs font-semibold">{focus.length} interfaces for {a.apps.find((x) => x.id === sel)?.name ?? sel}</div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[12px]">
            {focus.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: PATTERN_COLOR[i.pattern] }} />
                <span className="truncate">{i.from === sel ? `→ ${i.to_name}` : `← ${i.from_name}`}: {i.data}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">{i.pattern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Dialog open={catalog} onOpenChange={setCatalog}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Interface Catalog</DialogTitle>
            <DialogDescription>Add, edit or delete the interfaces behind this view (TOGAF §35.6.5).</DialogDescription>
          </DialogHeader>
          <InterfaceCatalog a={a} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

const BLANK: IfaceIn = { from: '', to: '', data: '', domain: null, pattern: 'API', frequency: 'TBD', via: 'Point-to-point' }

function InterfaceDialog({ a, edit, onClose }: { a: Applications; edit: Iface | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState<IfaceIn>(BLANK)
  const [seen, setSeen] = useState<typeof edit>(null)
  if (edit !== seen) {
    setSeen(edit)
    setF(edit && edit !== 'new' ? { from: edit.from, to: edit.to, data: edit.data, domain: edit.domain, pattern: edit.pattern, frequency: edit.frequency, via: edit.via } : BLANK)
  }
  const save = useMutation({
    mutationFn: () => (edit && edit !== 'new' ? api.putInterface(edit.id, f) : api.addInterface(f)),
    onSuccess: (d) => {
      qc.setQueryData(['applications'], d)
      ;['overview', 'data_tech'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      toast.success('Interface Catalog updated')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const ends = [...a.apps.map((x) => ({ id: x.id, name: x.name })), ...a.external]
  const pick = (label: string, value: string | null, options: { id: string; name: string }[], on: (v: string) => void) => (
    <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">{label}
      <Select value={value ?? undefined} onValueChange={on}>
        <SelectTrigger size="sm" className="h-8 w-full text-[13px] text-foreground"><SelectValue placeholder="Select" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.id} · {o.name}</SelectItem>)}</SelectContent>
      </Select>
    </label>
  )
  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{edit === 'new' ? 'Add Interface' : `Edit ${edit?.id ?? ''}`}</DialogTitle>
          <DialogDescription>Interface Catalog · TOGAF §35.6.5. Point-to-point unless routed through the API layer.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {pick('From (source)', f.from || null, ends, (v) => setF({ ...f, from: v }))}
          {pick('To (target)', f.to || null, ends, (v) => setF({ ...f, to: v }))}
          <label className="col-span-2 flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Data exchanged
            <Input value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} className="h-8 text-foreground" />
          </label>
          {pick('Pattern', f.pattern, a.patterns.map((p) => ({ id: p, name: p })), (v) => setF({ ...f, pattern: v }))}
          {pick('Routing', f.via, [{ id: 'Point-to-point', name: 'direct' }, { id: 'API layer', name: 'governed gateway' }], (v) => setF({ ...f, via: v }))}
          {pick('Data domain', f.domain, a.domains, (v) => setF({ ...f, domain: v }))}
          <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Frequency
            <Input value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} className="h-8 text-foreground" />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!f.from || !f.to || save.isPending}>Save Interface</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** RFP view 5: integration, API and data-flow architecture: pattern mix, hotspots, governance and the editable Interface Catalog. */
export function IntegrationView({ a }: { a: Applications }) {
  const ig = a.integration
  const total = Math.max(1, ig.count)
  const box = useRef<HTMLDivElement>(null)
  const via = a.interfaces.reduce<Record<string, number>>((m, i) => ({ ...m, [i.via]: (m[i.via] ?? 0) + 1 }), {})
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportMenu target={box} name="Integration and API Architecture" csv={() => [['Pattern', 'Interfaces'], ...Object.entries(ig.by_pattern)]} />
      </div>
      <div ref={box} className="grid grid-cols-12 gap-4 bg-card">
        <div className="col-span-5 rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">Integration Patterns <Explain x={a.explain.p2p_share} /></div>
          <div className="flex h-7 overflow-hidden rounded-md">
            {Object.entries(ig.by_pattern).map(([p, n]) => (
              <div key={p} title={`${p}: ${n}`} className="flex items-center justify-center text-[10.5px] font-semibold text-white" style={{ width: `${(n / total) * 100}%`, background: PATTERN_COLOR[p] ?? SLATE }}>{n}</div>
            ))}
          </div>
          <div className="mt-2"><Legend items={Object.entries(PATTERN_COLOR).map(([k, c]) => ({ label: `${k} (${ig.by_pattern[k] ?? 0})`, color: c }))} /></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[[`${ig.p2p_share}%`, 'point-to-point'], [`${ig.legacy_share}%`, 'file, DB or manual'], [String(ig.manual), 'manual hand-offs']].map(([v, l]) => (
              <div key={l} className="rounded-md bg-muted/60 px-2 py-1.5"><div className="tabular text-lg font-semibold text-navy">{v}</div><div className="text-[10.5px] text-muted-foreground">{l}</div></div>
            ))}
          </div>
        </div>
        <div className="col-span-4 rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">Integration Hotspots <Explain x={a.explain.hotspots} /></div>
          <ul className="space-y-1.5">
            {ig.hotspots.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-9 text-[11px] font-semibold text-muted-foreground">{h.id}</span><span className="flex-1 truncate">{short(h.name)}</span>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-navy" style={{ width: `${Math.min(100, (h.degree / 12) * 100)}%` }} /></span>
                <span className="tabular w-5 text-right font-semibold">{h.degree}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-span-3 rounded-lg border p-3 text-[12px]">
          <div className="mb-2 text-xs font-semibold">Integration Governance</div>
          <div className="space-y-1.5">
            {Object.entries(via).map(([k, n]) => <div key={k} className="flex justify-between"><span>{k}</span><b className="tabular">{n}</b></div>)}
            <p className="text-[11px] text-muted-foreground">Target: new integrations through the governed API layer (P-CIL-03, guardrail G-01); events for plant and channel updates; no new point-to-point links to SAP or retail. Middleware status follows resilience check R05.</p>
          </div>
        </div>
      </div>
      <InterfaceCatalog a={a} />
    </div>
  )
}

/** Editable Interface Catalog: add, edit and delete interfaces. */
export function InterfaceCatalog({ a }: { a: Applications }) {
  const qc = useQueryClient()
  const [edit, setEdit] = useState<Iface | 'new' | null>(null)
  const del = useMutation({
    mutationFn: api.deleteInterface,
    onSuccess: (d) => { qc.setQueryData(['applications'], d); toast.success('Interface removed') },
  })
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{a.interfaces.length} interfaces · {a.integration.p2p_share}% point-to-point</div>
        <Button size="sm" variant="outline" onClick={() => setEdit('new')}><Plus /> Add Interface</Button>
      </div>
      <div className="scrollbar-thin max-h-[56vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-12">ID</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Data</TableHead>
              <TableHead>Pattern</TableHead><TableHead>Routing</TableHead><TableHead>Frequency</TableHead><TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.interfaces.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="text-xs font-semibold text-muted-foreground">{i.id}</TableCell>
                <TableCell className="max-w-40 truncate">{short(i.from_name)}</TableCell>
                <TableCell className="max-w-40 truncate">{short(i.to_name)}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">{i.data}{i.domain ? ` · ${i.domain}` : ''}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5 text-xs"><span className="size-2 rounded-full" style={{ background: PATTERN_COLOR[i.pattern] }} />{i.pattern}</span></TableCell>
                <TableCell className="text-xs text-muted-foreground">{i.via}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{i.frequency}</TableCell>
                <TableCell>
                  <span className="flex gap-0.5">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEdit(i)} aria-label="Edit interface"><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => del.mutate(i.id)} aria-label="Delete interface"><Trash2 /></Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <InterfaceDialog a={a} edit={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

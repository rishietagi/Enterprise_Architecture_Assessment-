import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { CyberInputsPanel } from '@/components/Cyber'
import { ExportMenu } from '@/components/ExportMenu'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api, type DataTech, type Domain, type DomainIn, type NetLink, type Platform, type PlatformIn, type Site } from '@/lib/api'
import { BAND, NAVY, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

const short = (n: string) => n.split(' (')[0]
const QUALITY = ['Completeness', 'Accuracy', 'Timeliness']
const NONE = '__none'
const label = 'flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground'

function useSave() {
  const qc = useQueryClient()
  return (d: DataTech, msg: string) => {
    qc.setQueryData(['data_tech'], d)
    ;['overview', 'roadmap', 'applications', 'vision'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    toast.success(msg)
  }
}

function DomainDialog({ d, edit, onClose }: { d: DataTech; edit: Domain | 'new' | null; onClose: () => void }) {
  const done = useSave()
  const blank: DomainIn = { name: '', description: '', owner: false, steward: '', sor: '', consumers: [], mdm: 'none', lineage: false, pii: false, classified: false, quality: [3, 3, 3], data_types: [], sensitivity: 'Internal', volume_hint: '', retention: '' }
  const [f, setF] = useState<DomainIn>(blank)
  useEffect(() => {
    if (!edit) return
    setF(edit === 'new' ? blank : { name: edit.name, description: edit.description ?? '', owner: edit.owner, steward: edit.steward ?? '', sor: edit.sor, consumers: edit.consumers,
      mdm: edit.mdm, lineage: edit.lineage, pii: edit.pii, classified: edit.classified, quality: edit.quality, data_types: edit.data_types ?? [], sensitivity: edit.sensitivity ?? 'Internal',
      volume_hint: edit.volume_hint ?? '', retention: edit.retention ?? '' })
  }, [edit]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({ mutationFn: () => (edit === 'new' ? api.addDomain(f) : api.putDomain((edit as Domain).id, f)), onSuccess: (x) => { done(x, 'Data domain saved; scores recomputed'); onClose() }, onError: (e: Error) => toast.error(e.message) })
  const del = useMutation({ mutationFn: () => api.deleteDomain((edit as Domain).id), onSuccess: (x) => { done(x, 'Data domain removed'); onClose() } })
  const set = (p: Partial<DomainIn>) => setF({ ...f, ...p })
  const toggle = (k: 'data_types' | 'consumers', v: string) => set({ [k]: (f[k] ?? []).includes(v) ? (f[k] ?? []).filter((x) => x !== v) : [...(f[k] ?? []), v] })
  return (
    <Dialog open={!!edit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{edit === 'new' ? 'Add Data Domain' : `Edit ${(edit as Domain | null)?.id ?? ''}`}</DialogTitle>
          <DialogDescription>Data Entity attributes (TOGAF §34.6). Ownership, master data, quality, lineage and privacy feed the data assessment.</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin grid max-h-[64vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
          <label className={label}>Domain name<Input value={f.name ?? ''} onChange={(e) => set({ name: e.target.value })} className="h-8 text-foreground" /></label>
          <label className={label}>Sensitivity
            <Select value={f.sensitivity} onValueChange={(v) => set({ sensitivity: v })}><SelectTrigger size="sm" className="h-8 w-full text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>{d.options.sensitivity.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className={cn(label, 'col-span-2')}>What the domain holds<Textarea rows={2} value={f.description ?? ''} onChange={(e) => set({ description: e.target.value })} className="text-[13px] text-foreground" /></label>
          <div className={cn(label, 'col-span-2')}>Data types
            <div className="flex flex-wrap gap-1.5">{d.options.data_types.map((t) => (
              <button key={t} type="button" onClick={() => toggle('data_types', t)} className={cn('rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium', (f.data_types ?? []).includes(t) ? 'border-navy bg-navy text-white' : 'text-foreground hover:bg-muted')}>{t}</button>
            ))}</div>
          </div>
          <label className={label}>Volume<Input value={f.volume_hint ?? ''} onChange={(e) => set({ volume_hint: e.target.value })} placeholder="e.g. 3M records, 20 GB a month" className="h-8 text-foreground" /></label>
          <label className={label}>Retention<Input value={f.retention ?? ''} onChange={(e) => set({ retention: e.target.value })} placeholder="e.g. 8 years (statutory)" className="h-8 text-foreground" /></label>
          <label className={label}>System of record
            <Select value={f.sor || NONE} onValueChange={(v) => set({ sor: v === NONE ? '' : v })}><SelectTrigger size="sm" className="h-8 w-full text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72"><SelectItem value={NONE}>None</SelectItem>{d.apps.map((a) => <SelectItem key={a.id} value={a.id}>{a.id} · {short(a.name)}</SelectItem>)}</SelectContent></Select>
          </label>
          <label className={label}>Data steward<Input value={f.steward ?? ''} onChange={(e) => set({ steward: e.target.value })} placeholder="Role" className="h-8 text-foreground" /></label>
          <label className={label}>Master data management
            <Select value={f.mdm} onValueChange={(v) => set({ mdm: v as Domain['mdm'] })}><SelectTrigger size="sm" className="h-8 w-full text-foreground capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>{d.options.mdm.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
          </label>
          <div className={label}>Quality (1–5)
            <div className="grid grid-cols-3 gap-1.5">{QUALITY.map((q, i) => (
              <span key={q} className="flex flex-col"><span className="text-[10px] font-normal">{q}</span>
                <Select value={String((f.quality ?? [3, 3, 3])[i])} onValueChange={(v) => set({ quality: (f.quality ?? [3, 3, 3]).map((x, j) => (j === i ? Number(v) : x)) })}>
                  <SelectTrigger size="sm" className="h-7 w-full text-foreground"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></span>
            ))}</div>
          </div>
          <div className="col-span-2 grid grid-cols-4 gap-3 text-[12.5px] text-foreground">
            {([['owner', 'Named business owner'], ['lineage', 'Lineage documented'], ['pii', 'Holds personal data'], ['classified', 'Privacy classified']] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><Switch checked={!!f[k]} onCheckedChange={(v) => set({ [k]: v })} />{l}</label>
            ))}
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {edit !== 'new' ? <Button variant="ghost" className="text-destructive" onClick={() => del.mutate()}><Trash2 /> Remove</Button> : <span />}
          <span className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!f.name?.trim() || save.isPending}>Save Domain</Button></span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Domains({ d }: { d: DataTech }) {
  const [edit, setEdit] = useState<Domain | 'new' | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const app = Object.fromEntries(d.apps.map((a) => [a.id, short(a.name)]))
  const csv = () => [['ID', 'Domain', 'Description', 'Data types', 'Sensitivity', 'Volume', 'Retention', 'System of record', 'Owner', 'Steward', 'MDM', 'Quality', 'Lineage', 'PII', 'Classified'],
    ...d.domains.map((x) => [x.id, x.name, x.description ?? '', (x.data_types ?? []).join('; '), x.sensitivity ?? '', x.volume_hint ?? '', x.retention ?? '', app[x.sor] ?? x.sor,
      x.owner ? 'Yes' : 'No', x.steward ?? '', x.mdm, x.quality.join('/'), x.lineage ? 'Yes' : 'No', x.pii ? 'Yes' : 'No', x.classified ? 'Yes' : 'No'])]
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-muted-foreground">What data CIL holds, where it is mastered and who uses it. Select a row to edit.</span>
        <span className="flex gap-2"><AiAction label="Infer with AI" what="Data domain catalogue" from="the application intake and uploaded data dictionaries" /><ExportMenu target={box} name="Data Domain Catalogue" csv={csv} /><Button size="sm" onClick={() => setEdit('new')}><Plus /> Add Domain</Button></span>
      </div>
      <div ref={box} className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-14">ID</TableHead><TableHead>Domain</TableHead><TableHead>Data Types</TableHead><TableHead>Sensitivity</TableHead><TableHead>System of Record</TableHead>
            <TableHead>Volume · Retention</TableHead><TableHead className="w-10" />
          </TableRow></TableHeader>
          <TableBody>
            {d.domains.map((x) => (
              <TableRow key={x.id} className="cursor-pointer" onClick={() => setEdit(x)}>
                <TableCell className="text-xs font-semibold text-muted-foreground">{x.id}</TableCell>
                <TableCell className="max-w-60 whitespace-normal"><div className="font-medium">{short(x.name)}</div><div className="line-clamp-1 text-[10.5px] text-muted-foreground">{x.description}</div></TableCell>
                <TableCell><div className="flex max-w-52 flex-wrap gap-0.5">{(x.data_types ?? []).map((t) => <span key={t} className="rounded bg-muted px-1.5 py-px text-[10.5px]">{t}</span>)}</div></TableCell>
                <TableCell className="text-[12px]" style={{ color: (x.sensitivity ?? '').startsWith('Personal') || x.sensitivity === 'Restricted' ? BAND.weak : undefined }}>{x.sensitivity ?? '–'}</TableCell>
                <TableCell className="text-[12px]">{app[x.sor] ?? (x.sor || '–')}</TableCell>
                <TableCell className="max-w-48 text-[11px] whitespace-normal text-muted-foreground">{[x.volume_hint, x.retention].filter(Boolean).join(' · ') || '–'}</TableCell>
                <TableCell><Pencil className="size-3.5 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DomainDialog d={d} edit={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

const BLANK_P: PlatformIn = { name: '', category: '', standard: 'Proposed Standard', lifecycle: 'Current', version: '', location: '' }

function Platforms({ d }: { d: DataTech }) {
  const done = useSave()
  const [edit, setEdit] = useState<{ id: string | null; f: PlatformIn } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const save = useMutation({ mutationFn: () => (edit!.id ? api.putPlatform(edit!.id, edit!.f) : api.addPlatform(edit!.f)), onSuccess: (x) => { done(x, 'Platform saved'); setEdit(null) }, onError: (e: Error) => toast.error(e.message) })
  const del = useMutation({ mutationFn: (id: string) => api.deletePlatform(id), onSuccess: (x) => done(x, 'Platform removed') })
  const open = (p: Platform | null) => setEdit(p ? { id: p.id, f: { name: p.name, category: p.category, standard: p.standard, lifecycle: p.lifecycle, version: p.version ?? '', location: p.location ?? '' } } : { id: null, f: BLANK_P })
  const pick = (k: keyof PlatformIn, opts: string[]) => (
    <Select value={edit!.f[k]} onValueChange={(v) => setEdit({ ...edit!, f: { ...edit!.f, [k]: v } })}><SelectTrigger size="sm" className="h-8 w-full text-foreground"><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
  )
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-muted-foreground">Technology Portfolio Catalog (§35.6.6): databases, data and AI platforms, middleware, hosting and identity. Standards class and lifecycle feed the standards view.</span>
        <span className="flex gap-2"><ExportMenu target={box} name="Technology Portfolio" csv={() => [['ID', 'Platform', 'Category', 'Standards class', 'Lifecycle', 'Version', 'Location', 'Source'], ...d.platforms.map((p) => [p.id, p.name, p.category, p.standard, p.lifecycle, p.version ?? '', p.location ?? '', p.source])]} />
          <Button size="sm" onClick={() => open(null)}><Plus /> Add Platform</Button></span>
      </div>
      <div ref={box} className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead className="w-12">ID</TableHead><TableHead>Platform</TableHead><TableHead>Category</TableHead><TableHead>Standards Class</TableHead><TableHead>Lifecycle</TableHead><TableHead>Version</TableHead><TableHead>Location</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {d.platforms.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-semibold text-muted-foreground">{p.id}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-[12px] text-muted-foreground">{p.category}</TableCell>
                <TableCell className="text-[12px]">{p.standard}</TableCell>
                <TableCell className={cn('text-[12px]', p.lifecycle === 'Unknown' && 'text-muted-foreground italic')}>{p.lifecycle}</TableCell>
                <TableCell className="text-[12px] text-muted-foreground">{p.version || 'TBD'}</TableCell>
                <TableCell className="max-w-40 truncate text-[12px] text-muted-foreground">{p.location}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon-sm" onClick={() => open(p)}><Pencil /></Button><Button variant="ghost" size="icon-sm" onClick={() => del.mutate(p.id)}><Trash2 /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? `Edit ${edit.id}` : 'Add Platform'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <label className={cn(label, 'col-span-2')}>Platform<Input value={edit.f.name} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, name: e.target.value } })} className="h-8 text-foreground" /></label>
              <label className={label}>Category<Input value={edit.f.category} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, category: e.target.value } })} placeholder="e.g. Database" className="h-8 text-foreground" /></label>
              <label className={label}>Version<Input value={edit.f.version} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, version: e.target.value } })} className="h-8 text-foreground" /></label>
              <label className={label}>Standards class{pick('standard', d.options.standards)}</label>
              <label className={label}>Lifecycle{pick('lifecycle', d.options.lifecycle)}</label>
              <label className={cn(label, 'col-span-2')}>Location{pick('location', d.locations.map((l) => l.name))}</label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!edit?.f.name.trim() || save.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Sites({ d }: { d: DataTech }) {
  const done = useSave()
  const [locs, setLocs] = useState<Site[]>(d.locations)
  const [net, setNet] = useState<NetLink[]>(d.network)
  useEffect(() => { setLocs(d.locations); setNet(d.network) }, [d.locations, d.network])
  const dirty = JSON.stringify(locs) !== JSON.stringify(d.locations) || JSON.stringify(net) !== JSON.stringify(d.network)
  const save = useMutation({ mutationFn: () => api.putSites(locs, net), onSuccess: (x) => done(x, 'Sites and network saved'), onError: (e: Error) => toast.error(e.message) })
  const nextId = (p: string, ids: string[]) => `${p}${Math.max(0, ...ids.map((i) => parseInt(i.replace(/\D/g, '')) || 0)) + 1}`
  const cell = 'h-7 min-w-0 rounded-none border-0 bg-transparent px-2 text-[12px] shadow-none focus-visible:ring-0 focus:bg-navy-soft/40'
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-muted-foreground">Locations and the links between them (RFP views 7–8). Link types not yet confirmed stay TBD.</span>
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}><Save /> Save Sites & Network</Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-lg border">
          <div className="border-b px-3 py-1.5 text-[12px] font-semibold" style={{ background: tint(NAVY, 0.06) }}>Sites ({locs.length})</div>
          {locs.map((l, i) => (
            <div key={i} className="group grid grid-cols-[44px_minmax(0,1fr)_130px_28px] items-center border-b last:border-0">
              <span className="px-2 text-[11px] font-semibold text-muted-foreground">{l.id}</span>
              <Input className={cell} value={l.name} onChange={(e) => setLocs(locs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Select value={l.type} onValueChange={(v) => setLocs(locs.map((x, j) => (j === i ? { ...x, type: v } : x)))}><SelectTrigger size="sm" className="h-7 rounded-none border-0 border-l text-[11.5px] shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>{d.options.location_types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
              <button onClick={() => { setLocs(locs.filter((_, j) => j !== i)); setNet(net.filter((n) => n.from !== l.id && n.to !== l.id)) }} className="flex justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive" title="Remove site and its links"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
          <button onClick={() => setLocs([...locs, { id: nextId('L', locs.map((x) => x.id)), name: 'New site', type: 'Office', source: 'client' }])} className="flex w-full items-center gap-1 px-2 py-1 text-[11.5px] font-medium text-navy hover:bg-muted/50"><Plus className="size-3.5" /> Add site</button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <div className="border-b px-3 py-1.5 text-[12px] font-semibold" style={{ background: tint(NAVY, 0.06) }}>Network Links ({net.length})</div>
          {net.map((n, i) => (
            <div key={i} className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_28px] items-center border-b last:border-0">
              {(['from', 'to'] as const).map((k) => (
                <Select key={k} value={n[k]} onValueChange={(v) => setNet(net.map((x, j) => (j === i ? { ...x, [k]: v } : x)))}><SelectTrigger size="sm" className="h-7 rounded-none border-0 border-r text-[11.5px] shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{locs.map((l) => <SelectItem key={l.id} value={l.id}>{l.id} · {short(l.name).split(' incl.')[0]}</SelectItem>)}</SelectContent></Select>
              ))}
              <Input className={cell} value={n.type} onChange={(e) => setNet(net.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} />
              <button onClick={() => setNet(net.filter((_, j) => j !== i))} className="flex justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
          <button disabled={locs.length < 2} onClick={() => setNet([...net, { id: nextId('N', net.map((x) => x.id)), from: locs[0].id, to: locs[1].id, type: 'TBD', note: '', source: 'client' }])} className="flex w-full items-center gap-1 px-2 py-1 text-[11.5px] font-medium text-navy hover:bg-muted/50"><Plus className="size-3.5" /> Add link</button>
        </div>
      </div>
    </div>
  )
}

/** Step 1 of Data & Technology: the editable inputs every assessment and view on the screen is computed from. */
export function DataTechInputs({ d }: { d: DataTech }) {
  const [tab, setTab] = useState('domains')
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-[12px]">
        {[['Data Domains', d.domains.length, `${d.domains.filter((x) => x.pii).length} hold personal data`], ['Technology Platforms', d.platforms.length, `${d.platforms.filter((p) => p.lifecycle === 'Unknown').length} lifecycle unknown`],
          ['Sites', d.locations.length, `${d.network.length} network links`], ['Data Types', new Set(d.domains.flatMap((x) => x.data_types ?? [])).size, 'distinct types across domains']].map(([l, v, s]) => (
          <div key={l as string}><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{l}</div><div className="tabular text-[15px] font-semibold">{v}<span className="text-[11px] font-normal text-muted-foreground"> · {s}</span></div></div>
        ))}
      </div>
      <ToggleGroup type="single" value={tab} onValueChange={(v) => v && setTab(v)} variant="outline" size="sm">
        {[['domains', 'Data Domains & Types'], ['platforms', 'Technology Platforms'], ['sites', 'Sites & Network'], ['cyber', 'Cyber Security']].map(([k, l]) => (
          <ToggleGroupItem key={k} value={k} className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">{l}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      {tab === 'domains' && <Domains d={d} />}
      {tab === 'platforms' && <Platforms d={d} />}
      {tab === 'sites' && <Sites d={d} />}
      {tab === 'cyber' && <CyberInputsPanel d={d} />}
    </div>
  )
}

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { ExportMenu } from '@/components/ExportMenu'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api, type Tailoring, type Viewpoint, type Vision } from '@/lib/api'
import { SCREEN_BY_KEY } from '@/lib/screens'
import { BAND, NAVY, SLATE, tint } from '@/lib/theme'

const label = 'flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground'
const DECISION_COLOR: Record<string, string> = { Adopted: BAND.strong, Tailored: NAVY, Excluded: SLATE }

function useGuide() {
  const qc = useQueryClient()
  return (d: Vision, msg: string) => { qc.setQueryData(['vision'], d); toast.success(msg) }
}

/** ISO/IEC/IEEE 42010 viewpoint catalogue: each stakeholder's concerns, the viewpoint that frames them and the views that answer them. */
export function ViewpointCatalog({ v }: { v: Vision }) {
  const done = useGuide()
  const [edit, setEdit] = useState<Partial<Viewpoint> | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const save = useMutation({
    mutationFn: () => { const body = { kind: 'viewpoint' as const, ...edit }; return edit!.id ? api.putGuideline(edit!.id, body) : api.addGuideline(body) },
    onSuccess: (d) => { done(d, 'Viewpoint saved'); setEdit(null) }, onError: (e: Error) => toast.error(e.message),
  })
  const del = useMutation({ mutationFn: api.deleteGuideline, onSuccess: (d) => done(d, 'Viewpoint removed') })
  const views = Object.entries(v.rfp_views).map(([n, x]) => ({ n: Number(n), ...x }))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-muted-foreground">Stakeholder → concerns → viewpoint → views, per ISO/IEC/IEEE 42010. Every RFP view should be answered by at least one viewpoint.</span>
        <span className="flex gap-2">
          <AiAction what="Viewpoint catalogue" from="the stakeholder map and the RFP views" />
          <ExportMenu target={box} name="Viewpoint Catalogue" csv={() => [['ID', 'Viewpoint', 'Stakeholders', 'Concerns', 'Model kinds', 'RFP views'], ...v.viewpoints.map((x) => [x.id, x.name, x.stakeholder, x.concerns, x.model_kind, x.views.join('; ')])]} />
          <Button size="sm" onClick={() => setEdit({ name: '', stakeholder: '', concerns: '', model_kind: '', views: [], screen: 'overview' })}><Plus /> Add Viewpoint</Button>
        </span>
      </div>
      <div ref={box} className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead className="w-14">ID</TableHead><TableHead>Viewpoint</TableHead><TableHead>Stakeholders</TableHead><TableHead>Concerns</TableHead><TableHead>Model Kinds</TableHead><TableHead>Views</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {v.viewpoints.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="text-xs font-semibold text-muted-foreground">{x.id}</TableCell>
                <TableCell className="font-medium">{x.name}</TableCell>
                <TableCell className="max-w-44 text-[12px] whitespace-normal">{x.stakeholder}</TableCell>
                <TableCell className="max-w-64 text-[12px] whitespace-normal text-muted-foreground">{x.concerns}</TableCell>
                <TableCell className="max-w-48 text-[11.5px] whitespace-normal text-muted-foreground">{x.model_kind}</TableCell>
                <TableCell><div className="flex max-w-48 flex-wrap gap-1">{x.views.map((n) => {
                  const rv = v.rfp_views[n]
                  return rv ? <Link key={n} to={`${SCREEN_BY_KEY[rv.screen]?.path ?? '/'}?view=${rv.view}`} title={rv.name} className="rounded bg-navy-soft px-1.5 py-px text-[10.5px] font-semibold text-navy hover:underline">{n}</Link> : <span key={n}>{n}</span>
                })}</div></TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon-sm" onClick={() => setEdit(x)}><Pencil /></Button><Button variant="ghost" size="icon-sm" onClick={() => del.mutate(x.id)}><Trash2 /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {(() => {
        const covered = new Set(v.viewpoints.flatMap((x) => x.views))
        const miss = views.filter((x) => !covered.has(x.n))
        return miss.length ? <p className="text-[11.5px]" style={{ color: BAND.weak }}>RFP views with no viewpoint: {miss.map((x) => `${x.n} ${x.name}`).join('; ')}.</p>
          : <p className="text-[11.5px]" style={{ color: BAND.strong }}>All {views.length} RFP views are covered by a viewpoint.</p>
      })()}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{edit?.id ? `Edit ${edit.id}` : 'Add Viewpoint'}</DialogTitle><DialogDescription>ISO/IEC/IEEE 42010 viewpoint: who it is for, what they need to know, and the views that answer it.</DialogDescription></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Viewpoint<Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="h-8 text-foreground" /></label>
              <label className={label}>Stakeholders<Input value={edit.stakeholder ?? ''} onChange={(e) => setEdit({ ...edit, stakeholder: e.target.value })} className="h-8 text-foreground" /></label>
              <label className={`${label} col-span-2`}>Concerns<Textarea rows={2} value={edit.concerns ?? ''} onChange={(e) => setEdit({ ...edit, concerns: e.target.value })} className="text-foreground" /></label>
              <label className={`${label} col-span-2`}>Model kinds<Input value={edit.model_kind ?? ''} onChange={(e) => setEdit({ ...edit, model_kind: e.target.value })} className="h-8 text-foreground" /></label>
              <div className={`${label} col-span-2`}>RFP views answered
                <div className="grid grid-cols-2 gap-1 rounded-md border p-2 text-[12px] font-normal text-foreground">
                  {views.map((x) => <label key={x.n} className="flex items-center gap-1.5"><Checkbox checked={(edit.views ?? []).includes(x.n)} onCheckedChange={(c) => setEdit({ ...edit, views: c ? [...(edit.views ?? []), x.n].sort((a, b) => a - b) : (edit.views ?? []).filter((y) => y !== x.n) })} /><span className="truncate">{x.n} · {x.name}</span></label>)}
                </div>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!edit?.name?.trim() || save.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** TOGAF and ISO 42010 tailoring register: what was adopted, tailored or excluded, why, and its approval. */
export function TailoringRegister({ v }: { v: Vision }) {
  const done = useGuide()
  const [edit, setEdit] = useState<Partial<Tailoring> | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const save = useMutation({
    mutationFn: () => { const body = { kind: 'tailoring' as const, ...edit }; return edit!.id ? api.putGuideline(edit!.id, body) : api.addGuideline(body) },
    onSuccess: (d) => { done(d, 'Tailoring decision saved'); setEdit(null) }, onError: (e: Error) => toast.error(e.message),
  })
  const del = useMutation({ mutationFn: api.deleteGuideline, onSuccess: (d) => done(d, 'Tailoring decision removed') })
  const pick = (k: 'framework' | 'decision' | 'approval', opts: string[]) => (
    <Select value={edit?.[k] ?? ''} onValueChange={(x) => setEdit({ ...edit, [k]: x })}><SelectTrigger size="sm" className="h-8 w-full text-foreground"><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
  )
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-muted-foreground">The RFP asks for every TOGAF and ISO/IEC/IEEE 42010 practice adopted, tailored or excluded to be documented with its rationale and approved through governance.</span>
        <span className="flex gap-2">
          <ExportMenu target={box} name="Framework Tailoring Register" csv={() => [['ID', 'Framework', 'Element', 'Decision', 'Rationale', 'Approval'], ...v.tailoring.map((x) => [x.id, x.framework, x.element, x.decision, x.rationale, x.approval])]} />
          <Button size="sm" onClick={() => setEdit({ framework: 'TOGAF', element: '', decision: 'Tailored', rationale: '', approval: 'Proposed' })}><Plus /> Add Decision</Button>
        </span>
      </div>
      <div ref={box} className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead className="w-14">ID</TableHead><TableHead>Framework</TableHead><TableHead>Element</TableHead><TableHead>Decision</TableHead><TableHead>Rationale</TableHead><TableHead>Approval</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
          <TableBody>
            {v.tailoring.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="text-xs font-semibold text-muted-foreground">{x.id}</TableCell>
                <TableCell className="text-[12px]">{x.framework}</TableCell>
                <TableCell className="font-medium">{x.element}</TableCell>
                <TableCell><span className="rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ color: DECISION_COLOR[x.decision], background: tint(DECISION_COLOR[x.decision] ?? SLATE, 0.12) }}>{x.decision}</span></TableCell>
                <TableCell className="max-w-md text-[12px] whitespace-normal text-muted-foreground">{x.rationale}</TableCell>
                <TableCell className="text-[12px]">{x.approval}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon-sm" onClick={() => setEdit(x)}><Pencil /></Button><Button variant="ghost" size="icon-sm" onClick={() => del.mutate(x.id)}><Trash2 /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? `Edit ${edit.id}` : 'Add Tailoring Decision'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Framework{pick('framework', ['TOGAF', 'ISO/IEC/IEEE 42010', 'Other'])}</label>
              <label className={label}>Decision{pick('decision', ['Adopted', 'Tailored', 'Excluded'])}</label>
              <label className={`${label} col-span-2`}>Element<Input value={edit.element ?? ''} onChange={(e) => setEdit({ ...edit, element: e.target.value })} placeholder="e.g. Phase H Change Management" className="h-8 text-foreground" /></label>
              <label className={`${label} col-span-2`}>Rationale<Textarea rows={3} value={edit.rationale ?? ''} onChange={(e) => setEdit({ ...edit, rationale: e.target.value })} className="text-foreground" /></label>
              <label className={label}>Approval{pick('approval', ['Proposed', 'Approved by ARB', 'Rejected'])}</label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!edit?.element?.trim() || save.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

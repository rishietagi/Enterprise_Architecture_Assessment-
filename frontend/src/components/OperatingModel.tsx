import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ExportMenu } from '@/components/ExportMenu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { api, type EaRole, type OperatingModel as OM, type Roadmap } from '@/lib/api'
import { BAND, NAVY, SLATE, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

const MEASURES: Record<string, string> = {
  '': 'Not measured in the tool', acmm_mean: 'ACMM mean', decisions: 'Decisions logged', apps_owned_pct: 'Apps with a business owner',
  repo_owned: 'View families with an owner', gaps_high: 'High-severity gaps', principles: 'Principles adopted', discovery_pct: 'Discovery answered',
}
const sourcingColor = (s: string) => (s.startsWith('CIL') ? NAVY : s.toLowerCase().includes('business') ? BAND.strong : BAND.developing)
const NONE = '__none'

function RoleBox({ r, active, onPick }: { r: EaRole; active: boolean; onPick: () => void }) {
  const c = sourcingColor(r.sourcing)
  return (
    <button onClick={onPick} title={r.responsibilities.join('\n')}
      className={cn('w-[132px] rounded-lg border bg-card px-2 py-1.5 text-left shadow-xs transition-colors hover:border-navy', active && 'border-navy ring-2 ring-navy/20')}
      style={{ borderLeft: `3px solid ${c}` }}>
      <div className="text-[11.5px] leading-tight font-semibold">{r.title}</div>
      <div className="mt-0.5 text-[10.5px] text-muted-foreground">{r.count} · {r.sourcing}</div>
    </button>
  )
}

/** Org chart from the reporting lines: each role sits under the role it reports to. */
function OrgNode({ r, roles, sel, onPick }: { r: EaRole; roles: EaRole[]; sel: string; onPick: (id: string) => void }) {
  const kids = roles.filter((x) => x.reports_to === r.id)
  return (
    <div className="flex flex-col items-center">
      <RoleBox r={r} active={sel === r.id} onPick={() => onPick(r.id)} />
      {kids.length > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          <div className="flex">
            {kids.map((k, i) => (
              <div key={k.id} className="relative flex flex-col items-center px-1 pt-4">
                {i > 0 && <div className="absolute top-0 right-1/2 left-0 h-px bg-border" />}
                {i < kids.length - 1 && <div className="absolute top-0 right-0 left-1/2 h-px bg-border" />}
                <div className="absolute top-0 left-1/2 h-4 w-px bg-border" />
                <OrgNode r={k} roles={roles} sel={sel} onPick={onPick} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Editor({ om, onClose }: { om: OM | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState<OM | null>(om)
  const save = useMutation({
    mutationFn: () => api.putOperatingModel({
      model: f!.model, rationale: f!.rationale, engagement: f!.engagement, forums: f!.forums,
      roles: f!.roles.map((r) => ({ ...r, responsibilities: r.responsibilities.map((x) => x.trim()).filter(Boolean) })), kpis: f!.kpis,
    }),
    onSuccess: (d) => { qc.setQueryData(['roadmap'], d); toast.success('Operating model saved'); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  if (!f) return null
  const role = (i: number, p: Partial<EaRole>) => setF({ ...f, roles: f.roles.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const nextId = (pre: string, ids: string[]) => `${pre}${Math.max(0, ...ids.map((x) => Number(x.replace(/\D/g, '')) || 0)) + 1}`
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader><DialogTitle>Edit EA Operating Model</DialogTitle><DialogDescription>Roles and reporting lines, structure and forums, and the KPIs the EA function reports.</DialogDescription></DialogHeader>
        <Tabs defaultValue="roles" className="min-h-0 flex-1">
          <TabsList><TabsTrigger value="roles">Roles & Hierarchy</TabsTrigger><TabsTrigger value="structure">EA Structure</TabsTrigger><TabsTrigger value="kpis">EA KPIs</TabsTrigger></TabsList>
          <div className="scrollbar-thin mt-2 max-h-[62vh] overflow-y-auto pr-1">
            <TabsContent value="roles" className="space-y-2">
              <div className="grid grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1fr)_70px_120px_minmax(0,1.6fr)_28px] gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"><span>ID</span><span>Role</span><span>Reports to</span><span>Count</span><span>Sourcing</span><span>Responsibilities (one per line)</span><span /></div>
              {f.roles.map((r, i) => (
                <div key={i} className="grid grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1fr)_70px_120px_minmax(0,1.6fr)_28px] items-start gap-1.5">
                  <span className="pt-1.5 text-[11px] font-semibold text-muted-foreground">{r.id}</span>
                  <Input value={r.title} onChange={(e) => role(i, { title: e.target.value })} className="h-8 text-[12px]" />
                  <Select value={r.reports_to || NONE} onValueChange={(v) => role(i, { reports_to: v === NONE ? '' : v })}>
                    <SelectTrigger size="sm" className="h-8 w-full text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>None (top)</SelectItem>{f.roles.filter((x) => x.id !== r.id).map((x) => <SelectItem key={x.id} value={x.id}>{x.id} · {x.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={r.count} onChange={(e) => role(i, { count: e.target.value })} className="h-8 text-[12px]" />
                  <Input value={r.sourcing} onChange={(e) => role(i, { sourcing: e.target.value })} className="h-8 text-[12px]" />
                  <Textarea rows={2} value={r.responsibilities.join('\n')} onChange={(e) => role(i, { responsibilities: e.target.value.split('\n') })} className="min-h-8 text-[12px]" />
                  <Button variant="ghost" size="icon-sm" onClick={() => setF({ ...f, roles: f.roles.filter((_, j) => j !== i).map((x) => (x.reports_to === r.id ? { ...x, reports_to: r.reports_to } : x)) })}><Trash2 /></Button>
                </div>
              ))}
              <Button size="xs" variant="outline" onClick={() => setF({ ...f, roles: [...f.roles, { id: nextId('R', f.roles.map((x) => x.id)), title: '', reports_to: f.roles[0]?.id ?? '', count: '1', sourcing: 'CIL', responsibilities: [] }] })}><Plus /> Add role</Button>
            </TabsContent>
            <TabsContent value="structure" className="space-y-3">
              <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-3">
                <div className="space-y-1"><Label>Operating model</Label>
                  <Select value={f.model} onValueChange={(v) => setF({ ...f, model: v })}><SelectTrigger size="sm" className="h-8 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{f.model_options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Why this model</Label><Textarea rows={2} value={f.rationale} onChange={(e) => setF({ ...f, rationale: e.target.value })} className="text-[12.5px]" /></div>
              </div>
              <div className="space-y-1.5"><Label>Forums</Label>
                {f.forums.map((x, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_minmax(0,2fr)_28px] gap-1.5">
                    {(['name', 'chair', 'cadence', 'decides'] as const).map((k) => <Input key={k} value={x[k]} placeholder={k} className="h-8 text-[12px]" onChange={(e) => setF({ ...f, forums: f.forums.map((y, j) => (j === i ? { ...y, [k]: e.target.value } : y)) })} />)}
                    <Button variant="ghost" size="icon-sm" onClick={() => setF({ ...f, forums: f.forums.filter((_, j) => j !== i) })}><Trash2 /></Button>
                  </div>
                ))}
                <Button size="xs" variant="outline" onClick={() => setF({ ...f, forums: [...f.forums, { name: '', chair: '', cadence: 'Monthly', decides: '' }] })}><Plus /> Add forum</Button>
              </div>
              <div className="space-y-1"><Label>How projects engage EA <span className="font-normal text-muted-foreground">(one step per line)</span></Label>
                <Textarea rows={5} value={f.engagement.join('\n')} onChange={(e) => setF({ ...f, engagement: e.target.value.split('\n') })} className="text-[12.5px]" /></div>
            </TabsContent>
            <TabsContent value="kpis" className="space-y-1.5">
              <div className="grid grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1fr)_120px_minmax(0,1fr)_170px_28px] gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"><span>KPI</span><span>Category</span><span>Target</span><span>Frequency</span><span>Owner</span><span>Measured from</span><span /></div>
              {f.kpis.map((k, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1fr)_120px_minmax(0,1fr)_170px_28px] gap-1.5">
                  {(['name', 'category', 'target', 'frequency', 'owner'] as const).map((key) => <Input key={key} value={k[key]} className="h-8 text-[12px]" onChange={(e) => setF({ ...f, kpis: f.kpis.map((y, j) => (j === i ? { ...y, [key]: e.target.value } : y)) })} />)}
                  <Select value={k.measure || NONE} onValueChange={(v) => setF({ ...f, kpis: f.kpis.map((y, j) => (j === i ? { ...y, measure: v === NONE ? '' : v } : y)) })}>
                    <SelectTrigger size="sm" className="h-8 w-full text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(MEASURES).map(([m, l]) => <SelectItem key={m || NONE} value={m || NONE}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" onClick={() => setF({ ...f, kpis: f.kpis.filter((_, j) => j !== i) })}><Trash2 /></Button>
                </div>
              ))}
              <Button size="xs" variant="outline" onClick={() => setF({ ...f, kpis: [...f.kpis, { id: nextId('K', f.kpis.map((x) => x.id)), name: '', category: 'Compliance', target: '', frequency: 'Quarterly', owner: '', measure: '' }] })}><Plus /> Add KPI</Button>
            </TabsContent>
          </div>
        </Tabs>
        <DialogFooter className="border-t pt-3"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** EA Governance › EA Operating Model: roles and hierarchy, EA structure (model, forums, engagement) and EA KPIs. */
export function OperatingModel({ r }: { r: Roadmap }) {
  const qc = useQueryClient()
  const om = r.operating_model
  const [sel, setSel] = useState(om.roles[0]?.id ?? '')
  const [edit, setEdit] = useState(false)
  const org = useRef<HTMLDivElement>(null)
  const kpiBox = useRef<HTMLDivElement>(null)
  const reset = useMutation({ mutationFn: api.resetOperatingModel, onSuccess: (d) => { qc.setQueryData(['roadmap'], d); toast.success('Operating model restored') } })
  const roots = om.roles.filter((x) => !x.reports_to || !om.roles.some((y) => y.id === x.reports_to))
  const s = om.roles.find((x) => x.id === sel)
  const name = Object.fromEntries(om.roles.map((x) => [x.id, x.title]))
  const sourcings = [...new Set(om.roles.map((x) => x.sourcing))]
  return (
    <>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">EA Operating Model <Badge variant="outline" className="font-semibold text-navy">{om.model}</Badge></CardTitle>
          <CardDescription>{om.rationale}</CardDescription>
          <CardAction className="flex gap-2">
            {om.source === 'client' && <Button size="sm" variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending}><RotateCcw /> Restore Default</Button>}
            <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil /> Edit</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={org} className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[12.5px] font-semibold">Roles & Hierarchy <span className="font-normal text-muted-foreground">· reporting lines; select a role for its responsibilities</span></div>
              <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {sourcings.map((x) => <span key={x} className="flex items-center gap-1"><span className="h-3 w-1 rounded-sm" style={{ background: sourcingColor(x) }} />{x}</span>)}
                <ExportMenu target={org} name="EA Roles and Hierarchy" size="xs" csv={() => [['ID', 'Role', 'Reports to', 'Count', 'Sourcing', 'Responsibilities'], ...om.roles.map((x) => [x.id, x.title, name[x.reports_to] ?? '', x.count, x.sourcing, x.responsibilities.join('; ')])]} />
              </span>
            </div>
            <div className="scrollbar-thin overflow-x-auto pb-2">
              <div className="mx-auto flex w-max gap-6">{roots.map((x) => <OrgNode key={x.id} r={x} roles={om.roles} sel={sel} onPick={setSel} />)}</div>
            </div>
            {s && (
              <div className="mt-2 flex gap-6 rounded-lg bg-muted/40 px-3 py-2 text-[12.5px]">
                <div className="w-64 shrink-0"><div className="font-semibold">{s.title}</div>
                  <div className="text-[11px] text-muted-foreground">{s.count} · {s.sourcing}{s.reports_to ? ` · reports to ${name[s.reports_to]}` : ''}</div></div>
                <ul className="grid flex-1 list-disc grid-cols-2 gap-x-6 gap-y-0.5 pl-4">{s.responsibilities.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8 overflow-hidden rounded-lg border">
              <div className="border-b bg-muted/40 px-3 py-1.5 text-[12.5px] font-semibold">EA Structure <span className="font-normal text-muted-foreground">· forums, who chairs them and what they decide</span></div>
              <Table>
                <TableHeader><TableRow><TableHead>Forum</TableHead><TableHead>Chair</TableHead><TableHead>Cadence</TableHead><TableHead>Decides</TableHead></TableRow></TableHeader>
                <TableBody>{om.forums.map((x) => (
                  <TableRow key={x.name}><TableCell className="font-medium">{x.name}</TableCell><TableCell className="text-[12px]">{x.chair}</TableCell><TableCell className="text-[12px] text-muted-foreground">{x.cadence}</TableCell><TableCell className="text-[12px] whitespace-normal">{x.decides}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <div className="col-span-4 rounded-lg border p-3">
              <div className="mb-2 text-[12.5px] font-semibold">How Projects Engage EA</div>
              <ol className="space-y-1.5 text-[12.5px]">{om.engagement.map((x, n) => <li key={x} className="flex gap-2"><span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white">{n + 1}</span>{x}</li>)}</ol>
            </div>
          </div>

          <div ref={kpiBox} className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
              <div className="text-[12.5px] font-semibold">EA KPIs <span className="font-normal text-muted-foreground">· "Today" is measured from the data in this tool where possible</span></div>
              <ExportMenu target={kpiBox} name="EA KPIs" size="xs" csv={() => [['ID', 'KPI', 'Category', 'Today', 'Target', 'Frequency', 'Owner'], ...om.kpis.map((k) => [k.id, k.name, k.category, k.current ?? '', k.target, k.frequency, k.owner])]} />
            </div>
            <Table>
              <TableHeader><TableRow><TableHead className="w-12">ID</TableHead><TableHead>KPI</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Today</TableHead><TableHead>Target</TableHead><TableHead>Frequency</TableHead><TableHead>Owner</TableHead></TableRow></TableHeader>
              <TableBody>{om.kpis.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="text-xs font-semibold text-muted-foreground">{k.id}</TableCell>
                  <TableCell className="font-medium whitespace-normal">{k.name}</TableCell>
                  <TableCell><span className="rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ color: NAVY, background: tint(NAVY, 0.08) }}>{k.category}</span></TableCell>
                  <TableCell className="tabular text-right font-semibold" title={k.basis}>{k.current || <span className="font-normal" style={{ color: SLATE }}>To capture</span>}</TableCell>
                  <TableCell className="text-[12px]">{k.target}</TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{k.frequency}</TableCell>
                  <TableCell className="text-[12px]">{k.owner}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {edit && <Editor om={om} onClose={() => setEdit(false)} />}
    </>
  )
}

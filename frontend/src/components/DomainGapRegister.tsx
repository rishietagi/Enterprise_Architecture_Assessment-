import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Pencil, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api, type DomainGap, type DomainGapRegister as Reg, type Severity } from '@/lib/api'
import { NAVY, SEVERITY, tint } from '@/lib/theme'

type Screen = 'applications' | 'data_tech'
const ALL = '__all'

function Sev({ s }: { s: Severity }) {
  return <span className="rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ color: SEVERITY[s].color, background: tint(SEVERITY[s].color, 0.12) }}>{s}</span>
}

function GapDialog({ screen, gap, onClose }: { screen: Screen; gap: DomainGap | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ description: '', hypothesis: '', severity: 'Medium' as Severity })
  useEffect(() => { if (gap) setF({ description: gap.description, hypothesis: gap.hypothesis, severity: gap.severity }) }, [gap])
  const done = (d: unknown, msg: string) => { qc.setQueryData([screen], d); toast.success(msg); onClose() }
  const save = useMutation({ mutationFn: () => api.putDomainGap<unknown>(screen, gap!.id, f), onSuccess: (d) => done(d, 'Gap updated'), onError: (e: Error) => toast.error(e.message) })
  const reset = useMutation({ mutationFn: () => api.resetDomainGap<unknown>(screen, gap!.id), onSuccess: (d) => done(d, 'Restored the generated text') })
  return (
    <Dialog open={!!gap} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{gap?.id} · {gap?.title}</DialogTitle>
          <DialogDescription>{gap?.where.kind} {gap?.scope === 'item' ? gap?.where.id : gap?.where.name} · {gap?.category} · closed by {gap?.initiative} {gap?.initiative_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>What the gap is</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="text-[13px]" /></div>
          <div className="space-y-1"><Label>Target-state hypothesis</Label><Textarea rows={3} value={f.hypothesis} onChange={(e) => setF({ ...f, hypothesis: e.target.value })} className="text-[13px]" /></div>
          <div className="flex items-center gap-3">
            <Label>Severity</Label>
            <Select value={f.severity} onValueChange={(v) => setF({ ...f, severity: v as Severity })}>
              <SelectTrigger size="sm" className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(SEVERITY) as Severity[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            {gap && <span className="text-[11.5px] text-muted-foreground">Generated: {gap.generated.severity}</span>}
          </div>
          {gap && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-[12px]">
              <div className="mb-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Evidence from the assessment</div>
              <ul className="space-y-0.5">{gap.evidence.map((x) => <li key={x} className="flex gap-1.5"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-navy/60" />{x}</li>)}</ul>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => reset.mutate()} disabled={!gap?.edited}><RotateCcw /> Restore generated</Button>
          <span className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending || f.description.trim().length < 3}>Save</Button></span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Gap register for Applications or Data & Technology: item gaps and portfolio gaps, each with severity, a target-state
 * hypothesis and the roadmap initiative that closes it. */
export function DomainGapRegister({ reg, screen, name }: { reg: Reg; screen: Screen; name: string }) {
  const [scope, setScope] = useState('all')
  const [cat, setCat] = useState(ALL)
  const [sev, setSev] = useState(ALL)
  const [edit, setEdit] = useState<DomainGap | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const rows = reg.gaps.filter((g) => (scope === 'all' || g.scope === scope) && (cat === ALL || g.category === cat) && (sev === ALL || g.severity === sev))
  const c = reg.counts
  const csv = () => [['ID', 'Scope', 'Category', 'Where it sits', 'Gap', 'Description', 'Target-state hypothesis', 'Severity', 'Roadmap initiative', 'Edited'],
    ...reg.gaps.map((g) => [g.id, g.scope, g.category, `${g.where.kind} ${g.where.id} ${g.where.name}`, g.title, g.description, g.hypothesis, g.severity, `${g.initiative} ${g.initiative_name}`, g.edited ? 'Yes' : 'No'])]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
        {(Object.keys(SEVERITY) as Severity[]).map((s) => (
          <button key={s} onClick={() => setSev(sev === s ? ALL : s)} className="text-left">
            <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{s} Severity</div>
            <div className="tabular text-[18px] font-semibold" style={{ color: SEVERITY[s].color }}>{c[s]}{sev === s && <span className="ml-1 text-[11px] font-normal text-muted-foreground">filtered</span>}</div>
          </button>
        ))}
        <div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Item Gaps</div><div className="tabular text-[18px] font-semibold">{c.item}</div></div>
        <div><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Portfolio Gaps</div><div className="tabular text-[18px] font-semibold">{c.portfolio}</div></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={scope} onValueChange={(v) => v && setScope(v)} variant="outline" size="sm">
          {[['all', 'All'], ['item', 'Item Gaps'], ['portfolio', 'Portfolio Gaps']].map(([k, l]) => <ToggleGroupItem key={k} value={k} className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">{l}</ToggleGroupItem>)}
        </ToggleGroup>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger size="sm" className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All categories</SelectItem>{reg.categories.map((k) => <SelectItem key={k} value={k}>{k} ({c.by_category[k]})</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-[11.5px] text-muted-foreground">{rows.length} of {reg.gaps.length} gaps · select a row to edit</span>
        <span className="ml-auto"><ExportMenu target={box} name={name} csv={csv} /></span>
      </div>
      <div ref={box} className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-20">ID</TableHead><TableHead className="w-56">Where It Sits</TableHead><TableHead>Gap</TableHead>
            <TableHead>Target-State Hypothesis</TableHead><TableHead className="w-20">Severity</TableHead><TableHead className="w-44">Closed By</TableHead><TableHead className="w-8" />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((g) => (
              <TableRow key={g.id} className="cursor-pointer align-top" onClick={() => setEdit(g)}>
                <TableCell className="pt-2.5 text-[11px] font-semibold text-muted-foreground"><span className="inline-flex items-center gap-1"><Explain x={g.explain} />{g.id}</span></TableCell>
                <TableCell className="text-[12px] whitespace-normal">
                  <div className="font-medium">{g.where.name}</div>
                  <div className="text-[10.5px] text-muted-foreground">{g.where.kind}{g.where.id && g.scope === 'item' ? ` · ${g.where.id}` : ''}{g.where.group && g.where.group !== 'Portfolio' ? ` · ${g.where.group}` : ''}</div>
                  <span className="mt-0.5 inline-block rounded bg-muted px-1.5 text-[10px]">{g.category}</span>
                </TableCell>
                <TableCell className="max-w-md text-[12px] whitespace-normal"><div className="font-medium">{g.title}</div><div className="text-muted-foreground">{g.description}</div>{g.edited && <span className="text-[10px] font-semibold text-navy">Edited</span>}</TableCell>
                <TableCell className="max-w-sm text-[12px] whitespace-normal text-muted-foreground">{g.hypothesis}</TableCell>
                <TableCell><Sev s={g.severity} /></TableCell>
                <TableCell className="text-[11.5px] whitespace-normal" onClick={(e) => e.stopPropagation()}>
                  <Link to="/roadmap?view=longlist" className="group inline-flex items-start gap-1 hover:text-navy" style={{ color: NAVY }}>
                    <span><b>{g.initiative}</b> {g.initiative_name}</span><ArrowUpRight className="mt-0.5 size-3 shrink-0 opacity-0 group-hover:opacity-100" />
                  </Link>
                </TableCell>
                <TableCell><Pencil className="size-3.5 text-muted-foreground" /></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No gaps match the filters.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <GapDialog screen={screen} gap={edit} onClose={() => setEdit(null)} />
    </div>
  )
}

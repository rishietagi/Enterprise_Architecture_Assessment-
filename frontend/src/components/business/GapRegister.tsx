import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ChevronRight, Lightbulb, Pencil, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useBusinessUpdate } from '@/components/CapabilityModules'
import { Explain } from '@/components/Explain'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { api, type Business, type RegGap, type Severity } from '@/lib/api'
import { GAP_TYPE, SEVERITY, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

type TypeF = 'all' | 'thematic' | 'transactional'

function SevPill({ s }: { s: Severity }) {
  const c = SEVERITY[s].color
  return <span className="inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold" style={{ color: c, background: tint(c, 0.12) }}><span className="size-1.5 rounded-full" style={{ background: c }} />{s}</span>
}

function Mapping({ g }: { g: RegGap }) {
  const parts = [g.l0 && { lv: 'L0', ...g.l0 }, g.l1 && { lv: 'L1', ...g.l1 }, g.l2 && { lv: 'L2', ...g.l2 }, g.l3 && { lv: 'L3', ...g.l3 }].filter(Boolean) as { lv: string; id: string; name: string }[]
  return (
    <div className="space-y-0.5">
      {parts.map((p, i) => (
        <div key={p.lv} className={cn('flex items-center gap-1 text-[11px] leading-tight', p.lv === g.level || (g.level === 'L3' && p.lv === 'L3') ? 'font-semibold text-foreground' : 'text-muted-foreground')} style={{ paddingLeft: i * 8 }}>
          {i > 0 && <ChevronRight className="size-2.5 shrink-0" />}
          <span className="w-5 shrink-0 text-[9.5px] font-bold text-navy">{p.lv}</span><span className="truncate" title={`${p.id} ${p.name}`}>{p.name}</span>
        </div>
      ))}
    </div>
  )
}

function GapTable({ rows, kind, onOpen }: { rows: RegGap[]; kind: keyof typeof GAP_TYPE; onOpen: (g: RegGap) => void }) {
  const t = GAP_TYPE[kind]
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ background: tint(t.color, 0.07) }}>
        <span className="size-2.5 rounded-full" style={{ background: t.color }} />
        <span className="text-[13px] font-semibold" style={{ color: t.color }}>{t.label} Gaps</span>
        <span className="text-[11px] text-muted-foreground">{kind === 'thematic' ? 'A weakness that recurs across an L1 area or an L0 value chain' : 'A gap in one L3 process, described from its questionnaire answers'}</span>
        <span className="tabular ml-auto text-[13px] font-bold">{rows.length}</span>
      </div>
      <div className="grid grid-cols-[64px_210px_minmax(0,1.25fr)_minmax(0,1fr)_86px_32px] gap-3 border-b bg-muted/40 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span>ID</span><span>Where It Sits</span><span>Gap</span><span>Target-State Hypothesis</span><span>Severity</span><span />
      </div>
      {!rows.length && <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">No {t.label.toLowerCase()} gaps match the filters.</div>}
      {rows.map((g) => (
        <div key={g.id} role="button" tabIndex={0} onClick={() => onOpen(g)} onKeyDown={(e) => e.key === 'Enter' && onOpen(g)}
          className="grid cursor-pointer grid-cols-[64px_210px_minmax(0,1.25fr)_minmax(0,1fr)_86px_32px] items-start gap-3 border-b px-3 py-2 last:border-0 hover:bg-muted/30">
          <span className="pt-0.5 text-[10px] leading-tight font-semibold break-all text-muted-foreground">{g.id.replace(/^T[GH]-/, '')}</span>
          <Mapping g={g} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold">{g.title}{g.edited && <span className="rounded bg-muted px-1 text-[9.5px] font-semibold text-muted-foreground">edited</span>}</div>
            <p className="mt-0.5 line-clamp-3 text-[11.5px] leading-snug text-muted-foreground">{g.description}</p>
          </div>
          <p className="line-clamp-4 border-l-2 pl-2 text-[11.5px] leading-snug" style={{ borderColor: tint(t.color, 0.5) }}>{g.hypothesis}</p>
          <span className="flex flex-col items-start gap-1"><SevPill s={g.severity} /><ProvenanceBadge source={g.source} /></span>
          <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" aria-label="Edit gap" onClick={(e) => { e.stopPropagation(); onOpen(g) }}><Pencil /></Button>
        </div>
      ))}
    </div>
  )
}

function GapDialog({ g, all, onClose, onOpen }: { g: RegGap | null; all: RegGap[]; onClose: () => void; onOpen: (g: RegGap) => void }) {
  const done = useBusinessUpdate()
  const [f, setF] = useState({ description: '', hypothesis: '', severity: 'Medium' as Severity })
  useEffect(() => { if (g) setF({ description: g.description, hypothesis: g.hypothesis, severity: g.severity }) }, [g])
  const save = useMutation({ mutationFn: () => api.putGap(g!.id, f), onSuccess: (d) => { done(d, 'Gap updated'); onClose() }, onError: (e: Error) => toast.error(e.message) })
  const reset = useMutation({ mutationFn: () => api.resetGap(g!.id), onSuccess: (d) => { done(d, 'Restored the text generated from the answers'); onClose() } })
  const related = g?.related?.map((id) => all.find((x) => x.id === id)).filter(Boolean) as RegGap[] | undefined
  const parent = g?.type === 'transactional' ? all.filter((x) => x.related?.includes(g.id)) : []
  return (
    <Dialog open={!!g} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {g && (
          <>
            <DialogHeader className="border-b px-5 py-3.5 text-left">
              <DialogTitle className="flex items-center gap-2 pr-8">{g.title} <Explain x={g.explain} /></DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <span className="rounded px-1.5 text-[10.5px] font-semibold" style={{ color: GAP_TYPE[g.type].color, background: tint(GAP_TYPE[g.type].color, 0.12) }}>{GAP_TYPE[g.type].label} · {g.level}</span>
                {[g.l0?.name, g.l1?.name, g.l2?.name, g.l3?.name].filter(Boolean).join(' › ')}
              </DialogDescription>
            </DialogHeader>
            <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-5 py-4">
              <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Gap Description
                <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-24 text-[12.5px] text-foreground md:text-[12.5px]" />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground"><span className="flex items-center gap-1"><Lightbulb className="size-3.5" /> Target-State Hypothesis</span>
                <Textarea value={f.hypothesis} onChange={(e) => setF({ ...f, hypothesis: e.target.value })} className="min-h-20 text-[12.5px] text-foreground md:text-[12.5px]" />
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[11.5px] font-medium text-muted-foreground">Severity</span>
                <ToggleGroup type="single" value={f.severity} onValueChange={(v) => v && setF({ ...f, severity: v as Severity })} variant="outline" size="sm">
                  {(['High', 'Medium', 'Low'] as const).map((s) => <ToggleGroupItem key={s} value={s} className="px-3 data-[state=on]:text-white" style={f.severity === s ? { background: SEVERITY[s].color } : undefined}>{s}</ToggleGroupItem>)}
                </ToggleGroup>
                {g.generated.severity !== f.severity && <span className="text-[11px] text-muted-foreground">Rule suggests {g.generated.severity}</span>}
              </div>
              <div>
                <div className="mb-1 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">{g.type === 'thematic' ? 'Processes Behind This Theme' : 'Evidence from the Questionnaire'}</div>
                <div className="rounded-lg border">
                  {g.evidence.map((e, i) => {
                    const r = related?.find((x) => x.l3?.name === e.label)
                    return (
                      <div key={i} className={cn('flex gap-3 border-b px-3 py-1.5 text-[12px] last:border-0', r && 'cursor-pointer hover:bg-muted/30')} onClick={() => r && onOpen(r)}>
                        <span className="w-44 shrink-0 font-medium">{e.label}</span>
                        <span className="min-w-0 flex-1 text-muted-foreground">{e.value !== null && <b className="mr-1 text-foreground">{e.value} ·</b>}{e.answer}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {parent.length > 0 && <div className="text-[11.5px] text-muted-foreground">Part of: {parent.map((x) => <button key={x.id} onClick={() => onOpen(x)} className="mr-2 underline decoration-dotted hover:text-navy">{x.title}</button>)}</div>}
              {g.owner && <div className="text-[11.5px] text-muted-foreground">Owner: {g.owner}</div>}
            </div>
            <DialogFooter className="flex-row items-center border-t px-5 py-3 sm:justify-between">
              <Button variant="ghost" size="sm" disabled={!g.edited || reset.isPending} onClick={() => reset.mutate()}><RotateCcw /> Restore generated text</Button>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !f.description.trim()}>Save</Button>
              </span>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Gap register from discovery: transactional (L3) and thematic (L1 / L0) gaps, each described from the answers, with a
 * severity and a target-state hypothesis. No scores here: those live on the Assessment step. */
export function GapRegister({ b }: { b: Business }) {
  const reg = b.gap_register
  const [type, setType] = useState<TypeF>('all')
  const [sev, setSev] = useState<'all' | Severity>('all')
  const [l1, setL1] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const all = useMemo(() => [...reg.thematic, ...reg.transactional], [reg])
  const ok = (g: RegGap) => (sev === 'all' || g.severity === sev) && (l1 === 'all' || g.l1?.id === l1 || (g.level === 'L0' && b.l1.find((x) => x.id === l1)?.l0 === g.l0.id))
    && (!q || `${g.title} ${g.description} ${g.hypothesis} ${g.l3?.name ?? ''} ${g.l2?.name ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  const th = reg.thematic.filter(ok)
  const tx = reg.transactional.filter(ok)
  const l1s = b.l1.filter((x) => all.some((g) => g.l1?.id === x.id))
  const answered = b.discovery.rollup.responded
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
        {([['Thematic', reg.counts.thematic, GAP_TYPE.thematic.color], ['Transactional', reg.counts.transactional, GAP_TYPE.transactional.color],
          ['High', reg.counts.High, SEVERITY.High.color], ['Medium', reg.counts.Medium, SEVERITY.Medium.color], ['Low', reg.counts.Low, SEVERITY.Low.color]] as const).map(([k, v, c]) => (
          <div key={k}><div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{k}{k === 'High' || k === 'Medium' || k === 'Low' ? ' severity' : ' gaps'}</div><div className="tabular text-[18px] font-bold" style={{ color: c }}>{v}</div></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a gap or process" className="h-8 pl-8 text-[13px]" />
        </div>
        <ToggleGroup type="single" value={type} onValueChange={(v) => v && setType(v as TypeF)} variant="outline" size="sm">
          <ToggleGroupItem value="all" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">All</ToggleGroupItem>
          <ToggleGroupItem value="thematic" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">Thematic</ToggleGroupItem>
          <ToggleGroupItem value="transactional" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">Transactional</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" value={sev} onValueChange={(v) => v && setSev(v as typeof sev)} variant="outline" size="sm">
          <ToggleGroupItem value="all" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">Any Severity</ToggleGroupItem>
          {(['High', 'Medium', 'Low'] as const).map((s) => <ToggleGroupItem key={s} value={s} className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">{s}</ToggleGroupItem>)}
        </ToggleGroup>
        <Select value={l1} onValueChange={setL1}>
          <SelectTrigger size="sm" className="h-8 w-56 text-[12.5px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All L1 areas</SelectItem>{l1s.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} · {x.name}</SelectItem>)}</SelectContent>
        </Select>
        <span className="ml-auto text-[11px] text-muted-foreground">From {answered} answered questionnaires · select a gap to edit it</span>
      </div>
      {!all.length && <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No gaps yet. Gaps appear as L3 questionnaires are answered in discovery.</p>}
      {all.length > 0 && type !== 'transactional' && <GapTable rows={th} kind="thematic" onOpen={(g) => setOpenId(g.id)} />}
      {all.length > 0 && type !== 'thematic' && <GapTable rows={tx} kind="transactional" onOpen={(g) => setOpenId(g.id)} />}
      <GapDialog g={openId ? all.find((g) => g.id === openId) ?? null : null} all={all} onClose={() => setOpenId(null)} onOpen={(g) => setOpenId(g.id)} />
    </div>
  )
}

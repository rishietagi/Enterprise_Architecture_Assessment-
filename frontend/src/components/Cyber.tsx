import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, type Cyber, type CyberInputs, type DataTech } from '@/lib/api'
import { BAND, bandColor, SLATE, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

const MATURITY = ['1 · Ad hoc', '2 · Partial', '3 · Implemented', '4 · Measured', '5 · Optimised']
const STATUS_COLOR: Record<string, string> = { 'In place': BAND.strong, Compliant: BAND.strong, Partial: BAND.developing, 'In progress': BAND.developing, None: BAND.critical, 'Not started': BAND.critical }

const nextId = (prefix: string, ids: string[]) => `${prefix}${String(Math.max(0, ...ids.map((i) => Number(i.replace(/\D/g, '')) || 0)) + 1).padStart(2, '0')}`
const offTarget = (m: CyberInputs['metrics'][number]) =>
  m.value != null && m.target != null && (m.better === 'higher' ? m.value < m.target : m.value > m.target)

function Pick({ value, options, onChange, className }: { value: string; options: string[]; onChange: (v: string) => void; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className={cn('h-7 text-[12px]', className)}><SelectValue /></SelectTrigger>
      <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function Section({ title, hint, onAdd, children }: { title: string; hint: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
        <div className="text-[12.5px] font-semibold">{title} <span className="font-normal text-muted-foreground">· {hint}</span></div>
        <Button size="xs" variant="ghost" onClick={onAdd}><Plus /> Add</Button>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  )
}

/** Step 1 input: the cyber security baseline (controls by NIST CSF function, metrics, tooling, compliance). */
export function CyberInputsPanel({ d }: { d: DataTech }) {
  const qc = useQueryClient()
  const c = d.cyber
  const [f, setF] = useState<CyberInputs>(c.inputs)
  useEffect(() => setF(c.inputs), [c.inputs])
  const dirty = JSON.stringify(f) !== JSON.stringify(c.inputs)
  const done = (x: DataTech, msg: string) => { qc.setQueryData(['data_tech'], x); qc.invalidateQueries({ predicate: (q) => ['roadmap', 'overview'].includes(String(q.queryKey[0])) }); toast.success(msg) }
  const save = useMutation({ mutationFn: () => api.putCyber({ controls: f.controls, metrics: f.metrics, tooling: f.tooling, compliance: f.compliance }), onSuccess: (x) => done(x, 'Cyber security inputs saved'), onError: (e: Error) => toast.error(e.message) })
  const reset = useMutation({ mutationFn: api.resetCyber, onSuccess: (x) => done(x, 'Cyber security inputs restored') })
  const set = <K extends keyof CyberInputs>(k: K, i: number, patch: Partial<CyberInputs[K] extends (infer T)[] ? T : never>) =>
    setF({ ...f, [k]: (f[k] as unknown[]).map((x, j) => (j === i ? { ...(x as object), ...patch } : x)) })
  const del = (k: 'controls' | 'metrics' | 'tooling' | 'compliance', i: number) => setF({ ...f, [k]: (f[k] as unknown[]).filter((_, j) => j !== i) })
  const bin = (k: 'controls' | 'metrics' | 'tooling' | 'compliance', i: number) => <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground" onClick={() => del(k, i)} aria-label="Delete"><Trash2 /></Button>
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11.5px] text-muted-foreground">The cyber security baseline, captured with the CISO: control maturity by NIST CSF 2.0 function, key metrics against target, tooling and compliance. Saved inputs update the cyber assessment, the gap register and the roadmap.</span>
        <span className="flex shrink-0 gap-2">
          {c.inputs.source === 'client' && <Button size="sm" variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending}><RotateCcw /> Restore Default</Button>}
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}><Save /> Save Inputs</Button>
        </span>
      </div>

      <Section title="Controls" hint="maturity 1-5 per control, with evidence" onAdd={() => setF({ ...f, controls: [...f.controls, { id: nextId('CY', f.controls.map((x) => x.id)), function: c.options.functions[0], control: '', maturity: 2, evidence: '' }] })}>
        <div className="grid grid-cols-[52px_120px_minmax(0,1.3fr)_150px_minmax(0,1.6fr)_28px] gap-2 px-3 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"><span>ID</span><span>Function</span><span>Control</span><span>Maturity</span><span>Evidence</span><span /></div>
        {f.controls.map((x, i) => (
          <div key={x.id} className="grid grid-cols-[52px_120px_minmax(0,1.3fr)_150px_minmax(0,1.6fr)_28px] items-center gap-2 px-3 py-1">
            <span className="text-[11px] font-semibold text-muted-foreground">{x.id}</span>
            <Pick value={x.function} options={c.options.functions} onChange={(v) => set('controls', i, { function: v })} />
            <Input value={x.control} onChange={(e) => set('controls', i, { control: e.target.value })} className="h-7 text-[12px]" />
            <Pick value={MATURITY[x.maturity - 1]} options={MATURITY} onChange={(v) => set('controls', i, { maturity: MATURITY.indexOf(v) + 1 })}
              className={x.maturity <= 2 ? 'border-destructive/40' : ''} />
            <Input value={x.evidence ?? ''} onChange={(e) => set('controls', i, { evidence: e.target.value })} className="h-7 text-[12px]" placeholder="What shows the control works" />
            {bin('controls', i)}
          </div>
        ))}
      </Section>

      <div className="grid grid-cols-2 gap-3">
        <Section title="Metrics" hint="today vs target" onAdd={() => setF({ ...f, metrics: [...f.metrics, { id: nextId('M', f.metrics.map((x) => x.id)), label: '', value: null, target: null, unit: '%', better: 'higher' }] })}>
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px_88px_28px] gap-2 px-3 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"><span>Metric</span><span>Today</span><span>Target</span><span>Unit</span><span>Better</span><span /></div>
          {f.metrics.map((x, i) => (
            <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_64px_64px_64px_88px_28px] items-center gap-2 px-3 py-1">
              <Input value={x.label} onChange={(e) => set('metrics', i, { label: e.target.value })} className="h-7 text-[12px]" />
              <Input type="number" value={x.value ?? ''} onChange={(e) => set('metrics', i, { value: e.target.value === '' ? null : Number(e.target.value) })}
                className="tabular h-7 text-right text-[12px]" style={offTarget(x) ? { color: BAND.critical } : undefined} />
              <Input type="number" value={x.target ?? ''} onChange={(e) => set('metrics', i, { target: e.target.value === '' ? null : Number(e.target.value) })} className="tabular h-7 text-right text-[12px]" />
              <Input value={x.unit} onChange={(e) => set('metrics', i, { unit: e.target.value })} className="h-7 text-[12px]" />
              <Pick value={x.better === 'higher' ? 'Higher' : 'Lower'} options={['Higher', 'Lower']} onChange={(v) => set('metrics', i, { better: v === 'Higher' ? 'higher' : 'lower' })} />
              {bin('metrics', i)}
            </div>
          ))}
        </Section>
        <div className="space-y-3">
          <Section title="Tooling" hint="product is TBD until confirmed" onAdd={() => setF({ ...f, tooling: [...f.tooling, { id: nextId('TL', f.tooling.map((x) => x.id)), area: '', product: 'TBD', status: 'None' }] })}>
            {f.tooling.map((x, i) => (
              <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_28px] items-center gap-2 px-3 py-1">
                <Input value={x.area} onChange={(e) => set('tooling', i, { area: e.target.value })} className="h-7 text-[12px]" placeholder="Area" />
                <Input value={x.product} onChange={(e) => set('tooling', i, { product: e.target.value })} className="h-7 text-[12px]" placeholder="Product" />
                <Pick value={x.status} options={c.options.tool_status} onChange={(v) => set('tooling', i, { status: v })} />
                {bin('tooling', i)}
              </div>
            ))}
          </Section>
          <Section title="Compliance" hint="regulatory and certification obligations" onAdd={() => setF({ ...f, compliance: [...f.compliance, { id: nextId('CP', f.compliance.map((x) => x.id)), name: '', status: 'Not started' }] })}>
            {f.compliance.map((x, i) => (
              <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_120px_28px] items-center gap-2 px-3 py-1">
                <Input value={x.name} onChange={(e) => set('compliance', i, { name: e.target.value })} className="h-7 text-[12px]" />
                <Pick value={x.status} options={c.options.compliance_status} onChange={(v) => set('compliance', i, { status: v })} />
                {bin('compliance', i)}
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  )
}

/** Step 2 view: cyber posture by NIST CSF function, with what is off target. */
export function CyberAssessment({ c }: { c: Cyber }) {
  const box = useRef<HTMLDivElement>(null)
  const p = c.posture
  const ctl = Object.fromEntries(c.inputs.controls.map((x) => [x.id, x]))
  const met = c.inputs.metrics.filter((m) => p.breaches.includes(m.id))
  const scoreColor = p.score == null ? SLATE : p.score >= 60 ? BAND.strong : p.score >= 40 ? BAND.developing : BAND.critical
  return (
    <div ref={box} className="grid grid-cols-12 gap-4 bg-card">
      <div className="col-span-4 space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">Cyber Security Score <Explain x={p.explain} /></span>
          <ExportMenu target={box} name="Cyber Security Assessment" size="xs" csv={() => [['Function', 'Mean maturity', 'Controls'], ...p.functions.map((f) => [f.name, f.maturity ?? '', f.n])]} />
        </div>
        <div className="flex items-baseline gap-1"><span className="tabular text-[34px] leading-none font-bold" style={{ color: scoreColor }}>{p.score ?? '–'}</span><span className="text-sm text-muted-foreground">/ 100</span></div>
        <div className="space-y-1.5">
          {p.functions.map((f) => (
            <div key={f.name} className="grid grid-cols-[72px_minmax(0,1fr)_32px] items-center gap-2 text-[12px]">
              <span className="font-medium">{f.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${((f.maturity ?? 0) / 5) * 100}%`, background: f.band ? bandColor(f.band) : SLATE }} /></span>
              <span className="tabular text-right font-semibold">{f.maturity ?? '–'}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Mean control maturity per NIST CSF 2.0 function (1-5). Edit the inputs in Step 1.</p>
      </div>
      <div className="col-span-8 space-y-3">
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-[12.5px] font-semibold">Controls Below Target <span className="font-normal text-muted-foreground">· maturity ≤ 2 · {p.weak.length} of {p.counts.controls}</span></div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {p.weak.map((id) => (
              <div key={id} className="flex items-start gap-2 text-[12px]">
                <span className="tabular mt-px rounded px-1.5 text-[10.5px] font-bold" style={{ color: BAND.critical, background: tint(BAND.critical) }}>{ctl[id]?.maturity}</span>
                <span><span className="font-medium">{ctl[id]?.control}</span> <span className="text-muted-foreground">· {ctl[id]?.function}</span></span>
              </div>
            ))}
            {!p.weak.length && <span className="text-[12px] text-muted-foreground">Every control is at maturity 3 or above.</span>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="mb-1.5 text-[12.5px] font-semibold">Metrics Off Target</div>
            <ul className="space-y-1 text-[12px]">{met.map((m) => <li key={m.id}>{m.label}: <b style={{ color: BAND.critical }}>{m.value}</b> <span className="text-muted-foreground">vs {m.target} {m.unit}</span></li>)}</ul>
            {!met.length && <span className="text-[12px] text-muted-foreground">All on target.</span>}
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-1.5 text-[12.5px] font-semibold">Tooling</div>
            <ul className="space-y-1 text-[12px]">{c.inputs.tooling.map((t) => <li key={t.id} className="flex items-center gap-1.5"><span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[t.status] ?? SLATE }} />{t.area} <span className="text-muted-foreground">· {t.status}</span></li>)}</ul>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-1.5 text-[12.5px] font-semibold">Compliance</div>
            <ul className="space-y-1 text-[12px]">{c.inputs.compliance.map((x) => <li key={x.id} className="flex items-start gap-1.5"><span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[x.status] ?? SLATE }} /><span>{x.name} <span className="text-muted-foreground">· {x.status}</span></span></li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  )
}

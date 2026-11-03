import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ExplainBody } from '@/components/Explain'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api, type App, type AppFields, type Applications } from '@/lib/api'
import { DEFAULT_LAYER, DISPOSITION_CODES, dispositionColor } from '@/lib/theme'
import { cn } from '@/lib/utils'

const BF = ['Functional fit', 'Strategic alignment', 'User satisfaction']
const TF = ['Technology currency', 'Integration / API readiness', 'Security & compliance', 'Cost efficiency']
const SCORE_HINT = ['Poor', 'Weak', 'Adequate', 'Good', 'Excellent']

const EMPTY: AppFields = {
  name: '', description: '', vendor: 'TBD', version: '', type: 'COTS', layer: DEFAULT_LAYER, business_owner: '', it_owner: '',
  users: '', caps: [], hosting: 'Unknown', platform: '', customisation: 'TBD', licence_model: 'TBD', support_model: 'TBD',
  contract_end: '', scalability: 'TBD', dr: 'TBD', standards_class: 'Non-Standard', lifecycle: 'Unknown', retire_date: '', sor: [],
  pii: false, run_cost: '', criticality: 3, bf: [3, 3, 3], tf: [3, 3, 3, 3], in_scope: true, issues: '', override: {},
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-t pt-4 first:border-t-0 first:pt-0">
      <div>
        <div className="text-xs font-semibold tracking-wide text-navy uppercase">{title}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, assumed, children, className }: { label: string; assumed?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">{label}{assumed && <ProvenanceBadge source="assumed" />}</span>
      {children}
    </label>
  )
}

function Pick({ value, options, onChange }: { value: string | number | undefined; options: (string | number)[]; onChange: (v: string) => void }) {
  const opts = value !== undefined && value !== '' && !options.map(String).includes(String(value)) ? [String(value), ...options] : options
  return (
    <Select value={value === undefined || value === '' ? undefined : String(value)} onValueChange={onChange}>
      <SelectTrigger size="sm" className="h-8 w-full text-[13px]"><SelectValue placeholder="Select" /></SelectTrigger>
      <SelectContent>{opts.map((o) => <SelectItem key={String(o)} value={String(o)}>{String(o)}</SelectItem>)}</SelectContent>
    </Select>
  )
}

function Scores({ labels, values, onChange }: { labels: string[]; values: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="space-y-1.5">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <span className="w-44 shrink-0 text-[12.5px]">{l}</span>
          <div className="grid flex-1 grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" title={SCORE_HINT[n - 1]} onClick={() => onChange(values.map((x, j) => (j === i ? n : x)))}
                className={cn('h-7 rounded-md border text-xs font-semibold transition-colors', values[i] === n ? 'border-navy bg-navy text-white' : 'hover:bg-muted')}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Application intake and edit form: Tech DD due-diligence fields plus the rule inputs, with a disposition override. */
export function AppForm({ open, app, a, onClose }: { open: boolean; app: App | null; a: Applications; onClose: () => void }) {
  const qc = useQueryClient()
  const [f, setF] = useState<AppFields>(EMPTY)
  const [capQ, setCapQ] = useState('')
  useEffect(() => {
    if (!open) return
    setF(app ? { ...EMPTY, ...app, override: app.override ?? {} } : EMPTY)
    setCapQ('')
  }, [open, app])
  const set = <K extends keyof AppFields>(k: K, v: AppFields[K]) => setF((x) => ({ ...x, [k]: v }))
  const assumed = new Set(app?.assumed_fields ?? [])
  const opt = (k: string, fallback: (string | number)[] = []) => a.options[k] ?? fallback
  const caps = useMemo(() => a.l2.filter((c) => `${c.id} ${c.name} ${c.l1}`.toLowerCase().includes(capQ.toLowerCase())), [a.l2, capQ])

  const done = (msg: string) => {
    qc.invalidateQueries({ predicate: (q) => !['coach', 'findings', 'settings', 'health'].includes(String(q.queryKey[0])) })
    toast.success(msg)
    onClose()
  }
  const save = useMutation({
    mutationFn: async () => {
      const body = Object.fromEntries((Object.keys(EMPTY) as (keyof AppFields)[]).map((k) => [k, f[k]])) as Partial<AppFields>
      if (!body.override?.disposition) body.override = {}
      if (app) {
        await api.putApp(app.id, body)
        return app.id
      }
      return (await api.addApp(body)).id
    },
    onSuccess: (id) => done(app ? `${f.name} updated and re-rationalized` : `${f.name} added as ${id}`),
    onError: (e: Error) => toast.error(e.message),
  })
  const del = useMutation({
    mutationFn: () => api.deleteApp(app!.id),
    onSuccess: () => done(`${app!.name} removed with its interfaces`),
    onError: (e: Error) => toast.error(e.message),
  })
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const ov = f.override ?? {}

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="pr-8">{app ? `${app.id} · ${app.name}` : 'Add application'}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Tech DD intake · TOGAF §35.6.5 Application Portfolio Catalog {app && <ProvenanceBadge source={app.source} />}
          </DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {app && (
            <details className="rounded-lg border">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-navy">
                Current disposition: <span style={{ color: dispositionColor(app.computed.disposition) }}>{app.computed.label}</span> · how it was decided
              </summary>
              <ExplainBody x={app.computed.explain} />
            </details>
          )}
          <Section title="Identification" hint="What the application is and does">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Application name *"><Input value={f.name} onChange={(e) => set('name', e.target.value)} className="h-8" /></Field>
              <Field label="Vendor / product (TBD if unknown)"><Input value={f.vendor} onChange={(e) => set('vendor', e.target.value)} className="h-8" /></Field>
              <Field label="Primary business functionality" className="col-span-2"><Textarea value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} className="min-h-14 text-sm" /></Field>
              <Field label="Type"><Pick value={f.type} options={opt('type')} onChange={(v) => set('type', v)} /></Field>
              <Field label="Version"><Input value={f.version ?? ''} onChange={(e) => set('version', e.target.value)} className="h-8" /></Field>
              <Field label="Architecture layer" assumed={assumed.has('layer')}><Pick value={f.layer} options={a.layers} onChange={(v) => set('layer', v)} /></Field>
              <Field label="Users"><Input value={f.users ?? ''} onChange={(e) => set('users', e.target.value)} className="h-8" /></Field>
            </div>
          </Section>
          <Section title="Ownership & support">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Business owner" assumed={assumed.has('business_owner')}><Input value={f.business_owner ?? ''} onChange={(e) => set('business_owner', e.target.value)} className="h-8" /></Field>
              <Field label="IT owner" assumed={assumed.has('it_owner')}><Input value={f.it_owner ?? ''} onChange={(e) => set('it_owner', e.target.value)} className="h-8" /></Field>
              <Field label="Support arrangement" assumed={assumed.has('support_model')}><Pick value={f.support_model} options={opt('support_model')} onChange={(v) => set('support_model', v)} /></Field>
              <Field label="Licence model"><Pick value={f.licence_model} options={opt('licence_model')} onChange={(v) => set('licence_model', v)} /></Field>
              <Field label="Contract / licence end"><Input value={f.contract_end ?? ''} onChange={(e) => set('contract_end', e.target.value)} className="h-8" placeholder="YYYY-MM or TBD" /></Field>
              <Field label="Annual run cost band"><Pick value={f.run_cost} options={opt('run_cost')} onChange={(v) => set('run_cost', v)} /></Field>
            </div>
          </Section>
          <Section title="Architecture & hosting" hint="Platform, customisation, scalability and redundancy (Tech DD data request)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hosting"><Pick value={f.hosting} options={opt('hosting')} onChange={(v) => set('hosting', v)} /></Field>
              <Field label="Platform / technology stack"><Input value={f.platform ?? ''} onChange={(e) => set('platform', e.target.value)} className="h-8" /></Field>
              <Field label="Level of customisation" assumed={assumed.has('customisation')}><Pick value={f.customisation} options={opt('customisation')} onChange={(v) => set('customisation', v)} /></Field>
              <Field label="Scalability"><Pick value={f.scalability} options={opt('scalability')} onChange={(v) => set('scalability', v)} /></Field>
              <Field label="Redundancy / DR"><Pick value={f.dr} options={opt('dr')} onChange={(v) => set('dr', v)} /></Field>
              <Field label="Standards class"><Pick value={f.standards_class} options={opt('standards_class')} onChange={(v) => set('standards_class', v)} /></Field>
              <Field label="Lifecycle status"><Pick value={f.lifecycle} options={opt('lifecycle')} onChange={(v) => set('lifecycle', v)} /></Field>
              <Field label="Planned retire date"><Input value={f.retire_date ?? ''} onChange={(e) => set('retire_date', e.target.value)} className="h-8" /></Field>
              <label className="col-span-2 flex items-center gap-2 text-[12.5px]">
                <Switch checked={f.in_scope} onCheckedChange={(v) => set('in_scope', v)} /> In assessment scope (off = SAP RISE / OT, dependencies only)
              </label>
            </div>
          </Section>
          <Section title={`Capabilities served (${f.caps.length})`} hint="Maps the app to L2 capabilities: drives duplication clusters and business-IT alignment">
            <Input value={capQ} onChange={(e) => setCapQ(e.target.value)} placeholder="Filter capabilities" className="h-8" />
            <div className="scrollbar-thin grid max-h-44 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-md border p-2">
              {caps.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-[12px]" title={c.l1}>
                  <Checkbox checked={f.caps.includes(c.id)} onCheckedChange={() => set('caps', toggle(f.caps, c.id))} />
                  <span className="w-11 shrink-0 font-semibold text-muted-foreground">{c.id}</span><span className="truncate">{c.name}</span>
                </label>
              ))}
            </div>
          </Section>
          <Section title="Data" hint="Domains this app is the system of record for">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {a.domains.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-[12px]">
                  <Checkbox checked={f.sor.includes(d.id)} onCheckedChange={() => set('sor', toggle(f.sor, d.id))} />
                  <span className="w-12 shrink-0 font-semibold text-muted-foreground">{d.id}</span><span className="truncate">{d.name.split(' (')[0]}</span>
                </label>
              ))}
              <label className="col-span-2 mt-1 flex items-center gap-2 text-[12.5px]"><Switch checked={!!f.pii} onCheckedChange={(v) => set('pii', v)} /> Holds personal data (DPDP Act 2023)</label>
            </div>
          </Section>
          <Section title="Assessment" hint={`Scores 1–5. BF and TF vs threshold ${a.threshold.toFixed(1)} set the quadrant; rules on Vision & Guardrails then apply.`}>
            <div className="flex items-center gap-2">
              <span className="w-44 shrink-0 text-[12.5px]">Business criticality {assumed.has('criticality') && <ProvenanceBadge source="assumed" className="ml-1" />}</span>
              <div className="grid flex-1 grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => set('criticality', n)}
                    className={cn('h-7 rounded-md border text-xs font-semibold', f.criticality === n ? 'border-navy bg-navy text-white' : 'hover:bg-muted')}>{n}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-muted-foreground uppercase">Business fit {assumed.has('bf') && <ProvenanceBadge source="assumed" />}</div>
            <Scores labels={BF} values={f.bf} onChange={(v) => set('bf', v)} />
            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-muted-foreground uppercase">Technical fit {assumed.has('tf') && <ProvenanceBadge source="assumed" />}</div>
            <Scores labels={TF} values={f.tf} onChange={(v) => set('tf', v)} />
          </Section>
          <Section title="Disposition override" hint="Rules propose the disposition; an architect can override it with context. The rule result stays visible.">
            <div className="grid grid-cols-[200px_1fr] gap-3">
              <Field label="Override to">
                <Select value={ov.disposition ?? 'none'} onValueChange={(v) => set('override', v === 'none' ? {} : { ...ov, disposition: v })}>
                  <SelectTrigger size="sm" className="h-8 w-full text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No override (use rules)</SelectItem>
                    {DISPOSITION_CODES.map((c) => <SelectItem key={c} value={c}>{a.labels[c] ?? c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reason (required with an override)">
                <Input value={ov.reason ?? ''} disabled={!ov.disposition} onChange={(e) => set('override', { ...ov, reason: e.target.value })} className="h-8" placeholder="e.g. ARB decision 2026-11, contract runs to FY28" />
              </Field>
            </div>
            <Field label="Known issues"><Textarea value={f.issues ?? ''} onChange={(e) => set('issues', e.target.value)} className="min-h-12 text-sm" /></Field>
          </Section>
        </div>
        <DialogFooter className="flex-row items-center justify-between border-t px-5 py-3 sm:justify-between">
          {app ? <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del.mutate()} disabled={del.isPending}><Trash2 /> Remove</Button> : <span />}
          <Button onClick={() => save.mutate()} disabled={save.isPending || !f.name.trim() || (!!ov.disposition && !ov.reason?.trim())}>
            {save.isPending && <Loader2 className="animate-spin" />} {app ? 'Save & recompute' : 'Add application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

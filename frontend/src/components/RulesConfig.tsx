import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Explain } from '@/components/Explain'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api, type RulesConfig as RC, type Vision } from '@/lib/api'
import { DISPOSITION_CODES, dispositionColor, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

const BF = ['Functional fit', 'Strategic alignment', 'User satisfaction']
const TF = ['Technology currency', 'Integration / API', 'Security & compliance', 'Cost efficiency']
const PARAM_LABEL: Record<string, string> = {
  max_security: 'Security ≤', min_criticality: 'Criticality ≥', min_alignment: 'Strategic alignment ≥', core_vendor: 'Core vendor',
}

function Num({ value, onChange, step = 1, min = 0, max = 5, className }: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; className?: string }) {
  return <Input type="number" value={value} step={step} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} className={cn('tabular h-7 w-16 px-2 text-center text-[13px]', className)} />
}

/** Configurable rationalization rules: terminology, thresholds, weights and principle-driven rules. */
export function RulesConfig({ v }: { v: Vision }) {
  const qc = useQueryClient()
  const [r, setR] = useState<RC>(v.rules)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (!dirty) setR(v.rules) }, [v.rules, dirty])
  const edit = (p: Partial<RC>) => { setR((x) => ({ ...x, ...p })); setDirty(true) }
  const after = (d: Vision, msg: string) => {
    qc.setQueryData(['vision'], d)
    ;['applications', 'overview', 'roadmap', 'business'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
    setDirty(false)
    toast.success(msg)
  }
  const save = useMutation({
    mutationFn: () => api.putRules({
      threshold: r.threshold, bf_weights: r.bf_weights, tf_weights: r.tf_weights, labels: r.labels,
      rules: r.rules.map((x) => ({ id: x.id, enabled: x.enabled, params: x.params })),
      capability: { gap_importance_min: r.capability.gap_importance_min, gap_maturity_max: r.capability.gap_maturity_max },
    }),
    onSuccess: (d) => after(d, 'Rules saved. Dispositions, gaps and roadmap recomputed.'),
    onError: (e: Error) => toast.error(e.message),
  })
  const reset = useMutation({ mutationFn: api.resetRules, onSuccess: (d) => after(d, 'Rules reset to defaults') })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-navy-soft/60 px-3 py-2 text-[12px]">
        <span className="flex items-center gap-1.5">
          Rules generate each application's disposition; architects can still override an app with a reason on the Applications screen.
          <Explain x={v.explain.rules_on} />
        </span>
        <span className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => reset.mutate()} disabled={reset.isPending}><RotateCcw /> Defaults</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save & recompute</Button>
        </span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 rounded-lg border">
          <div className="border-b px-3 py-2 text-xs font-semibold">Disposition Terminology</div>
          <div className="divide-y">
            {DISPOSITION_CODES.map((code) => {
              const l = r.labels[code] ?? { label: code, desc: '' }
              const col = dispositionColor(code)
              return (
                <div key={code} className="grid grid-cols-[150px_130px_1fr] items-center gap-2 px-3 py-1.5">
                  <span className="text-[11px] text-muted-foreground" title="Internal rule code">
                    {code === 'Tolerate' ? 'Low BF · high TF' : code === 'Invest' ? 'High BF · high TF' : code === 'Migrate' ? 'High BF · low TF' : code === 'Eliminate' ? 'Low BF · low TF' : code === 'Consolidate' ? 'Duplicate (rule RR-04)' : 'Out of scope (RR-01)'}
                  </span>
                  <Input value={l.label} onChange={(e) => edit({ labels: { ...r.labels, [code]: { ...l, label: e.target.value } } })}
                    className="h-7 text-[13px] font-semibold" style={{ color: col, background: tint(col, 0.06) }} />
                  <Input value={l.desc} onChange={(e) => edit({ labels: { ...r.labels, [code]: { ...l, desc: e.target.value } } })} className="h-7 text-[12px]" />
                </div>
              )
            })}
          </div>
        </div>
        <div className="col-span-5 space-y-3">
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-semibold">Fit Threshold & Weights</div>
            <div className="mb-2 flex items-center gap-2 text-[12.5px]">Business and technical fit threshold <Num value={r.threshold} step={0.1} min={1} onChange={(x) => edit({ threshold: x })} /><span className="text-[11px] text-muted-foreground">default {v.rules.defaults.threshold}</span></div>
            <div className="grid grid-cols-2 gap-3">
              {[['Business fit weights', BF, 'bf_weights'], ['Technical fit weights', TF, 'tf_weights']].map(([title, dims, key]) => (
                <div key={key as string}>
                  <div className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase">{title as string}</div>
                  {(dims as string[]).map((d, i) => (
                    <div key={d} className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate">{d}</span>
                      <Num value={(r[key as 'bf_weights'] as number[])[i]} step={0.5} max={10}
                        onChange={(x) => edit({ [key as string]: (r[key as 'bf_weights'] as number[]).map((y, j) => (j === i ? x : y)) } as Partial<RC>)} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-semibold">Capability Gap Rule</div>
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              Gap when business criticality ≥ <Num value={r.capability.gap_importance_min} min={1} onChange={(x) => edit({ capability: { ...r.capability, gap_importance_min: x } })} />
              and maturity ≤ <Num value={r.capability.gap_maturity_max} step={0.1} min={1} onChange={(x) => edit({ capability: { ...r.capability, gap_maturity_max: x } })} />
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">Target maturity by business criticality: {Object.entries(r.capability.target_maturity).sort().reverse().map(([k, x]) => `${k} → ${x}`).join(' · ')}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold">Principle-Driven Rationalization Rules</span>
          <span className="text-[11px] text-muted-foreground">Run in order after the fit quadrant. Each rule cites the principle, guardrail or driver it enforces.</span>
        </div>
        <div className="divide-y">
          {r.rules.map((x, i) => (
            <div key={x.id} className={cn('grid grid-cols-[44px_1fr_230px] items-start gap-3 px-3 py-2.5', !x.enabled && 'opacity-70')}>
              <div className="flex flex-col items-center gap-1 pt-0.5">
                <Switch checked={x.enabled} disabled={x.locked} onCheckedChange={(on) => edit({ rules: r.rules.map((y, j) => (j === i ? { ...y, enabled: on } : y)) })} aria-label={`Enable ${x.name}`} />
                {x.locked && <Lock className="size-3 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground">{x.id}</span>
                  <span className="text-[13px] font-semibold">{x.name}</span>
                  <span className="text-[11px] text-muted-foreground">→</span>
                  <span className="rounded px-1.5 text-[11px] font-semibold" style={{ color: dispositionColor(x.then), background: tint(dispositionColor(x.then), 0.12) }}>{r.labels[x.then]?.label ?? x.then}</span>
                  <span className="rounded bg-navy-soft px-1.5 text-[10.5px] font-semibold text-navy">§{x.togaf_ref}</span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground"><span className="font-medium text-foreground">If </span>{x.condition}. {x.why}.</div>
                <div className="mt-1 flex flex-wrap gap-1">{x.basis.map((bs) => <span key={bs} className="rounded border px-1.5 text-[10.5px] text-muted-foreground">{bs}</span>)}</div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {Object.entries(x.params ?? {}).filter(([, pv]) => typeof pv !== 'object').map(([k, pv]) => (
                  <label key={k} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">{PARAM_LABEL[k] ?? k}
                    {typeof pv === 'number'
                      ? <Num value={pv} onChange={(n) => edit({ rules: r.rules.map((y, j) => (j === i ? { ...y, params: { ...y.params, [k]: n } } : y)) })} />
                      : <Input value={String(pv)} onChange={(e) => edit({ rules: r.rules.map((y, j) => (j === i ? { ...y, params: { ...y.params, [k]: e.target.value } } : y)) })} className="h-7 w-20 text-[12px]" />}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

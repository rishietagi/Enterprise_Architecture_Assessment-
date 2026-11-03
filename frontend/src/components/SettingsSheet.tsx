import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, Loader2, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type EditableConfig } from '@/lib/api'
import { useShell } from '@/lib/shell'

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="tabular h-8 w-24 text-right" />
    </label>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function SettingsSheet() {
  const { settingsOpen, setSettingsOpen } = useShell()
  const qc = useQueryClient()
  const s = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings,
    enabled: settingsOpen,
    refetchInterval: (q) => (q.state.data?.rag.reindex.running ? 3000 : false),
  })
  const [cfg, setCfg] = useState<EditableConfig | null>(null)
  useEffect(() => {
    if (s.data) setCfg(structuredClone(s.data.config))
  }, [s.data])

  const refreshAll = () => qc.invalidateQueries({ predicate: (q) => !['coach', 'findings'].includes(String(q.queryKey[0])) })
  const save = useMutation({
    mutationFn: () => api.putConfig(cfg!),
    onSuccess: (d) => {
      qc.setQueryData(['settings'], d)
      refreshAll()
      toast.success('Rule parameters saved. All views recomputed.')
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const reset = useMutation({
    mutationFn: api.reset,
    onSuccess: (d) => {
      qc.setQueryData(['settings'], d)
      qc.removeQueries({ queryKey: ['findings'] })
      refreshAll()
      toast.success('Demo data reset to seed')
    },
  })
  const reindex = useMutation({
    mutationFn: api.reindex,
    onSuccess: (d) => {
      qc.setQueryData(['settings'], d)
      toast.info('Re-indexing TOGAF in the background')
    },
  })

  const set = (fn: (c: EditableConfig) => void) => setCfg((c) => {
    if (!c) return c
    const n = structuredClone(c)
    fn(n)
    return n
  })
  const d = s.data

  return (
    <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
      <SheetContent side="right" className="flex w-[440px] flex-col gap-0 p-0 sm:max-w-[440px]">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Rule parameters, TOGAF index and AI status.</SheetDescription>
        </SheetHeader>
        {!d || !cfg ? (
          <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (
          <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Database className="size-3.5" /> TOGAF index</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold capitalize">{d.rag.mode === 'lexical' ? 'Lexical mode' : d.rag.mode === 'hybrid' ? 'Hybrid' : 'Not built'}</span>
                  {d.rag.reindex.running && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                </div>
                <div className="text-xs text-muted-foreground">{d.rag.n_chunks} chunks{d.rag.meta.built ? ` · ${d.rag.meta.built}` : ''}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Sparkles className="size-3.5" /> Gemini</div>
                <div className="mt-1 text-sm font-semibold">{d.llm.has_key ? 'Key present' : 'No key · offline'}</div>
                <div className="truncate text-xs text-muted-foreground">{d.llm.model} · {d.llm.rpm} RPM</div>
              </div>
            </div>
            {d.llm.last_error && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Last AI error: {d.llm.last_error}</p>}

            <Separator />
            <Group title="Capabilities (Phase B)">
              <NumField label="Gap if business criticality ≥" value={cfg.capability_rules.gap_importance_min} onChange={(v) => set((c) => { c.capability_rules.gap_importance_min = v })} />
              <NumField label="and maturity ≤" step={0.1} value={cfg.capability_rules.gap_maturity_max} onChange={(v) => set((c) => { c.capability_rules.gap_maturity_max = v })} />
              <NumField label="Urgency +1 if maturity ≤" step={0.1} value={cfg.capability_rules.critical_maturity_max} onChange={(v) => set((c) => { c.capability_rules.critical_maturity_max = v })} />
            </Group>
            <Group title="Rationalization (Phase C)">
              <NumField label="TIME threshold (BF / TF)" step={0.1} value={cfg.rationalization.threshold} onChange={(v) => set((c) => { c.rationalization.threshold = v })} />
            </Group>
            <Group title="Data governance score weights">
              {Object.entries(cfg.data_rules.score_weights).map(([k, v]) => (
                <NumField key={k} label={k.replace(/_/g, ' ')} value={v} onChange={(n) => set((c) => { c.data_rules.score_weights[k] = n })} />
              ))}
              <NumField label="Gap if score <" value={cfg.data_rules.gap_score_below} onChange={(v) => set((c) => { c.data_rules.gap_score_below = v })} />
              <NumField label="AI data-ready if every domain ≥" value={cfg.data_rules.ai_ready_min} onChange={(v) => set((c) => { c.data_rules.ai_ready_min = v })} />
            </Group>
            <Group title="Rate card (₹ Cr, low–high)">
              {Object.entries(cfg.roadmap.rate_card_inr_cr).map(([size, [lo, hi]]) => (
                <div key={size} className="flex items-center justify-between gap-3 text-sm">
                  <Badge variant="outline" className="w-9 justify-center">{size}</Badge>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" step={0.5} value={lo} className="tabular h-8 w-20 text-right" onChange={(e) => set((c) => { c.roadmap.rate_card_inr_cr[size][0] = Number(e.target.value) })} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="number" step={0.5} value={hi} className="tabular h-8 w-20 text-right" onChange={(e) => set((c) => { c.roadmap.rate_card_inr_cr[size][1] = Number(e.target.value) })} />
                  </div>
                </div>
              ))}
            </Group>
          </div>
        )}
        <div className="flex items-center gap-2 border-t px-5 py-3">
          <Button onClick={() => save.mutate()} disabled={!cfg || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />} Save parameters
          </Button>
          <Button variant="outline" onClick={() => reindex.mutate()} disabled={reindex.isPending || d?.rag.reindex.running}>
            <RefreshCw /> Re-index
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive"><RotateCcw /> Reset demo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset Demo Data?</DialogTitle>
                <DialogDescription>All scores, uploads, decisions, principle selections and rule overrides return to the seed. The TOGAF index and AI cache are kept.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <DialogClose asChild><Button variant="destructive" onClick={() => reset.mutate()}>Reset</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SheetContent>
    </Sheet>
  )
}

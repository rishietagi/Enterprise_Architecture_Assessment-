import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Fingerprint, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, type DataTech, type LandingZone, type RefStatus } from '@/lib/api'
import { CHECK_STATUS, NAVY, REF_STATUS, dispositionColor, tint } from '@/lib/theme'

const short = (n: string) => n.split(' (')[0]
const H = ({ children }: { children: ReactNode }) => <div className="mb-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</div>

function Spend({ d, kinds }: { d: DataTech; kinds: string[] }) {
  const rows = d.budget_infra.filter((r) => kinds.includes(r.kind ?? ''))
  if (!rows.length) return null
  return (
    <div>
      <H>Run Cost from IT Budget (₹ Cr)</H>
      <table className="w-full text-[12px]">
        <thead><tr className="text-[11px] text-muted-foreground"><th className="py-1 text-left font-medium">Cost head</th>{d.budget_fys.map((f) => <th key={f} className="py-1 text-right font-medium">{f}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="py-1">{r.name}</td>{r.values.map((v, i) => <td key={i} className="tabular py-1 text-right">{v ?? '–'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function Checks({ d, ids }: { d: DataTech; ids: string[] }) {
  const all = [...d.checks, ...d.engineering_checks].filter((c) => ids.includes(c.id))
  return (
    <div className="space-y-1">
      {all.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-[12px]">
          <span className="w-8 text-[11px] font-semibold text-muted-foreground">{c.id}</span><span className="min-w-0 flex-1">{c.check}</span>
          <span className="rounded px-1.5 text-[10.5px] font-semibold" style={{ color: CHECK_STATUS[c.status].color, background: tint(CHECK_STATUS[c.status].color) }}>{CHECK_STATUS[c.status].label}</span>
        </div>
      ))}
    </div>
  )
}

function LandingZones({ d }: { d: DataTech }) {
  const qc = useQueryClient()
  const [z, setZ] = useState<LandingZone[]>(d.landing_zones)
  useEffect(() => setZ(d.landing_zones), [d.landing_zones])
  const dirty = JSON.stringify(z) !== JSON.stringify(d.landing_zones)
  const save = useMutation({ mutationFn: () => api.putZones(z), onSuccess: (x) => { qc.setQueryData(['data_tech'], x); toast.success('Landing zones saved') }, onError: (e: Error) => toast.error(e.message) })
  const cell = 'h-7 rounded-none border-0 bg-transparent px-2 text-[12px] shadow-none focus-visible:ring-0'
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between"><H>Azure Landing Zones</H><Button size="xs" onClick={() => save.mutate()} disabled={!dirty || save.isPending}><Save /> Save</Button></div>
      <div className="overflow-hidden rounded-md border">
        {z.map((x, i) => (
          <div key={i} className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_150px_28px] items-center border-b last:border-0">
            <Input className={cell} value={x.name} onChange={(e) => setZ(z.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
            <Input className={`${cell} border-l`} value={x.workloads} placeholder="Workloads" onChange={(e) => setZ(z.map((y, j) => (j === i ? { ...y, workloads: e.target.value } : y)))} />
            <Select value={x.status} onValueChange={(v) => setZ(z.map((y, j) => (j === i ? { ...y, status: v as RefStatus } : y)))}>
              <SelectTrigger size="sm" className="h-7 rounded-none border-0 border-l text-[11.5px] shadow-none" style={{ color: REF_STATUS[x.status].color }}><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(REF_STATUS) as RefStatus[]).map((s) => <SelectItem key={s} value={s}>{REF_STATUS[s].label}</SelectItem>)}</SelectContent>
            </Select>
                        <button onClick={() => setZ(z.filter((_, j) => j !== i))} className="flex justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"><Trash2 className="size-3.5" /></button>
          </div>
        ))}
        <button onClick={() => setZ([...z, { id: `LZ${z.length + 1}`, name: 'New landing zone', status: 'missing', workloads: '', source: 'client' }])} className="flex w-full items-center gap-1 px-2 py-1 text-[11.5px] font-medium text-navy hover:bg-muted/50"><Plus className="size-3.5" /> Add landing zone</button>
      </div>
    </div>
  )
}

function Hosting({ d, names }: { d: DataTech; names: string[] }) {
  const rows = d.hosting.filter((h) => names.includes(h.name))
  return (
    <div>
      <H>Applications by Hosting</H>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((h) => (
          <div key={h.name} className="rounded-md border p-2">
            <div className="mb-1 flex justify-between text-[12px] font-semibold"><span>{h.name}</span><span className="tabular">{h.apps.length}</span></div>
            <div className="flex flex-wrap gap-1">{h.apps.map((a) => <span key={a.id} className="rounded px-1.5 py-px text-[10.5px]" style={{ color: dispositionColor(a.disposition), background: tint(dispositionColor(a.disposition), 0.1) }} title={a.label}>{short(a.name)}</span>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Drill-downs behind the consolidated infrastructure view: network, cloud, security and private hosting detail. */
export function infraDetail(d: DataTech) {
  const loc = Object.fromEntries(d.locations.map((l) => [l.id, short(l.name).split(' incl.')[0]]))
  return (layer: string): { title: string; body: ReactNode } | null => {
    if (layer === 'il-nw') return {
      title: 'Network & Connectivity · RFP view 8', body: (
        <div className="space-y-4">
          <div>
            <H>Site Links ({d.network.length}) · edit them in Inputs › Sites & Network</H>
            <table className="w-full text-[12px]">
              <thead><tr className="text-[11px] text-muted-foreground"><th className="py-1 text-left font-medium">From</th><th className="py-1 text-left font-medium">To</th><th className="py-1 text-left font-medium">Link type</th><th className="py-1 text-left font-medium">Note</th><th className="w-20 py-1" /></tr></thead>
              <tbody>{d.network.map((n) => <tr key={n.id} className="border-t"><td className="py-1.5">{loc[n.from] ?? n.from}</td><td className="py-1.5">{loc[n.to] ?? n.to}</td><td className="py-1.5">{n.type}</td><td className="py-1.5 text-muted-foreground">{n.note}</td></tr>)}</tbody>
            </table>
          </div>
          <Checks d={d} ids={['R07', 'R08']} />
          <Spend d={d} kinds={['network']} />
        </div>
      ),
    }
    if (layer === 'il-cl') return {
      title: 'Hybrid & Public Cloud · RFP view 9', body: (
        <div className="space-y-4">
          <LandingZones d={d} />
          <Hosting d={d} names={['Azure', 'RISE (SAP-managed)', 'SaaS', 'Partner-hosted', 'Unknown']} />
          <Checks d={d} ids={['R06', 'E03', 'E05']} />
          <Spend d={d} kinds={['cloud']} />
        </div>
      ),
    }
    if (layer === 'il-pc') return {
      title: 'Private Hosting: Hyderabad DC and Chennai DR · RFP view 7', body: (
        <div className="space-y-4">
          <Hosting d={d} names={['DC-HYD']} />
          <Checks d={d} ids={['R01', 'R02', 'R03', 'R04']} />
          <Spend d={d} kinds={['infrastructure']} />
        </div>
      ),
    }
    if (layer === 'aside') return {
      title: 'IT & OT Cyber Security · RFP view 10', body: (
        <div className="space-y-4">
          {d.identity_plane && <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] text-white" style={{ background: NAVY }}><Fingerprint className="size-4" /><b>Identity plane:</b> {d.identity_plane.name}</div>}
          <div>
            <H>Security Zones</H>
            <div className="grid grid-cols-3 gap-2">
              {d.zones.map((z) => (
                <div key={z.id} className="rounded-md border p-2">
                  <div className="text-[12.5px] font-semibold">{z.name}</div>
                  <div className="mb-1 text-[11px] text-muted-foreground">{z.holds}</div>
                  {z.statuses.map((s) => <div key={s.id} className="flex justify-between text-[11px]"><span className="text-muted-foreground">{s.id}</span><span style={{ color: CHECK_STATUS[s.status].color }}>{CHECK_STATUS[s.status].label}</span></div>)}
                </div>
              ))}
            </div>
          </div>
          <Checks d={d} ids={['R07', 'R08', 'E04', 'E09']} />
          <Spend d={d} kinds={['security']} />
        </div>
      ),
    }
    return null
  }
}

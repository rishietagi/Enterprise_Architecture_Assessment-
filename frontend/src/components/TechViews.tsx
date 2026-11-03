import { FlowDiagram, Legend, type FNode } from '@/components/FlowDiagram'
import type { DataTech } from '@/lib/api'
import { BAND, LAYER_COLOR, NAVY, SLATE, bandColor, tint } from '@/lib/theme'

const short = (n: string) => n.split(' (')[0]

/** Data Dissemination view: systems of record → data domains → analytics products → AI initiatives. */
export function DataArchitecture({ d }: { d: DataTech }) {
  const da = d.data_arch
  const used = new Set(da.edges.flatMap((e) => [e.from, e.to]))
  const columns: { key: string; title: string; nodes: FNode[] }[] = [
    { key: 'src', title: 'Systems of record', nodes: da.sources.map((s) => ({ id: s.id, label: short(s.name), sub: `${s.id} · ${s.hosting}`, color: NAVY })) },
    { key: 'dom', title: 'Data domains (score)', nodes: da.domains.map((x) => ({ id: x.id, label: x.name, sub: `${x.id}${x.privacy_risk ? ' · unclassified PII' : x.pii ? ' · PII' : ''}`, color: bandColor(x.band),
      badge: <span className="tabular rounded px-1 text-[10.5px] font-bold" style={{ color: bandColor(x.band), background: tint(bandColor(x.band)) }}>{x.score}</span> })) },
    { key: 'ana', title: 'Analytics & data products', nodes: [
      ...da.analytics.map((a) => ({ id: a.id, label: short(a.name), sub: a.id, color: LAYER_COLOR['Data & AI'] })),
      ...da.platforms.map((p) => ({ id: p.id, label: p.name, sub: `Platform · ${p.standard}`, color: SLATE, dashed: true })),
    ] },
    { key: 'ai', title: 'AI initiatives', nodes: da.ai.filter((i) => used.has(i.id)).map((i) => ({ id: i.id, label: i.name, sub: i.ready ? 'Data-ready' : 'Blocked by data', color: i.ready ? BAND.strong : BAND.critical })) },
  ]
  const edges = da.edges.map((e) => ({ from: e.from, to: e.to, color: e.kind === 'sor' ? NAVY : e.kind === 'ai' ? LAYER_COLOR['Data & AI'] : BAND.strong, dashed: e.kind === 'ai' }))
  return (
    <div className="space-y-2">
      <Legend items={[{ label: 'System of record for', color: NAVY, line: true }, { label: 'Feeds analytics', color: BAND.strong, line: true }, { label: 'AI depends on', color: LAYER_COLOR['Data & AI'], line: true, dashed: true }]} />
      <FlowDiagram columns={columns} edges={edges} nodeH={36} />
      <p className="text-[11px] text-muted-foreground">Data Dissemination view (§35.6.4). Domain colour = governance score band; AI initiatives turn red when a dependent domain scores below the readiness threshold.</p>
    </div>
  )
}

const CLASSES = ['Standard', 'Provisional Standard', 'Proposed Standard', 'Phasing-Out Standard', 'Non-Standard', 'Retired Standard']
const LIFE_COLOR: Record<string, string> = { Current: BAND.strong, Ageing: BAND.developing, 'EOL < 24m': BAND.critical, Unknown: SLATE }

/** RFP view 11: Technology Standards Catalog by standards class and lifecycle. */
export function StandardsView({ d }: { d: DataTech }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-6 gap-2">
        {CLASSES.map((c) => {
          const ps = d.platforms.filter((p) => p.standard === c)
          return (
            <div key={c} className="rounded-lg border">
              <div className="border-b px-2 py-1.5 text-[11.5px] font-semibold">{c} <span className="text-muted-foreground">({ps.length})</span></div>
              <div className="space-y-1 p-2">
                {ps.map((p) => (
                  <div key={p.id} className="rounded border-l-[3px] bg-muted/40 px-1.5 py-1 text-[11px]" style={{ borderLeftColor: LIFE_COLOR[p.lifecycle] ?? SLATE }}>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[10px] text-muted-foreground">{p.category} · v{p.version ?? 'TBD'} · {p.lifecycle}</div>
                  </div>
                ))}
                {!ps.length && <div className="text-[11px] text-muted-foreground">–</div>}
              </div>
            </div>
          )
        })}
      </div>
      <Legend items={Object.entries(LIFE_COLOR).map(([k, c]) => ({ label: `Lifecycle ${k}`, color: c }))} />
    </div>
  )
}

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Landscape, States } from '@/lib/api'
import { Explain } from '@/components/Explain'
import { BAND, LAYER_COLOR, NAVY, SLATE, WAVE_COLOR, bandColor, dispositionColor, tint } from '@/lib/theme'
import { SCREEN_BY_KEY } from '@/lib/screens'
import { cn } from '@/lib/utils'

const fmtV = (v: number | null, unit: string) => (v === null ? '–' : `${Number.isInteger(v) ? v : v.toFixed(2)}${unit === '%' ? '%' : ''}`)

/** RFP view 13: current, transition (per wave) and target state metrics, projected by the rules. */
export function ArchitectureStates({ s }: { s: States }) {
  const nav = useNavigate()
  const colColor = (i: number) => (i === 0 ? SLATE : i === s.columns.length - 1 ? BAND.strong : WAVE_COLOR[i - 1] ?? NAVY)
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="w-[230px] pb-2 text-left text-[11px] font-medium text-muted-foreground">Measure</th>
              {s.columns.map((c, i) => (
                <th key={c.id} className="px-1 pb-2">
                  <div className="rounded-md px-2 py-1.5 text-center" style={{ background: tint(colColor(i), 0.1) }}>
                    <div className="text-[11.5px] font-semibold" style={{ color: colColor(i) }}>{c.name}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">{c.window}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.metrics.map((m) => {
              const base = m.values[0]
              return (
                <tr key={m.key} className="group">
                  <td className="border-t py-1.5 pr-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Explain x={m.explain} />
                      <button className="text-left text-[12.5px] font-medium hover:text-navy hover:underline" onClick={() => nav(SCREEN_BY_KEY[m.screen].path)}>{m.label}</button>
                      {m.unit && m.unit !== '%' && <span className="text-[10.5px] text-muted-foreground">{m.unit}</span>}
                    </span>
                  </td>
                  {m.values.map((v, i) => {
                    const better = v !== null && base !== null && i > 0 && (m.better === 'higher' ? v > base : v < base)
                    return (
                      <td key={i} className="tabular border-t px-1 py-1.5 text-center">
                        <span className={cn('inline-block min-w-12 rounded px-1.5 py-0.5 text-[12.5px]', i === s.columns.length - 1 && 'font-semibold')}
                          style={better ? { color: BAND.strong, background: tint(BAND.strong, 0.08) } : i === 0 ? { color: NAVY, fontWeight: 600 } : undefined}>
                          {fmtV(v, m.unit)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-3 gap-3 text-[12px]">
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-[11px] font-semibold tracking-wide uppercase" style={{ color: SLATE }}>Current state (baseline)</div>
          <ul className="list-disc space-y-0.5 pl-4">{s.narrative.current.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-navy uppercase">Transition architectures</div>
          <ul className="space-y-1">
            {Object.entries(s.narrative.transitions).map(([w, items], i) => (
              <li key={w} className="flex gap-2"><span className="w-6 shrink-0 font-bold" style={{ color: WAVE_COLOR[i] }}>{w}</span><span className="line-clamp-2">{items.join(' · ') || '–'}</span></li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-1.5 text-[11px] font-semibold tracking-wide uppercase" style={{ color: BAND.strong }}>Target state 2030</div>
          <ul className="list-disc space-y-0.5 pl-4">{s.narrative.target.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
    </div>
  )
}

function Band({ title, sub, children, onClick }: { title: string; sub: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-t py-2.5 first:border-t-0">
      <button onClick={onClick} className="text-left">
        <div className="text-[12px] font-semibold text-navy hover:underline">{title}</div>
        <div className="text-[10.5px] leading-tight text-muted-foreground">{sub}</div>
      </button>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** RFP view 1: one-page enterprise landscape, business > applications > data > technology. */
export function EnterpriseLandscape({ l }: { l: Landscape }) {
  const nav = useNavigate()
  return (
    <div>
      <Band title="Business" sub="L0 > L1 capability maturity" onClick={() => nav('/business?view=heatmap')}>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, l.l0.length)}, minmax(0,1fr))` }}>
          {l.l0.map((g) => (
            <div key={g.id} className="rounded-md bg-muted/60 p-1.5">
              <div className="mb-1 truncate text-[10.5px] font-semibold text-foreground/80">{g.name}</div>
              <div className="flex flex-col gap-1">
                {l.l1.filter((x) => x.l0 === g.id).map((x) => (
                  <div key={x.id} title={`${x.name}: maturity ${x.maturity ?? '–'}, ${x.gaps} gaps`}
                    className="flex items-center justify-between rounded border-l-[3px] bg-card px-1.5 py-0.5 text-[10.5px]"
                    style={{ borderLeftColor: x.band ? bandColor(x.band) : SLATE }}>
                    <span className="truncate">{x.name}</span>
                    <span className="tabular ml-1 font-semibold" style={{ color: x.band ? bandColor(x.band) : SLATE }}>{x.maturity?.toFixed(1) ?? '–'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Band>
      <Band title="Applications" sub="By layer, coloured by disposition" onClick={() => nav('/applications?view=architecture')}>
        <div className="space-y-1">
          {l.layers.map((ly) => (
            <div key={ly.layer} className="flex items-start gap-2">
              <span className="w-[118px] shrink-0 pt-0.5 text-[10.5px] font-semibold" style={{ color: LAYER_COLOR[ly.layer] ?? NAVY }}>{ly.layer}</span>
              <div className="flex flex-wrap gap-1">
                {ly.apps.map((a) => (
                  <span key={a.id} title={`${a.name} · ${a.label} · ${a.hosting}`}
                    className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10.5px]', !a.in_scope && 'border-dashed text-muted-foreground')}>
                    <span className="size-1.5 rounded-full" style={{ background: dispositionColor(a.disposition) }} />
                    {a.name.split(' (')[0]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Band>
      <Band title="Data" sub="Domains by governance score" onClick={() => nav('/data-tech?view=data_arch')}>
        <div className="flex flex-wrap gap-1">
          {l.data.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium"
              style={{ background: tint(bandColor(d.band), 0.12), color: bandColor(d.band) }}>
              {d.name}<span className="tabular font-bold">{d.score}</span>
            </span>
          ))}
        </div>
      </Band>
      <Band title="Technology" sub="Hosting and platforms" onClick={() => nav('/data-tech?view=cloud')}>
        <div className="flex flex-wrap items-center gap-1">
          {l.hosting.map((h) => (
            <span key={h.name} className="inline-flex items-center gap-1 rounded-md bg-navy-soft px-1.5 py-0.5 text-[10.5px] font-medium text-navy">
              {h.name}<span className="tabular font-bold">{h.apps}</span>
            </span>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {l.platforms.map((p) => (
            <span key={p.id} title={`${p.category} · ${p.standard}`} className="rounded border px-1.5 py-px text-[10.5px] text-muted-foreground">{p.name}</span>
          ))}
        </div>
      </Band>
    </div>
  )
}

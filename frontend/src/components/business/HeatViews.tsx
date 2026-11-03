import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { AppChip } from '@/components/CapabilityModules'
import { Switch } from '@/components/ui/switch'
import type { Business, CapRow, L3Row } from '@/lib/api'
import { BAND, BAND_LABEL, DISC_STATUS, GRID, MATRIX, NAVY, QUADRANT, SLATE, SLATE_LIGHT, bandColor, tint, type Band } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { ScoreChip, allL2 } from './shared'

const NEUTRAL = '#94A3B8'

// ---------------------------------------------------------------- process maturity (all-process view L1 > L2 > L3)
function L3Line({ x, rag }: { x: L3Row; rag: boolean }) {
  const s = x.score
  const c = s ? (rag ? bandColor(s.band) : NEUTRAL) : undefined
  return (
    <div className="flex items-center gap-1.5 py-[1px]" title={`${x.id} ${x.name}${s ? ` · maturity ${s.maturity}` : ` · ${DISC_STATUS[x.status].label}`}`}>
      <span className="size-2 shrink-0 rounded-full border" style={s ? { background: c, borderColor: c } : { borderColor: SLATE_LIGHT, borderStyle: 'dashed' }} />
      <span className={cn('min-w-0 flex-1 truncate text-[10.5px] leading-[13px]', !s && 'text-muted-foreground')}>{x.name}</span>
      {s && <span className="tabular text-[10px] font-semibold" style={{ color: c }}>{s.maturity.toFixed(1)}</span>}
    </div>
  )
}

function L2Tile({ c, rag, showL3, showBase, onPick }: { c: CapRow; rag: boolean; showL3: boolean; showBase: boolean; onPick: (c: CapRow) => void }) {
  const disc = c.basis === 'discovery'
  const r = c.discovery.rollup
  const col = disc && c.band ? (rag ? bandColor(c.band) : NAVY) : SLATE_LIGHT
  return (
    <button onClick={() => onPick(c)}
      className={cn('flex flex-col rounded-md border border-l-[3px] bg-card px-2 py-1.5 text-left transition-all hover:-translate-y-px hover:shadow-md', !disc && 'border-dashed')}
      style={{ borderLeftColor: col, borderLeftStyle: 'solid', background: rag && disc && c.band ? tint(col, 0.07) : undefined, outline: rag && disc && c.is_gap ? `1.5px solid ${tint(BAND.critical, 0.6)}` : undefined, outlineOffset: -1 }}>
      <span className="flex items-start gap-1.5">
        <span className="min-w-0 flex-1 text-[11.5px] leading-[14px] font-semibold">{c.name}</span>
        {disc && c.maturity !== null
          ? <span className="tabular text-[12px] font-bold" style={{ color: rag ? col : NAVY }}>{c.maturity.toFixed(1)}</span>
          : showBase && c.maturity !== null
            ? <span className="tabular rounded border border-dashed px-1 text-[10.5px] text-muted-foreground italic" title="Assumed baseline, not yet discovered">{c.maturity.toFixed(1)}</span>
            : null}
      </span>
      <span className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground">
        {c.id}
        {disc && c.is_gap && <span className="font-semibold" style={{ color: BAND.critical }}>gap</span>}
        {c.focus && <span className="rounded bg-navy px-1 font-bold text-white">{c.focus}</span>}
      </span>
      {!disc && (
        <span className="mt-1 flex items-center gap-1.5">
          <span className="flex h-1 flex-1 overflow-hidden rounded-full bg-muted"><span style={{ width: `${(r.responded / Math.max(1, r.l3)) * 100}%`, background: DISC_STATUS.responded.color }} /></span>
          <span className="text-[9.5px] whitespace-nowrap text-muted-foreground">{r.responded ? `${r.responded}/${r.l3} L3 in · not analysed` : 'Awaiting discovery'}</span>
        </span>
      )}
      {showL3 && c.l3.length > 0 && <span className="mt-1 border-t border-dashed pt-1">{c.l3.map((x) => <L3Line key={x.id} x={x} rag={rag} />)}</span>}
    </button>
  )
}

export function ProcessMaturity({ b, onPick }: { b: Business; onPick: (c: CapRow) => void }) {
  const [rag, setRag] = useState(true)
  const [showL3, setShowL3] = useState(true)
  const showBase = false  // scores come from discovery only; no assumed baseline is shown
  const l2s = allL2(b)
  const nDisc = l2s.filter((c) => c.basis === 'discovery').length
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-[11.5px]">
        <label className="flex items-center gap-2 font-medium"><Switch checked={rag} onCheckedChange={setRag} /> Red / amber / green</label>
        <label className="flex items-center gap-2 font-medium"><Switch checked={showL3} onCheckedChange={setShowL3} /> Show L3 processes</label>
        <span className="ml-auto flex items-center gap-3 text-muted-foreground">
          {rag && (Object.keys(BAND) as Band[]).map((k) => <span key={k} className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ background: BAND[k] }} />{BAND_LABEL[k]}</span>)}
          {rag && <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ outline: `1.5px solid ${BAND.critical}` }} />Gap</span>}
          <span className="flex items-center gap-1"><span className="h-2.5 w-3.5 rounded-sm border border-dashed" style={{ borderColor: SLATE }} />Not yet scored</span>
        </span>
      </div>
      <p className="text-[11.5px] text-muted-foreground">
        A score appears only once an L2's L3 questionnaires are answered and analysed ({nDisc} of {l2s.length} L2 so far). L1 scores average the analysed L2s.      </p>
      {b.l0.map((l0) => {
        const l1s = b.l1.filter((l) => l.l0 === l0.id)
        return (
          <div key={l0.id} className="grid grid-cols-[34px_minmax(0,1fr)] gap-2">
            <div className="flex items-center justify-center rounded-md bg-navy">
              <span className="text-[11px] font-semibold whitespace-nowrap text-white" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{l0.name}</span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: l1s.map((l) => `minmax(0, ${Math.max(1, l.children.length)}fr)`).join(' ') }}>
              {l1s.map((l1) => {
                const d = l1.children.filter((c) => c.basis === 'discovery')
                const m = d.length ? d.reduce((s, c) => s + (c.maturity ?? 0), 0) / d.length : null
                return (
                  <div key={l1.id} className="rounded-lg border bg-muted/35 p-1.5">
                    <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                      <span className="text-[10px] font-bold text-navy">{l1.id}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold" title={l1.name}>{l1.name}</span>
                      <span className="text-[9.5px] text-muted-foreground">{d.length}/{l1.children.length} scored</span>
                      {m !== null && <ScoreChip v={m} size="sm" />}
                    </div>
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${showL3 ? 168 : 132}px, 1fr))` }}>
                      {l1.children.map((c) => <L2Tile key={c.id} c={c} rag={rag} showL3={showL3} showBase={showBase} onPick={onPick} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- shared quadrant chart
interface Pt { id: string; x: number; y: number; r: number; color: string; label: string; title: string; sub: string; hollow?: boolean; onClick?: () => void }

/** Spreads points that share a position on a small ring so every bubble stays clickable. */
function spread<T extends { x: number; y: number }>(pts: T[], sx: number, sy: number): (T & { px: number; py: number })[] {
  const groups: Record<string, T[]> = {}
  pts.forEach((p) => { (groups[`${p.x.toFixed(2)}|${p.y.toFixed(2)}`] ??= []).push(p) })
  return Object.values(groups).flatMap((g) => g.map((p, i) => {
    if (g.length === 1) return { ...p, px: sx * p.x, py: sy * p.y }
    const ring = i === 0 ? 0 : i <= 6 ? 13 : 24
    const k = i === 0 ? 0 : i <= 6 ? i - 1 : i - 7
    const n = i <= 6 ? Math.min(6, g.length - 1) : Math.max(1, g.length - 7)
    const t = (k / n) * Math.PI * 2 - Math.PI / 2
    return { ...p, px: sx * p.x + ring * Math.cos(t), py: sy * p.y + ring * Math.sin(t) }
  }))
}

function QuadChart({ pts, xLabel, yLabel, xDomain, yDomain = [0, 5], xSplit, ySplit, quads, height = 430 }: {
  pts: Pt[]; xLabel: string; yLabel: string; xDomain: [number, number]; yDomain?: [number, number]; xSplit: number; ySplit: number
  quads: { tl: Q; tr: Q; bl: Q; br: Q }; height?: number
}) {
  const [hover, setHover] = useState<string | null>(null)
  const W = 760, H = height, L = 48, R = 18, T = 22, B = 40
  const iw = W - L - R, ih = H - T - B
  const X = (v: number) => L + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * iw
  const Y = (v: number) => T + ih - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * ih
  const xs = X(xSplit), ys = Y(ySplit)
  // spread overlapping points, then keep every bubble fully inside the plot area (values at 0 or 5 sit on the edge)
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const size: Record<string, number> = {}
  pts.forEach((p) => { const k = `${p.x.toFixed(2)}|${p.y.toFixed(2)}`; size[k] = (size[k] ?? 0) + 1 })
  const inset = (p: Pt) => { const n = size[`${p.x.toFixed(2)}|${p.y.toFixed(2)}`]; return p.r + 3 + (n > 7 ? 24 : n > 1 ? 13 : 0) }
  const placed = spread(pts.map((p) => {
    const m = inset(p)
    return { ...p, x: clamp(X(p.x), L + m, L + iw - m), y: clamp(Y(p.y), T + m, T + ih - m) }
  }), 1, 1)
    .map((p) => ({ ...p, px: clamp(p.px, L + p.r + 3, L + iw - p.r - 3), py: clamp(p.py, T + p.r + 3, T + ih - p.r - 3) }))
  const hv = placed.find((p) => p.id === hover)
  const Quad = ({ x, y, w, h, q, anchor }: { x: number; y: number; w: number; h: number; q: Q; anchor: 'tl' | 'tr' | 'bl' | 'br' }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={tint(q.color, 0.07)} />
      <text x={anchor.endsWith('l') ? x + 10 : x + w - 10} y={anchor.startsWith('t') ? y + 20 : y + h - 22} textAnchor={anchor.endsWith('l') ? 'start' : 'end'}
        fontSize={13} fontWeight={700} fill={q.color} opacity={0.9}>{q.label}</text>
      <text x={anchor.endsWith('l') ? x + 10 : x + w - 10} y={anchor.startsWith('t') ? y + 34 : y + h - 8} textAnchor={anchor.endsWith('l') ? 'start' : 'end'}
        fontSize={10} fill={SLATE}>{q.sub}</text>
    </g>
  )
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        <Quad x={L} y={T} w={xs - L} h={ys - T} q={quads.tl} anchor="tl" />
        <Quad x={xs} y={T} w={L + iw - xs} h={ys - T} q={quads.tr} anchor="tr" />
        <Quad x={L} y={ys} w={xs - L} h={T + ih - ys} q={quads.bl} anchor="bl" />
        <Quad x={xs} y={ys} w={L + iw - xs} h={T + ih - ys} q={quads.br} anchor="br" />
        {Array.from({ length: yDomain[1] - yDomain[0] + 1 }, (_, i) => yDomain[0] + i).map((v) => <g key={`y${v}`}><line x1={L} x2={L + iw} y1={Y(v)} y2={Y(v)} stroke={GRID} strokeDasharray="2 4" /><text x={L - 8} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={SLATE}>{v}</text></g>)}
        {Array.from({ length: Math.floor(xDomain[1]) - Math.ceil(xDomain[0]) + 1 }, (_, i) => Math.ceil(xDomain[0]) + i).map((v) => (
          <g key={`x${v}`}><line x1={X(v)} x2={X(v)} y1={T} y2={T + ih} stroke={GRID} strokeDasharray="2 4" /><text x={X(v)} y={T + ih + 16} textAnchor="middle" fontSize={11} fill={SLATE}>{v}</text></g>
        ))}
        <line x1={xs} x2={xs} y1={T} y2={T + ih} stroke={SLATE} strokeWidth={1.2} strokeDasharray="5 4" />
        <line x1={L} x2={L + iw} y1={ys} y2={ys} stroke={SLATE} strokeWidth={1.2} strokeDasharray="5 4" />
        <text x={L + iw / 2} y={H - 4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={SLATE}>{xLabel}</text>
        <text x={12} y={T + ih / 2} textAnchor="middle" fontSize={11.5} fontWeight={600} fill={SLATE} transform={`rotate(-90 12 ${T + ih / 2})`}>{yLabel}</text>
        {placed.map((p) => (
          <g key={p.id} className="cursor-pointer" onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onClick={p.onClick}>
            <circle cx={p.px} cy={p.py} r={p.r + (hover === p.id ? 2 : 0)} fill={p.hollow ? 'white' : p.color} fillOpacity={hover && hover !== p.id ? 0.35 : p.hollow ? 1 : 0.88}
              stroke={p.hollow ? p.color : 'white'} strokeWidth={p.hollow ? 2 : 1.5} strokeDasharray={p.hollow ? '3 2' : undefined} strokeOpacity={hover && hover !== p.id ? 0.4 : 1} />
            {p.r >= 9 && <text x={p.px} y={p.py + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill="white" pointerEvents="none">{p.label}</text>}
          </g>
        ))}
      </svg>
      {hv && (
        <div className="pointer-events-none absolute z-10 w-64 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(hv.px / W) * 100}%`, top: (hv.py / H) * height, transform: `translate(${hv.px > W * 0.6 ? 'calc(-100% - 14px)' : '14px'}, -50%)` }}>
          <div className="font-semibold">{hv.title}</div>
          <div className="text-muted-foreground">{hv.sub}</div>
        </div>
      )}
    </div>
  )
}
interface Q { label: string; sub: string; color: string }

// ---------------------------------------------------------------- business criticality x maturity (equal quadrants)
type Zone = 'fix' | 'sustain' | 'run' | 'monitor'
function zone(c: CapRow, sp: number): Zone {
  const hi = (c.importance ?? 0) >= sp
  const m = c.maturity ?? 0
  if (hi) return m < sp ? 'fix' : 'sustain'
  return m < sp ? 'monitor' : 'run'
}

export function Matrix({ b, onPick }: { b: Business; onPick: (c: CapRow) => void }) {
  const all = allL2(b)
  const rows = all.filter((c) => c.basis === 'discovery' && c.maturity !== null && c.importance !== null)
  const sp = b.thresholds.quadrant_split
  const pts: Pt[] = rows.map((c) => ({
    id: c.id, x: c.maturity!, y: c.importance!, r: 8, color: bandColor(c.band ?? ''), label: '',
    title: `${c.id} ${c.name}`, sub: `${c.l1} · maturity ${c.maturity!.toFixed(2)} · business criticality ${c.importance}`,
    onClick: () => onPick(c),
  }))
  const by = useMemo(() => {
    const m: Record<string, CapRow[]> = {}
    rows.forEach((c) => (m[zone(c, sp)] ??= []).push(c))
    Object.values(m).forEach((v) => v.sort((a, z) => (z.importance! - a.importance!) || (a.maturity! - z.maturity!)))
    return m
  }, [rows, sp])
  if (!rows.length) return <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No capability is fully discovered yet. Capabilities appear here once their L3 questionnaires are answered and analysed.</p>
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4">
      <div className="rounded-lg border p-2">
        <QuadChart pts={pts} xLabel="Maturity (mean of process, technology & AI, data, integration)" yLabel="Business criticality" xDomain={[0, 5]}
          xSplit={sp} ySplit={sp}
          quads={{ tl: { ...MATRIX.fix, sub: `${by.fix?.length ?? 0} capabilities` }, tr: { ...MATRIX.sustain, sub: `${by.sustain?.length ?? 0} capabilities` },
            bl: { ...MATRIX.monitor, sub: `${by.monitor?.length ?? 0} capabilities` }, br: { ...MATRIX.run, sub: `${by.run?.length ?? 0} capabilities` } }} />
        <div className="flex items-center gap-4 px-2 pb-1 text-[11px] text-muted-foreground">
          {(Object.keys(BAND) as Band[]).map((k) => <span key={k} className="flex items-center gap-1"><span className="size-2.5 rounded-full" style={{ background: BAND[k] }} />{BAND_LABEL[k]}</span>)}
          <span>Equal quadrants split at {sp} on both scales · {rows.length} of {all.length} L2 fully discovered</span>
          <span className="ml-auto">Click a bubble for the capability</span>
        </div>
      </div>
      <div className="scrollbar-thin max-h-[480px] space-y-2 overflow-y-auto">
        {(['fix', 'sustain', 'run', 'monitor'] as const).map((k) => (
          <div key={k} className="rounded-lg border">
            <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ background: tint(MATRIX[k].color, 0.08) }}>
              <span className="size-2.5 rounded-full" style={{ background: MATRIX[k].color }} />
              <span className="text-[12.5px] font-semibold" style={{ color: MATRIX[k].color }}>{MATRIX[k].label}</span>
              <span className="text-[10.5px] text-muted-foreground">{MATRIX[k].sub}</span>
              <span className="tabular ml-auto text-[13px] font-bold">{by[k]?.length ?? 0}</span>
            </div>
            <div className="px-1.5 py-1">
              {(by[k] ?? []).slice(0, k === 'fix' ? 8 : 5).map((c) => (
                <button key={c.id} onClick={() => onPick(c)} className="flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-[11.5px] hover:bg-muted/50">
                  <span className="w-11 shrink-0 text-[10px] text-muted-foreground">{c.id}</span><span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <ScoreChip v={c.maturity} band={c.band} size="sm" />
                </button>
              ))}
              {(by[k]?.length ?? 0) > (k === 'fix' ? 8 : 5) && <div className="px-1.5 text-[10.5px] text-muted-foreground">+{by[k].length - (k === 'fix' ? 8 : 5)} more</div>}
              {!by[k]?.length && <div className="px-1.5 py-0.5 text-[11px] text-muted-foreground">None</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- business-IT alignment (L3 evidence)
const PART_SHORT: Record<string, string> = { 'System fit': 'Fit', 'Business-IT partnering': 'Partnering', 'Information & reporting': 'Reporting', 'Responsiveness to change': 'Change', 'User adoption': 'Adoption' }

/** The five alignment answers as mini bars (averaged when several L3s are passed). */
function Parts({ xs }: { xs: L3Row[] }) {
  const acc: Record<string, number[]> = {}
  xs.forEach((x) => x.score?.alignment_parts.forEach((p) => (acc[p.label] ??= []).push(p.value)))
  const rows = Object.entries(acc).map(([k, v]) => [k, v.reduce((s, n) => s + n, 0) / v.length] as const)
  return (
    <span className="grid grid-cols-5 gap-1" title={rows.map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')}>
      {rows.map(([k, v]) => {
        const c = v >= 3.5 ? BAND.strong : v >= 2.5 ? BAND.developing : v >= 1.5 ? BAND.weak : BAND.critical
        return (
          <span key={k} className="flex flex-col items-center gap-0.5">
            <span className="relative h-6 w-2.5 overflow-hidden rounded-sm bg-muted"><span className="absolute inset-x-0 bottom-0 rounded-sm" style={{ height: `${(v / 5) * 100}%`, background: c }} /></span>
            <span className="text-[8.5px] leading-none text-muted-foreground">{PART_SHORT[k] ?? k}</span>
          </span>
        )
      })}
    </span>
  )
}

export function AlignmentView({ b, onPick }: { b: Business; onPick: (c: CapRow) => void }) {
  const l2s = allL2(b)
  const l3s = l2s.flatMap((c) => c.l3.map((x) => ({ x, c }))).filter(({ x }) => x.score?.alignment !== null && x.score?.alignment !== undefined)
  const th = b.thresholds
  const pts: Pt[] = l3s.map(({ x, c }) => ({
    id: x.id, x: x.score!.alignment!, y: x.score!.importance ?? 3, r: 7, color: QUADRANT[x.quadrant!.key].color, label: '',
    title: `${x.id} ${x.name}`, sub: `${c.name} · alignment ${x.score!.alignment} (${x.score!.alignment_parts.map((p) => p.value).join(' + ')}) · business criticality ${x.score!.importance} · ${x.quadrant!.label}`,
    onClick: () => onPick(c),
  }))
  const qc = (k: keyof typeof QUADRANT) => l3s.filter(({ x }) => x.quadrant?.key === k)
  const withEv = l2s.filter((c) => c.discovery.inference.alignment !== null)
  const sp = th.quadrant_split
  if (!l3s.length) return <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No discovery responses yet. Alignment comes from the five business–IT alignment questions in each L3 questionnaire.</p>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4">
        <div className="rounded-lg border p-2">
          <QuadChart pts={pts} height={380} xLabel="IT support: mean of the five business–IT alignment answers (L3)" yLabel="Business criticality" xDomain={[0, 5]}
            xSplit={sp} ySplit={sp}
            quads={{ tl: { label: QUADRANT.underserved.label, sub: 'Business need outruns IT: invest', color: QUADRANT.underserved.color },
              tr: { label: QUADRANT.aligned.label, sub: 'Sustain and scale', color: QUADRANT.aligned.color },
              bl: { label: QUADRANT.low.label, sub: 'Monitor', color: QUADRANT.low.color },
              br: { label: QUADRANT.overserved.label, sub: 'IT ahead of need: rationalise', color: QUADRANT.overserved.color } }} />
          <div className="px-2 pb-1 text-[11px] text-muted-foreground">Each dot is a surveyed L3 process. {l2s.reduce((s, c) => s + c.l3.length, 0) - l3s.length} L3 still awaiting discovery.</div>
        </div>
        <div className="space-y-2">
          {(['underserved', 'aligned', 'overserved', 'low'] as const).map((k) => {
            const xs = qc(k)
            return (
              <div key={k} className="rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: QUADRANT[k].color }} />
                  <span className="text-[12.5px] font-semibold" style={{ color: QUADRANT[k].color }}>{QUADRANT[k].label}</span>
                  <span className="text-[10.5px] text-muted-foreground">{QUADRANT[k].action}</span>
                  <span className="tabular ml-auto text-[18px] font-bold">{xs.length}</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {xs.slice(0, 3).map(({ x }) => <div key={x.id} className="truncate text-[11px] text-muted-foreground" title={x.name}>{x.name} · {x.score!.alignment!.toFixed(1)}</div>)}
                  {xs.length > 3 && <div className="text-[10.5px] text-muted-foreground">+{xs.length - 3} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[minmax(0,1fr)_150px_170px_minmax(0,1fr)] gap-3 border-b bg-muted/40 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          <span>L1 › L2 › L3</span><span>Alignment</span><span>Fit · Partnering · Reporting · Change · Adoption</span><span>IT Support (Applications)</span>
        </div>
        {b.l1.map((l1) => {
          const ev = l1.children.filter((c) => c.discovery.inference.alignment !== null)
          if (!ev.length) return null
          return (
            <div key={l1.id}>
              <div className="flex items-center gap-2 border-b bg-navy-soft/40 px-3 py-1 text-[11.5px] font-semibold text-navy">{l1.id} · {l1.name}
                <span className="ml-auto text-[10.5px] font-normal text-muted-foreground">{ev.length} of {l1.children.length} L2 with evidence</span></div>
              {ev.map((c) => {
                const xs = c.l3.filter((x) => x.score?.alignment !== null && x.score?.alignment !== undefined)
                const a = c.discovery.inference.alignment!
                const key = (c.importance ?? 0) >= sp ? (a >= sp ? 'aligned' : 'underserved') : a >= sp ? 'overserved' : 'low'
                return (
                  <div key={c.id} className="border-b last:border-0">
                    <button onClick={() => onPick(c)} className="grid w-full grid-cols-[minmax(0,1fr)_150px_170px_minmax(0,1fr)] items-center gap-3 px-3 py-1.5 text-left hover:bg-muted/30">
                      <span className="min-w-0"><span className="text-[10.5px] text-muted-foreground">{c.id}</span> <span className="text-[12.5px] font-semibold">{c.name}</span></span>
                      <span className="flex items-center gap-2">
                        <span className="tabular text-[15px] font-bold" style={{ color: QUADRANT[key].color }}>{a.toFixed(2)}</span>
                        <span className="rounded-full px-1.5 py-px text-[10px] font-semibold" style={{ color: QUADRANT[key].color, background: tint(QUADRANT[key].color, 0.12) }}>{QUADRANT[key].label}</span>
                      </span>
                      <Parts xs={xs} />
                      <span className="flex flex-wrap gap-1">{c.apps.length ? c.apps.map((ap) => <AppChip key={ap.id} a={ap} />) : <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: BAND.weak }}><AlertTriangle className="size-3" /> No application support</span>}</span>
                    </button>
                    {xs.map((x) => (
                      <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_150px_170px_minmax(0,1fr)] items-center gap-3 py-1 pr-3 pl-9 text-[11.5px]">
                        <span className="truncate text-muted-foreground">{x.name}</span>
                        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: QUADRANT[x.quadrant!.key].color }} /><span className="tabular font-semibold">{x.score!.alignment!.toFixed(1)}</span><span className="text-[10px] text-muted-foreground">crit. {x.score!.importance}</span></span>
                        <Parts xs={[x]} />

                        <span className="truncate text-[10.5px] text-muted-foreground">{(x.survey?.answers.systems as { other?: string } | undefined)?.other || ''}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )
        })}
        <div className="bg-muted/25 px-3 py-1.5 text-[11px] text-muted-foreground">{l2s.length - withEv.length} L2 capabilities have no alignment evidence yet; they appear here as their L3 questionnaires come back.</div>
      </div>
    </div>
  )
}

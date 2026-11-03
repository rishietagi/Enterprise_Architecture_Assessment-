import { useState } from 'react'
import type { Overview } from '@/lib/api'
import { ADM_STATUS, SLATE, SLATE_LIGHT, NAVY, tint } from '@/lib/theme'

const SHORT: Record<string, [string, string]> = {
  PRELIM: ['P', 'Preliminary'], A: ['A', 'Vision'], B: ['B', 'Business'], C: ['C', 'Info Systems'], D: ['D', 'Technology'],
  E: ['E', 'Opportunities'], F: ['F', 'Migration'], G: ['G', 'Governance'], H: ['H', 'Change'],
}
const RING = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const CX = 200
const CY = 252
const R = 128
const NODE = 37

interface Props {
  nodes: Overview['adm']
  onSelect: (screen: string) => void
}

export function AdmWheel({ nodes, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const by = Object.fromEntries(nodes.map((n) => [n.phase, n]))
  const pos = (i: number) => {
    const a = (-90 + i * 45) * (Math.PI / 180)
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }
  }
  const arrow = (i: number) => {
    const a = (-90 + i * 45 + 22.5) * (Math.PI / 180)
    const x = CX + R * Math.cos(a)
    const y = CY + R * Math.sin(a)
    const deg = -90 + i * 45 + 22.5 + 90
    return <path key={`ar${i}`} d="M -5 -4 L 3 0 L -5 4 z" fill={SLATE_LIGHT} transform={`translate(${x} ${y}) rotate(${deg})`} />
  }
  const hovered = hover ? by[hover] : null

  const Node = ({ phase, x, y, r }: { phase: string; x: number; y: number; r: number }) => {
    const n = by[phase]
    if (!n) return null
    const st = ADM_STATUS[n.status]
    const [letter, label] = SHORT[phase]
    const active = hover === phase
    return (
      <g
        role="button"
        tabIndex={0}
        aria-label={`${n.label}: ${st.label}`}
        className="cursor-pointer outline-none"
        onMouseEnter={() => setHover(phase)}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover(phase)}
        onBlur={() => setHover(null)}
        onClick={() => onSelect(n.screen)}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(n.screen)}
      >
        <circle cx={x} cy={y} r={r + (active ? 3 : 0)} fill={active ? tint(st.color, 0.22) : tint(st.color, 0.12)}
          stroke={st.color} strokeWidth={active ? 2.5 : 1.75} style={{ transition: 'all 150ms ease' }} />
        <text x={x} y={y - 3} textAnchor="middle" fontSize={r > 34 ? 20 : 17} fontWeight={700} fill={NAVY}>{letter}</text>
        <text x={x} y={y + 14} textAnchor="middle" fontSize={9.5} fontWeight={500} fill={SLATE}>{label}</text>
      </g>
    )
  }

  return (
    <div className="relative">
      <svg viewBox="0 0 400 425" className="h-full w-full" role="img" aria-label="TOGAF ADM cycle">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={SLATE_LIGHT} strokeWidth={2} />
        {RING.map((_, i) => arrow(i))}
        {RING.map((p, i) => {
          const { x, y } = pos(i)
          const dx = x - CX
          const dy = y - CY
          const d = Math.hypot(dx, dy)
          return (
            <line key={`sp${p}`} x1={CX + (dx / d) * 52} y1={CY + (dy / d) * 52} x2={x - (dx / d) * (NODE + 2)}
              y2={y - (dy / d) * (NODE + 2)} stroke={SLATE_LIGHT} strokeWidth={1} strokeDasharray="3 3" />
          )
        })}
        <line x1={CX} y1={70} x2={CX} y2={CY - R - NODE - 1} stroke={SLATE_LIGHT} strokeWidth={2} />
        {/* Requirements Management centre */}
        {by.REQ && (() => {
          const st = ADM_STATUS[by.REQ.status]
          const active = hover === 'REQ'
          return (
            <g role="button" tabIndex={0} className="cursor-pointer outline-none" aria-label="Requirements Management"
              onMouseEnter={() => setHover('REQ')} onMouseLeave={() => setHover(null)} onClick={() => onSelect(by.REQ.screen)}>
              <circle cx={CX} cy={CY} r={50 + (active ? 3 : 0)} fill={active ? tint(st.color, 0.22) : tint(st.color, 0.1)}
                stroke={st.color} strokeWidth={active ? 2.5 : 1.75} style={{ transition: 'all 150ms ease' }} />
              <text x={CX} y={CY - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={NAVY}>Requirements</text>
              <text x={CX} y={CY + 10} textAnchor="middle" fontSize={11} fontWeight={700} fill={NAVY}>Management</text>
            </g>
          )
        })()}
        <Node phase="PRELIM" x={CX} y={40} r={31} />
        {RING.map((p, i) => {
          const { x, y } = pos(i)
          return <Node key={p} phase={p} x={x} y={y} r={NODE} />
        })}
      </svg>
      <div className="pointer-events-none absolute top-1 left-1 min-h-9 text-xs">
        {hovered && (
          <div className="rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
            <div className="font-semibold text-foreground">{hovered.label}</div>
            <div style={{ color: ADM_STATUS[hovered.status].color }}>{ADM_STATUS[hovered.status].label}</div>
            <div className="max-w-52 text-muted-foreground">{hovered.explain.lines[0]?.value}</div>
            <div className="max-w-52 text-[10.5px] text-muted-foreground/80">{hovered.explain.rule}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function AdmLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {Object.entries(ADM_STATUS).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-[1.5px]" style={{ borderColor: v.color, background: tint(v.color, 0.15) }} />
          {v.label}
        </span>
      ))}
    </div>
  )
}

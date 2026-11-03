import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NAVY, SLATE, SLATE_LIGHT, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

export interface FNode {
  id: string
  label: string
  sub?: ReactNode
  color?: string
  badge?: ReactNode
  dashed?: boolean
  title?: string
}

export interface FEdge {
  from: string
  to: string
  color?: string
  dashed?: boolean
  title?: string
  width?: number
}

interface Props {
  columns: { key: string; title: ReactNode; nodes: FNode[] }[]
  edges: FEdge[]
  nodeH?: number
  gap?: number
  className?: string
  selected?: string | null
  onSelect?: (id: string | null) => void
  minHeight?: number
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Column flow diagram: HTML node boxes over an SVG edge layer. Hover or select a node to trace its edges. */
export function FlowDiagram({ columns, edges, nodeH = 36, gap = 8, className, selected, onSelect, minHeight = 0 }: Props) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState<string | null>(null)
  const focus = hover ?? selected ?? null
  const head = 28
  const n = columns.length
  const colGap = n > 1 ? Math.max(40, Math.min(110, width * 0.07)) : 0
  const colW = n ? (width - colGap * (n - 1)) / n : 0
  const pos = useMemo(() => {
    const p: Record<string, { x: number; y: number; col: number }> = {}
    columns.forEach((c, i) => c.nodes.forEach((nd, j) => { p[nd.id] = { x: i * (colW + colGap), y: head + j * (nodeH + gap), col: i } }))
    return p
  }, [columns, colW, colGap, nodeH, gap])
  const height = Math.max(minHeight, head + Math.max(0, ...columns.map((c) => c.nodes.length)) * (nodeH + gap))
  const linked = useMemo(() => {
    if (!focus) return null
    const s = new Set([focus])
    edges.forEach((e) => { if (e.from === focus) s.add(e.to); if (e.to === focus) s.add(e.from) })
    return s
  }, [focus, edges])

  const path = (e: FEdge) => {
    const a = pos[e.from], b = pos[e.to]
    if (!a || !b) return null
    const ya = a.y + nodeH / 2, yb = b.y + nodeH / 2
    if (a.col === b.col) {
      const x = a.x + colW
      const bulge = 26 + Math.abs(yb - ya) * 0.15
      return `M ${x} ${ya} C ${x + bulge} ${ya}, ${x + bulge} ${yb}, ${x} ${yb}`
    }
    const fwd = a.col < b.col
    const x1 = fwd ? a.x + colW : a.x, x2 = fwd ? b.x : b.x + colW
    const dx = Math.abs(x2 - x1) * 0.5
    return `M ${x1} ${ya} C ${x1 + (fwd ? dx : -dx)} ${ya}, ${x2 + (fwd ? -dx : dx)} ${yb}, ${x2} ${yb}`
  }

  return (
    <div ref={ref} className={cn('relative w-full', className)} style={{ height }}>
      {width > 0 && (
        <>
          <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
            {edges.map((e, i) => {
              const d = path(e)
              if (!d) return null
              const on = !focus || e.from === focus || e.to === focus
              return (
                <path key={i} d={d} fill="none" stroke={e.color ?? SLATE} strokeWidth={(e.width ?? 1.4) * (focus && on ? 1.6 : 1)}
                  strokeDasharray={e.dashed ? '4 3' : undefined} opacity={on ? (focus ? 0.95 : 0.55) : 0.07}>
                  {e.title && <title>{e.title}</title>}
                </path>
              )
            })}
          </svg>
          {columns.map((c, i) => (
            <div key={c.key} className="absolute top-0 truncate text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase"
              style={{ left: i * (colW + colGap), width: colW }}>{c.title}</div>
          ))}
          {columns.flatMap((c) => c.nodes).map((nd) => {
            const p = pos[nd.id]
            if (!p) return null
            const dim = linked && !linked.has(nd.id)
            const col = nd.color ?? NAVY
            return (
              <button key={nd.id} title={nd.title ?? nd.label}
                onMouseEnter={() => setHover(nd.id)} onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(selected === nd.id ? null : nd.id)}
                className={cn('absolute flex items-center gap-1.5 overflow-hidden rounded-md border border-l-[3px] bg-card px-2 text-left shadow-xs transition-opacity',
                  dim && 'opacity-30', (selected === nd.id) && 'ring-2 ring-navy/40')}
                style={{ left: p.x, top: p.y, width: colW, height: nodeH, borderLeftColor: col, borderStyle: nd.dashed ? 'dashed' : undefined,
                  background: selected === nd.id ? tint(col, 0.08) : undefined }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] leading-tight font-medium text-foreground">{nd.label}</span>
                  {nd.sub && <span className="block truncate text-[10px] leading-tight text-muted-foreground">{nd.sub}</span>}
                </span>
                {nd.badge}
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.line
            ? <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? '4 3' : undefined} /></svg>
            : <span className="size-2.5 rounded-sm" style={{ background: i.color, outline: i.dashed ? `1px dashed ${SLATE_LIGHT}` : undefined }} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

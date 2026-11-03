import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Business, CapRow, DiscStatus, L3Row } from '@/lib/api'
import { BAND, DISC_STATUS, SLATE, SLATE_LIGHT, bandColor, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

export const DIMS = [
  { key: 'P', short: 'P', label: 'Process' },
  { key: 'T', short: 'T', label: 'Technology & AI' },
  { key: 'D', short: 'D', label: 'Data' },
  { key: 'I', short: 'I', label: 'Integration' },
] as const

export function bandOf(m: number | null | undefined, bands: Business['bands']): string | null {
  if (m === null || m === undefined) return null
  return bands.find(([lo, hi]) => m >= lo && m < hi)?.[2] ?? bands[bands.length - 1][2]
}

export function StatusPill({ s, small }: { s: DiscStatus; small?: boolean }) {
  const d = DISC_STATUS[s]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap', small ? 'h-[18px] px-1.5 text-[10px]' : 'h-5 px-2 text-[11px]')}
      style={{ color: s === 'not_generated' ? SLATE : d.color, background: tint(d.color, s === 'not_generated' ? 0.25 : 0.12) }}>
      <span className="size-1.5 rounded-full" style={{ background: d.color }} />{d.label}
    </span>
  )
}

/** Score 1-5 in a band-coloured chip; '–' when missing. */
export function ScoreChip({ v, band, size = 'md', title }: { v: number | null | undefined; band?: string | null; size?: 'sm' | 'md' | 'lg'; title?: string }) {
  if (v === null || v === undefined) return <span className="text-[11px] text-muted-foreground">–</span>
  const c = band ? bandColor(band) : v >= 3.5 ? BAND.strong : v >= 2.5 ? BAND.developing : v >= 1.5 ? BAND.weak : BAND.critical
  const cls = size === 'lg' ? 'h-7 min-w-9 text-[15px]' : size === 'sm' ? 'h-[18px] min-w-6 text-[10.5px]' : 'h-6 min-w-7 text-[12px]'
  return (
    <span title={title} className={cn('tabular inline-flex items-center justify-center rounded-md px-1 font-bold', cls)} style={{ color: c, background: tint(c, 0.13) }}>
      {Number.isInteger(v) ? v : v.toFixed(size === 'lg' ? 2 : 1)}
    </span>
  )
}

/** Stacked progress bar of survey statuses. */
export function PipelineBar({ r, className }: { r: { l3: number } & Record<DiscStatus, number>; className?: string }) {
  const order: DiscStatus[] = ['responded', 'walkthrough', 'redirected', 'sent', 'draft', 'not_generated']
  return (
    <div className={cn('flex h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      {order.map((k) => r[k] > 0 && (
        <span key={k} title={`${DISC_STATUS[k].label}: ${r[k]}`} style={{ width: `${(r[k] / Math.max(1, r.l3)) * 100}%`, background: k === 'not_generated' ? SLATE_LIGHT : DISC_STATUS[k].color }} />
      ))}
    </div>
  )
}

export function DimBars({ q, compact }: { q: number[] | null; compact?: boolean }) {
  if (!q) return <span className="text-[11px] text-muted-foreground">–</span>
  return (
    <span className={cn('inline-flex items-end gap-[3px]', compact ? 'h-4' : 'h-5')} title={DIMS.map((d, i) => `${d.label} ${q[i]}`).join(' · ')}>
      {q.map((v, i) => {
        const c = v >= 4 ? BAND.strong : v >= 3 ? BAND.developing : v >= 2 ? BAND.weak : BAND.critical
        return <span key={i} className="w-[5px] rounded-sm" style={{ height: `${(v / 5) * 100}%`, background: c }} />
      })}
    </span>
  )
}

export function Caret({ open }: { open: boolean }) {
  return <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
}

export function Stat({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="tabular text-[15px] leading-tight font-semibold" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="truncate text-[10.5px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function allL2(b: Business): CapRow[] {
  return b.l1.flatMap((l) => l.children)
}

export function allL3(b: Business): L3Row[] {
  return allL2(b).flatMap((c) => c.l3)
}

export function answerLabel(q: { type: string; options?: string[] }, v: unknown, apps: Business['apps']): string {
  if (v === undefined || v === null || v === '') return ''
  if (q.type === 'choice' && typeof v === 'number') return q.options?.[v - 1] ?? String(v)
  if (q.type === 'apps' && typeof v === 'object') {
    const s = v as { apps?: string[]; other?: string }
    const names = (s.apps ?? []).map((id) => apps.find((a) => a.id === id)?.name.split(' (')[0] ?? id)
    return [...names, s.other].filter(Boolean).join('; ')
  }
  return String(v)
}

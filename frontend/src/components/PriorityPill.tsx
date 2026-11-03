import { priorityColor, tint } from '@/lib/theme'

export function PriorityPill({ p }: { p: number }) {
  const c = priorityColor(p)
  return (
    <span className="tabular inline-flex h-5 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold"
      style={{ color: c, background: tint(c, 0.12) }}>
      {p}
    </span>
  )
}

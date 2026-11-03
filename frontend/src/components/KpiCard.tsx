import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Explanation } from '@/lib/api'
import { Explain } from './Explain'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: ReactNode
  sub?: ReactNode
  accent?: string
  icon?: ReactNode
  explain?: Explanation
  className?: string
}

export function KpiCard({ label, value, sub, accent, icon, explain, className }: Props) {
  return (
    <Card className={cn('relative gap-1 px-5 py-4', className)}>
      {accent && <span className="absolute inset-y-4 left-0 w-1 rounded-r-full" style={{ background: accent }} />}
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1">{label}<Explain x={explain} /></span>
        {icon && <span className="text-muted-foreground/70 [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="tabular text-2xl font-semibold tracking-tight text-foreground">{value}</div>
      {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
    </Card>
  )
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 gap-4">{children}</div>
}

export function KpiSkeleton() {
  return (
    <KpiRow>
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="h-[94px] gap-2 px-5 py-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-32" />
        </Card>
      ))}
    </KpiRow>
  )
}

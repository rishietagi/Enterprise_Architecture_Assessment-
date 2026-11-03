import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { KpiSkeleton } from './KpiCard'

export function ScreenSkeleton() {
  return (
    <>
      <KpiSkeleton />
      <Card className="h-[480px] gap-3 p-5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-full w-full" />
      </Card>
    </>
  )
}

export function ScreenError({ error }: { error: Error }) {
  return (
    <Card className="items-center gap-1 py-16 text-center">
      <div className="text-sm font-semibold">Could not load this view</div>
      <div className="text-sm text-muted-foreground">{error.message}. Is the API running on :8000?</div>
    </Card>
  )
}

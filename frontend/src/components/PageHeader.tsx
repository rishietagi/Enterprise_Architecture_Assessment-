import type { ReactNode } from 'react'
import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import type { ScreenKey } from '@/lib/api'
import { SCREEN_BY_KEY } from '@/lib/screens'
import { useShell } from '@/lib/shell'

export function PhaseChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md bg-navy-soft px-1.5 text-[11px] font-semibold text-navy">
      {children}
    </span>
  )
}

export function PageHeader({ screen, actions }: { screen: ScreenKey; actions?: ReactNode }) {
  const meta = SCREEN_BY_KEY[screen]
  const { setCoachOpen } = useShell()
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <SidebarTrigger className="mt-1 -ml-1 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{meta.title}</h1>
            <div className="flex items-center gap-1">
              {meta.phases.map((p) => (
                <PhaseChip key={p}>{p}</PhaseChip>
              ))}
            </div>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{meta.purpose}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <Button variant="outline" size="sm" onClick={() => setCoachOpen(true)}>
          <GraduationCap /> TOGAF Coach
        </Button>
      </div>
    </header>
  )
}

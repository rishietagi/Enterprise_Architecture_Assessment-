import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** AI action for outputs the AI layer will draft in a later release.
 *  Today it refreshes the rule-based draft and says so; no AI call is made, so the 6 call types are unchanged. */
export function AiAction({ what, from, label = 'Regenerate with AI', size = 'sm', className }: {
  what: string; from: string; label?: string; size?: 'sm' | 'xs'; className?: string
}) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    await qc.invalidateQueries()
    setBusy(false)
    toast.success(`${what} refreshed from the rules`, { description: `AI drafting from ${from} is not enabled yet; the rule-based draft stays the baseline.` })
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size={size} onClick={run} disabled={busy} className={className}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles className="text-navy" />} {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">AI will draft the {what.toLowerCase()} from {from}, grounded in TOGAF with citations. Today the draft comes from the rules.</TooltipContent>
    </Tooltip>
  )
}

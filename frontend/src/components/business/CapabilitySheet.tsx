import { ArrowRight } from 'lucide-react'
import { AppChip, LadderChip } from '@/components/CapabilityModules'
import { Explain } from '@/components/Explain'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Business, CapRow } from '@/lib/api'
import { BAND, QUADRANT } from '@/lib/theme'
import { L2Scores } from './L2Scores'
import { ScoreChip, StatusPill } from './shared'

/** L2 capability assessment: scores inferred from its L3 questionnaires (with comments), L3 evidence, applications and coupling. */
export function CapabilitySheet({ cap, b, onClose, onDiscover }: { cap: CapRow | null; b: Business; onClose: () => void; onDiscover: (c: CapRow) => void }) {
  const ent = cap?.entanglement
  const name = (id: string) => b.l1.flatMap((l) => l.children).find((c) => c.id === id)?.name ?? id
  const disc = cap?.basis === 'discovery'
  return (
    <Dialog open={!!cap} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {cap && (
          <>
            <DialogHeader className="border-b px-5 py-4 text-left">
              <DialogTitle className="pr-8">{cap.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2">{cap.id} · {cap.l1}{cap.focus ? ` · ${cap.focus}` : ''}
                <span className="rounded bg-navy-soft px-1.5 text-[10.5px] font-semibold text-navy">{disc ? 'Scored from discovery' : 'Not yet scored'}</span></DialogDescription>
            </DialogHeader>
            <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {cap.description && <p className="text-[12.5px] text-muted-foreground">{cap.description}</p>}
              {disc && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg border px-3 py-2"><div className="text-[10px] font-semibold text-muted-foreground uppercase">Maturity</div><span className="flex items-center gap-1"><ScoreChip v={cap.maturity} band={cap.band} size="lg" /><Explain x={cap.explain} /></span></div>
                  <div className="rounded-lg border px-3 py-2"><div className="text-[10px] font-semibold text-muted-foreground uppercase">Business Criticality</div><div className="tabular text-[17px] font-bold text-navy">{cap.importance ?? '–'}</div></div>
                  <div className="rounded-lg border px-3 py-2"><div className="text-[10px] font-semibold text-muted-foreground uppercase">Business–IT Alignment</div><div className="tabular text-[17px] font-bold">{cap.discovery.inference.alignment?.toFixed(2) ?? '–'}</div></div>
                  <div className="rounded-lg border px-3 py-2"><div className="text-[10px] font-semibold text-muted-foreground uppercase">Technology & AI</div><div className="mt-1"><LadderChip level={cap.q?.[1]} label={cap.ai_level} /></div></div>
                </div>
              )}
              <div>
                <div className="mb-1.5 text-xs font-semibold">Assessment from Discovery</div>
                <L2Scores b={b} c={cap} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold"><span>L3 Processes ({cap.l3.length})</span><span className="font-normal text-muted-foreground">{cap.discovery.rollup.responded} answered</span></div>
                  <div className="rounded-lg border">
                    {cap.l3.map((x) => (
                      <div key={x.id} className="flex items-center gap-2 border-b px-2.5 py-1.5 text-[12px] last:border-0">
                        <span className="w-14 text-[10px] text-muted-foreground">{x.id}</span><span className="min-w-0 flex-1 truncate">{x.name}</span>
                        {x.quadrant && <span className="size-2 rounded-full" title={x.quadrant.label} style={{ background: QUADRANT[x.quadrant.key].color }} />}
                        {x.score ? <ScoreChip v={x.score.maturity} band={x.score.band} size="sm" /> : <StatusPill s={x.status} small />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1.5 text-xs font-semibold">Supporting Applications ({cap.apps.length})</div>
                    <div className="flex flex-wrap gap-1">{cap.apps.length ? cap.apps.map((a) => <AppChip key={a.id} a={a} />) : <span className="text-[12px]" style={{ color: BAND.weak }}>No application support recorded</span>}</div>
                    {cap.automation && <div className="mt-1 text-[11.5px] text-muted-foreground">Automation / tools: {cap.automation}</div>}
                  </div>
                  {ent && (
                    <div>
                      <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold">Dependencies</div>
                      <div className="text-[12px] text-muted-foreground">Depends on: {ent.upstream.map(name).join(', ') || 'none'}</div>
                      <div className="text-[12px] text-muted-foreground">Feeds: {ent.downstream.map(name).join(', ') || 'none'}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="flex-row items-center justify-between border-t px-5 py-3 sm:justify-between">
              <span className="text-[11px] text-muted-foreground">Owner: {cap.owner || 'TBC'}</span>
              <Button size="sm" onClick={() => onDiscover(cap)}>Open in Discovery <ArrowRight /></Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

import { useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Explain } from '@/components/Explain'
import { ExportMenu } from '@/components/ExportMenu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { App, Applications, HealthRow } from '@/lib/api'
import { BAND, SLATE, tint } from '@/lib/theme'

const BAND_OF: Record<string, string> = { High: BAND.critical, Medium: BAND.developing, Low: BAND.strong, SPOF: BAND.critical, Check: BAND.developing, OK: BAND.strong, 'At risk': BAND.critical, Watch: BAND.developing }
const Pill = ({ v }: { v: string | null }) => v ? <span className="rounded px-1.5 py-px text-[10.5px] font-semibold" style={{ color: BAND_OF[v] ?? SLATE, background: tint(BAND_OF[v] ?? SLATE, 0.12) }}>{v}</span> : <span className="text-muted-foreground">–</span>

/** Technical debt, single points of failure and scalability per application (RFP assessment items 4, 6 and 8). */
export function TechHealth({ a, onOpen }: { a: Applications; onOpen: (x: App) => void }) {
  const th = a.tech_health
  const [only, setOnly] = useState('issues')
  const box = useRef<HTMLDivElement>(null)
  const app = Object.fromEntries(a.apps.map((x) => [x.id, x]))
  const issue = (r: HealthRow) => r.debt_band === 'High' || r.spof_status !== 'OK' || r.scal_status !== 'OK'
  const rows = th.rows.filter((r) => r.in_scope && (only === 'all' || issue(r))).sort((x, y) => (y.debt ?? 0) - (x.debt ?? 0))
  const k = th.counts
  const kpi = 'text-[10px] font-semibold tracking-wide text-muted-foreground uppercase'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
        <div><div className={kpi}>High Technical Debt</div><div className="tabular text-[15px] font-semibold" style={{ color: BAND.critical }}>{k.high_debt}<span className="text-[11px] font-normal text-muted-foreground"> of {k.in_scope} · avg {k.avg_debt ?? '–'}/100</span></div></div>
        <div><div className={kpi}>Single Points of Failure</div><div className="tabular text-[15px] font-semibold" style={{ color: BAND.critical }}>{k.spof}<span className="text-[11px] font-normal text-muted-foreground"> · {k.spof_check} to check</span></div></div>
        <div><div className={kpi}>Scalability at Risk</div><div className="tabular text-[15px] font-semibold" style={{ color: BAND.weak }}>{k.scal_risk}<span className="text-[11px] font-normal text-muted-foreground"> at peak season</span></div></div>
        <div className="text-[11px] leading-snug text-muted-foreground">Inputs: intake fields (Technical Health section) and the L3 discovery answers on peak load, fallback and workarounds.</div>
      </div>
      <div className="flex items-center gap-2">
        <ToggleGroup type="single" value={only} onValueChange={(v) => v && setOnly(v)} variant="outline" size="sm">
          <ToggleGroupItem value="issues" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">With Issues</ToggleGroupItem>
          <ToggleGroupItem value="all" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">All In Scope</ToggleGroupItem>
        </ToggleGroup>
        <span className="ml-auto text-[11px] text-muted-foreground">Select a row to update the application's intake record</span>
        <ExportMenu target={box} name="Technical Health" csv={() => [['ID', 'Application', 'Criticality', 'Technical debt', 'Debt band', 'SPOF', 'SPOF reasons', 'Scalability', 'Scalability reasons'],
          ...th.rows.map((r) => [r.id, r.name, r.criticality, r.debt ?? '', r.debt_band ?? '', r.spof_status, [...r.spof, ...r.spof_checks].join('; '), r.scal_status, r.scal.join('; ')])]} />
      </div>
      <div ref={box} className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-14">ID</TableHead><TableHead>Application</TableHead><TableHead className="text-right">Crit.</TableHead><TableHead>Technical Debt</TableHead>
            <TableHead>Single Point of Failure</TableHead><TableHead>Scalability</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => app[r.id] && onOpen(app[r.id])}>
                <TableCell className="text-xs font-semibold text-muted-foreground">{r.id}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="tabular text-right">{r.criticality}</TableCell>
                <TableCell><span className="inline-flex items-center gap-1.5"><Explain x={r.explain} />
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${r.debt ?? 0}%`, background: BAND_OF[r.debt_band ?? ''] ?? SLATE }} /></span>
                  <span className="tabular w-6 text-[12px]">{r.debt ?? '–'}</span><Pill v={r.debt_band} /></span></TableCell>
                <TableCell className="max-w-80 text-[11.5px] whitespace-normal"><span className="flex items-start gap-1.5"><Pill v={r.spof_status} /><span className="text-muted-foreground">{[...r.spof, ...r.spof_checks].join('; ')}</span></span></TableCell>
                <TableCell className="max-w-72 text-[11.5px] whitespace-normal"><span className="flex items-start gap-1.5"><Pill v={r.scal_status} /><span className="text-muted-foreground">{r.scal.join('; ')}</span></span></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground"><AlertTriangle className="mr-1 inline size-4" />No issues found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

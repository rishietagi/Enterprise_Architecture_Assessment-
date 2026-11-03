import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { ExportMenu } from '@/components/ExportMenu'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { App, AppCapL2, AppCapL3, Applications } from '@/lib/api'
import { BAND, bandColor, DEFAULT_LAYER, DISC_STATUS, DISPOSITION_CODES, dispositionColor, LAYER_COLOR, NAVY, SLATE, SLATE_LIGHT, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'

type ColourBy = 'disposition' | 'layer'
const short = (n: string) => n.split(' (')[0]

function AppPill({ a, by, dim, onOpen }: { a: App; by: ColourBy; dim: boolean; onOpen: (a: App) => void }) {
  const c = by === 'layer' ? LAYER_COLOR[a.layer ?? DEFAULT_LAYER] ?? NAVY : dispositionColor(a.computed.disposition)
  return (
    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onOpen(a) }} onKeyDown={(e) => e.key === 'Enter' && onOpen(a)}
      title={`${a.name} · ${a.computed.label} · ${a.layer}`}
      className={cn('inline-flex max-w-full cursor-pointer items-center gap-1 rounded px-1.5 py-px text-[10.5px] font-medium transition-opacity hover:underline', !a.in_scope && 'border border-dashed', dim && 'opacity-30')}
      style={{ color: c, background: tint(c, 0.1), borderColor: tint(c, 0.5) }}>
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: c }} /><span className="truncate">{short(a.name)}</span>
    </span>
  )
}

function L3Apps({ x, apps, by, focus, onOpen }: { x: AppCapL3; apps: Record<string, App>; by: ColourBy; focus: string | null; onOpen: (a: App) => void }) {
  const named = x.apps.map((id) => apps[id]).filter(Boolean)
  return (
    <div className="flex items-start gap-1.5 py-[2px]">
      <span className="mt-[3px] size-2 shrink-0 rounded-full border" style={x.status === 'responded' ? { background: DISC_STATUS.responded.color, borderColor: DISC_STATUS.responded.color } : { borderColor: SLATE, borderStyle: 'dashed' }} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[10.5px] leading-[13px]', x.status !== 'responded' && 'text-muted-foreground')}
          title={x.status === 'responded' ? x.name : `${x.name} · systems come from discovery (${DISC_STATUS[x.status].label.toLowerCase()})`}>{x.name}</span>
        {x.status === 'responded' ? (
          <span className="mt-0.5 flex flex-wrap gap-0.5">
            {named.map((a) => <AppPill key={a.id} a={a} by={by} dim={!!focus && focus !== a.id} onOpen={onOpen} />)}
            {x.other && <span className="truncate text-[9.5px] text-muted-foreground italic" title={x.other}>+ {x.other}</span>}
            {!named.length && !x.other && <span className="text-[9.5px] font-medium" style={{ color: BAND.weak }}>No system named</span>}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function L2Card({ c, apps, by, showL3, focus, onOpen }: { c: AppCapL2; apps: Record<string, App>; by: ColourBy; showL3: boolean; focus: string | null; onOpen: (a: App) => void }) {
  const serving = c.apps.map((id) => apps[id]).filter(Boolean)
  const hit = !focus || c.apps.includes(focus) || c.l3.some((x) => x.apps.includes(focus))
  const disc = c.basis === 'discovery'
  return (
    <div className={cn('flex flex-col rounded-md border bg-card px-2 py-1.5 transition-opacity', !hit && 'opacity-35')}
      style={c.is_gap && disc ? { outline: `1.5px solid ${tint(BAND.critical, 0.55)}`, outlineOffset: -1 } : undefined}>
      <div className="flex items-start gap-1.5">
        <span className="min-w-0 flex-1 text-[11.5px] leading-[14px] font-semibold">{c.name}</span>
        <span className="tabular text-[10px] font-semibold" style={{ color: serving.length ? NAVY : BAND.weak }}>{serving.length} app{serving.length === 1 ? '' : 's'}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground">
        {c.id}
        {disc && c.maturity !== null && <span className="rounded px-1 font-bold" style={{ color: bandColor(c.band ?? ''), background: tint(bandColor(c.band ?? ''), 0.12) }}>maturity {c.maturity.toFixed(1)}</span>}
        {disc && c.is_gap && <span className="font-semibold" style={{ color: BAND.critical }}>gap</span>}
        {serving.length > 1 && <span className="font-semibold" style={{ color: BAND.developing }}>overlap</span>}
      </div>
      <div className="mt-1 flex flex-wrap gap-0.5">
        {serving.map((a) => <AppPill key={a.id} a={a} by={by} dim={!!focus && focus !== a.id} onOpen={onOpen} />)}
        {!serving.length && <span className="inline-flex items-center gap-1 text-[10.5px] font-medium" style={{ color: BAND.weak }}><AlertTriangle className="size-3" /> No application support</span>}
      </div>
      {showL3 && c.l3.length > 0 && <div className="mt-1 border-t border-dashed pt-1">{c.l3.map((x) => <L3Apps key={x.id} x={x} apps={apps} by={by} focus={focus} onOpen={onOpen} />)}</div>}
    </div>
  )
}

/** Application support by capability, L0 › L1 › L2 › L3 (business–application view, TOGAF §35.6.3): L2 from the app's
 * capability mapping, L3 from the systems each owner named in discovery. */
export function AppCapabilityMap({ a, onOpen }: { a: Applications; onOpen: (x: App) => void }) {
  const [by, setBy] = useState<ColourBy>('disposition')
  const [showL3, setShowL3] = useState(true)
  const [focus, setFocus] = useState<string | null>(null)
  const [bareOnly, setBareOnly] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const apps = useMemo(() => Object.fromEntries(a.apps.map((x) => [x.id, x])), [a.apps])
  const t = a.cap_tree
  const l2s = t.l1.flatMap((l) => l.children)
  const l3s = l2s.flatMap((c) => c.l3)
  const covered = l2s.filter((c) => c.apps.length).length
  const bare = l2s.filter((c) => !c.apps.length && !c.l3.some((x) => x.apps.length))
  const bareIds = new Set(bare.map((c) => c.id))
  const answered = l3s.filter((x) => x.status === 'responded')
  const l3Bare = answered.filter((x) => !x.apps.length)
  const kpi = 'text-[10px] font-semibold tracking-wide text-muted-foreground uppercase'
  const csv = () => [['L0', 'L1', 'L2 ID', 'L2 capability', 'Applications (L2 mapping)', 'L3 process', 'Systems named in discovery', 'Other tools'],
    ...t.l1.flatMap((l1) => l1.children.flatMap((c) => {
      const l0 = t.l0.find((x) => x.id === l1.l0)?.name ?? ''
      const names = c.apps.map((id) => apps[id]?.name ?? id).join('; ') || 'None'
      return c.l3.length ? c.l3.map((x) => [l0, l1.name, c.id, c.name, names, x.name, x.apps.map((id) => apps[id]?.name ?? id).join('; '), x.other])
        : [[l0, l1.name, c.id, c.name, names, '', '', '']]
    }))]
  const legend = by === 'layer'
    ? a.layers.map((ly) => ({ k: ly, label: ly, c: LAYER_COLOR[ly] ?? NAVY }))
    : DISPOSITION_CODES.map((k) => ({ k, label: a.labels[k], c: dispositionColor(k) }))
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3">
        <button onClick={() => setBareOnly(!bareOnly)} title="Show only capabilities without any application"
          className={cn('rounded-lg border-2 px-3 py-2 text-left transition-colors', bareOnly ? 'bg-card' : 'bg-card hover:bg-muted/40')}
          style={{ borderColor: bareOnly ? BAND.critical : tint(BAND.critical, 0.45) }}>
          <div className={kpi}>Capabilities Without Any App</div>
          <div className="tabular text-[22px] leading-tight font-bold" style={{ color: BAND.critical }}>{bare.length}<span className="text-[12px] font-normal text-muted-foreground"> of {l2s.length} L2</span></div>
          <div className="text-[10.5px] text-muted-foreground">{bareOnly ? 'Showing only these · click to show all' : 'No L2 mapping and no system named at L3 · click to filter'}</div>
        </button>
        <div className="rounded-lg border bg-muted/30 px-3 py-2"><div className={kpi}>L2 With App Support</div><div className="tabular text-[18px] font-semibold">{covered}<span className="text-[11px] font-normal text-muted-foreground"> / {l2s.length}</span></div></div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2"><div className={kpi}>L2 Served by 2+ Apps</div><div className="tabular text-[18px] font-semibold" style={{ color: BAND.developing }}>{l2s.filter((c) => c.apps.length > 1).length}</div></div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2"><div className={kpi}>Answered L3 With No System</div><div className="tabular text-[18px] font-semibold" style={{ color: BAND.weak }}>{l3Bare.length}<span className="text-[11px] font-normal text-muted-foreground"> / {answered.length} answered · {l3s.length} total</span></div></div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2"><div className={kpi}>Gaps Without App Support</div><div className="tabular text-[18px] font-semibold" style={{ color: BAND.critical }}>{l2s.filter((c) => c.is_gap && !c.apps.length).length}</div></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11.5px]">
        <ToggleGroup type="single" value={by} onValueChange={(v) => v && setBy(v as ColourBy)} variant="outline" size="sm">
          <ToggleGroupItem value="disposition" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">Colour by Disposition</ToggleGroupItem>
          <ToggleGroupItem value="layer" className="px-2.5 data-[state=on]:bg-navy data-[state=on]:text-white">Colour by Layer</ToggleGroupItem>
        </ToggleGroup>
        <label className="flex items-center gap-2 font-medium"><Switch checked={showL3} onCheckedChange={setShowL3} /> Show L3 processes</label>
        <Select value={focus ?? 'all'} onValueChange={(v) => setFocus(v === 'all' ? null : v)}>
          <SelectTrigger size="sm" className="h-8 w-60 text-[12.5px]"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Trace an application…</SelectItem>
            {a.apps.map((x) => <SelectItem key={x.id} value={x.id}>{x.id} · {x.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {focus && <Button variant="ghost" size="xs" onClick={() => setFocus(null)}><X /> Clear trace</Button>}
        <label className="flex items-center gap-2 font-medium"><Switch checked={bareOnly} onCheckedChange={setBareOnly} /> Only Without Apps</label>
        <ExportMenu target={box} name="Application Capability View" csv={csv} />
        <span className="ml-auto flex flex-wrap items-center gap-3 text-[10.5px] text-muted-foreground">
          {legend.map((l) => <span key={l.k} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: l.c }} />{l.label}</span>)}
          <span className="flex items-center gap-1"><span className="size-2 rounded-full border border-dashed" style={{ borderColor: SLATE_LIGHT }} />L3 awaiting discovery</span>
        </span>
      </div>
      <div ref={box} className="space-y-3 bg-card">
      {t.l0.map((l0) => {
        const l1s = t.l1.filter((l) => l.l0 === l0.id).map((l) => (bareOnly ? { ...l, children: l.children.filter((c) => bareIds.has(c.id)) } : l)).filter((l) => l.children.length)
        if (!l1s.length) return null
        return (
          <div key={l0.id} className="grid grid-cols-[34px_minmax(0,1fr)] gap-2">
            <div className="flex items-center justify-center rounded-md bg-navy">
              <span className="text-[11px] font-semibold whitespace-nowrap text-white" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{l0.name}</span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: l1s.map((l) => `minmax(0, ${Math.max(1, l.children.length)}fr)`).join(' ') }}>
              {l1s.map((l1) => {
                const ids = new Set(l1.children.flatMap((c) => [...c.apps, ...c.l3.flatMap((x) => x.apps)]))
                return (
                  <div key={l1.id} className="rounded-lg border bg-muted/35 p-1.5">
                    <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
                      <span className="text-[10px] font-bold text-navy">{l1.id}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold" title={l1.name}>{l1.name}</span>
                      <span className="text-[9.5px] text-muted-foreground">{ids.size} app{ids.size === 1 ? '' : 's'}</span>
                    </div>
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${showL3 ? 178 : 140}px, 1fr))` }}>
                      {l1.children.map((c) => <L2Card key={c.id} c={c} apps={apps} by={by} showL3={showL3} focus={focus} onOpen={onOpen} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      {bareOnly && !bare.length && <p className="py-6 text-center text-sm text-muted-foreground">Every L2 capability has at least one supporting application.</p>}
      </div>
      <p className="text-[11px] text-muted-foreground">L2 support
 comes from each application's capability mapping in the intake record; L3 support comes from the systems the business owner named in the discovery questionnaire. Dashed pills are out of scope (dependencies only). Select an application to open its intake record.</p>
    </div>
  )
}

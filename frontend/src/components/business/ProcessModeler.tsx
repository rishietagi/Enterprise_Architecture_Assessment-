import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, Hand, Link2, Loader2, MousePointer2, Plus, RotateCcw, Save, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'
import { AiAction } from '@/components/AiAction'
import { useBusinessUpdate } from '@/components/CapabilityModules'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { processDrawio } from '@/lib/drawio'
import { api, type Business, type PEdge, type PNode, type PNodeType, type ProcessModelT } from '@/lib/api'
import { BAND, EPC, NAVY, SLATE, bandColor, tint } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { allL2, bandOf } from './shared'

const HEAD = 132 // lane header width
const SIZE: Record<PNodeType, [number, number]> = { event: [132, 50], function: [136, 58], xor: [40, 40], and: [40, 40], system: [118, 30], data: [112, 40] }
const PALETTE: { type: PNodeType; label: string }[] = [
  { type: 'event', label: 'Event' }, { type: 'function', label: 'Function' }, { type: 'xor', label: 'XOR' },
  { type: 'and', label: 'AND' }, { type: 'system', label: 'System' }, { type: 'data', label: 'Data' },
]
type Sel = { kind: 'node' | 'edge'; id: string } | null

function wrap(text: string, width: number, size: number): string[] {
  const max = Math.max(6, Math.floor(width / (size * 0.56)))
  const out: string[] = []
  let line = ''
  for (const w of text.split(/\s+/)) {
    if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w } else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out.slice(0, 3)
}

function Label({ n, size = 10.5, color = '#0F172A', dy = 0 }: { n: PNode; size?: number; color?: string; dy?: number }) {
  const lines = wrap(n.label, n.w - 14, size)
  const y0 = n.y + n.h / 2 - ((lines.length - 1) * (size + 2)) / 2 + size / 3 + dy
  return (
    <text x={n.x + n.w / 2} textAnchor="middle" fontSize={size} fill={color} pointerEvents="none" fontWeight={n.type === 'function' ? 600 : 500}>
      {lines.map((l, i) => <tspan key={i} x={n.x + n.w / 2} y={y0 + i * (size + 2)}>{l}</tspan>)}
    </text>
  )
}

function Shape({ n, sel, overlay, mat }: { n: PNode; sel: boolean; overlay: boolean; mat?: { v: number | null; band: string | null; own: boolean; gap: boolean } }) {
  const { x, y, w, h } = n
  const ring = sel ? NAVY : undefined
  const sw = sel ? 2.4 : 1.3
  if (n.type === 'event') {
    const d = 14
    return (
      <g>
        <polygon points={`${x + d},${y} ${x + w - d},${y} ${x + w},${y + h / 2} ${x + w - d},${y + h} ${x + d},${y + h} ${x},${y + h / 2}`} fill={EPC.event.fill} stroke={ring ?? EPC.event.stroke} strokeWidth={sw} />
        <Label n={n} size={10} />
      </g>
    )
  }
  if (n.type === 'xor' || n.type === 'and') {
    const r = w / 2
    return (
      <g>
        <circle cx={x + r} cy={y + r} r={r} fill={EPC.gateway.fill} stroke={ring ?? EPC.gateway.stroke} strokeWidth={sw + 0.4} />
        <text x={x + r} y={y + r + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill={EPC.gateway.stroke} pointerEvents="none">{n.type === 'xor' ? '×' : '∧'}</text>
      </g>
    )
  }
  if (n.type === 'system')
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={2} fill={EPC.system.fill} stroke={ring ?? EPC.system.stroke} strokeWidth={sw} />
        <line x1={x + 7} x2={x + 7} y1={y} y2={y + h} stroke={EPC.system.stroke} strokeWidth={1} />
        <line x1={x + w - 7} x2={x + w - 7} y1={y} y2={y + h} stroke={EPC.system.stroke} strokeWidth={1} />
        <Label n={n} size={9.5} color={EPC.system.stroke} />
      </g>
    )
  if (n.type === 'data')
    return (
      <g>
        <path d={`M${x},${y} H${x + w} V${y + h - 6} Q${x + w * 0.75},${y + h - 14} ${x + w / 2},${y + h - 6} T${x},${y + h - 6} Z`} fill={EPC.data.fill} stroke={ring ?? EPC.data.stroke} strokeWidth={sw} />
        <Label n={n} size={9.5} dy={-3} />
      </g>
    )
  const c = overlay && mat?.band ? bandColor(mat.band) : EPC.function.stroke
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={10} fill={overlay && mat?.band ? tint(c, 0.16) : EPC.function.fill} stroke={ring ?? c} strokeWidth={sw}
        strokeDasharray={overlay && mat?.gap ? '0' : undefined} />
      {overlay && mat?.gap && <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={12} fill="none" stroke={tint(BAND.critical, 0.6)} strokeWidth={1.5} strokeDasharray="4 3" />}
      <Label n={n} />
      {overlay && mat && mat.v !== null && (
        <g>
          <rect x={x + w - 30} y={y - 9} width={32} height={16} rx={8} fill={c} />
          <text x={x + w - 14} y={y + 3} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="white" fontStyle={mat.own ? 'normal' : 'italic'}>{mat.v.toFixed(1)}</text>
        </g>
      )}
      {n.cap && <text x={x + 7} y={y + h - 5} fontSize={8} fill={SLATE} pointerEvents="none">{n.cap}</text>}
    </g>
  )
}

function route(a: PNode, z: PNode, kind?: string): { d: string; mx: number; my: number } {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, zc = { x: z.x + z.w / 2, y: z.y + z.h / 2 }
  if (kind === 'assoc') return { d: `M${ac.x},${ac.y} L${zc.x},${zc.y}`, mx: (ac.x + zc.x) / 2, my: (ac.y + zc.y) / 2 }
  if (z.x >= a.x + a.w + 10) {
    const sx = a.x + a.w, sy = ac.y, ex = z.x, ey = zc.y, mx = (sx + ex) / 2
    return { d: sy === ey ? `M${sx},${sy} H${ex}` : `M${sx},${sy} H${mx} V${ey} H${ex}`, mx, my: (sy + ey) / 2 }
  }
  if (z.x + z.w <= a.x - 10) {
    const sy = zc.y < ac.y ? a.y : a.y + a.h, ey = zc.y < ac.y ? z.y + z.h : z.y
    const my = (sy + ey) / 2
    return { d: `M${ac.x},${sy} V${my} H${zc.x} V${ey}`, mx: (ac.x + zc.x) / 2, my }
  }
  const down = zc.y > ac.y
  const sy = down ? a.y + a.h : a.y, ey = down ? z.y : z.y + z.h
  const my = (sy + ey) / 2
  return { d: `M${ac.x},${sy} V${my} H${zc.x} V${ey}`, mx: zc.x, my }
}

export function ProcessModeler({ b }: { b: Business }) {
  const done = useBusinessUpdate()
  const [mid, setMid] = useState(b.models[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const server = b.models.find((m) => m.id === mid) ?? b.models[0]
  const [m, setM] = useState<ProcessModelT | null>(server ?? null)
  const [dirty, setDirty] = useState(false)
  const [sel, setSel] = useState<Sel>(null)
  const [mode, setMode] = useState<'select' | 'connect' | 'pan'>('select')
  const [from, setFrom] = useState<string | null>(null)
  const [overlay, setOverlay] = useState(true)
  const [zoom, setZoom] = useState(0.75)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => { setM(server ?? null); setDirty(false); setSel(null); setFrom(null) }, [server?.id, server?.version, server])  // eslint-disable-line react-hooks/exhaustive-deps
  const l3 = useMemo(() => Object.fromEntries(allL2(b).flatMap((c) => c.l3.map((x) => [x.id, { x, c }]))), [b])
  const save = useMutation({
    mutationFn: () => api.putModel(m!.id, { lanes: m!.lanes, nodes: m!.nodes, edges: m!.edges, name: m!.name, description: m!.description }),
    onSuccess: (d) => { done(d, `${m!.name} saved`); setDirty(false) },
    onError: (e: Error) => toast.error(e.message),
  })
  const reset = useMutation({
    mutationFn: () => api.resetModel(m!.id),
    onSuccess: (d) => done(d, 'Model reset to the drafted version'),
    onError: (e: Error) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api.deleteModel(m!.id),
    onSuccess: (d) => { done(d, ` deleted`); setMid(d.models[0]?.id ?? '') },
    onError: (e: Error) => toast.error(e.message),
  })
  if (!m) return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10"><p className="text-sm text-muted-foreground">No architecture views yet.</p>
      <Button size="sm" onClick={() => setCreating(true)}><Plus /> New Architecture View</Button>
      <NewModelDialog b={b} open={creating} onClose={() => setCreating(false)} onCreated={setMid} /></div>
  )
  const LH = m.lane_h
  const W = Math.max(1200, ...m.nodes.map((n) => n.x + n.w + 80))
  const H = m.lanes.length * LH
  const byId = Object.fromEntries(m.nodes.map((n) => [n.id, n]))
  const update = (fn: (x: ProcessModelT) => ProcessModelT) => { setM((x) => (x ? fn(x) : x)); setDirty(true) }
  const pt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * (W + HEAD) - HEAD, y: ((e.clientY - r.top) / r.height) * H }
  }
  const matOf = (n: PNode) => {
    if (!n.cap || !l3[n.cap]) return undefined
    const { x, c } = l3[n.cap]
    return x.score ? { v: x.score.maturity, band: x.score.band, own: true, gap: x.score.is_gap } : { v: c.maturity, band: bandOf(c.maturity, b.bands), own: false, gap: c.is_gap }
  }
  const onNodeDown = (e: React.PointerEvent, n: PNode) => {
    e.stopPropagation()
    if (mode === 'connect') {
      if (!from) { setFrom(n.id); return }
      if (from !== n.id) {
        const a = byId[from]
        const kind = ['system', 'data'].includes(a.type) || ['system', 'data'].includes(n.type) ? 'assoc' as const : undefined
        update((x) => ({ ...x, edges: [...x.edges, { id: `e${Date.now().toString(36)}`, from, to: n.id, ...(kind ? { kind } : {}) }] }))
      }
      setFrom(null)
      return
    }
    setSel({ kind: 'node', id: n.id })
    const p = pt(e)
    drag.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const p = pt(e)
    const { id, dx, dy } = drag.current
    const snap = (v: number) => Math.round(v / 8) * 8
    update((x) => ({ ...x, nodes: x.nodes.map((n) => (n.id === id ? { ...n, x: Math.max(4, snap(p.x - dx)), y: Math.max(4, Math.min(H - n.h - 4, snap(p.y - dy))) } : n)) }))
  }
  const onUp = () => {
    if (!drag.current) return
    const id = drag.current.id
    drag.current = null
    update((x) => ({ ...x, nodes: x.nodes.map((n) => (n.id === id ? { ...n, lane: x.lanes[Math.max(0, Math.min(x.lanes.length - 1, Math.floor((n.y + n.h / 2) / LH)))].id } : n)) }))
  }
  const addNode = (type: PNodeType) => {
    const [w, h] = SIZE[type]
    const id = `n${Date.now().toString(36)}`
    const maxX = Math.max(0, ...m.nodes.map((n) => n.x + n.w))
    const lane = 0
    update((x) => ({ ...x, nodes: [...x.nodes, { id, type, label: type === 'event' ? 'New event' : type === 'function' ? 'New function' : type === 'system' ? 'System' : type === 'data' ? 'Document' : type.toUpperCase(), lane: x.lanes[lane].id, x: maxX + 40, y: lane * LH + (LH - h) / 2, w, h }] }))
    setSel({ kind: 'node', id })
    setMode('select')
  }
  const del = () => {
    if (!sel) return
    if (sel.kind === 'node') update((x) => ({ ...x, nodes: x.nodes.filter((n) => n.id !== sel.id), edges: x.edges.filter((e) => e.from !== sel.id && e.to !== sel.id) }))
    else update((x) => ({ ...x, edges: x.edges.filter((e) => e.id !== sel.id) }))
    setSel(null)
  }
  const exportSvg = () => {
    const src = new XMLSerializer().serializeToString(svg.current!)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }))
    a.download = `${m.id}_${m.name.replace(/\W+/g, '_')}.svg`
    a.click()
  }
  const exportDrawio = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([processDrawio(m)], { type: 'application/xml' }))
    a.download = `${m.id}_${m.name.replace(/\W+/g, '_')}.drawio`
    a.click()
  }
  const sn = sel?.kind === 'node' ? byId[sel.id] : undefined
  const se = sel?.kind === 'edge' ? m.edges.find((e) => e.id === sel.id) : undefined
  const setNode = (patch: Partial<PNode>) => sn && update((x) => ({ ...x, nodes: x.nodes.map((n) => (n.id === sn.id ? { ...n, ...patch } : n)) }))
  const setEdge = (patch: Partial<PEdge>) => se && update((x) => ({ ...x, edges: x.edges.map((e) => (e.id === se.id ? { ...e, ...patch } : e)) }))
  const fns = m.nodes.filter((n) => n.type === 'function')
  const weak = fns.map((n) => ({ n, mt: matOf(n) })).filter((x) => x.mt?.v !== null && x.mt?.v !== undefined).sort((a, z) => a.mt!.v! - z.mt!.v!).slice(0, 3)

  return (
    <div className="space-y-3" onKeyDown={(e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !(e.target as HTMLElement).closest('input,textarea')) del() }} tabIndex={-1}>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup type="single" value={m.id} onValueChange={(v) => { if (!v) return; if (dirty && !window.confirm('Discard unsaved changes?')) return; setMid(v) }} variant="outline" size="sm">
          {b.models.map((x) => <ToggleGroupItem key={x.id} value={x.id} className="px-3 data-[state=on]:bg-navy data-[state=on]:text-white">{x.id} · {x.name}</ToggleGroupItem>)}
        </ToggleGroup>
        <span className="text-[11px] text-muted-foreground">{m.notation} · v{m.version}{dirty && <b className="ml-1 text-foreground">· unsaved</b>}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <AiAction label="Draft from Answers with AI" what="Process model" from="the discovery answers and the leading-practice process" />
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus /> New view</Button>
          {m.custom
            ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => window.confirm(`Delete ${m.name}?`) && remove.mutate()} disabled={remove.isPending}><Trash2 /> Delete</Button>
            : <Button size="sm" variant="ghost" onClick={() => window.confirm('Reset this model to the drafted version?') && reset.mutate()} disabled={reset.isPending}><RotateCcw /> Reset</Button>}
          <Button size="sm" variant="outline" onClick={exportSvg}><Download /> SVG</Button>
          <Button size="sm" variant="outline" onClick={exportDrawio}><Download /> draw.io</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save model</Button>
        </span>
      </div>
      <p className="text-[12px] text-muted-foreground">{m.description}</p>
      <NewModelDialog b={b} open={creating} onClose={() => setCreating(false)} onCreated={(id) => setMid(id)} />

      <div className="grid grid-cols-[minmax(0,1fr)_250px] gap-3">
        <div className="overflow-hidden rounded-lg border">
          <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/40 px-2 py-1.5">
            <ToggleGroup type="single" value={mode} onValueChange={(v) => { if (v) { setMode(v as typeof mode); setFrom(null) } }} size="sm" variant="outline">
              <ToggleGroupItem value="select" title="Select and move" className="px-2 data-[state=on]:bg-navy data-[state=on]:text-white"><MousePointer2 className="size-3.5" /></ToggleGroupItem>
              <ToggleGroupItem value="connect" title="Connect: click source, then target" className="px-2 data-[state=on]:bg-navy data-[state=on]:text-white"><Link2 className="size-3.5" /></ToggleGroupItem>
              <ToggleGroupItem value="pan" title="Scroll the canvas" className="px-2 data-[state=on]:bg-navy data-[state=on]:text-white"><Hand className="size-3.5" /></ToggleGroupItem>
            </ToggleGroup>
            <span className="mx-1 h-5 w-px bg-border" />
            {PALETTE.map((p) => (
              <button key={p.type} onClick={() => addNode(p.type)} title={`Add ${p.label}`} className="flex h-7 items-center gap-1.5 rounded-md border bg-card px-2 text-[11px] font-medium hover:border-navy">
                <svg width="18" height="12" viewBox="0 0 18 12">
                  {p.type === 'event' && <polygon points="3,1 15,1 17,6 15,11 3,11 1,6" fill={EPC.event.fill} stroke={EPC.event.stroke} />}
                  {p.type === 'function' && <rect x="1" y="1" width="16" height="10" rx="3" fill={EPC.function.fill} stroke={EPC.function.stroke} />}
                  {(p.type === 'xor' || p.type === 'and') && <circle cx="9" cy="6" r="5" fill="white" stroke={EPC.gateway.stroke} />}
                  {p.type === 'system' && <rect x="1" y="2" width="16" height="8" fill={EPC.system.fill} stroke={EPC.system.stroke} />}
                  {p.type === 'data' && <path d="M1,1 H17 V9 Q13,7 9,9 T1,9 Z" fill={EPC.data.fill} stroke={EPC.data.stroke} />}
                </svg>
                {p.label}
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-border" />
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label="Zoom out"><ZoomOut /></Button>
            <span className="tabular w-9 text-center text-[11px]">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} aria-label="Zoom in"><ZoomIn /></Button>
            <label className="ml-auto flex items-center gap-1.5 text-[11.5px] font-medium"><Switch checked={overlay} onCheckedChange={setOverlay} /> Maturity overlay</label>
          </div>
          {mode === 'connect' && <div className="border-b bg-navy-soft/60 px-3 py-1 text-[11.5px] text-navy">{from ? `From ${byId[from]?.label}: now click the target shape` : 'Click the source shape, then the target. Links to systems or data become associations.'}</div>}
          <div className={cn('scrollbar-thin max-h-[560px] overflow-auto bg-white', mode === 'pan' && 'cursor-grab')}>
            <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`${-HEAD} 0 ${W + HEAD} ${H}`} width={(W + HEAD) * zoom} height={H * zoom}
              onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onPointerDown={() => { if (mode !== 'pan') setSel(null) }} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#334155" /></marker>
                <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0 L0 0 0 16" fill="none" stroke="#EEF2F7" strokeWidth="1" /></pattern>
              </defs>
              {m.lanes.map((l, i) => (
                <g key={l.id}>
                  <rect x={0} y={i * LH} width={W} height={LH} fill={i % 2 ? EPC.lane : 'white'} />
                  <rect x={0} y={i * LH} width={W} height={LH} fill="url(#grid)" />
                  <rect x={-HEAD} y={i * LH} width={HEAD} height={LH} fill={EPC.laneHead} stroke="#CBD5E1" />
                  <text x={-HEAD / 2} y={i * LH + LH / 2 + 4} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={NAVY}>
                    {wrap(l.name, HEAD - 16, 11.5).map((t, k, arr) => <tspan key={k} x={-HEAD / 2} dy={k === 0 ? -((arr.length - 1) * 7) : 14}>{t}</tspan>)}
                  </text>
                  <line x1={-HEAD} x2={W} y1={(i + 1) * LH} y2={(i + 1) * LH} stroke="#CBD5E1" />
                </g>
              ))}
              {m.edges.map((e) => {
                const a = byId[e.from], z = byId[e.to]
                if (!a || !z) return null
                const r = route(a, z, e.kind)
                const on = sel?.kind === 'edge' && sel.id === e.id
                return (
                  <g key={e.id} onPointerDown={(ev) => { ev.stopPropagation(); setSel({ kind: 'edge', id: e.id }) }} className="cursor-pointer">
                    <path d={r.d} fill="none" stroke="transparent" strokeWidth={10} />
                    <path d={r.d} fill="none" stroke={on ? NAVY : e.kind === 'assoc' ? '#94A3B8' : '#334155'} strokeWidth={on ? 2.2 : 1.3}
                      strokeDasharray={e.kind === 'assoc' ? '3 3' : undefined} markerEnd={e.kind === 'assoc' ? undefined : 'url(#arr)'} />
                    {e.label && (
                      <g>
                        <rect x={r.mx - e.label.length * 2.9 - 4} y={r.my - 8} width={e.label.length * 5.8 + 8} height={14} rx={3} fill="white" stroke="#E2E8F0" />
                        <text x={r.mx} y={r.my + 2.5} textAnchor="middle" fontSize={9} fill="#334155" fontWeight={600}>{e.label}</text>
                      </g>
                    )}
                  </g>
                )
              })}
              {m.nodes.map((n) => (
                <g key={n.id} onPointerDown={(e) => onNodeDown(e, n)} className={mode === 'connect' ? 'cursor-crosshair' : 'cursor-move'} opacity={from && from !== n.id ? 0.85 : 1}>
                  <Shape n={n} sel={(sel?.kind === 'node' && sel.id === n.id) || from === n.id} overlay={overlay} mat={matOf(n)} />
                </g>
              ))}
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t bg-muted/30 px-3 py-1.5 text-[10.5px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4" style={{ background: EPC.event.fill, border: `1px solid ${EPC.event.stroke}` }} />Event</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded" style={{ background: EPC.function.fill, border: `1px solid ${EPC.function.stroke}` }} />Function (linked to L3)</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-full border" style={{ borderColor: EPC.gateway.stroke }} />Connector XOR / AND</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4" style={{ background: EPC.system.fill, border: `1px solid ${EPC.system.stroke}` }} />Application system</span>
            {overlay && <span>Badge = L3 maturity (italic = L2 baseline) · dashed red = sits on a gap</span>}
            <span className="ml-auto">Drag to move · Delete removes the selection</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Properties</div>
            {!sn && !se && <ModelProps m={m} LH={LH} update={update} />}
            {sn && (
              <div className="space-y-2">
                <div className="text-[11px] text-muted-foreground">{sn.type.toUpperCase()} · {sn.id}</div>
                <Textarea value={sn.label} onChange={(e) => setNode({ label: e.target.value })} className="min-h-14 text-[12.5px] md:text-[12.5px]" />
                <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Lane
                  <Select value={sn.lane} onValueChange={(v) => { const i = m.lanes.findIndex((l) => l.id === v); setNode({ lane: v, y: i * LH + (LH - sn.h) / 2 }) }}>
                    <SelectTrigger size="sm" className="h-8 w-full text-[12px] text-foreground"><SelectValue /></SelectTrigger>
                    <SelectContent>{m.lanes.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                {sn.type === 'function' && (
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Linked L3 capability
                    <Select value={sn.cap ?? 'none'} onValueChange={(v) => setNode({ cap: v === 'none' ? undefined : v })}>
                      <SelectTrigger size="sm" className="h-8 w-full text-[12px] text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="none">Not linked</SelectItem>
                        {Object.values(l3).map(({ x }) => <SelectItem key={x.id} value={x.id}>{x.id} · {x.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                )}
                {sn.type === 'system' && (
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Application
                    <Select value={sn.app ?? 'none'} onValueChange={(v) => { const a = b.apps.find((x) => x.id === v); setNode({ app: v === 'none' ? undefined : v, ...(a ? { label: a.name.split(' (')[0] } : {}) }) }}>
                      <SelectTrigger size="sm" className="h-8 w-full text-[12px] text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72"><SelectItem value="none">External / not in portfolio</SelectItem>{b.apps.map((a) => <SelectItem key={a.id} value={a.id}>{a.id} · {a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </label>
                )}
                {sn.cap && l3[sn.cap] && (() => {
                  const { x, c } = l3[sn.cap]
                  return (
                    <div className="rounded-md bg-muted/40 px-2 py-1.5 text-[11px]">
                      <div className="font-semibold">{x.name}</div>
                      <div className="text-muted-foreground">{c.name} · {x.score ? `L3 maturity ${x.score.maturity.toFixed(2)}` : `L2 ${c.maturity?.toFixed(2) ?? '–'} (L3 not surveyed)`}{c.is_gap ? ' · gap' : ''}</div>
                    </div>
                  )
                })()}
                <Button size="sm" variant="outline" className="w-full text-destructive" onClick={del}><Trash2 /> Delete shape</Button>
              </div>
            )}
            {se && (
              <div className="space-y-2">
                <div className="text-[11px] text-muted-foreground">{se.kind === 'assoc' ? 'Association' : 'Control flow'} · {byId[se.from]?.label} → {byId[se.to]?.label}</div>
                <Input value={se.label ?? ''} onChange={(e) => setEdge({ label: e.target.value || undefined })} placeholder="Label (e.g. Matched)" className="h-8 text-[12.5px]" />
                <Button size="sm" variant="outline" className="w-full text-destructive" onClick={del}><Trash2 /> Delete connector</Button>
              </div>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Model readout</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="tabular text-[17px] font-bold text-navy">{fns.length}</div><div className="text-[10px] text-muted-foreground">functions</div></div>
              <div><div className="tabular text-[17px] font-bold text-navy">{m.nodes.filter((n) => n.type === 'event').length}</div><div className="text-[10px] text-muted-foreground">events</div></div>
              <div><div className="tabular text-[17px] font-bold text-navy">{m.nodes.filter((n) => n.type === 'system').length}</div><div className="text-[10px] text-muted-foreground">systems</div></div>
            </div>
            <div className="mt-2.5 text-[11px] font-semibold">Weakest steps</div>
            {weak.map(({ n, mt }) => (
              <button key={n.id} onClick={() => setSel({ kind: 'node', id: n.id })} className="mt-1 flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[11.5px] hover:bg-muted/50">
                <span className="tabular rounded px-1 text-[10.5px] font-bold text-white" style={{ background: bandColor(mt!.band ?? '') }}>{mt!.v!.toFixed(1)}</span>
                <span className="truncate">{n.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Model-level properties shown when nothing is selected: name, description and swimlanes. */
function ModelProps({ m, LH, update }: { m: ProcessModelT; LH: number; update: (fn: (x: ProcessModelT) => ProcessModelT) => void }) {
  const used = (id: string) => m.nodes.some((n) => n.lane === id)
  const dropLane = (i: number) => update((x) => ({
    ...x, lanes: x.lanes.filter((_, k) => k !== i),
    nodes: x.nodes.map((n) => (n.y >= (i + 1) * LH ? { ...n, y: n.y - LH } : n)),
  }))
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">Select a shape or connector to edit it. With nothing selected, edit the view itself.</p>
      <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">View name
        <Input value={m.name} onChange={(e) => update((x) => ({ ...x, name: e.target.value }))} className="h-8 text-[12.5px] text-foreground" />
      </label>
      <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">Scope
        <Textarea value={m.description} onChange={(e) => update((x) => ({ ...x, description: e.target.value }))} className="min-h-14 text-[12px] text-foreground md:text-[12px]" />
      </label>
      <div className="text-[11px] font-medium text-muted-foreground">Swimlanes</div>
      {m.lanes.map((l, i) => (
        <div key={l.id} className="flex items-center gap-1">
          <Input value={l.name} onChange={(e) => update((x) => ({ ...x, lanes: x.lanes.map((y) => (y.id === l.id ? { ...y, name: e.target.value } : y)) }))} className="h-7 text-[12px]" />
          <Button variant="ghost" size="icon-sm" className="size-7 shrink-0 text-muted-foreground hover:text-destructive" disabled={used(l.id) || m.lanes.length === 1}
            title={used(l.id) ? 'Move or delete its shapes first' : 'Remove lane'} aria-label={`Remove lane ${l.name}`} onClick={() => dropLane(i)}><X /></Button>
        </div>
      ))}
      <Button variant="outline" size="xs" className="w-full" onClick={() => update((x) => ({ ...x, lanes: [...x.lanes, { id: `lane-${Date.now().toString(36)}`, name: 'New lane' }] }))}><Plus /> Add lane</Button>
    </div>
  )
}

/** Create an architecture view: blank swimlanes with a starter event and function, or a copy of an existing view. */
function NewModelDialog({ b, open, onClose, onCreated }: { b: Business; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const done = useBusinessUpdate()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [lanes, setLanes] = useState('Business owner, Operations, Systems')
  const [copy, setCopy] = useState('blank')
  useEffect(() => { if (open) { setName(''); setDesc(''); setCopy('blank'); setLanes('Business owner, Operations, Systems') } }, [open])
  const create = useMutation({
    mutationFn: () => api.addModel({ name, description: desc, lanes: lanes.split(',').map((x) => x.trim()).filter(Boolean), copy_from: copy === 'blank' ? null : copy }),
    onSuccess: (d) => { done(d, `${name} created`); onCreated(d.added![0]); onClose() },
    onError: (e: Error) => toast.error(e.message),
  })
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Architecture View</DialogTitle>
          <DialogDescription>An ARIS-style EPC swimlane model. Link its functions to L3 capabilities to carry their discovered maturity.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Process name
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Raw material receipt to production release" className="h-8 text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Scope
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Trigger, end state and the plants or channels in scope" className="min-h-14 text-[12.5px] text-foreground md:text-[12.5px]" />
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Start from
            <Select value={copy} onValueChange={setCopy}>
              <SelectTrigger size="sm" className="h-8 w-full text-[13px] text-foreground"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank swimlanes</SelectItem>
                {b.models.map((x) => <SelectItem key={x.id} value={x.id}>Copy of {x.id} · {x.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          {copy === 'blank' && (
            <label className="flex flex-col gap-1 text-[11.5px] font-medium text-muted-foreground">Swimlanes (comma separated)
              <Input value={lanes} onChange={(e) => setLanes(e.target.value)} className="h-8 text-foreground" />
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={name.trim().length < 3 || create.isPending}>{create.isPending && <Loader2 className="animate-spin" />} Create view</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

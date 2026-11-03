/** draw.io (diagrams.net) exports: editable diagrams for the layered architecture views, the application interaction
 * diagram and the process models. Geometry is laid out here; colours come from theme.ts. */
import type { Applications, ProcessModelT, RefBlock, RefView } from './api'
import { LAYER_COLOR, NAVY, PATTERN_COLOR, REF_STATUS, SLATE } from './theme'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const hex = (c: string) => (c.startsWith('#') ? c : '#1E3A8A')

/** Solid hex for a tinted fill (draw.io has no rgba fills in the style string). */
function lighten(c: string, a: number): string {
  const h = hex(c).slice(1)
  const n = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return '#' + n.map((v) => Math.round(255 - (255 - v) * a).toString(16).padStart(2, '0')).join('')
}

function file(name: string, cells: string[]): string {
  return `<mxfile host="CIL EA Navigator"><diagram name="${esc(name)}"><mxGraphModel grid="1" gridSize="10" page="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`
}

const vertex = (id: string, value: string, style: string, x: number, y: number, w: number, h: number) =>
  `<mxCell id="${esc(id)}" value="${esc(value)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" as="geometry"/></mxCell>`
const edge = (id: string, from: string, to: string, style: string, value = '') =>
  `<mxCell id="${esc(id)}" value="${esc(value)}" style="${style}" edge="1" parent="1" source="${esc(from)}" target="${esc(to)}"><mxGeometry relative="1" as="geometry"/></mxCell>`

const block = (b: RefBlock) => {
  const c = REF_STATUS[b.status].color
  return `rounded=1;whiteSpace=wrap;html=1;fontSize=11;fillColor=${lighten(c, 0.16)};strokeColor=${lighten(c, 0.6)};fontColor=#1F2937;`
}

/** A layered architecture view: one band per layer, blocks sized by span, the cross-cutting column and flow arrows. */
export function refViewDrawio(v: RefView): string {
  const cells: string[] = []
  const LW = 160, W = 1240, RH = 48, G = 8, ASIDE = 200
  let y = 0
  cells.push(vertex('title', v.title, 'text;html=1;fontSize=16;fontStyle=1;fontColor=' + hex(NAVY) + ';align=left;', 0, y, W + LW, 26))
  y += 34
  if (v.functions.length) {
    const fw = W / v.functions.length
    v.functions.forEach((f, i) => cells.push(vertex(`fn${i}`, f, `rounded=1;whiteSpace=wrap;html=1;fontSize=10;fontStyle=1;fillColor=${hex(NAVY)};fontColor=#FFFFFF;strokeColor=none;`, LW + G + i * fw, y, fw - 4, 34)))
    y += 42
  }
  const top = y
  for (const ly of v.layers) {
    const rows = Math.max(1, ly.rows.length)
    const h = rows * RH + (rows - 1) * G
    cells.push(vertex(`L-${ly.id}`, ly.name.toUpperCase(), `rounded=1;whiteSpace=wrap;html=1;fontSize=10;fontStyle=1;fillColor=${hex(NAVY)};fontColor=#FFFFFF;strokeColor=none;align=left;spacingLeft=8;`, 0, y, LW, h))
    ly.rows.forEach((row, ri) => {
      const total = row.reduce((s, b) => s + b.span, 0) || 1
      let x = LW + G
      row.forEach((b) => {
        const w = (W - G * row.length) * (b.span / total)
        cells.push(vertex(b.id, b.name, block(b), x, y + ri * (RH + G), w, RH))
        x += w + G
      })
    })
    y += h + G * 2
  }
  if (v.aside) {
    const h = y - top - G * 2
    cells.push(vertex('aside-title', v.aside.title.toUpperCase(), `rounded=1;whiteSpace=wrap;html=1;fontSize=10;fontStyle=1;fillColor=${hex(NAVY)};fontColor=#FFFFFF;strokeColor=none;`, LW + W + G, top, ASIDE, 30))
    const bh = (h - 30 - G * v.aside.boxes.length) / Math.max(1, v.aside.boxes.length)
    v.aside.boxes.forEach((b, i) => cells.push(vertex(b.id, b.name, block(b), LW + W + G, top + 30 + G + i * (bh + G), ASIDE, bh)))
  }
  const legend = (Object.keys(REF_STATUS) as (keyof typeof REF_STATUS)[]).map((s, i) =>
    vertex(`lg-${s}`, REF_STATUS[s].label, `rounded=1;whiteSpace=wrap;html=1;fontSize=10;fillColor=${lighten(REF_STATUS[s].color, 0.16)};strokeColor=${lighten(REF_STATUS[s].color, 0.6)};`, LW + G + i * 190, y + 6, 180, 26))
  cells.push(...legend)
  v.edges.forEach((e, i) => cells.push(edge(`e${i}`, e.from, e.to, `edgeStyle=orthogonalEdgeStyle;curved=1;html=1;endArrow=block;endSize=5;strokeColor=${hex(NAVY)};opacity=60;`)))
  return file(v.title, cells)
}

/** Application communication diagram: one column per layer plus external parties, interfaces as edges. */
export function interactionDrawio(a: Applications): string {
  const cells: string[] = []
  const deg = a.integration.degree
  const CW = 230, NH = 46, G = 14
  const cols = [...a.layers.map((ly) => ({ key: ly, color: LAYER_COLOR[ly] ?? NAVY, nodes: a.apps.filter((x) => x.layer === ly && (deg[x.id] ?? 0) > 0).map((x) => ({ id: x.id, name: x.name.split(' (')[0], dashed: !x.in_scope })) })),
    { key: 'External', color: SLATE, nodes: a.external.map((x) => ({ id: x.id, name: x.name, dashed: true })) }]
  cols.forEach((c, ci) => {
    cells.push(vertex(`col${ci}`, c.key, `text;html=1;fontSize=12;fontStyle=1;fontColor=${hex(c.color)};`, ci * (CW + 60), 0, CW, 24))
    c.nodes.forEach((n, ni) => cells.push(vertex(n.id, `${n.name}\n${n.id}`, `rounded=1;whiteSpace=wrap;html=1;fontSize=11;fillColor=${lighten(c.color, 0.1)};strokeColor=${hex(c.color)};${n.dashed ? 'dashed=1;' : ''}`, ci * (CW + 60), 34 + ni * (NH + G), CW, NH)))
  })
  a.interfaces.forEach((i) => cells.push(edge(i.id, i.from, i.to, `html=1;endArrow=block;endSize=5;strokeColor=${hex(PATTERN_COLOR[i.pattern] ?? SLATE)};${i.pattern === 'Manual / re-key' ? 'dashed=1;' : ''}`, `${i.data}`)))
  return file('Application Interactions', cells)
}

/** ARIS-style EPC model: swimlanes with events, functions, connectors, systems and documents. */
export function processDrawio(m: ProcessModelT): string {
  const cells: string[] = []
  const LW = 130
  const width = Math.max(600, ...m.nodes.map((n) => n.x + n.w)) + 60
  m.lanes.forEach((l, i) => cells.push(vertex(`lane-${l.id}`, l.name, `rounded=0;whiteSpace=wrap;html=1;fontSize=11;fontStyle=1;fillColor=${i % 2 ? '#FFFFFF' : lighten(NAVY, 0.05)};strokeColor=#CBD5E1;align=left;verticalAlign=middle;spacingLeft=8;`, 0, i * m.lane_h, LW + width, m.lane_h)))
  const shape: Record<string, string> = {
    event: 'shape=hexagon;perimeter=hexagonPerimeter2;fillColor=#F3E8FF;strokeColor=#7C3AED;',
    function: 'rounded=1;fillColor=#DCFCE7;strokeColor=#15803D;',
    xor: 'ellipse;fillColor=#FFFFFF;strokeColor=#334155;', and: 'ellipse;fillColor=#FFFFFF;strokeColor=#334155;',
    system: 'rounded=0;fillColor=#DBEAFE;strokeColor=#1D4ED8;', data: 'shape=document;fillColor=#FEF9C3;strokeColor=#A16207;',
  }
  m.nodes.forEach((n) => cells.push(vertex(n.id, n.label, `whiteSpace=wrap;html=1;fontSize=11;${shape[n.type] ?? ''}`, LW + n.x, n.y, n.w, n.h)))
  m.edges.forEach((e) => cells.push(edge(e.id, e.from, e.to, `edgeStyle=orthogonalEdgeStyle;html=1;${e.kind === 'assoc' ? 'dashed=1;endArrow=none;' : 'endArrow=block;endSize=5;'}strokeColor=#475569;`, e.label ?? '')))
  return file(m.name, cells)
}

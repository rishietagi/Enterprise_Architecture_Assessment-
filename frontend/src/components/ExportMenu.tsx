import { useState, type RefObject } from 'react'
import { toPng } from 'html-to-image'
import { Download, FileSpreadsheet, Image as ImageIcon, Loader2, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function save(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
}

/** Download a view on its own: a PNG of the rendered element, a CSV of its data and, for diagrams, an editable draw.io
 * file. Elements marked `data-export-ignore` (toolbars, edit buttons) are left out of the image. */
export function ExportMenu({ target, name, csv, drawio, size = 'sm', className }: {
  target: RefObject<HTMLElement | null>; name: string; csv?: () => (string | number)[][]; drawio?: () => string; size?: 'sm' | 'xs'; className?: string
}) {
  const [busy, setBusy] = useState(false)
  const png = async () => {
    const el = target.current
    if (!el) return
    setBusy(true)
    try {
      const bg = getComputedStyle(document.body).backgroundColor
      const url = await toPng(el, { pixelRatio: 2, backgroundColor: bg, cacheBust: true,
        filter: (n) => !(n instanceof HTMLElement && n.dataset.exportIgnore !== undefined) })
      save(url, `CIL_${slug(name)}.png`)
    } catch (e) {
      toast.error(`Image export failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }
  const toCsv = () => {
    const rows = csv!()
    const body = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    save(URL.createObjectURL(new Blob(['\ufeff' + body], { type: 'text/csv;charset=utf-8' })), `CIL_${slug(name)}.csv`)
  }
  const toDrawio = () => save(URL.createObjectURL(new Blob([drawio!()], { type: 'application/xml' })), `CIL_${slug(name)}.drawio`)
  if (!csv && !drawio)
    return <Button variant="outline" size={size} onClick={png} disabled={busy} className={className} data-export-ignore>{busy ? <Loader2 className="animate-spin" /> : <Download />} Export</Button>
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={busy} className={className} data-export-ignore>{busy ? <Loader2 className="animate-spin" /> : <Download />} Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={png}><ImageIcon /> Image (PNG)</DropdownMenuItem>
        {csv && <DropdownMenuItem onSelect={toCsv}><FileSpreadsheet /> Data (CSV)</DropdownMenuItem>}
        {drawio && <DropdownMenuItem onSelect={toDrawio}><Workflow /> Editable diagram (draw.io)</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

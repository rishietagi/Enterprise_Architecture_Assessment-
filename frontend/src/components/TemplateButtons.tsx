import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, templateUrl, type UploadResult } from '@/lib/api'

type Kind = Parameters<typeof templateUrl>[0]

export function TemplateButtons({ kind, label = 'template' }: { kind: Kind; label?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<UploadResult | null>(null)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const r = await api.upload(kind, f)
      qc.invalidateQueries({ predicate: (q) => !['coach', 'findings', 'settings', 'health'].includes(String(q.queryKey[0])) })
      if (r.errors.length || r.warnings.length) setRes(r)
      if (r.imported) toast.success(`Imported ${r.imported} rows${r.created ? ` (${r.created} new)` : ''}. Marked as client data.`)
      else toast.error('Nothing imported. See row errors.')
    } catch (e) {
      toast.error(`Upload failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" asChild>
        <a href={templateUrl(kind)}><FileSpreadsheet /> Download {label}</a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload
      </Button>
      <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Dialog open={!!res} onOpenChange={(o) => !o && setRes(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Results</DialogTitle>
            <DialogDescription>
              {res?.imported} rows imported · {res?.errors.length} errors · {res?.warnings.length} warnings. Rows with errors were skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead className="w-16">Row</TableHead><TableHead>Column</TableHead><TableHead>Issue</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...(res?.errors ?? []).map((e) => ({ ...e, level: 'error' })), ...(res?.warnings ?? []).map((w) => ({ ...w, level: 'warning' }))].map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular">{e.row}</TableCell>
                    <TableCell>{e.column}</TableCell>
                    <TableCell className={e.level === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

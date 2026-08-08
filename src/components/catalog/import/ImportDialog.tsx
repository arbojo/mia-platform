'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle2 } from 'lucide-react'
import type { ImportSummary, PreviewResult } from '@/lib/import/types'
import { FileImportPanel } from './FileImportPanel'
import { SourceImportPanel } from './SourceImportPanel'
import { PreviewTable } from './PreviewTable'
import { ImportResults } from './ImportResults'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  onImported: () => void
}

export function ImportDialog({ open, onOpenChange, businessId, onImported }: ImportDialogProps) {
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const handlePreview = (next: PreviewResult) => {
    setPreview(next)
    setSummary(null)
  }

  const handleImported = (next: ImportSummary) => {
    setSummary(next)
    setPreview(null)
    onImported()
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setPreview(null)
      setSummary(null)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Importar productos</AlertDialogTitle>
          <AlertDialogDescription>
            Agrega o actualiza tu catálogo desde un archivo, tu tienda WooCommerce o una página web.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {summary ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                <CheckCircle2 className="h-4 w-4 text-olive-600" />
                Importación completada. El catálogo se actualizó.
              </p>
              <ImportResults summary={summary} />
            </div>
          ) : (
            <Tabs defaultValue="file">
              <TabsList className="w-full">
                <TabsTrigger value="file">Archivo</TabsTrigger>
                <TabsTrigger value="source">Fuente remota</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="pt-4">
                <FileImportPanel businessId={businessId} onImported={handleImported} />
              </TabsContent>
              <TabsContent value="source" className="space-y-4 pt-4">
                <SourceImportPanel
                  businessId={businessId}
                  onPreview={handlePreview}
                  onImported={handleImported}
                />
                {preview && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-zinc-900">Vista previa</h4>
                    <PreviewTable rows={preview.rows} />
                    <ImportResults preview={preview} />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{summary ? 'Cerrar' : 'Cancelar'}</AlertDialogCancel>
          {summary && (
            <Button
              className="bg-olive-600 hover:bg-olive-700"
              onClick={() => {
                setSummary(null)
                setPreview(null)
              }}
            >
              Importar otro
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

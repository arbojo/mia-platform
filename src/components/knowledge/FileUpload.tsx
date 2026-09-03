'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'

interface FileUploadProps {
  businessId: string
  onReportCreated: (reportId: string) => void
}

interface PendingFile {
  file: File
  preview?: string
}

export function FileUpload({ businessId, onReportCreated }: FileUploadProps) {
  const [files, setFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        setError(`"${f.name}" es muy grande. El máximo es 10MB.`)
        return false
      }
      const allowed = ['image/', 'application/pdf', 'text/']
      if (!allowed.some((t) => f.type.startsWith(t) || f.type === t)) {
        setError(`"${f.name}" no es un formato que pueda leer.`)
        return false
      }
      return true
    })

    setFiles((prev) => [
      ...prev,
      ...validFiles.map((file) => ({ file })),
    ])
    setError(null)
  }, [])

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const [, setPollFailures] = useState(0)

  const pollReport = useCallback(
    (reportId: string, total: number) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/knowledge/learn/${reportId}`)
          if (!res.ok) throw new Error(`status ${res.status}`)
          const { report } = (await res.json()) as {
            report: {
              status: string
              files_done: number
              files_total: number
              error_reason: string | null
            }
          }
          setPollFailures(0)
          setUploadMessage(
            report.status === 'processing'
              ? `Estoy estudiando tus archivos... (${report.files_done}/${report.files_total || total})`
              : null
          )

          if (report.status === 'completed') {
            clearInterval(interval)
            setUploading(false)
            setUploadMessage('¡Ya terminé de estudiar tus archivos!')
            setTimeout(() => onReportCreated(reportId), 1500)
          } else if (report.status === 'failed') {
            clearInterval(interval)
            setError(report.error_reason ?? 'No pude procesar los archivos.')
            setUploadMessage(null)
            setUploading(false)
          }
        } catch {
          // Error de red transitorio: reintentar antes de rendirse.
          setPollFailures((prev) => {
            if (prev + 1 >= 5) {
              clearInterval(interval)
              setError('Se perdió la conexión con el servidor. Revisa el reporte en unos minutos.')
              setUploadMessage(null)
              setUploading(false)
              return 0
            }
            return prev + 1
          })
        }
      }, 2500)
    },
    [onReportCreated]
  )

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setError(null)
    setUploadMessage('Subiendo tus archivos...')

    try {
      const formData = new FormData()
      formData.append('business_id', businessId)
      for (const pf of files) {
        formData.append('files', pf.file)
      }

      const res = await fetch('/api/knowledge/learn', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al procesar los archivos')
        setUploadMessage(null)
        setUploading(false)
        return
      }

      // F3 (TASK-20260209): el POST responde en <1s con report_id; el trabajo
      // pesado corre en el worker asíncrono. Este hilo solo hace polling.
      setFiles([])
      setUploadMessage('Estoy estudiando tus archivos... (0/' + (data.files_total ?? files.length) + ')')
      pollReport(data.report_id, data.files_total ?? files.length)
    } catch {
      setError('Error al subir los archivos. Verifica tu conexión e intenta de nuevo.')
      setUploadMessage(null)
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/50 p-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
          📚
        </div>
        <p className="text-lg font-medium text-zinc-900">
          Arrastra tus archivos aquí
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          PDFs, imágenes, catálogos, listas de precios...
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          O haz clic para seleccionar
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((pf, i) => (
            <div
              key={`${pf.file.name}-${i}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {pf.file.type === 'application/pdf' ? '📄' :
                   pf.file.type.startsWith('image/') ? '🖼️' : '📝'}
                </span>
                <div>
                  <p className="text-sm font-medium text-zinc-900">{pf.file.name}</p>
                  <p className="text-xs text-zinc-400">
                    {(pf.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-zinc-400 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-brand-600 hover:bg-brand-700"
          >
            {uploading ? '📚 Estoy estudiando...' : '📚 Enséñame'}
          </Button>
        </div>
      )}

      {uploadMessage && (
        <div className="rounded-xl bg-brand-50 p-4 text-center">
          <p className="text-sm text-brand-800">{uploadMessage}</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-center">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  )
}

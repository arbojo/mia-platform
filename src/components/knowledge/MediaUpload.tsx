'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

interface MediaUploadProps {
  businessId: string
  onUploaded: (url: string) => void
  label?: string
}

export function MediaUpload({ businessId, onUploaded, label = 'Subir imagen' }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('business_id', businessId)
      formData.append('file', file)
      const res = await fetch('/api/knowledge/media/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const { url } = await res.json()
        onUploaded(url)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'No se pudo subir la imagen.')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ''
        }}
      />
      <Button
        variant="outline"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        {uploading ? 'Subiendo...' : label}
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

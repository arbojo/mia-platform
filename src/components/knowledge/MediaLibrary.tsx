'use client'

import { MediaBrowser } from '@/components/knowledge/MediaBrowser'

interface MediaLibraryProps {
  businessId: string
}

export function MediaLibrary({ businessId }: MediaLibraryProps) {
  return (
    <MediaBrowser
      businessId={businessId}
      header="Medios generales"
      hint="Imágenes que MIA envía por condición de envío (palabras clave), sin importar el producto. Para atar un medio a un producto, úsalo desde su ficha en el Catálogo."
    />
  )
}

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
      hint="Medios que MIA envía con cualquier producto en contexto. La condición de envío es opcional: sin ella, el medio acompaña al producto. Para atar un medio a un producto, úsalo desde su ficha en el Catálogo."
    />
  )
}

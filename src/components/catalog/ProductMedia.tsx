'use client'

import { MediaBrowser } from '@/components/knowledge/MediaBrowser'
import type { Database } from '@/lib/types'

type Product = Database['public']['Tables']['products']['Row']

interface ProductMediaProps {
  businessId: string
  product: Product
}

export function ProductMedia({ businessId, product }: ProductMediaProps) {
  return (
    <MediaBrowser
      businessId={businessId}
      productId={product.id}
      productNames={{ [product.id]: product.name }}
      header={`Multimedia de ${product.name}`}
      hint="Medios atados a este producto: se envían cuando la conversación tiene su contexto activo. La condición de envío refina dentro de este producto."
    />
  )
}

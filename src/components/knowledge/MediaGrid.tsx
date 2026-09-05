'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/lib/types'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']

const mediaTypeLabel = (id: string) =>
  ({ image: 'Imagen', testimonial: 'Testimonio' })[id] ?? id

interface MediaGridProps {
  items: KnowledgeItem[]
  emptyMessage: string
  productNames?: Record<string, string>
  onEdit: (item: KnowledgeItem) => void
  onDelete: (item: KnowledgeItem) => void
}

export function MediaGrid({ items, emptyMessage, productNames, onEdit, onDelete }: MediaGridProps) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-gray-500">{emptyMessage}</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-xl border bg-white">
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={item.answer} className="h-40 w-full object-cover" />
          )}
          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{mediaTypeLabel(item.media_type ?? 'image')}</Badge>
                {!item.product_id && <Badge variant="secondary">Genérica</Badge>}
                {item.product_id && productNames?.[item.product_id] && (
                  <Badge variant="secondary">{productNames[item.product_id]}</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={() => onDelete(item)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
            <p className="line-clamp-2 text-sm text-gray-700">{item.answer}</p>
            {item.trigger_condition ? (
              <p className="text-xs text-gray-500">
                {!item.product_id && 'Genérica · '}Se envía cuando:{' '}
                <span className="text-brand-600">{item.trigger_condition}</span>
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                Incondicional
                {item.product_id
                  ? ' · acompaña al producto'
                  : ' · genérica: acompaña al producto en contexto'}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

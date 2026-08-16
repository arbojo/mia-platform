'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ImageIcon, Package, Trash2 } from 'lucide-react'
import type { CatalogAvailability } from '@/lib/inventory/stock'

interface ProductCardProps {
  id: string
  name: string
  sku: string | null
  price: number | null
  description: string | null
  thumbnail: string | null
  mediaCount: number
  availability?: CatalogAvailability | null
  onDelete: () => void
}

const AVAILABILITY_BADGE: Record<string, { label: string; className: string }> = {
  ok: { label: 'Disponible', className: 'bg-emerald-100 text-emerald-800' },
  low: { label: 'Stock bajo', className: 'bg-amber-100 text-amber-800' },
  out: { label: 'Agotado', className: 'bg-red-100 text-red-800' },
}

export function ProductCard({
  id,
  name,
  sku,
  price,
  description,
  thumbnail,
  mediaCount,
  availability,
  onDelete,
}: ProductCardProps) {
  const availabilityBadge = availability ? AVAILABILITY_BADGE[availability.status] : null

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md">
      <Link href={`/dashboard/catalog/${id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={name}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <Package className="h-10 w-10" />
            </div>
          )}
          {mediaCount > 0 && (
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              <ImageIcon className="h-3 w-3" />
              {mediaCount}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-medium text-zinc-900">{name}</h3>
            {sku && (
              <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                {sku}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            {price !== null && (
              <p className="text-sm font-semibold text-brand-600">${price}</p>
            )}
            {availabilityBadge && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${availabilityBadge.className}`}
              >
                {availabilityBadge.label}
              </span>
            )}
          </div>
          {description && (
            <p className="line-clamp-2 text-sm text-zinc-500">{description}</p>
          )}
        </div>
      </Link>
      <div className="absolute right-2 top-2 hidden group-hover:block">
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

'use client'

import { Check, Package } from 'lucide-react'
import type { ProductReference } from '@/lib/channels/types'

interface ProductMessageCardProps {
  product: ProductReference
}

export function ProductMessageCard({ product }: ProductMessageCardProps) {
  const benefits = product.benefits
    ? product.benefits
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : []

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-100">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-300">
            <Package className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <h3 className="font-semibold text-zinc-900">{product.name}</h3>
        {product.price !== null && (
          <p className="font-semibold text-brand-600">${product.price}</p>
        )}
        {benefits.length > 0 && (
          <ul className="line-clamp-2 space-y-1 text-xs text-zinc-500">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-1.5">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />
                {benefit}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

'use client'

import Image from 'next/image'
import type { NormalizedRow } from '@/lib/import/types'

interface PreviewTableProps {
  rows: NormalizedRow[]
}

export function PreviewTable({ rows }: PreviewTableProps) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-zinc-500">No hay filas para previsualizar.</p>
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Imagen</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Precio</th>
              <th className="px-3 py-2 font-medium">Descripción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  {row.imageUrl ? (
                    <Image
                      src={row.imageUrl}
                      alt={row.name}
                      width={32}
                      height={32}
                      unoptimized
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-900">{row.name}</td>
                <td className="px-3 py-2 text-zinc-500">{row.sku ?? '—'}</td>
                <td className="px-3 py-2 text-zinc-700">
                  {row.price !== null ? `$${row.price.toFixed(2)}` : '—'}
                </td>
                <td className="max-w-[12rem] truncate px-3 py-2 text-zinc-500">
                  {row.description ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { ProductFormDialog } from '@/components/catalog/ProductFormDialog'
import { ProductMedia } from '@/components/catalog/ProductMedia'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types'
import type { CatalogAvailability } from '@/lib/inventory/stock'

type Product = Database['public']['Tables']['products']['Row']

const AVAILABILITY_BADGE: Record<string, { label: string; className: string }> = {
  ok: { label: 'Disponible', className: 'bg-emerald-100 text-emerald-800' },
  low: { label: 'Stock bajo', className: 'bg-amber-100 text-amber-800' },
  out: { label: 'Agotado', className: 'bg-red-100 text-red-800' },
}

interface ProductDetailProps {
  businessId: string
  product: Product
  availability?: CatalogAvailability | null
}

export function ProductDetail({ businessId, product, availability }: ProductDetailProps) {
  const router = useRouter()
  const [current, setCurrent] = useState<Product>(product)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('products').delete().eq('id', current.id)
    setDeleting(false)
    if (!error) {
      router.push('/dashboard/catalog')
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/catalog"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-3 rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900">{current.name}</h2>
              {availability && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${AVAILABILITY_BADGE[availability.status].className}`}
                >
                  {AVAILABILITY_BADGE[availability.status].label}
                </span>
              )}
            </div>
            {current.sku && (
              <Badge variant="outline" className="font-mono text-xs">
                {current.sku}
              </Badge>
            )}
            {current.price !== null && (
              <p className="text-2xl font-semibold text-olive-600">${current.price}</p>
            )}
            {current.description && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Descripción</p>
                <p className="mt-1 text-sm text-zinc-700">{current.description}</p>
              </div>
            )}
            {current.benefits && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Beneficios</p>
                <p className="mt-1 text-sm text-zinc-700">{current.benefits}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" className="text-red-600" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <ProductMedia businessId={businessId} product={current} />
        </div>
      </div>

      <ProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        businessId={businessId}
        product={current}
        onSaved={(saved) => {
          setCurrent(saved)
          router.refresh()
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar <strong>{current.name}</strong>? Sus medios
              quedarán sin producto asociado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

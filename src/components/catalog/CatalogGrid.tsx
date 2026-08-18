'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Images, Upload } from 'lucide-react'
import { ProductCard } from '@/components/catalog/ProductCard'
import { ProductFormDialog } from '@/components/catalog/ProductFormDialog'
import { ImportDialog } from '@/components/catalog/import/ImportDialog'
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
import type { CatalogProduct } from '@/app/dashboard/catalog/page'

type Product = Database['public']['Tables']['products']['Row']

interface CatalogGridProps {
  businessId: string
  initialProducts: CatalogProduct[]
}

export function CatalogGrid({ businessId, initialProducts }: CatalogGridProps) {
  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts)
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null)

  const handleSaved = (product: Product) => {
    const existing = products.find((p) => p.id === product.id)
    if (existing) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, ...product } : p)))
    } else {
      setProducts((prev) => [{ ...product, mediaCount: 0, thumbnail: null }, ...prev])
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    const supabase = createClient()
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id)
    if (!error) {
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      fetch('/api/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId }),
      }).catch(() => {})
    }
    setDeleteTarget(null)
  }

  const handleImported = async () => {
    const supabase = createClient()
    const [productsResult, mediaResult] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .order('name', { ascending: true }),
      supabase
        .from('knowledge_items')
        .select('product_id, image_url, created_at')
        .eq('business_id', businessId)
        .not('image_url', 'is', null)
        .not('product_id', 'is', null)
        .order('created_at', { ascending: true }),
    ])

    const counts = new Map<string, { mediaCount: number; thumbnail: string | null }>()
    for (const item of mediaResult.data ?? []) {
      if (!item.product_id) continue
      const entry = counts.get(item.product_id) ?? { mediaCount: 0, thumbnail: null }
      entry.mediaCount += 1
      if (!entry.thumbnail && item.image_url) entry.thumbnail = item.image_url
      counts.set(item.product_id, entry)
    }

    setProducts(
      (productsResult.data ?? []).map((product) => {
        const media = counts.get(product.id)
        return {
          ...product,
          mediaCount: media?.mediaCount ?? 0,
          thumbnail: media?.thumbnail ?? null,
        }
      })
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900">Catálogo</h2>
          <p className="text-sm text-zinc-500">
            Tus productos con su SKU, precio y multimedia. Haz clic en uno para gestionar sus medios.
          </p>
        </div>
        <div className="flex gap-2" data-tour="catalog-actions">
          <Link href="/dashboard/knowledge">
            <Button variant="outline">
              <Images className="mr-2 h-4 w-4" />
              Medios generales
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button className="bg-brand-600 hover:bg-brand-700" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo producto
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <div
          data-tour="catalog-grid"
          className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center"
        >
          <p className="text-lg text-zinc-700">Aún no hay productos.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Agrega tu primer producto para empezar a construir tu catálogo.
          </p>
          <Button
            className="mt-4 bg-brand-600 hover:bg-brand-700"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo producto
          </Button>
        </div>
      ) : (
        <div
          data-tour="catalog-grid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {products.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              sku={product.sku}
              price={product.price}
              description={product.description}
              thumbnail={product.thumbnail}
              mediaCount={product.mediaCount}
              availability={product.availability}
              onDelete={() => setDeleteTarget(product)}
            />
          ))}
        </div>
      )}

      <ProductFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        businessId={businessId}
        onSaved={handleSaved}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        businessId={businessId}
        onImported={handleImported}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar <strong>{deleteTarget?.name}</strong>? Sus
              medios quedarán sin producto asociado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/types'

type Product = Database['public']['Tables']['products']['Row']

export interface ProductFormValues {
  name: string
  sku: string
  price: string
  description: string
  benefits: string
}

interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  product?: Product | null
  onSaved: (product: Product) => void
}

export function ProductFormDialog({
  open,
  onOpenChange,
  businessId,
  product,
  onSaved,
}: ProductFormDialogProps) {
  const [name, setName] = useState(product?.name ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [price, setPrice] = useState(product?.price?.toString() ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [benefits, setBenefits] = useState(product?.benefits ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const payload = {
      name,
      sku: sku.trim() || null,
      price: price ? parseFloat(price) : null,
      description: description.trim() || null,
      benefits: benefits.trim() || null,
    }

    if (product) {
      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', product.id)
        .select()
        .single()
      if (error) {
        setError(error.message)
      } else if (data) {
        onSaved(data)
        onOpenChange(false)
      }
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert({ business_id: businessId, ...payload })
        .select()
        .single()
      if (error) {
        setError(error.message)
      } else if (data) {
        onSaved(data)
        onOpenChange(false)
      }
    }

    setLoading(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{product ? 'Editar producto' : 'Nuevo producto'}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="catalog-name">Nombre</Label>
              <Input
                id="catalog-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del producto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-sku">SKU</Label>
              <Input
                id="catalog-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Código de inventario (opcional)"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-price">Precio</Label>
            <Input
              id="catalog-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-description">Descripción</Label>
            <Textarea
              id="catalog-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Qué es este producto?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="catalog-benefits">Beneficios</Label>
            <Textarea
              id="catalog-benefits"
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="¿Por qué lo comprarían?"
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={loading || !name.trim()}>
            {loading ? 'Guardando...' : product ? 'Guardar cambios' : 'Agregar producto'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

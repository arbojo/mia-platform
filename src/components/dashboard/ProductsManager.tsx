'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Database } from '@/lib/types'

type Product = Database['public']['Tables']['products']['Row']

interface ProductsManagerProps {
  businessId: string
  initialProducts: Product[]
}

export function ProductsManager({ businessId, initialProducts }: ProductsManagerProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [benefits, setBenefits] = useState('')

  const supabase = createClient()

  const handleAdd = async () => {
    if (!name.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('products')
      .insert({
        business_id: businessId,
        name,
        price: price ? parseFloat(price) : null,
        description: description || null,
        benefits: benefits || null,
      })
      .select()
      .single()

    if (!error && data) {
      setProducts((prev) => [data, ...prev])
      setName('')
      setPrice('')
      setDescription('')
      setBenefits('')
    }

    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('products').delete().eq('id', id)
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-xl bg-gray-50 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del producto"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Precio</Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿Qué es este producto?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="benefits">Beneficios</Label>
          <Textarea
            id="benefits"
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            placeholder="¿Por qué lo comprarían?"
          />
        </div>
        <Button
          onClick={handleAdd}
          disabled={loading || !name.trim()}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {loading ? 'Agregando...' : 'Agregar producto'}
        </Button>
      </div>

      <div className="space-y-3">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between p-4 border rounded-xl"
          >
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{product.name}</h3>
              {product.price && (
                <p className="text-sm text-violet-600 font-semibold">
                  ${product.price}
                </p>
              )}
              {product.description && (
                <p className="text-sm text-gray-500 mt-1">{product.description}</p>
              )}
              {product.benefits && (
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-medium">Beneficios:</span> {product.benefits}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(product.id)}
              className="text-red-600 hover:text-red-700"
            >
              Eliminar
            </Button>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Aún no hay productos. Agrega el primero arriba.
          </p>
        )}
      </div>
    </div>
  )
}

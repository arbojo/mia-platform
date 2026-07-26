'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { Database } from '@/lib/types'

type SalesRule = Database['public']['Tables']['sales_rules']['Row']

const categories = [
  { id: 'zones', label: 'Zonas de envío' },
  { id: 'payment', label: 'Métodos de pago' },
  { id: 'schedule', label: 'Horarios' },
  { id: 'promotions', label: 'Promociones' },
  { id: 'restrictions', label: 'Restricciones' },
  { id: 'escalation', label: 'Escalación a humano' },
]

interface RulesManagerProps {
  businessId: string
  initialRules: SalesRule[]
}

export function RulesManager({ businessId, initialRules }: RulesManagerProps) {
  const [rules, setRules] = useState<SalesRule[]>(initialRules)
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('zones')
  const [content, setContent] = useState('')

  const supabase = createClient()

  const handleAdd = async () => {
    if (!content.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('sales_rules')
      .insert({
        business_id: businessId,
        category: category as SalesRule['category'],
        content,
      })
      .select()
      .single()

    if (!error && data) {
      setRules((prev) => [data, ...prev])
      setContent('')
    }

    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('sales_rules').delete().eq('id', id)
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="p-4 border rounded-xl bg-gray-50 space-y-4">
        <div className="space-y-2">
          <Label>Categoría</Label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={category === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategory(cat.id)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="content">Regla</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ej: Solo hacemos envíos a León y Silao"
          />
        </div>
        <Button
          onClick={handleAdd}
          disabled={loading || !content.trim()}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {loading ? 'Agregando...' : 'Agregar regla'}
        </Button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-start justify-between p-4 border rounded-xl"
          >
            <div className="flex-1">
              <Badge variant="secondary" className="mb-2">
                {categories.find((c) => c.id === rule.category)?.label ?? rule.category}
              </Badge>
              <p className="text-gray-900">{rule.content}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(rule.id)}
              className="text-red-600 hover:text-red-700"
            >
              Eliminar
            </Button>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Aún no hay reglas. Agrega la primera arriba.
          </p>
        )}
      </div>
    </div>
  )
}

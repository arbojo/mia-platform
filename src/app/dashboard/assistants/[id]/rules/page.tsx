import { requireAuth } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { RulesManager } from '@/components/dashboard/RulesManager'

export default async function RulesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAuth()

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*')
    .eq('id', id)
    .single()

  if (!assistant) {
    notFound()
  }

  const { data: rules } = await supabase
    .from('sales_rules')
    .select('*')
    .eq('business_id', assistant.business_id)
    .order('priority', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reglas de Venta</h1>
        <p className="text-gray-600">
          Define las reglas que {assistant.name} debe seguir
        </p>
      </div>
      <RulesManager
        businessId={assistant.business_id}
        initialRules={rules ?? []}
      />
    </div>
  )
}

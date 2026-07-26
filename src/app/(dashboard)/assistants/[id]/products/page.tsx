import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProductsManager } from '@/components/dashboard/ProductsManager'

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*')
    .eq('id', id)
    .single()

  if (!assistant) {
    notFound()
  }

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', assistant.business_id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <p className="text-gray-600">
          Gestiona los productos que {assistant.name} puede recomendar
        </p>
      </div>
      <ProductsManager
        businessId={assistant.business_id}
        initialProducts={products ?? []}
      />
    </div>
  )
}

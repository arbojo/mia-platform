interface ProductIntel {
  product_id: string
  product_name: string
  knowledge_level: number
  common_questions_count: number
  answered_successfully: number
  missing_information: string[]
  customer_interest: 'high' | 'medium' | 'low' | 'none'
  status: 'excellent' | 'good' | 'needs_work' | 'critical'
  recommendations: string[]
}

interface ProductIntelligenceCardProps {
  products: ProductIntel[]
}

function getStatusColor(status: ProductIntel['status']) {
  switch (status) {
    case 'excellent': return 'bg-emerald-500'
    case 'good': return 'bg-blue-500'
    case 'needs_work': return 'bg-amber-500'
    case 'critical': return 'bg-red-500'
  }
}

function getStatusBg(status: ProductIntel['status']) {
  switch (status) {
    case 'excellent': return 'bg-emerald-50'
    case 'good': return 'bg-blue-50'
    case 'needs_work': return 'bg-amber-50'
    case 'critical': return 'bg-red-50'
  }
}

function getStatusLabel(status: ProductIntel['status']) {
  switch (status) {
    case 'excellent': return 'Excelente'
    case 'good': return 'Bueno'
    case 'needs_work': return 'Necesita trabajo'
    case 'critical': return 'Crítico'
  }
}

function getInterestLabel(interest: ProductIntel['customer_interest']) {
  switch (interest) {
    case 'high': return 'Alto interés'
    case 'medium': return 'Interés medio'
    case 'low': return 'Poco interés'
    case 'none': return 'Sin consultas'
  }
}

export function ProductIntelligenceCard({ products }: ProductIntelligenceCardProps) {
  const excellent = products.filter((p) => p.status === 'excellent').length
  const good = products.filter((p) => p.status === 'good').length
  const needsWork = products.filter((p) => p.status === 'needs_work').length
  const critical = products.filter((p) => p.status === 'critical').length

  return (
    <div className="rounded-2xl border border-olive-100 bg-white p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">Inteligencia de productos</h3>
        <span className="text-xs text-zinc-400">{products.length} productos</span>
      </div>

      <div className="mt-4 flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />{excellent} excelentes
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-blue-500" />{good} buenos
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-amber-500" />{needsWork} por mejorar
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500" />{critical} críticos
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {products.slice(0, 6).map((product) => (
          <div key={product.product_id} className={`rounded-lg px-4 py-3 ${getStatusBg(product.status)}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-800">{product.product_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{getInterestLabel(product.customer_interest)}</span>
                <span className="text-sm font-bold text-zinc-700">{product.knowledge_level}%</span>
              </div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getStatusColor(product.status)}`}
                style={{ width: `${product.knowledge_level}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-xs text-zinc-500">{getStatusLabel(product.status)}</span>
              <span className="text-xs text-zinc-400">{product.common_questions_count} preguntas</span>
            </div>
            {product.missing_information.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {product.missing_information.map((info) => (
                  <span key={info} className="rounded bg-white px-2 py-0.5 text-xs text-zinc-500">
                    Falta: {info}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

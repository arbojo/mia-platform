import { createAdminClient } from '@/lib/supabase/admin'

export interface ProductIntelligence {
  product_id: string
  product_name: string
  knowledge_level: number
  common_questions_count: number
  answered_successfully: number
  missing_information: string[]
  avg_confidence: number
  customer_interest: 'high' | 'medium' | 'low' | 'none'
  status: 'excellent' | 'good' | 'needs_work' | 'critical'
  recommendations: string[]
}

export interface ProductIntelligenceSummary {
  total_products: number
  excellent_count: number
  good_count: number
  needs_work_count: number
  critical_count: number
  overall_knowledge_level: number
  products: ProductIntelligence[]
}

function getKnowledgeLevel(product: {
  description: string | null
  benefits: string | null
  faq: unknown
  restrictions: string | null
  price: number | null
}): number {
  let score = 0
  if (product.description) score += 25
  if (product.benefits) score += 25
  if (product.price !== null) score += 20
  if (product.restrictions) score += 15
  if (product.faq && Array.isArray(product.faq) && product.faq.length > 0) score += 15
  return Math.min(100, score)
}

function getMissingInformation(product: {
  description: string | null
  benefits: string | null
  faq: unknown
  restrictions: string | null
}): string[] {
  const missing: string[] = []
  if (!product.description) missing.push('Descripción')
  if (!product.benefits) missing.push('Beneficios')
  if (!product.restrictions) missing.push('Restricciones')
  if (!product.faq || !Array.isArray(product.faq) || product.faq.length === 0) {
    missing.push('Preguntas frecuentes')
  }
  return missing
}

function getStatus(level: number): ProductIntelligence['status'] {
  if (level >= 90) return 'excellent'
  if (level >= 70) return 'good'
  if (level >= 40) return 'needs_work'
  return 'critical'
}

function getRecommendations(product: {
  description: string | null
  benefits: string | null
  faq: unknown
  restrictions: string | null
  name: string
}, level: number): string[] {
  const recs: string[] = []

  if (!product.description) {
    recs.push(`Agregar descripción para ${product.name}`)
  }
  if (!product.benefits) {
    recs.push(`Agregar beneficios para ${product.name}`)
  }
  if (!product.faq || !Array.isArray(product.faq) || product.faq.length === 0) {
    recs.push(`Agregar preguntas frecuentes para ${product.name}`)
  }
  if (level < 50) {
    recs.push(`${product.name} necesita atención urgente — información muy incompleta`)
  }

  return recs
}

export async function getProductIntelligence(businessId: string): Promise<ProductIntelligenceSummary> {
  const supabase = createAdminClient()

  const [productsResult, messagesResult, knowledgeResult] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, description, benefits, faq, restrictions, price')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('messages')
      .select('id, content, role, metadata')
      .eq('conversations.business_id', businessId)
      .eq('role', 'user')
      .limit(200),
    supabase
      .from('knowledge_items')
      .select('id, category, content')
      .eq('business_id', businessId)
      .eq('is_active', true),
  ])

  const products = productsResult.data ?? []
  const messages = messagesResult.data ?? []
  const knowledge = knowledgeResult.data ?? []

  const faqKnowledge = knowledge.filter((k) => k.category === 'faq')

  const intelligence: ProductIntelligence[] = products.map((product) => {
    const level = getKnowledgeLevel(product)
    const missing = getMissingInformation(product)

    const productMentions = messages.filter((m) =>
      m.content.toLowerCase().includes(product.name.toLowerCase())
    )

    const questionCount = productMentions.filter((m) =>
      m.content.includes('?') || m.content.toLowerCase().includes('cuánto') ||
      m.content.toLowerCase().includes('cuanto') || m.content.toLowerCase().includes('price') ||
      m.content.toLowerCase().includes('precio')
    ).length

    const productFaqs = faqKnowledge.filter((k) =>
      k.content.toLowerCase().includes(product.name.toLowerCase())
    )

    const customerInterest: ProductIntelligence['customer_interest'] = productMentions.length > 10 ? 'high'
      : productMentions.length > 3 ? 'medium'
      : productMentions.length > 0 ? 'low'
      : 'none'

    return {
      product_id: product.id,
      product_name: product.name,
      knowledge_level: level,
      common_questions_count: questionCount,
      answered_successfully: productFaqs.length,
      missing_information: missing,
      avg_confidence: level,
      customer_interest: customerInterest,
      status: getStatus(level),
      recommendations: getRecommendations(product, level),
    }
  })

  const sorted = intelligence.sort((a, b) => a.knowledge_level - b.knowledge_level)

  return {
    total_products: products.length,
    excellent_count: sorted.filter((p) => p.status === 'excellent').length,
    good_count: sorted.filter((p) => p.status === 'good').length,
    needs_work_count: sorted.filter((p) => p.status === 'needs_work').length,
    critical_count: sorted.filter((p) => p.status === 'critical').length,
    overall_knowledge_level: products.length > 0
      ? Math.round(sorted.reduce((sum, p) => sum + p.knowledge_level, 0) / products.length)
      : 0,
    products: sorted,
  }
}

export async function getSingleProductIntelligence(
  businessId: string,
  productId: string
): Promise<ProductIntelligence | null> {
  const summary = await getProductIntelligence(businessId)
  return summary.products.find((p) => p.product_id === productId) ?? null
}

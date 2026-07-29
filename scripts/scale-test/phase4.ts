import { getSupabase, MetricsCollector } from './utils'
import { BusinessDef } from './config'

export async function phase4LearningEvolution(defs: BusinessDef[], metrics: MetricsCollector): Promise<void> {
  metrics.startPhase('4. Learning Evolution Test')
  const supabase = getSupabase()

  for (const b of defs) {
    const bizId = metrics.getBizId(b.name)
    const asstId = metrics.getAsstId(b.name)
    if (!bizId || !asstId) {
      metrics.recordFailure(`Phase4: Missing IDs for ${b.name}`)
      continue
    }

    try {
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .eq('business_id', bizId)
        .limit(3)

      const productId = products?.[0]?.id

      const corrections = [
        {
          original_response: 'No tengo información sobre ese producto.',
          corrected_response: 'Claro, déjame consultar y te doy los detalles exactos de ese producto.',
          correction_type: 'knowledge',
        },
        {
          original_response: 'No podemos hacer envíos a tu dirección.',
          corrected_response: 'Déjame verificar las zonas de cobertura. ¿Cuál es tu código postal?',
          correction_type: 'rule',
        },
        {
          original_response: 'Eso no está en mis capacidades.',
          corrected_response: 'Permíteme revisar la mejor opción para ayudarte con eso.',
          correction_type: 'instruction',
        },
      ]

      for (const corr of corrections) {
        const { error } = await supabase.from('learning_events').insert({
          business_id: bizId,
          assistant_id: asstId,
          original_response: corr.original_response,
          corrected_response: corr.corrected_response,
          correction_type: corr.correction_type,
          status: 'approved',
          severity: 'medium',
          is_active: true,
        })
        if (error) metrics.recordFailure(`Phase4 correction: ${error.message}`)
      }

      const { data: mem } = await supabase.from('business_memory').insert({
        business_id: bizId,
        memory_type: 'pattern',
        category: 'customer_behavior',
        content: `Los clientes de ${b.name} suelen preguntar por precios y promociones antes de comprar.`,
        evidence: { source: 'scale_test', conversations: 10 },
        confidence: 75,
      }).select().single()
      if (mem) {
        await supabase.from('business_memory').insert({
          business_id: bizId,
          memory_type: 'insight',
          category: 'sales_pattern',
          content: `Ofrecer un descuento del 10% aumenta la conversión en clientes indecisos.`,
          evidence: { source: 'scale_test' },
          confidence: 70,
        })
      }

      console.log(`  ✓ ${b.name}: 3 learning events + 2 memory items created`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      metrics.recordFailure(`Phase4/${b.name}: ${msg}`)
    }
  }

  metrics.endPhase()
}
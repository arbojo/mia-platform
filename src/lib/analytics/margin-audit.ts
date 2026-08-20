import { createAdminClient } from '@/lib/supabase/admin'
import { executeAI } from '@/lib/runtime/execute-ai'

interface ProductMargin {
  product_id: string
  product_name: string
  revenue: number
  cogs: number
  delivery_cost: number
  gross_margin: number
  gross_margin_pct: number
  units_sold: number
}

interface MarginAnomaly {
  product_id: string
  product_name: string
  current_pct: number
  historical_pct: number
  delta: number
  revenue: number
  cogs: number
  delivery_cost: number
  units_sold: number
  probable_cause: string
}

export async function calculateProductMargins(
  businessId: string,
  days: number = 1
): Promise<ProductMargin[]> {
  const admin = createAdminClient()

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceIso = since.toISOString()

  const { data: salesEvents, error: salesErr } = await admin
    .from('sales_events')
    .select('product_id, amount, delivery_cost, metadata')
    .eq('business_id', businessId)
    .eq('event_type', 'SALE_WON')
    .gte('created_at', sinceIso)

  if (salesErr || !salesEvents || salesEvents.length === 0) {
    return []
  }

  const productSales = new Map<string, {
    revenue: number
    delivery_cost: number
    units: number
  }>()

  for (const event of salesEvents) {
    const pid = event.product_id
    if (!pid) continue

    const existing = productSales.get(pid) ?? { revenue: 0, delivery_cost: 0, units: 0 }
    existing.revenue += Number(event.amount ?? 0)
    existing.delivery_cost += Number(event.delivery_cost ?? 0)

    const items = (event.metadata as Record<string, unknown>)?.items
    if (Array.isArray(items)) {
      for (const item of items) {
        const qty = (item as Record<string, unknown>).quantity as number ?? 1
        existing.units += qty
      }
    } else {
      existing.units += 1
    }

    productSales.set(pid, existing)
  }

  const productIds = Array.from(productSales.keys())
  if (productIds.length === 0) return []

  const { data: products } = await admin
    .from('products')
    .select('id, name, cost')
    .in('id', productIds)

  const productMap = new Map((products ?? []).map((p) => [p.id, p]))

  const margins: ProductMargin[] = []

  for (const [pid, sales] of productSales) {
    const product = productMap.get(pid)
    const unitCost = product?.cost ?? 0
    const cogs = unitCost * sales.units

    const grossMargin = sales.revenue - cogs - sales.delivery_cost
    const grossMarginPct = sales.revenue > 0
      ? Math.round((grossMargin / sales.revenue) * 1000) / 10
      : 0

    margins.push({
      product_id: pid,
      product_name: product?.name ?? 'Unknown',
      revenue: sales.revenue,
      cogs,
      delivery_cost: sales.delivery_cost,
      gross_margin: grossMargin,
      gross_margin_pct: grossMarginPct,
      units_sold: sales.units,
    })
  }

  return margins
}

export async function detectMarginAnomalies(
  businessId: string,
  thresholdPct: number = 5
): Promise<MarginAnomaly[]> {
  const currentMargins = await calculateProductMargins(businessId, 1)
  const historicalMargins = await calculateProductMargins(businessId, 30)

  const historicalMap = new Map(
    historicalMargins.map((m) => [m.product_id, m])
  )

  const anomalies: MarginAnomaly[] = []

  for (const current of currentMargins) {
    const hist = historicalMap.get(current.product_id)
    if (!hist || hist.units_sold === 0) continue

    const delta = current.gross_margin_pct - hist.gross_margin_pct

    if (Math.abs(delta) >= thresholdPct) {
      anomalies.push({
        product_id: current.product_id,
        product_name: current.product_name,
        current_pct: current.gross_margin_pct,
        historical_pct: hist.gross_margin_pct,
        delta: Math.round(delta * 10) / 10,
        revenue: current.revenue,
        cogs: current.cogs,
        delivery_cost: current.delivery_cost,
        units_sold: current.units_sold,
        probable_cause: '',
      })
    }
  }

  return anomalies
}

export async function runMarginAudit(businessId: string): Promise<{
  margins: ProductMargin[]
  anomalies: MarginAnomaly[]
  insights_created: number
}> {
  const margins = await calculateProductMargins(businessId, 1)
  const anomalies = await detectMarginAnomalies(businessId, 5)

  let insightsCreated = 0

  if (anomalies.length > 0) {
    const anomalyText = anomalies.map((a) =>
      `${a.product_name}: ${a.historical_pct}% → ${a.current_pct}% (delta: ${a.delta > 0 ? '+' : ''}${a.delta}pp). Revenue: $${a.revenue}, COGS: $${a.cogs}, Delivery: $${a.delivery_cost}, Units: ${a.units_sold}`
    ).join('\n')

    const result = await executeAI({
      mode: 'complete',
      taskType: 'analysis',
      businessId,
      assistantId: '00000000-0000-0000-0000-000000000000',
      requestType: 'margin_audit',
      system: `Eres un analista financiero revisando márgenes de productos para un negocio de retail en México.

Analiza las anomalías de margen detectadas y explica la causa probable de cada cambio.

Responde SOLO con un JSON válido:
{
  "analyses": [
    {
      "product_name": "nombre del producto",
      "cause": "causa probable del cambio de margen en español",
      "severity": "info|warning|critical",
      "recommendation": "recomendación accionable"
    }
  ]
}

Causas comunes a considerar:
- Descuentos aplicados (reduce revenue sin reducir COGS)
- Aumento de costo de proveedor
- Cambio en costo de delivery (zonas, distancias)
- Productos con costo NULL (no registrado)
- Devoluciones
- Mezcla de productos (orden con más productos baratos)

Sé específico y práctico.`,
      messages: [{
        role: 'user',
        content: `Anomalías de margen detectadas en las últimas 24 horas:

${anomalyText}

Total de productos con margen Changed: ${anomalies.length}`,
      }],
      maxTokens: 1500,
      temperature: 0.3,
      responseFormat: 'json',
    })

    try {
      const parsed = JSON.parse(result.content) as {
        analyses: Array<{
          product_name: string
          cause: string
          severity: string
          recommendation: string
        }>
      }

      const admin = createAdminClient()

      for (const analysis of parsed.analyses) {
        const anomaly = anomalies.find((a) => a.product_name === analysis.product_name)
        if (!anomaly) continue

        await admin.from('ai_insights').insert({
          business_id: businessId,
          insight_type: 'product_alert',
          title: `Margen cambió: ${analysis.product_name}`,
          summary: analysis.cause,
          severity: analysis.severity ?? 'warning',
          details: {
            product_id: anomaly.product_id,
            product_name: anomaly.product_name,
            historical_pct: anomaly.historical_pct,
            current_pct: anomaly.current_pct,
            delta: anomaly.delta,
            revenue: anomaly.revenue,
            cogs: anomaly.cogs,
            delivery_cost: anomaly.delivery_cost,
            recommendation: analysis.recommendation,
            type: 'margin_audit',
          },
        })

        insightsCreated++
      }
    } catch {
      console.error('[margin-audit] Failed to parse AI response')
    }
  }

  return { margins, anomalies, insights_created: insightsCreated }
}

import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Fase 2 - Logistica predictiva y compras autonomas (variantes, ROP, ETA, CX)',
    description:
      'Expansion Fase 2 del Inventory Hub. (1) Migracion 042_polymorphic_variants.sql: relajar asset_products a N:M, inventory.resolve_variant() con GIN @> + fallback is_default, trigger handle_sale_won v3. (2) Migracion 043_rop_purchasing.sql: calculate_rop_for_asset, suppliers (supplier_reliability_score/webhook_secret), purchase_orders + purchase_order_events (UNIQUE parcial de sugerencia abierta = idempotencia del comprador autonomo), bom + suggest_bom_procurement, suggest_purchase_orders, handle_supplier_webhook (HMAC verificado en app), vista replenishment_dashboard con semaforo verde/amarillo/rojo. (3) Migracion 044_eta_cx.sql: ledger con transfer_out/in y product_id nullable, network_key en assets, transfers + execute_transfer atomico, calcular_eta (local > transit > purchase > lead), business_settings CX (late_delivery_threshold_days, late_delivery_discount_percent), delivery_promises con payment_context listo para pasarela y trigger handle_sale_won_cx protegido (BEGIN/EXCEPTION; nunca escribe en public, ADR-020). (4) TS: types ampliado + rop.ts/purchasing.ts/eta.ts (verifyWebhookSignature timing-safe + computeEta puro testeable) + fix maybeSingle->limit(1) en import/adjustments/threshold + settings schema. Sin push (Subaru freeze).',
    categories: ['feature', 'schema_change', 'security'],
    filesAffected: 11,
    hasSchemaChanges: true,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['backend', 'database', 'security'],
  },
]

for (const input of tasks) {
  const result = orchestrator.classify(input)
  console.log()
  console.log(orchestrator.generatePreFlightSummary(result))
  const manifest = workflow.createManifest(input.title, input.description, {
    categories: input.categories,
    filesAffected: input.filesAffected,
    hasSchemaChanges: input.hasSchemaChanges,
    hasAIConsumerChanges: input.hasAIConsumerChanges,
    hasSecurityImplications: input.hasSecurityImplications,
    isCrossCutting: input.affectedDomains.length > 1,
    domains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}

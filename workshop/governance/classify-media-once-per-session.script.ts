import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'Regla de envio unico de imagen por producto/sesion + blindaje del pipeline multimedia del bot de WhatsApp (motor Vercel + bridge Fly.io)',
    description:
      'EVIDENCIA del pipeline actual: el bot de WhatsApp envia la imagen del producto via processIncomingMessage (src/lib/runtime/runtime.ts:277-284) -> resolveConditionalMedia (src/lib/runtime/conditional-media.ts:13-82) -> webhook /api/channels/baileys/webhook (src/app/api/channels/baileys/webhook/route.ts:32-33) -> bridge sendToMia -> session-manager.ts handleMessages L598-605 y sendMessage L642-646 con sock.sendMessage(jid, { image: { url }, caption }). El dedup actual es SOLO por knowledge_item_id via tabla chat_media_dispatched con constraint UNIQUE (knowledge_item_id, conversation_id) (migracion 016). GAPS confirmados: (1) NO hay dedup por PRODUCTO: dos knowledge_items con el mismo product_id pueden enviar cada uno su imagen en turnos distintos de la misma conversacion -> spam visual; (2) NO hay validacion de URL: image_url se reenvia tal cual al bridge (podria ser relativa o localhost); (3) el bridge envia { image } sin fallback: si Baileys falla al descargar la imagen, la respuesta de texto se pierde (el catch externo en handleMessages traga el error); (4) cero tests unitarios en services/whatsapp-bridge. DISENO aprobado: (1) Migracion 038_media_sent_products.sql: ALTER TABLE conversations ADD COLUMN media_sent_products UUID[] NOT NULL DEFAULT \'{}\' (flag de sesion solicitado por negocio) + indice GIN para membership; sin cambios de RLS (las politicas existentes de conversations ya cubren tenant+usuario); actualizar tipos Database en src/lib/types/index.ts:406-452. (2) Nuevo src/lib/runtime/media-guard.ts con (a) isSafeMediaUrl(url): exige http(s), host publico en allowlist (SUPABASE_URL host y subdominios *.supabase.co o CDN publico configurado), rechaza localhost, IPs privadas/link-local, userinfo y rutas relativas; (b) productMediaAlreadySent(conversationId, productId): lee conversations.media_sent_products; (c) markProductMediaSent(conversationId, productId): append con dedup via ARRAY(SELECT DISTINCT unnest(...)). (3) resolveConditionalMedia: si el knowledge_item seleccionado tiene product_id ya presente en media_sent_products -> retorna null (respuesta solo texto); si no -> valida isSafeMediaUrl(image_url) (insegura -> null) y registra BOTH chat_media_dispatched Y markProductMediaSent. (4) processIncomingMessage (runtime.ts:302-310): sanitizacion final con isSafeMediaUrl de imageUrl antes de devolverla (defensa en profundidad; insegura -> undefined). (5) Bridge services/whatsapp-bridge: nuevo src/media-url.ts (isSafeMediaUrl, modulo puro standalone) + helper sendReply(socket, jid, { response, imageUrl, interactive }, config) que: si imageUrl es segura intenta { image: { url }, caption: response } y si el envio falla (descarga) hace fallback a { text: response } (nunca se pierde el texto); si imageUrl insegura -> solo texto. Refactor session-manager.ts handleMessages L590-606 y sendMessage L638-651 para delegar en sendReply. (6) Tests engine: extender tests/runtime/conditional-media.test.ts (envio unico por producto por sesion: segunda llamada con el mismo product_id -> null; marca producto; URL insegura -> null; genericos sin product_id siguen con dedup chat_media_dispatched), nuevo tests/runtime/media-guard.test.ts (isSafeMediaUrl: supabase, cdn, http/https, relativa, localhost, IP privada, userinfo; productMediaAlreadySent/markProductMediaSent). (7) Tests bridge: anadir vitest como devDependency + tests de media-url.ts (isSafeMediaUrl) y sendReply (fallback imagen->texto con socket falso, URL insegura -> solo texto). Archivos afectados (10): supabase/migrations/038_media_sent_products.sql, src/lib/types/index.ts, src/lib/runtime/media-guard.ts (nuevo), src/lib/runtime/conditional-media.ts, src/lib/runtime/runtime.ts, tests/runtime/conditional-media.test.ts, tests/runtime/media-guard.test.ts (nuevo), services/whatsapp-bridge/src/media-url.ts (nuevo), services/whatsapp-bridge/src/session-manager.ts, services/whatsapp-bridge/package.json + tests bridge. SIN cambios de prompt ni de comportamiento de IA (solo transporte/deduplicacion de media).',
    categories: ['feature', 'schema_change', 'api_change', 'security'],
    filesAffected: 10,
    hasSchemaChanges: true,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['backend', 'ai', 'infrastructure'],
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
    primaryDomain: 'sales',
    affectedDomains: [],
    technicalDomains: input.affectedDomains,
  }, result)
  console.log(`✓ Manifest created: ${manifest.id} (${manifest.status})`)
}

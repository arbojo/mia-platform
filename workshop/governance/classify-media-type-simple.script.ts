import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Simplificar media_type de knowledge_items a solo image | testimonial',
    description:
      'Los tipos de medio flyer y other no tienen comportamiento diferenciado: el runtime envia todo como imagen+caption (services/whatsapp-bridge/src/media-url.ts:85, sendReply solo recibe imageUrl) y media_type no participa en la seleccion de envio (src/lib/runtime/conditional-media.ts:35-64, seleccion solo por trigger_condition + prioridad de producto). Datos Vitanova: 5 image, 13 other, 0 flyer, 0 testimonial (knowledge_items con imagen en prod). Decidido con el usuario: conservar solo image y testimonial. Plan: (1) migracion nueva supabase/migrations/039_media_type_simple.sql: UPDATE knowledge_items SET media_type=image WHERE media_type IN (flyer,other), DROP CONSTRAINT knowledge_items_media_type_check y agregar CHECK (media_type IN (image,testimonial)), ALTER COLUMN SET DEFAULT image, actualizar COMMENT; (2) acotar la union de tipos a image|testimonial en src/lib/types/index.ts (Row/Insert/Update), src/lib/runtime/runtime.ts:143, src/lib/runtime/conditional-media.ts:11, services/whatsapp-bridge/src/mia-client.ts:20,69; (3) actualizar listas de validacion en src/app/api/knowledge/items/route.ts (L60/L117, default L167 media_type ?? image), src/app/api/knowledge/items/[id]/route.ts (L89), src/lib/knowledge/suggestions.ts:61; (4) UI: quitar flyer/other en MediaEditDialog.tsx:21-27, MediaBrowser.tsx:23-29, MediaGrid.tsx:9-10; (5) test fixture tests/knowledge/suggestions.test.ts:46 other -> testimonial. Sin cambio de comportamiento en envio. Verificacion: lint + build + unit (646) + component (31) + Playwright + Chrome DevTools MCP (Biblioteca Multimedia y media de producto en Catalogo).',
    categories: ['refactor'],
    filesAffected: 10,
    hasSchemaChanges: true,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['database', 'backend', 'frontend'],
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

import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Bridge WhatsApp: dockerizar, desplegar en hosting de contenedores y sincronizar Vercel',
    description:
      'El intento de migrar el bridge de WhatsApp a Cloudflare Workers fallo: el servicio en services/whatsapp-bridge usa @whiskeysockets/baileys + node:http + ws, lo que requiere runtime Node.js persistente con conexiones TCP estables (incompatible con Workers serverless). El worker desplegado en mia-whatsapp-bridge.arbojo.workers.dev es un stub que responde "Hello world" en todas las rutas sin auth. Plan aprobado por el concilio: (1) crear Dockerfile para services/whatsapp-bridge que empaquete el entorno Node completo, (2) probar el contenedor localmente identico a produccion, (3) desplegar en un hosting compatible con contenedores persistente (Fly.io o Railway), (4) SOLO entonces configurar en Vercel las env vars WHATSAPP_BRIDGE_URL (apuntando a la URL real de produccion) y WHATSAPP_BRIDGE_SECRET (sincronizado con el bridge), verificando que el endpoint real responda 401 sin secreto y JSON con secreto. No tocar Vercel hasta tener URL real de produccion. Riesgo: credenciales (service role key de Supabase) en env del servicio; requiere revision de seguridad.',
    categories: ['infrastructure', 'configuration', 'devops'],
    filesAffected: 4,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['backend', 'infrastructure', 'frontend'],
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
  console.log(`V Manifest created: ${manifest.id} (${manifest.status})`)
}

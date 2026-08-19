import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'
import type { BusinessDomain } from './types'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Estabilizar conectividad del bridge WhatsApp: host unico en Fly.io, MIA_APP_URL de produccion, puertos consistentes y anti-crash',
    description:
      'Tras cambio de maquina (Dell Precision) se detecto conflicto critico de sesiones Baileys (stream:error conflict type: replaced) entre la instancia local (PID 10332) y la maquina en Fly.io compitiendo por el mismo socket. Fly.io ademas sufre cold-start/crash-loop intermitente (~21s por request, auto_stop off) y tiene MIA_APP_URL=http://localhost:3000 (heredado del .env de la maquina vieja), por lo que los webhooks no llegan a Vercel en produccion. Plan: (1) detener la instancia local del bridge en la Dell, (2) fijar en Fly.io MIA_APP_URL=https://mia-platform-psi.vercel.app y verificar alineacion de WHATSAPP_BRIDGE_URL/secret en Vercel (ya verificados), (3) corregir discrepancia de puertos (Dockerfile EXPOSE 8787 vs fly.toml internal_port 3001) estandarizando en 3001, (4) endurecer handlers del bridge (try/catch en saveCreds y handlers de eventos Baileys) para evitar unhandled rejections que matan el proceso Node 22, (5) verificar que la maquina Fly se mantenga arriba (healthz <1s) sin bucles de reconexion, (6) actualizar ADR-013 (Baileys 7.0.0-rc14) y documentar la regla de host unico. Riesgo: credenciales de sesion (service role) y estabilidad de produccion; requiere revision de seguridad.',
    categories: ['infrastructure', 'bugfix', 'security'],
    filesAffected: 6,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['platform', 'sales'],
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
    primaryDomain: 'platform',
    affectedDomains: input.affectedDomains as BusinessDomain[],
    technicalDomains: ['backend', 'infrastructure'],
  }, result)
  console.log(`V Manifest created: ${manifest.id} (${manifest.status})`)
}

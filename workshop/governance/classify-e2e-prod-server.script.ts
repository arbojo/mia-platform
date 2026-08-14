import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Run e2e tests against production server (next start) to fix Turbopack dev concurrency flakiness',
    description:
      'Los tests e2e de Playwright fallan de forma intermitente (timeout 30s en page.goto esperando el evento load) cuando varios workers piden la misma ruta en paralelo. Causa raiz aislada: el dev server de Next.js 16 (Turbopack) serializa la compilacion on-demand de los chunks vendor compartidos (react-dom, next-devtools, etc.) bajo carga paralela, tardando 20-30s+ por chunk; con --workers=1 todo pasa en ~2s y con build de produccion (next start) no hay compilacion on-demand. Plan: cambiar el webServer de playwright.config.ts de "npm run dev" a "npm run build && npm run start" (puerto 3000). Sin cambios en codigo de la app ni en los tests. Verificacion: correr la suite e2e completa con workers paralelos y confirmar que auth/public/delivery pasan.',
    categories: ['bugfix'],
    filesAffected: 1,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['testing'],
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

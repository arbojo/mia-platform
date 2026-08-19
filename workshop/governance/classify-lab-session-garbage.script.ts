import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Evitar sesiones automaticas/vacias en el Laboratorio (normal test / chat directo)',
    description:
      'El Laboratorio crea y persiste sesiones basura en la barra lateral: (1) al hacer clic en un escenario, handleStartSession (src/components/laboratorio/LaboratorioClient.tsx:82-101) hace POST inmediato a /api/laboratorio/sessions creando una conversacion vacia (type=simulation, status=active) y una lab_session con titulo por defecto `${mode} test` (normal test) sin ningun mensaje real; (2) LabChatWindow.tsx:94-111 crea una sesion titulo `chat directo` al primer submit, ANTES de llamar a /api/chat, por lo que si el chat falla persiste una sesion vacia. DISENO aprobado (Modo 2): (1) LaboratorioClient.handleStartSession deja de llamar a POST /api/laboratorio/sessions y solo resetea la UI (currentSessionId/currentConversationId/tokens/mensajes/coaching); (2) LabChatWindow conserva la creacion en handleSubmit (primer mensaje real, regla de negocio) y recibe un prop opcional sessionTitle desde LaboratorioClient (Escenario: {nombre} si hay escenario activo, si no chat directo) para titulos descriptivos; (3) sin cambios de schema ni de API route (sessions/route.ts se reutiliza tal cual). Verificacion: lint + build + tests de componente existentes.',
    categories: ['bugfix'],
    filesAffected: 2,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['frontend'],
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

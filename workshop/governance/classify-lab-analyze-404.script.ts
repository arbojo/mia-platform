import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Fix: ¿Por qué respondió esto? devuelve 404 en el Laboratorio',
    description:
      'Al chatear en el Laboratorio sin iniciar sesión previa, conversationId es null y ResponseAnalysis envía un messageId falso (crypto.randomUUID del cliente) que no existe en la tabla messages, por lo que el route /api/laboratorio/analyze responde 404. Fix: crear la conversación/sesión de forma perezosa en el primer mensaje del lab, propagar el conversationId real a ResponseAnalysis, y hacer resiliente el route analyze (respuesta elegante en lugar de 404 crudo).',
    categories: ['bugfix'],
    filesAffected: 3,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['frontend', 'backend'],
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

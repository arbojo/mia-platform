import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Fix bucle de confirmacion: regla anti-bucle en prompts (4 diccionarios) y corolario en regla de pedido de Vitanova',
    description:
      'MIA queda ciclada repitiendo la pregunta de control ("Te confirmo tu pedido?") cuando el cliente responde una negativa informal (un "no" a secas) o desvia la conversacion a otro tema. Causa raiz: el prompt de ventas (waOrderCapture + closing policies en los diccionarios i18n) ordena pedir confirmacion explicita y cerrar cada respuesta con gancho comercial; no existe una regla que le diga que hacer ante una negativa informal o un cambio de tema, por lo que repite el template. Fix: (1) agregar en waOrderCapture y en las closing policies una regla anti-bucle: si el cliente rechaza informalmente o desvia a otro tema, reconocerlo, pivotar con naturalidad y NO repetir la pregunta de confirmacion; una negativa clara detiene el intento de cierre. Aplica a los 4 diccionarios (es/en/pt/ja). (2) Actualizar la sales_rule de Vitanova en la DB (y su seed) anadiendo el corolario de que no se insiste tras una negativa o desvio. Sin cambios de schema ni de seguridad.',
    categories: ['ai_behaviour'],
    filesAffected: 6,
    hasSchemaChanges: false,
    hasAIConsumerChanges: true,
    hasSecurityImplications: false,
    affectedDomains: ['ai', 'i18n', 'backend'],
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

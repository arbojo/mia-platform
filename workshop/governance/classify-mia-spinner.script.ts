import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Logo MIA girando como indicador de carga (auth + dashboards)',
    description:
      'Capricho visual aprobado por el usuario: usar el logo de MIA (icono Sparkles del sidebar, ActivityRail.tsx:199-202, color var(--module-accent) + drop-shadow(0 0 6px var(--module-glow-soft))) girando con animate-spin como indicador de "cargando", en lugar de los spinners genericos de borde/Loader2. Alcance: solo auth y spinners de pantalla de dashboard, NO botones. Plan: (1) nuevo componente src/components/ui/mia-spinner.tsx con MiaSpinner presentacional (Sparkles + animate-spin + color/glow por CSS vars, prop size via className, sin use client); (2) reemplazos: login/page.tsx:70 y signup/page.tsx:92 (borde spinner en "Verificando sesion..."), MemoryPanel.tsx:63 (Loader2), WeeklyReportCard.tsx:67 (borde spinner), ConnectionsManager.tsx:572 (Loader2 estado WhatsApp). Se mantienen los iconos giratorios dentro de botones (HealthDashboard.tsx:82 RefreshCw, ConnectionsManager.tsx:620 Loader2 en boton) y el driver portal (fuera de alcance). Sin cambios de schema, API, backend ni AI. Verificacion: lint + build + unit (674) + Playwright (52) + visual en produccion (Vercel) login y dashboard.',
    categories: ['ui_change'],
    filesAffected: 6,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['frontend', 'ux'],
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

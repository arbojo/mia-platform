import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title: 'Motor de diagnóstico y protocolo No Pass No Commit (health-check persistente)',
    description:
      'Integrar servicio de salud persistente: health-check automatizado (Supabase conectividad/latencia, tokens Google Auth, persistencia de memoria de chat, indexación Vitanova) que bloquea commit/build si falla y genera log legible en el dashboard admin con origen de la falla y ruta de solución.',
    categories: ['feature', 'infrastructure', 'security', 'schema_change'],
    filesAffected: 10,
    hasSchemaChanges: true,
    hasAIConsumerChanges: false,
    hasSecurityImplications: true,
    affectedDomains: ['backend', 'frontend', 'database', 'infrastructure'],
  },
  {
    title: 'Ingeniería de UX proactivo y wayfinding (dropzones, breadcrumbs, layouts dinámicos)',
    description:
      'Componentes de drag-and-drop masivo con validación visual de formatos (PDF, imágenes, CSV) y barras de progreso, reemplazando botones de exploración nativos; encabezado dinámico y breadcrumbs obligatorios en cada vista del dashboard; layouts flexibles Flexbox/Grid sin saturación visual.',
    categories: ['feature', 'ui_change'],
    filesAffected: 15,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['frontend'],
  },
  {
    title: 'Módulo de accesibilidad, ergonomía y salud óptica (pestaña dedicada)',
    description:
      'Vista "Preferencias de Accesibilidad y Ergonomía" persistida en tabla de perfil Supabase: modo espejo (sidebar derecha/izquierda), modo óptico antifatiga (paleta sin negro puro/blanco brillante, selector font-weight, anti-aliasing), y selector de temperatura de color (filtro CSS cálido/frío).',
    categories: ['feature', 'schema_change', 'ui_change'],
    filesAffected: 8,
    hasSchemaChanges: true,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['frontend', 'database', 'backend'],
  },
  {
    title: 'Arquitectura multilingüe nativa i18n (es/en/pt/ja)',
    description:
      'Diccionarios JSON por idioma (es base, en, pt, ja), selector global de idioma vinculado al perfil Supabase, refactor de todo texto estático a claves i18n, y adaptación del prompt de sistema de los agentes IA al idioma activo.',
    categories: ['feature', 'refactor', 'ai_behaviour', 'schema_change'],
    filesAffected: 25,
    hasSchemaChanges: true,
    hasAIConsumerChanges: true,
    hasSecurityImplications: false,
    affectedDomains: ['frontend', 'backend', 'ai', 'database'],
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

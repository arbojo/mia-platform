import { Orchestrator, type OrchestratorInput } from './orchestrator'
import { WorkflowEngine } from './workflow'

const orchestrator = new Orchestrator()
const workflow = new WorkflowEngine()

const tasks: OrchestratorInput[] = [
  {
    title:
      'Sellar compatibilidad multiplataforma (Windows): añadir .gitattributes con reglas explícitas de fin de línea y documentar la sección "Desarrollo en Windows" en el README',
    description:
      'EVIDENCIA del estado actual (HEAD 06ed13d, working tree limpio): (1) todos los npm scripts del repo (dev, build, lint, test:unit, test:e2e, governance, subaru, doctor, environment-check) usan solo npx/node/next/vitest/playwright/tsx, sin sintaxis bash-only (verificado leyendo package.json: los 40 scripts no contienen &&, |, cp, rm ni heredocs). (2) Cero shell-outs en código: rg de spawn|execSync|/bin/sh|bash -c|process.platform en src/, scripts/, workshop/ y services/ devuelve 0 resultados -> el toolchain es JS puro y cross-platform. (3) El repo ya incluye soporte Windows nativo para distribución: start.bat y build-distribute.bat (gemelos de start.sh) y README-DISTRIBUTE.md. (4) El .gitattributes actual solo define filtros git-crypt para .env.local y services/whatsapp-bridge/.env; NO define reglas de fin de línea (text/auto, eol). Sin ellas, con core.autocrlf=true (default Windows) los archivos se checkoutean con CRLF y start.sh bajo WSL/Git-Bash puede romperse por "bad interpreter" (CRLF en shebang). PLAN: (1) crear .gitattributes con * text=auto, *.sh text eol=lf, *.bat text eol=crlf, y mantener los filtros git-crypt existentes; (2) añadir sección "## Desarrollo en Windows" al README.md documentando: requisitos (Node 22 exacto via fnm/nvm-windows, npm >=10), paso de git-crypt unlock para .env.local y bridge .env, comandos idénticos a Linux (npm ci, npm run dev, npm run test:unit, npx playwright install), notas sobre core.autocrlf y la opción WSL2; (3) verificar git status (sin cambios de contenido en otros archivos), npm run lint, commit descriptivo + push a origin/main (pull --rebase antes porque el remoto avanza con regeneración de MASTER.md). No se toca código de producción: solo config de git y documentación.',
    categories: ['documentation'],
    filesAffected: 2,
    hasSchemaChanges: false,
    hasAIConsumerChanges: false,
    hasSecurityImplications: false,
    affectedDomains: ['infrastructure'],
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

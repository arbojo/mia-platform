import * as fs from 'node:fs'
import * as path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(__dirname, '..', '..')
const OUTPUT_DIR = path.join(ROOT, 'docs')
const OUTPUT = path.join(OUTPUT_DIR, 'MASTER.md')

interface GitInfo {
  head: string
  headDate: string
  branch: string
  commits: string[]
  remote: string
}

interface PackageInfo {
  name: string
  version: string
  scripts: string[]
  dependencies: string[]
  devDependencies: string[]
}

interface TableInfo {
  name: string
  file: string
}

interface AdrInfo {
  file: string
  title: string
}

interface TaskInfo {
  id: string
  title: string
  status: string
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

function walkDir(dir: string, base: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkDir(full, base))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(path.relative(base, full).split('\\').join('/'))
    }
  }
  return out.sort()
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return null
  }
}

function getGitInfo(): GitInfo {
  return {
    head: run('git rev-parse --short HEAD'),
    headDate: run('git show -s --format=%cI HEAD'),
    branch: run('git branch --show-current'),
    commits: run('git log --oneline -20')
      .split('\n')
      .filter(Boolean),
    remote: run('git remote get-url origin'),
  }
}

function getPackageInfo(): PackageInfo {
  const pkg = readJson<{
    name: string
    version: string
    scripts: Record<string, string>
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }>(path.join(ROOT, 'package.json'))

  const nextVersion = pkg?.dependencies?.next ?? '16'

  return {
    name: pkg?.name ?? 'unknown',
    version: `${nextVersion}`,
    scripts: Object.entries(pkg?.scripts ?? {}).map(([k, v]) => `${k}: ${v}`),
    dependencies: Object.keys(pkg?.dependencies ?? {}),
    devDependencies: Object.keys(pkg?.devDependencies ?? {}),
  }
}

function parseTables(migrationsDir: string): TableInfo[] {
  if (!fs.existsSync(migrationsDir)) return []
  const tables: TableInfo[] = []
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
    const matches = content.matchAll(/CREATE TABLE\s+(?:public\.)?([a-z_]+)/gi)
    for (const m of matches) {
      tables.push({ name: m[1], file })
    }
  }
  return tables
}

function parseAdrs(adrDir: string): AdrInfo[] {
  if (!fs.existsSync(adrDir)) return []
  const files = fs.readdirSync(adrDir).filter((f) => f.endsWith('.md')).sort()
  const adrs: AdrInfo[] = []
  for (const file of files) {
    const content = fs.readFileSync(path.join(adrDir, file), 'utf-8')
    const titleMatch = content.match(/^#\s+.+?\s*[—-]\s*(.+)$/m) ?? content.match(/^#\s+(.+)$/m)
    const title = titleMatch?.[1] ?? file.replace(/\.md$/, '')
    adrs.push({ file, title })
  }
  return adrs
}

function getTasks(): TaskInfo[] {
  const tasksDir = path.join(ROOT, '.governance', 'tasks')
  if (!fs.existsSync(tasksDir)) return []
  return fs
    .readdirSync(tasksDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const t = readJson<{ id: string; title: string; status: string }>(
        path.join(tasksDir, f)
      )
      return { id: t?.id ?? f.replace(/\.json$/, ''), title: t?.title ?? '', status: t?.status ?? 'unknown' }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

function markdownTable(headers: string[], rows: string[][]): string {
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ]
  return lines.join('\n')
}

function buildMasterDoc(
  git: GitInfo,
  pkg: PackageInfo,
  tables: TableInfo[],
  adrs: AdrInfo[],
  tasks: TaskInfo[],
  apiRoutes: string[],
  pages: string[],
  components: string[],
  libModules: string[],
  migrations: string[],
  tests: string[]
): string {
  const generatedAt = git.headDate || new Date().toISOString()
  const docTables = tables.map((t) => [t.name, t.file])
  const docTasks = tasks.map((t) => [t.id, t.title, t.status])
  const docAdrs = adrs.map((a) => [a.file.replace(/\.md$/, ''), a.title])

  return `# MIA Platform — Documento Maestro de Arquitectura

> **Documento auto-generado.** No lo edites a mano: se regenera en cada commit con \`npm run docs:generate\`.
> Fuente de verdad: este repositorio en \`${git.head}\`.

| Metadato | Valor |
|----------|-------|
| **Commit HEAD** | \`${git.head}\` |
| **Rama** | \`${git.branch}\` |
| **Remoto** | \`${git.remote}\` |
| **Generado** | ${generatedAt} |

---

## 1. Qué es MIA

MIA **no es un chatbot**. Es una **plataforma de inteligencia de ventas conversacional** que permite a las empresas:

- **Aprender** el negocio mediante conocimiento estructurado, productos y reglas.
- **Conversar** con clientes en lenguaje natural.
- **Recordar** interacciones, preferencias y contexto a lo largo del tiempo.
- **Entrenarse** mediante simulación y correcciones.
- **Operar** en múltiples canales desde un núcleo inteligente único.

**Filosofía central**: contratar y entrenar a un nuevo empleado, no configurar software.

**Límite de dominio**: la responsabilidad de MIA empieza cuando empieza una conversación con un cliente y termina cuando (1) la venta se cierra o descarta, (2) los datos del cliente se estructuran o (3) se emiten eventos de Sales Intelligence. MIA **no** hace ERP, inventario, logística, facturación ni cobros. Ver [ADR-010](docs/adr/010-sales-domain-boundary.md).

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js ${pkg.version} (App Router) |
| UI | React 19 |
| Lenguaje | TypeScript (strict mode) |
| Estilos | Tailwind CSS v4 |
| Componentes | shadcn/ui |
| Base de datos | Supabase (PostgreSQL + Row Level Security) |
| Auth | Email/password + Google OAuth via \`@supabase/ssr\` |
| AI | OpenAI \`gpt-4o-mini\` via Vercel AI SDK |
| Testing | Playwright (e2e) + Vitest (unit) |
| CI | GitHub Actions |

**Dependencias de producción** (${pkg.dependencies.length}): ${pkg.dependencies.join(', ')}

**DevDependencies** (${pkg.devDependencies.length}): ${pkg.devDependencies.join(', ')}

---

## 3. Arquitectura General

Diseño **multi-tenant desde el día uno**. Toda la data está acotada a un negocio mediante RLS.

\`\`\`
Business → Assistants → Customers → Conversations → Messages
\`\`\`

Patrón de cliente Supabase:

| Cliente | Archivo | Uso |
|---------|---------|-----|
| Browser | \`src/lib/supabase/client.ts\` | \`createBrowserClient\` — solo frontend |
| Server | \`src/lib/supabase/server.ts\` | Lecturas server-side |
| Admin | \`src/lib/supabase/admin.ts\` | Escrituras server-side (bypassa RLS) |
| Route Handler | \`src/lib/supabase/route-handler.ts\` | Route Handlers, propaga cookies |

**Regla crítica**: cualquier Route Handler que haga escrituras **debe** usar el cliente admin. Las lecturas pueden usar el server client.

---

## 4. Modelo de Datos

${tables.length} tablas definidas en \`supabase/migrations/\`:

${markdownTable(['Tabla', 'Migración'], docTables)}

Todas las tablas tienen **RLS habilitado y forzado**, scoped al \`business_id\` del usuario autenticado. Las migraciones son **inmutables** — los cambios de esquema se hacen solo mediante migraciones nuevas.

### Migraciones

${markdownTable(['#', 'Archivo'], migrations.map((m, i) => [`${i + 1}`, m]))}

---

## 5. Dominio de Venta (ADR-010)

MIA **emite** eventos de Sales Intelligence; los sistemas externos (ERP, CRM, billing, logística) los consumen. MIA nunca llama APIs operativas externas directamente.

Eventos: \`SALE_STARTED, PRODUCT_SELECTED, OBJECTION_DETECTED, OBJECTION_RESOLVED, UPSELL_ACCEPTED, CROSSSELL_ACCEPTED, FOLLOWUP_REQUIRED, SALE_WON, SALE_LOST, CUSTOMER_HESITATION, PRICE_ACCEPTED, PRICE_REJECTED\`

**Test de frontera**: "¿Esto ayuda a MIA a vender mejor?" Si la respuesta es no, pertenece a otro dominio.

---

## 6. Sistema de IA

| Componente | Archivo | Responsabilidad |
|------------|---------|-----------------|
| Cliente OpenAI | \`src/lib/ai/client.ts\` | Singleton, \`MODEL='gpt-4o-mini'\`, costos por token |
| Prompt Builder | \`src/lib/ai/prompts.ts\` | Ensambla el system prompt maestro |
| Context Builder | \`src/lib/ai/knowledge.ts\` | Obtiene y estructura data de la DB |
| Memory | \`src/lib/ai/memory.ts\` | Memoria de negocio |
| Customer Memory | \`src/lib/ai/customer-memory.ts\` | Memoria de cliente |
| Maturity | \`src/lib/ai/maturity.ts\` | Etapa de madurez del asistente |
| Readiness | \`src/lib/ai/readiness.ts\` | Índice de preparación ponderado |
| Skills | \`src/lib/ai/skills.ts\` | Habilidades del asistente |
| Product Intelligence | \`src/lib/ai/product-intelligence.ts\` | Análisis de productos/objeciones |
| Weekly Report | \`src/lib/ai/weekly-report.ts\` | Reporte semanal narrativo |

**Reglas**:
- Nunca se hardcodea conocimiento: todo proviene de la DB.
- Toda llamada AI se registra con \`recordAiUsage()\` y \`request_type\`.
- El contexto se construye **exclusivamente** con datos de la base de datos.

---

## 7. API Routes

${apiRoutes.length} rutas en \`src/app/api/\`:

\`\`\`
${apiRoutes.join('\n')}
\`\`\`

---

## 8. Páginas

${pages.length} páginas en \`src/app/\`:

\`\`\`
${pages.join('\n')}
\`\`\`

---

## 9. Componentes

${components.length} componentes en \`src/components/\`:

\`\`\`
${components.join('\n')}
\`\`\`

---

## 10. Módulos de Lógica (\`src/lib/\`)

${libModules.length} módulos:

\`\`\`
${libModules.join('\n')}
\`\`\`

---

## 11. Gobernanza y Workflow de Desarrollo

MIA usa un **sistema de agentes de ingeniería** con 17 roles (ver \`AGENTS.md\` y \`docs/adr/001-agent-system.md\`). El Orchestrator es el punto de entrada: clasifica cada tarea (simple/compleja), selecciona agentes y coordina el flujo.

**Gate obligatorio antes de tocar código**:
\`\`\`bash
npx tsx workshop/governance/cli.ts classify   # clasificar tarea
npx tsx workshop/governance/cli.ts validate   # verificar aprobación
\`\`\`

**Artefactos**:
- Manifests de tareas: \`.governance/tasks/<id>.json\`
- Log de gobernanza: \`.governance/logs/governance-<fecha>.log\`

**Tareas registradas (${tasks.length})**:

${markdownTable(['ID', 'Título', 'Estado'], docTasks)}

---

## 12. Decisiones de Arquitectura (ADRs)

${adrs.length} ADRs en \`docs/adr/\`:

${markdownTable(['ADR', 'Título'], docAdrs)}

---

## 13. Tests

\`\`\`
${tests.join('\n')}
\`\`\`

---

## 14. Commits Recientes

\`\`\`
${git.commits.join('\n')}
\`\`\`

---

## 15. Comandos de Desarrollo

\`\`\`bash
npm run dev                 # dev server (puerto 3000)
npm run build               # build de producción
npm run lint                # ESLint (0 errores, 0 warnings)
npm test                    # Playwright e2e
npm run test:unit           # Vitest unit tests
npm run docs:generate       # regenerar ESTE documento maestro
npm run council-audit       # auditoría post-desarrollo del council
npm run governance          # CLI de gobernanza
\`\`\`

---

## 16. Guía de Lectura para Otra IA

Para entender este proyecto al máximo:

1. **Empieza por \`AGENTS.md\`** — define la filosofía, los 17 agentes, el workflow obligatorio, las reglas de calidad y el límite de dominio.
2. **Lee este documento maestro** — te da el mapa actual del código (HEAD, tablas, rutas, componentes, ADRs).
3. **Revisa los ADRs** en \`docs/adr/\` — cada decisión arquitectónica importante tiene su registro.
4. **Lee la gobernanza** en \`workshop/governance/\` — cómo se clasifican y aprueban las tareas.
5. **Antes de modificar código**: ejecuta \`npx tsx workshop/governance/cli.ts validate\` para verificar que existe un manifest aprobado.
6. **Después de modificar código**: pasa lint + build + tests antes de reportar completado.
7. **Nunca** modifiques migraciones ya aplicadas ni crees jerarquías de datos paralelas al modelo multi-tenant.

**Reglas de oro**:
- No inventar información: el contexto AI se construye solo con data real de la DB.
- Escrituras server-side → cliente admin; lecturas → server client.
- Servidor y gobernanza primero: ningún cambio sin manifest aprobado.
`
}

function main(): void {
  const srcDir = path.join(ROOT, 'src')
  const apiDir = path.join(srcDir, 'app', 'api')
  const appDir = path.join(srcDir, 'app')
  const componentsDir = path.join(srcDir, 'components')
  const libDir = path.join(srcDir, 'lib')
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations')
  const adrDir = path.join(ROOT, 'docs', 'adr')
  const testsDir = path.join(ROOT, 'tests')

  const git = getGitInfo()
  const pkg = getPackageInfo()
  const tables = parseTables(migrationsDir)
  const adrs = parseAdrs(adrDir)
  const tasks = getTasks()

  const apiRoutes = walkDir(apiDir, apiDir).map((f) => f.replace(/\/route\.ts$/, '') || '/')
  const pages = walkDir(appDir, appDir).filter((f) => /page\.tsx$/.test(f)).map((f) => f.replace(/(\/|^)page\.tsx$/, '$1').replace(/\/$/, '') || '/')
  const components = walkDir(componentsDir, componentsDir).filter((f) => !f.startsWith('ui/'))
  const libModules = walkDir(libDir, libDir)
  const migrations = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
    : []
  const tests = fs.existsSync(testsDir)
    ? fs.readdirSync(testsDir).filter((f) => /\.(spec|test)\.(ts|tsx)$/.test(f))
    : []

  const doc = buildMasterDoc(git, pkg, tables, adrs, tasks, apiRoutes, pages, components, libModules, migrations, tests)

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT, doc, 'utf-8')

  const summary = [
    `MASTER.md regenerado en ${new Date().toISOString()}`,
    `  HEAD: ${git.head} (${git.branch})`,
    `  Tablas: ${tables.length} | ADRs: ${adrs.length} | Tareas: ${tasks.length}`,
    `  API routes: ${apiRoutes.length} | Páginas: ${pages.length} | Componentes: ${components.length}`,
    `  Output: ${path.relative(ROOT, OUTPUT)}`,
  ]
  console.log(summary.join('\n'))
}

main()

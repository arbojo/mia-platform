# Engineering Loop — Estado Actual del Sistema (Auditoría Forense)

**Fecha**: 2026-08-23
**Tipo**: READ-ONLY forensic audit. Nada fue implementado, modificado ni commiteado.
**HEAD auditado**: `f215c79` (`subaru: checkpoint TASK-20260820-ADR027 - completado`), 775 commits totales.

## Pregunta central

> ¿Qué tan cerca está MIA HOY de poder gestionar autónomamente una misión de
> ingeniería de software usando Nemotron y Big Pickle como workers de ejecución
> intercambiables?

**Respuesta corta**: MIA ya posee la capa de ESTADO duradero (Subaru), la capa de
GOBERNANZA machine-readable (governance CLI + 124 manifests reales), un motor de
auditoría determinista ejecutable (Council) y un pipeline de evidencia post-desarrollo.
Lo que NO posee es la capa de ACTUACIÓN: nada en el repositorio puede invocar,
seleccionar, supervisar o cambiar un worker. La orquestación entre Nemotron y
Big Pickle es hoy 100% humana. **El loop existe como esqueleto; el músculo que lo
cierra (worker actuation + decisión de siguiente acción) no existe.**

---

## 1. Orchestrator Audit

| Manifestación | Ubicación | Naturaleza |
|---|---|---|
| Persona | `.agents/orchestrator.md` | DOCUMENTATION_ONLY — responsabilidades/autoridades en prosa |
| Clasificador | `workshop/governance/orchestrator.ts:29` — `class Orchestrator.classify()` | EXISTS_AND_EXECUTABLE (solo clasificación) |

**Comportamiento real verificado** (`orchestrator.ts:30-42`): recibe input estructurado
(título, categorías, nº archivos, flags de schema/AI/security), calcula complexity por
conteo de drivers (`:72-93`: ≥1 driver → complex), selecciona agentes desde
`AGENT_TASK_MAP` + reglas condicionales (`:95-131`: schema → database+security;
complex → architect+qa+godzilla+release; siempre añade memory_engineer), los ordena
según secuencia de workflow (`:133-159`) y elige quality gates (`:161-177`).

**Lo que NO hace**: no crea tareas por sí solo, no invoca agentes, no selecciona
workers, no reacciona a resultados de ejecución, no detecta completion/failure/blockage,
no continúa misiones.

**Clasificación: PARTIAL** — clasificación ejecutable real; orquestación de ejecución
inexistente. El routing produce un `ClassificationResult`; un humano debe actuar sobre él.

## 2. Subaru Audit

Implementación real y usada en producción:

- `workshop/subaru/cli.ts` (767 líneas) + `workshop/subaru/lib.ts` (320 líneas) + tests propios
- Máquina de estados real: `frozen | in_progress | blocked | completed` (`lib.ts:1-9`)
- Checkpoint Markdown con frontmatter machine-readable:
  `docs/checkpoints/active-subaru-checkpoint.md`
- Comandos: `freeze / mark / complete / block / revive / status / bootstrap` (`cli.ts:712-733`)
- Persistencia vía git real: `spawnSync('git', ...)` commit+push en cada mutación (`cli.ts:90-97`)
- `mark` secuencial e idempotente con flip de checkbox (`lib.ts:65-94`)
- `revive` con drift detection (`cli.ts:455-508`): bloquea ante checkpoint editado a mano,
  working tree sucio, frontmatter contradictorio o remoto adelantado
- Governance gate integrado: `freeze`/`complete` exigen manifest aprobado vía
  `WorkflowEngine.assertGovernanceApproved` (`cli.ts:69,169-171`)
- Secret scan antes de persistir (`lib.ts:47-63`)
- Bootstrap restaura el agente espejo en `~/.config/opencode/agent/subaru.md` (`cli.ts:64-67`)

**Evidencia de uso real (no teórico)**:

```
git log --grep=subaru:
f215c79 subaru: checkpoint TASK-20260820-ADR027 - completado
e7945bf subaru: checkpoint TASK-20260822-TESTFIX - completado
8823669..30e79cd subaru: checkpoint TASK-20260822-TESTFIX - en-progreso (×6)
```

El checkpoint activo registra `last_machine: DESKTOP-VN2R21O`, misión completada 5/5
(2026-08-22). Subaru ha sostenido continuidad multi-máquina y multi-sesión reales.

**¿Puede servir como capa de estado duradera del loop? SÍ.** Es agnóstico del worker:
cualquier worker que ejecute `revive` obtiene estado exacto y siguiente paso. NO hace:
invocar workers, decidir el siguiente paso por sí mismo, detectar estancamiento,
escalar entre workers.

**Clasificación: EXISTS_AND_EXECUTABLE**

## 3. Council Audit

Existen DOS cosas llamadas "Council" — distinguirlas es crítico:

### 3a. Council Engine determinista (`workshop/council/`)

- `core/council-engine.ts:11-59`: Scheduler → ParallelDispatcher → ResultCollector reales
- `dispatcher/parallel-dispatcher.ts:27-46`: dispatch paralelo real con timeout (`withTimeout`)
- Roles como heurísticas deterministas, NO LLMs (`roles/qa.ts:9-39`: si
  `validationResults.tests` es false → finding high; si `errorCount > 0` → finding medium)
- Pipeline completo ejecutable: `scripts/run-council-audit.ts` (contexto git real →
  ADRs → Evidence First pre-audit → engine → reportes JSON+MD persistidos en
  `workshop/council/reports/`)
- **Cableado automático a CI**: `.github/workflows/council-audit.yml` corre
  `npm run council-audit` en cada push a `main`, advisory (`continue-on-error`),
  reporte subido como artefacto

### 3b. Council deliberativo (governance)

- `workshop/governance/workflow.ts:23-116`: `WorkflowEngine` con manifests JSON en
  `.governance/tasks/`, transiciones validadas, decisiones approve/reject machine-readable
  con auto-transición de status (`addDecision :88-110`: any reject → rejected;
  all approved → approved)
- **124 manifests reales** en `.governance/tasks/` — uso histórico intensivo
- Las decisiones las registran humanos/agentes manualmente vía CLI
  (`workshop/governance/cli.ts approve <id> <rol> <rationale>`)

**¿Las decisiones pueden volverse tareas / disparar ejecución?** Parcialmente: el
manifest aprobado DESBLOQUEA a Subaru (gating en freeze/complete), pero nadie invoca
la ejecución posterior.

**Clasificación: PARTIAL** — auditoría determinista ejecutable y automatizada en CI;
deliberación LLM inexistente; registro de decisiones manual pero machine-readable.

## 4. Auditoría de los 23 Roles

| # | Rol | Clasificación | Evidencia |
|---|-----|---------------|-----------|
| 1 | Orchestrator | **E (híbrido)** | `.agents/orchestrator.md` (persona) + `governance/orchestrator.ts` clasificador ejecutable parcial |
| 2 | CTO | **B/D** | `.agents/cto.md` prosa only; sin código |
| 3 | Architect | **F** | persona `.agents/architect.md` + heurística ejecutable `council/roles/architect.ts` |
| 4 | AI Engineer | **B** | persona only; el runtime de IA del producto es otro dominio |
| 5 | Backend Engineer | **B** | persona only |
| 6 | Frontend Engineer | **B** | persona only |
| 7 | Database Engineer | **B** | persona only; migraciones aplicadas por humano/agente |
| 8 | Domain Expert | **B** | persona only |
| 9 | Product Manager | **F** | persona + heurística `council/roles/product.ts` |
| 10 | QA Engineer | **F** | persona + heurística `council/roles/qa.ts`; gates reales en `scripts/post-development-audit.ts:22-39` |
| 11 | Release Manager | **B** | persona + convención; sin código de release automation |
| 12 | Security Engineer | **F** | persona + heurística `council/roles/security.ts` + `npm run secrets-check` (`scripts/secrets-check.mjs`) |
| 13 | Performance Engineer | **F** | persona + heurística `council/roles/performance.ts` |
| 14 | Analytics Engineer | **B** | persona only |
| 15 | Frontline Architect | **B** | persona; su "control tower" conceptual mapea a `workshop/intelligence/` (rule-engine) que hoy solo alimenta reportes |
| 16 | Godzilla | **B/D** | persona extensa (12.6 KB) + string de rol en `governance/types.ts`; **cero código ejecutable de stress-testing** |
| 17 | Infrastructure Guardian | **A/F** | ejecutable REAL: `npm run doctor` (`scripts/doctor.script.ts`: health checks con Supabase) y `environment-check`; + persona |
| 18 | Infrastructure Bootstrap | **B/D** | persona; instalación guiada manual; `subaru bootstrap` solo restaura el agente espejo |
| 19 | Memory Engineer | **A/F** | ejecutable REAL: `memory/memory-indexer.ts` (indexa ADRs+council reports → `.mia-memory/index.json`, 36 entradas, lastScan 2026-08-08) + query CLI + artifacts JSON; + persona |
| 20 | Commander — MIA Landings | **B/D** | persona `commander.md` (3.6 KB) only |
| 21 | PRD Generator | **B/D** | persona `prd-generator.md` (2.2 KB) only |
| 22 | Experience Memory Blueprint | **D** | documento de diseño (`experience-memory-blueprint-v4.md`); NOTA: existe memoria de experiencia en el PRODUCTO (src) — es otro dominio, no ingeniería |
| 23 | Subaru | **E** | CLI ejecutable completa + estado duradero probado (ver §2) |

Leyenda: A=ejecutable, B=prompt/persona, C=regla governance, D=documentación,
E=componente orquestación, F=híbrido.

**Hallazgo central**: 18 de 23 roles son personas/documentación. Solo Subaru,
Memory Engineer e Infrastructure Guardian tienen implementaciones ejecutables
sustantivas, y Orchestrator un clasificador parcial.

## 5. Worker / Runtime Audit

**Búsqueda exhaustiva realizada**: `ollama|nemotron|big.?pickle` en todo `workshop/`,
`scripts/`, `src/`, configs → **cero resultados**. Usos de `child_process`: solo git
adapters (`workshop/git/git-adapter.ts:1`, `workshop/memory/git-adapter.ts:1,39`),
gates locales (`post-development-audit.ts:32`) y operaciones git de Subaru (`cli.ts:91`).

No existe mecanismo para:
- invocar un worker externo / Ollama / modelo local / agente cloud
- pasar una tarea a otro worker
- detectar completion/failure de un worker
- capturar output o fallos de worker
- resumir tras fallo de worker (Subaru permite que OTRO humano inicie el revive,
  pero nadie lanza al segundo worker)
- escalar automáticamente de un worker a otro

La única "integración" con workers es implícita: OpenCode es el harness donde el
humano carga un modelo u otro. Subaru bootstrap restaura un agente espejo
(`~/.config/opencode/agent/subaru.md`), lo que demuestra conciencia del harness,
no automatización del mismo.

**Clasificación: WORKER ROUTING NOT IMPLEMENTED**

## 6. Stuck / No-Progress Detection

Existe código ejecutable relevante PERO sin cablear a sesiones reales:

- `workshop/intelligence/rules/repeated-error-rule.ts:6-38`: **REAL y ejecutable** —
  agrupa eventos por `module:action`, si count > 1 emite finding
  `REPEATED_FAILURE_PATTERN` con severity+confidence calculadas
- `workshop/collector/event-collector.ts:17-49`: dedup con ventana temporal y
  contador (`metadata.count`) — la materia prima del detector
- `workshop/recorder/jsonl-recorder.ts`: grabador JSONL de eventos

**El problema de integración**: `JsonlRecorder` solo se usa en
`workshop/tests/basic-flow.test.ts`. Los observers (browser/runtime/performance/
dead-interaction) no están conectados al dev server ni a las corridas de test.
El `RuleEngine` solo lo consumen generadores de documentación/reportes
(`docs/generate-master-doc.ts:199`, `snapshots/session-report-generator.ts:4-10`).

Lo que NO existe en ningún caso: detección de "sin cambios de repositorio",
"sin mejora de score", "iteraciones excesivas", tiempo excesivo, ni triggers de
escalación automática.

**Clasificación: PARTIAL (librería ejecutable) / INTEGRACIÓN MISSING**

## 7. Escalación Audit

El caso real reciente (Nemotron atascado → humano cambia a Big Pickle → continúa)
funcionó así:

```
Nemotron stuck → [HUMANO detecta] → [HUMANO detiene]
→ checkpoint ya estaba en git (Subaru, commits automáticos)
→ [HUMANO selecciona Big Pickle en OpenCode]
→ npx tsx workshop/subaru/cli.ts revive  (drift check + estado exacto)
→ Big Pickle continúa desde el paso exacto
```

Lo ejecutable del repo cubre: save state (automático en cada mark), restore state
(revive), continue (el worker lee el siguiente paso). Lo NO ejecutable: detectar
el stuck y lanzar al worker B.

**Clasificación: EXISTS_BUT_MANUAL** — la mitad difícil del problema (estado
duradero) está resuelta; la mitad de actuación es humana.

## 8. Evidence / Artifact Audit

| Evidencia | Ubicación | Machine-readable |
|-----------|-----------|------------------|
| Decisiones governance | `.governance/tasks/*.json` (**124 archivos**) | ✅ JSON |
| Log de governance | `.governance/logs/governance-*.log` | ⚠️ texto plano |
| Estado de misión | `docs/checkpoints/active-subaru-checkpoint.md` frontmatter | ✅ YAML frontmatter |
| Reportes Council | `workshop/council/reports/*.json` + `*.md` | ✅ JSON + MD |
| Memoria indexada | `.mia-memory/index.json` (36 entradas) | ✅ JSON |
| Registros desarrollo | `workshop/memory/artifacts/*/development-record.json` | ✅ JSON (incluye health: stability/coverage/traceability) |
| Resultados Playwright | `test-results/`, badges via `npm run test:badges` | ✅ parcial |
| Lint/build | salida de consola; gates en `post-development-audit.ts` | ❌ no persistido estructurado |
| Findings Godzilla | ninguno automatizado | ❌ |
| Eventos de sesión | diseñados (`workshop/schemas/events.ts`) pero recorder sin cablear | ⚠️ |

## 9. QA → Loop Feedback

`scripts/post-development-audit.ts` encadena: git status → gates (lint/build/unit)
→ council-audit → memory-index. Es el pipeline más cercano a un feedback loop.

**Pero**: los fallos de gate solo se imprimen (`results.push({passed:false})`,
línea 37); `WorkflowEngine.addQualityResult` (`workflow.ts:112-116`) solo loguea;
nadie crea una tarea de remediación, identifica rol responsable ni re-asigna worker.
El council-audit corre con `continue-on-error` en CI.

**Clasificación: PARTIAL** — pipeline de medición existe; bucle de remediación cerrado no.

## 10. Godzilla → Loop Feedback

Godzilla no tiene implementación ejecutable (solo persona + rol como string).
Sus findings hoy vivirían en conversación/documentos, no en artefactos machine-readable.
No puede disparar remediation.

**Clasificación: MISSING** (como componente automatizable)

## 11. Memory Engineer Audit

Implementación real:
- **Escritura**: `MemoryIndexer.indexAll()` escanea `docs/adr/` + `workshop/council/reports/`
  → `.mia-memory/index.json`; se ejecuta en el paso 4 de post-development-audit
- **Consulta**: `npm run memory-query` con filtros por tipo/source/tag/search
- **Artefactos**: development-records JSON con métricas de salud por sesión

**Consumo automático por el loop**: NINGUNO. Ni Orchestrator, ni Subaru, ni Council
leen `.mia-memory`. Las lecciones existen pero no alimentan decisiones futuras
sin consulta humana manual.

**Clasificación: PARTIAL** — memoria persistente y consultable sí; retroalimentación automática no.

## 12. True Loop Test

Recorrido solicitado vs realidad:

| Paso | ¿Automatizable hoy? | Qué falta |
|------|--------------------|-----------|
| MISSION → ORCHESTRATOR | ⚠️ manual (input humano al classify) | intake automático |
| ROLE | ✅ clasificador ejecutable | — |
| WORKER selection | ❌ humano elige modelo en OpenCode | routing |
| IMPLEMENT | ❌ es el propio LLM en el harness | launcher de workers |
| TEST | ✅ gates + playwright + CI | — |
| RESULT adjudication | ⚠️ exit codes existen; nadie decide con ellos | decision engine |
| CHECKPOINT | ✅ subaru mark/block automáticos | — |
| NEXT ACTION | ❌ humano decide | policy sobre checkpoint |
| COMPLETE | ✅ gated por governance | — |

**Un humano es imprescindible exactamente aquí**: (1) definir misión e invocar
classify, (2) registrar aprobaciones del concilio vía CLI, (3) lanzar/detener/cambiar
workers, (4) interpretar resultados y decidir siguiente acción, (5) autorizar commit/push
de implementación (Release Manager es persona). El estado sobrevive sin humano;
la dirección del loop no.

## 13. Current Architecture Map

```
LOGICAL ROLES (18 personas .agents/*.md)          ← DOCUMENTACIÓN pura
        │
        ▼ (invocación manual por humano/LLM)
┌─────────────────────────────────────────────────────┐
│ GOVERNANCE (ejecutable)                             │
│   Orchestrator.classify() ──► TaskManifest JSON     │
│   WorkflowEngine: transitions, decisions, gates     │
│   .governance/tasks/*.json (124) + logs             │
└──────────────┬──────────────────────────────────────┘
               │ assertGovernanceApproved (gate)
               ▼
┌─────────────────────────────────────────────────────┐
│ SUBARU (ejecutable) — STATE duradero                │
│   freeze/mark/block/complete/revive/status          │
│   docs/checkpoints/active-subaru-checkpoint.md      │
│   persistencia: commit+push git en cada mutación    │
│   drift detection + secret scan                     │
└──────────────┬──────────────────────────────────────┘
               │ revive → "next action" leído por…
               ▼
┌─────────────────────────────────────────────────────┐
│ WORKERS (FUERA del repo)                            │
│   Nemotron (Ollama local) / Big Pickle (cloud)      │
│   dentro de OpenCode harness                        │
│   ► SIN CÓDIGO DE INVOCACIÓN/RUTEO EN EL REPO ◄     │
└──────────────┬──────────────────────────────────────┘
               │ cambios de código (manuales)
               ▼
┌─────────────────────────────────────────────────────┐
│ TESTING/EVIDENCE                                    │
│   lint/build/vitest/playwright (npm scripts)        │
│   post-development-audit (pipeline fijo, advisory)  │
│   CouncilEngine determinista (CI en push, advisory) │
│   reportes JSON/MD, badges, development-records     │
└──────────────┬──────────────────────────────────────┘
               │ indexAll()
               ▼
┌─────────────────────────────────────────────────────┐
│ MEMORY (.mia-memory/index.json)                     │
│   escritura: pipeline; lectura: CLI manual          │
│   ► ningún consumidor automático en el loop ◄       │
└─────────────────────────────────────────────────────┘

RELEASE: manual (persona release.md + vercel --prod por humano)
         CommitGate (workshop/git/commit-gate.ts): agregador booleano
         ejecutable pero trivial, sin wiring obligatorio
STUCK DETECTION: librería lista (RepeatedErrorRule), sin feed de eventos real
ESCALATION: humana (checkpoint git es el puente entre workers)
```

Conexiones dibujadas = verificadas en código. Conexiones ausentes = no inventadas.

## 14. Gap Analysis

| Capability | Implementación actual | Status | Evidencia clave | Pieza faltante |
|---|---|---|---|---|
| Clasificación de tareas | Orchestrator classifier | **EXISTS_AND_EXECUTABLE** | `governance/orchestrator.ts:29` | intake automático de misiones |
| Manifiestos/decisiones | WorkflowEngine + CLI | **EXISTS_AND_EXECUTABLE** | `workflow.ts:23`, 124 manifests | aprobaciones sin CLI humano |
| Estado de misión durable | Subaru checkpoint+git | **EXISTS_AND_EXECUTABLE** | `subaru/cli.ts`, checkpoint activo | — |
| Recovery multi-worker | subaru revive + drift check | **EXISTS_BUT_MANUAL** | `cli.ts:509-594`, uso real multi-máquina | auto-lanzamiento del worker B |
| Auditoría automática | CouncilEngine en CI | **EXISTS_AND_EXECUTABLE** (advisory) | `council-audit.yml` | enforcement/remediation |
| Stuck detection | RepeatedErrorRule + collector | **PARTIAL** | `intelligence/rules/*`, recorder solo en tests | feed de eventos real + umbral + trigger |
| Worker routing | nada | **MISSING** | grep ollama/nemotron = 0 hits | WORKER ROUTING NOT IMPLEMENTED |
| Stuck escalation | block/revive manuales | **EXISTS_BUT_MANUAL** | comandos CLI | detector → switcher automático |
| QA feedback loop | pipeline post-audit fijo | **PARTIAL** | `post-development-audit.ts` | decisión+remediation task |
| Godzilla automation | persona only | **MISSING** | sin código | motor de stress-testing |
| Memory write | indexer en pipeline | **EXISTS_AND_EXECUTABLE** | `.mia-memory/index.json` | — |
| Memory read→decisions | query CLI manual | **PARTIAL** | `memory-query.ts` sin consumidores | consumidor en orchestrator |
| Release automation | convención + vercel manual | **EXISTS_BUT_MANUAL** | persona release.md | gate ejecutable obligatorio |

## 15. Minimal Loop (máximo reuse, mínimo código nuevo)

Reutilizando SIN reemplazar nada lo existente, el loop más pequeño posible es un
único **runner script** (~150–300 líneas TypeScript, p.ej. `workshop/loop/run-once.ts`)
que orqueste piezas YA existentes:

1. **Estado**: `npx tsx workshop/subaru/cli.ts revive` → obtener paso actual (ya existe)
2. **Actuación worker**: invocar el harness existente por CLI con parámetro de modelo
   (`opencode run` con model nemotron|big-pickle) — único glue nuevo real
3. **Test/measure**: `execSync` sobre `npm run lint/build/test:unit/test:e2e`
   (mismo patrón que `post-development-audit.ts:22-39`, que ya existe)
4. **Decisión**: regla mínima determinista — gates pass → `subaru mark`;
   fail → `subaru block --reason` (+ opcionalmente cambiar de worker en el reintento)
5. **Stuck detection v0**: comparar `current_step` del checkpoint antes/después de N
   corridas (parse frontmatter que `lib.ts` ya provee) — sin necesidad de cablear
   observers todavía
6. **Escalación v0**: si step no avanza en N intentos → relanzar con el OTRO worker;
   si sigue → quedar en `blocked` (estado que ya existe)
7. **Evidencia**: persistir salida de gates como JSON junto al checkpoint
   (patrón `ReportPersister` ya existente)

Lo que NO se necesita construir: máquina de estados, checkpoints, drift detection,
gobernanza, auditoría determinista, memoria, secret scan — todo existe.
Lo nuevo es exclusivamente el **pegamento de actuación y decisión**, que es justo
el gap identificado en §5/§9.

Riesgos a respetar: el loop v0 debe seguir siendo supervisable (dry-run flag),
respetar governance gating existente y nunca forzar `complete` sin gates.

## 16. Final Scores

| Dimensión | Score | Justificación |
|-----------|-------|---------------|
| Orchestration readiness | **55/100** | Clasificador + manifests + council ejecutables y con uso masivo (124 tasks); resta 0 capacidad de invocar/reaccionar/continuar sin humano |
| Mission state readiness | **85/100** | Subaru completo, probado multi-máquina/multi-sesión, drift-checked; −15 por checkpoint único activo (sin historial/API de misiones múltiples) |
| Worker integration readiness | **15/100** | Solo conciencia implícita del harness (agente espejo); cero código de invocación/routeo/supervisión — WORKER ROUTING NOT IMPLEMENTED |
| Recovery readiness | **80/100** | freeze/mark/block/revive + drift detection reales y usados tras interrupciones reales; −20 porque la recuperación requiere humano que lance al worker |
| Evidence readiness | **75/100** | Artefactos JSON ricos y persistentes (manifests, reports, memory, records) + CI; −25 por gates sin persistencia estructurada y Godzilla/eventos sin captura |
| Feedback-loop readiness | **35/100** | Pipeline de medición secuencial existe (post-audit, council CI); no hay decisión automática, remediación ni reasignación |
| **Autonomous Engineering Loop readiness** | **40/100** | Promedio ponderado por criticidad: estado/recuperación fuertes (el trabajo previo difícil está hecho), actuación y decisión débiles. Hoy el repo NO puede ejecutar una misión sin humano; con un runner de ~200 líneas reutilizando Subaru+gates, el salto estimado sería a ~65–70 |

### Conclusión única

MIA es hoy un **sistema de ingeniería con columna vertebral ejecutable**
(estado + gobernanza + evidencia) dirigido por un sistema nervioso humano
(actuación + decisión). La experiencia Nemotron→Big Pickle funcionó precisamente
porque Subaru convirtió el handoff en un `revive` — pero fue el humano quien hizo
de Orchestrator. El siguiente incremento de autonomía no pasa por crear agentes
nuevos sino por escribir el pegamento que invoque workers contra el checkpoint
existente y aplique reglas de mark/block/switch ya definidas.


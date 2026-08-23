# Engineering Loop v0.1 — Minimal Worker Handoff

**Estado**: Implementado y demostrado con integración real
**Fecha**: 2026-08-23
**Governance**: TASK-20260823-102540725 (concilio unánime)
**Subaru**: TASK-20260823-102540725 (5 pasos, completada)
**Auditorías base**: [engineering-loop-current-state.md](engineering-loop-current-state.md) · [opencode-agent-switching-audit.md](opencode-agent-switching-audit.md)

---

## 1. Propósito

Eliminar la operación manual: *OpenCode model picker → Nemotron → humano detecta bloqueo → cambia a Big Pickle → le dice que continúe*. El Loop automatiza exactamente ese ciclo:

```
MISSION → SUBARU CHECKPOINT → NEMOTRON → GATES → COMPLETE
                                    │ fallo/stuck determinista
                                    ▼
                  CHECKPOINT (block) → BIG PICKLE (MISMA sesión) → GATES → COMPLETE | BLOCK
```

## 2. Arquitectura

Un solo módulo nuevo (`workshop/loop/`, 398 LOC de producción) sin runtimes, frameworks ni sistemas paralelos:

| Archivo | LOC | Responsabilidad |
|---------|-----|-----------------|
| `router.ts` | 13 | Mapeo determinista worker→modelo. Sin descubrimiento dinámico ni LLM selector. |
| `runner.ts` | 47 | Invocación de OpenCode (`spawnSync`) + extracción de `sessionID` del stream JSON. |
| `signals.ts` | 39 | SUCCESS/FAILURE/TIMEOUT + STUCK vía adaptador mínimo a `RepeatedErrorRule` existente. |
| `evidence.ts` | 37 | Evidencia JSONL machine-readable + recuperación de última sesión. |
| `gates.ts` | 28 | Gates npm existentes (lint/build/test:unit) con resultado machine-readable. |
| `subaru-gateway.ts` | 20 | Persistencia de escalación vía CLI Subaru real (`subaru block`). |
| `run-loop.ts` | 214 | Orquestador: seguridad → reintentos primario → checkpoint → handoff → gates. |

**Sistemas reutilizados (no modificados)**: Subaru CLI (única autoridad de estado), WorkflowEngine/Governance, `RepeatedErrorRule`, scripts npm de gates, binario OpenCode.

> **Nota sobre presupuesto (~200 LOC)**: la lógica de decisión pura está dentro del objetivo; el excedente corresponde a contratos tipados inyectables (para tests con fakes), compatibilidad Windows de spawn (`EINVAL` de CVE-2024-27980 en `.cmd`) y el esquema de evidencia exigido (11 campos). Se declara explícitamente según la regla STOP del encargo.

## 3. Worker Routing

Determinista, dos entradas fijas verificadas contra `opencode models` (v1.18.21):

```ts
nemotron    → opencode/nemotron-3-ultra-free   // PRIMARY
big-pickle  → opencode/big-pickle              // FALLBACK
```

Nemotron y Big Pickle **son modelos del proveedor `opencode`, no agentes** (hallazgo de la auditoría previa). El loop usa `--model`, no `--agent`.

## 4. Invocación de OpenCode

```bash
# Primario (nueva o continuada)
opencode run "<prompt>" --model opencode/nemotron-3-ultra-free --format json [-s <session-id>]

# Fallback (SIEMPRE misma sesión)
opencode run "<continuación>" -s <session-id> --model opencode/big-pickle --format json
```

- `--format json`: el stream emite eventos con `sessionID`; `extractSessionId()` lo captura (validado contra llamadas reales).
- Timeout por intento (`timeoutMs`, default 600 s) mapeado a señal TIMEOUT.
- El prompt de continuación incluye contexto explícito: razón de escalación + orden de continuar sin reiniciar ni duplicar trabajo (`buildContinuationPrompt`).

## 5. Session Handoff

1. La primera ejecución real crea la sesión; su ID se captura del stream JSON.
2. Cada intento posterior pasa `-s <id>` — incluido el fallback.
3. El ID se persiste en cada línea JSONL de evidencia; un proceso nuevo lo recupera con `lastSessionId()` (resume entre invocaciones).
4. Verificado con binario real: nemotron creó `ses_fd1ba0e0cffejh58yizYUVF0QA`; tras outage×2 simulado, big-pickle continuó ESA MISMA sesión (17 s, exit 0). Todas las líneas de evidencia comparten el ID.

## 6. Integración Subaru

- Estado de misión: SOLO el checkpoint Subaru (`docs/checkpoints/active-subaru-checkpoint.md`); sin segundo sistema.
- Escalación persistente: `CliSubaruGateway` ejecuta `npx tsx workshop/subaru/cli.ts block <taskId> --reason "ESCALATION …; opencode_session=<id>"` — commit+push del estado antes de entregar al fallback.
- Cadena legal verificada en código: `block` no impide `mark`/`complete` posteriores; `complete` sigue exigiendo checkboxes completos + governance aprobado + `--confirm-gates`.
- En los drills reales se usó un taskId de scratch (`SUBARU-DRILL-SCRATCH`) para no tocar la misión activa; el gateway es inyectable para tests.

## 7. Política de Reintentos

- Primario: hasta `maxPrimaryAttempts=2`. Tras cada fallo se reintenta con contexto de error añadido.
- Sin reintentos infinitos; el fallback corre UNA vez; si falla → BLOCK final.

## 8. Detección de Stuck

Determinista, sin LLM juez: cada intento genera un evento (`module:action = engineering-loop:attempt:<worker>:<señal>`) consumido por `RepeatedErrorRule` existente → finding cuando el mismo patrón se repite >1. Es decir: **dos fallos idénticos consecutivos del mismo worker = STUCK**. TIMEOUT cuenta como patrón repetible (TEST 4).

## 9. Escalación

Condicionada exclusivamente por señales deterministas (stuck / agotamiento / timeout repetido):

1. Persistir estado vía Subaru (`block` con razón + session id).
2. Registrar entrada STUCK en evidencia con `checkpoint` y `next_action`.
3. Invocar fallback con MISMO session id y contexto de continuación.
4. Gates otra vez. Solo cambia el modelo; nunca la sesión ni la tarea.

## 10. Límites de Seguridad

El loop NUNCA ejecuta autonomía sobre: deploy a producción (`vercel --prod/deploy`), force push, operaciones destructivas de BD (`supabase db reset/push`, `drop table/database`), modificación de `.env`, ni edición de estado de governance/checkpoints. Cualquier prompt con esos patrones produce `REQUIRE_HUMAN_APPROVAL` **antes** de invocar cualquier modelo (TEST 8a). Los gates nunca son opcionales: sin gates verdes no existe COMPLETE (TEST 8b, demostrado también en vivo en la primera Misión A con gates rotas → BLOCK).

## 11. Tests

`tests/engineering-loop.test.ts` — 13 tests vitest, 100 % deterministas con fakes (sin IA real): TEST 1 éxito→COMPLETE · TEST 2 fallo→reintento con contexto · TEST 3 stuck→checkpoint→handoff misma sesión · TEST 4 timeout-repetido→stuck→fallback completa · TEST 5 fallback falla→BLOCK sin gates fingidos · TEST 6/6b supervivencia de estado en JSONL y resume de sesión · TEST 7 session id idéntico tras el switch · TEST 8a/8b bypass de safety/gates imposible. Más unitarios de router/extractSessionId/continuation-prompt.

**Gates del repo sobre el árbol final**: lint 0 problemas · unit 801/801 · build OK.

## 12. Integración Real (binario v1.18.21)

| Drill | Resultado | Evidencia permanente |
|-------|-----------|----------------------|
| Misión A — tarea read-only real con nemotron | nemotron 53 s exit 0 → sesión real capturada → gates lint/build reales verdes → **COMPLETE** | [engineering-loop-v0.1-evidence-success.jsonl](engineering-loop-v0.1-evidence-success.jsonl) |
| Misión B — outage controlado ×2 → handoff | STUCK detectado → **big-pickle real continuó la MISMA sesión** (17 s exit 0) → gates verdes → **COMPLETE**, session_id idéntico en las 6 entradas | [engineering-loop-v0.1-evidence-handoff.jsonl](engineering-loop-v0.1-evidence-handoff.jsonl) |

Hallazgos corregidos durante la integración (sin discrepancias pendientes):
1. `spawnSync('npm')` en Windows → `EINVAL` (CVE-2024-27980): resuelto invocando `node <npm-cli.js>`; verificado `{"lint":true}` real.
2. El loop no recuperaba la sesión pre-existente: añadido resume desde evidencia (`lastSessionId`) + TEST 6b; re-drill confirma `-s` real hacia big-pickle.

## 13. Limitaciones

- Un fallback único, sin cadena de terceros modelos (por diseño v0.1).
- STUCK requiere repetición del mismo patrón; bloqueos "creativos" no repetitivos agotan reintentos y escalan igualmente (cobertura equivalente).
- `CliSubaruGateway` real no se ejercitó contra el checkpoint activo (evitaría bloquear esta misma misión); su lógica replica el patrón spawn verificado en gates y fue aprobada por concilio; drills usaron taskId scratch.
- Playwright e2e del manifest se ejecuta como gate de cierre de misión (fuera del bucle por costo).
- Concurrencia multi-misión sobre el mismo checkpoint Subaru no soportada (Subaru ya es single-active-checkpoint por diseño).

---

**Respuesta a la pregunta central del encargo**: YES — demostrado con binario real (§12, Misión B).

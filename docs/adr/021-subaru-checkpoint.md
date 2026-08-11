# ADR-021: Protocolo Subaru — Checkpoint de Misión Multi-máquina

## Status

Accepted

## Date

2026-08-11

## Council

Architect, Infrastructure Bootstrap, Infrastructure Guardian, Backend Engineer, QA Engineer, Release Manager, Memory Engineer (TASK-20260811-222129849)

---

## 1. Context

Las sesiones de desarrollo de opencode mueren por límite de tokens. En un ecosistema multi-máquina (HP, Dell Precision, Linux) la instancia que muere no puede retomar la tarea y la siguiente no sabe en qué paso quedó la anterior. La consecuencia histórica fue doble: trabajos perdidos y, peor, implementaciones re-escritas desde cero sin plano previo.

La primera versión del Protocolo Subaru (checkpoints en `docs/checkpoints/active-subaru-checkpoint.md`) resolvía el caso base: congelar un plan antes de codificar, sincronizarlo a remoto y permitir `revive` en cualquier máquina. La auditoría v2 (`subaru-audit-v2`) detectó brechas:

1. **Tests dependientes del entorno**: el harness de tests fallaba en máquinas sin identidad git global ("Author identity unknown") y el renderizado de números de `UsageBar` dependía del locale del runtime.
2. **Estado `blueprint_ready` muerto**: el estado congelado tenía un nombre legacy y no existía mecanismo para registrar una misión `blocked`.
3. **Gates en `complete`**: el cierre no exigía confirmación explícita de los gates de verificación del manifest governance.
4. **Sin secret scan**: un checkpoint podía commitearse con secretos en el body.
5. **Drift opaco**: `revive` detectaba que el remoto avanzó pero no reportaba qué commits faltaban.
6. **Bootstrap mínimo**: validaba node/git pero no identidad git, remote, checkpoint ni el espejo del agente.

## 2. Problem

El protocolo debe sobrevivir a la muerte de una sesión en **cualquier** máquina y cerrar misiones de forma honesta:

- Los tests del propio protocolo deben pasar en cualquier máquina, sin depender del entorno.
- El cierre de una misión debe exigir los gates reales del manifest governance.
- Una misión cuyo gate falla por causas fuera de su scope debe poder registrarse como `blocked`, no forzarse a `completed` ni quedarse sin registro.
- El checkpoint nunca debe contener secretos.
- El revive debe reportar exactamente qué avanzó el remoto.

## 3. Decision

**Endurecer el CLI de Subaru** (`workshop/subaru/`) como única autoridad sobre el checkpoint, añadiendo: fix del harness multi-máquina, bootstrap completo, estado `frozen` retrocompatible, scaffold enriquecido con 7 atributos por paso, `complete --confirm-gates`, `block --reason`, secret scan y drift detallado. El sistema governance (`workshop/governance/`) no se modifica: Subaru solo lo consulta.

## 4. El Protocolo

### 4.1 Estados del checkpoint

| Estado | Significado | Commit |
|--------|-------------|--------|
| `frozen` | Plan aprobado y congelado, antes de codificar | `subaru: checkpoint <id> - listo` |
| `in_progress` | Implementación en curso (marcada por pasos) | `subaru: checkpoint <id> - en-progreso` |
| `blocked` | Un gate falló por causa fuera del scope; motivo registrado | `subaru: checkpoint <id> - bloqueado` |
| `completed` | Todos los pasos y gates confirmados | `subaru: checkpoint <id> - completado` |

Los checkpoints legacy con `state: blueprint_ready` se normalizan a `frozen` al leerse (retrocompatibilidad sin drift).

### 4.2 Comandos

| Comando | Efecto |
|---------|--------|
| `freeze <id> --title "<t>" --steps <n> --governance <id> [--force]` | Verifica governance aprobado, siembra blueprint (9 secciones + N pasos con 7 atributos: número, objetivo, archivos, acción, dependencia, criterio, gate), escribe `state: frozen`, secret scan, commit `- listo` + push |
| `mark <id> <n>` | Secuencial (`n == current_step + 1`), idempotente, `in_progress`, tick del checkbox, actualiza "Next action", secret scan, commit `- en-progreso` + push |
| `complete <id> --confirm-gates` | Exige todos los checkboxes `[x]`, `current_step == total_steps`, governance aprobado y `--confirm-gates` (lista los gates del manifest governance); escribe el resultado final en "Current state", secret scan, commit `- completado` + push |
| `block <id> --reason "<motivo>"` | Registra `state: blocked` y el motivo en "Current state", secret scan, commit `- bloqueado` + push. La misión queda resumible |
| `revive [--no-pull]` | `git pull --rebase` + drift detection detallado (incluye `git log HEAD..origin/<branch> --oneline`) + informe del próximo paso exacto |
| `status` | Resumen del checkpoint |
| `bootstrap` | Valida Node, git, repo, remote `origin`, checkpoint, identidad git (`user.name`/`user.email`) y espejo del agente; restaura el agente global desde `.agents/subaru.md` |

### 4.3 Secret scan

`freeze`/`mark`/`complete`/`block` rechazan el checkpoint si el body contiene patrones de secretos (`sk-`, `AKIA…`, `-----BEGIN * PRIVATE KEY-----`, `password=`, `token=`, `client_secret` con valor). Los secretos se refieren por nombre de variable de entorno, nunca en línea.

### 4.4 Autoría del blueprint

El body del plan se autoriza por el Council **antes** del freeze. Después del freeze, el CLI es la única autoridad que modifica el frontmatter y committea el checkpoint; ediciones manuales disparan `DRIFT DETECTED → BLOCKED`.

### 4.5 Gates en complete

`complete` lee los gates obligatorios del manifest governance (`classification.qualityGates`). Sin `--confirm-gates` bloquea y lista los gates. Con el flag, solo cierra si los gates realmente pasaron; en caso contrario la misión se registra `blocked` con `subaru block`.

## 5. Consecuencias y Riesgos

| Aspecto | Consecuencia |
|---------|--------------|
| Commits atómicos | El CLI committea solo el checkpoint (`git add` del archivo); la implementación se committea aparte con conventional commits |
| Push fallido | El checkpoint sobrevive local; el CLI reporta `LOCAL CHECKPOINT` vs `REMOTE CHECKPOINT` y sugiere `git pull --rebase` |
| Identidad git | El CLI no configura identidad; en máquinas sin `user.email`/`user.name` los commits se hacen con variables de entorno por invocación |
| Falsos positivos del secret scan | Los patrones exigen valores (mín. 4 caracteres) para evitar dispararse con placeholders o nombres desnudos |
| No mezclar tareas | La documentación y los commits se separan por tarea/manifest governance |

## 6. Resultado de la Auditoría v2 (subaru-audit-v2)

La misión `subaru-audit-v2` implementó los puntos 1-6 de la Sección 1 y dejó como hallazgos de gates:

### 6.1 unit_tests — BLOCKED (pre-existente, fuera de scope)

- **Archivo**: `tests/component/usage-bar.test.tsx:17-18`, `src/components/laboratorio/UsageBar.tsx:24-25`.
- **Causa**: `UsageBar` usa `toLocaleString()` sin locale explícito → depende del locale del runtime de la máquina.
- **Observado en este entorno**: renderiza `12.000` (formato es).
- **Expectativa del test**: `12,000` (formato en-US).
- **Por qué depende del entorno**: el resultado de `toLocaleString()` sin argumento lo decide la configuración ICU del runtime.
- **Origen**: commit `fd450f7` (infraestructura de testing); no fue introducido por esta misión.

### 6.2 build — BLOCKED (pre-existente, fuera de scope)

- Errores de tipo en 13 archivos de tests de producto (`tests/ai/*`, `tests/api/*`, `tests/channels/*`, `tests/context/*`, `tests/i18n/*`, `tests/import/*`, `tests/runtime/*`, `tests/sales/*`, `workshop/tests/parallel-execution.test.ts`), todos previos a esta misión.

### 6.3 Recomendación de tarea futura (governance propio)

> Hacer determinista el formato numérico de `UsageBar` mediante locale explícito, siguiendo la convención existente en `AIOperationsCard` y `TodaysActivity` (`toLocaleString('es-MX')`), y ajustar el test a `12.000`/`3.400`. No forzar un PASS artificial modificando solo el test: el componente también es no determinista entre entornos.

Esta tarea debe clasificarse con su propio manifest governance y alcance; no se incluyó en `subaru-audit-v2` por respetar el Non-goal "no tocar producto".

## 7. Cambios Requeridos

1. `AGENTS.md` §24 — documentar estados, comandos, gates, bootstrap y autoría del blueprint (actualizado).
2. `.agents/subaru.md` — espejo del agente con las capacidades nuevas (actualizado).
3. `workshop/subaru/lib.ts` y `cli.ts` — implementación del endurecimiento (completado).
4. Tarea futura: `UsageBar` determinista (pendiente, con governance propio).

## 8. Referencias

- `AGENTS.md` §24 — Protocolo de Resurrección Subaru.
- `workshop/subaru/cli.ts`, `workshop/subaru/lib.ts` — implementación.
- `docs/checkpoints/active-subaru-checkpoint.md` — checkpoint activo de la misión (source of truth, lo edita solo el CLI).
- `docs/adr/001-agent-system.md` — sistema de agentes (governance).
- `docs/adr/011-evidence-first-protocol.md` — protocolo de evidencia (aplica a los hallazgos).

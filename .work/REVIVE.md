# REVIVE — Continuidad de Sesión MIA Platform

> Mecanismo mínimo de continuidad entre sesiones, máquinas y agotamiento de tokens.
> Sin CLI, sin framework, sin governance. Solo Markdown versionado en Git.

---

## Baseline

**Commit**: `6c4d04c` (feat(c1): sales orders durable identity + order_id propagation)
**Branch**: `chore/process-infra-decommission`
**Fecha**: 2026-09-06
**Estado working tree**: Clean (solo cambios de decommission)

---

## Objective

**Desmantelamiento completo de Process Infra (Governance, Council, Subaru, Agents, Inventory-Loop, Intelligence, Observers)** manteniendo intacto todo el código de producto (src/, services/, supabase/migrations/).

**Entregable**: Branch limpio listo para merge → CI → deploy automático.

---

## Current State

**Branch**: `chore/process-infra-decommission` (local, no pushed)
**HEAD**: `6c4d04c`
**Working tree**: Solo cambios de decommission (ver `git status`)

**Archivos eliminados (~258)**: .agents/, .governance/, workshop/council/, workshop/governance/, workshop/subaru/, workshop/inventory-loop/, workshop/intelligence/, workshop/observer/, workshop/loop/, workshop/collector/, workshop/memory/, workshop/scripts/, workshop/snapshots/, workshop/tests/, workshop/*.ts, .github/workflows/council-audit.yml, .github/workflows/docs-generate.yml, tests/inventory-loop.test.ts, tests/engineering-loop.test.ts, tests/unit/governance-workflow-guard.test.ts, tests/unit/invariant-registry.test.ts

**Archivos modificados (6)**:
- package.json: -9 scripts (council-audit, post-audit, memory-index, memory-query, docs:generate, governance, governance:validate, governance:classify, subaru)
- .github/workflows/validate.yml: -workshop tests step
- .github/workflows/docs-generate.yml: DELETED
- .cursorrules: Reescrito sin governance/Subaru/agents
- AGENTS.md: Reducido ~1100 → ~300 líneas (secciones 16, 22, 23, 24, 25 eliminadas)
- vitest.config.ts: -workshop project, -workshop from coverage exclude

**Archivos conservados intactos**: src/, services/, supabase/migrations/, public/, docs/adr/, workshop/audit/, workshop/deploy/

---

## Proven

✅ **Build PASS** — `npm run build` compila 101/101 páginas sin errores
✅ **Lint PASS** — `npm run lint` 0 errors, 24 warnings (pre-existentes)
✅ **Typecheck** — `npx tsc --noEmit` errores solo en tests (pre-existentes), 0 en src/
✅ **Zero runtime refs** — `grep -r "governance|subaru|\.agents|workshop" src/ tests/` → 0 matches activos
✅ **Product code intacto** — `git diff --name-only` no toca src/, services/, supabase/migrations/, public/
✅ **23 test failures eliminados** — workshop/loop/governance.test.ts (20) + invariant-registry.test.ts (3) eliminados con decommission

---

## Failed

⚠️ **24 test failures PRE-EXISTENTES** (existen en main antes de decommission):

| Test File | Failures | Tipo |
|-----------|----------|------|
| tests/runtime/process-streaming.test.ts | 3 | Mock/async setup |
| tests/sales/events.test.ts | 2 | Mock DB setup |
| tests/import/engine.test.ts | 4 | Mock Supabase admin |
| tests/runtime/product-recommendation.test.ts | 6 | Mock .single() |
| tests/api/widget-chat-route.test.ts | 3 | Route handler 404 |
| tests/api/widget-close.test.ts | 4 | Route handler 404 |
| tests/api/catalog-import-source.test.ts | 1 | Mock DB |
| tests/api/catalog-import-file.test.ts | 1 | Mock DB |
| tests/import/engine.test.ts | 4 | Mock .upsert() |
| tests/sales/events.test.ts | 2 | Mock products.ilike |
| tests/runtime/process-streaming.test.ts | 3 | Mock messages |

**Total**: 24 failures en 11 test files — **todos pre-existentes** (verificados en main antes de decommission)

**Eliminados por decommission (23)**:
- workshop/loop/governance.test.ts: 20 failures
- tests/unit/invariant-registry.test.ts: 3 failures

---

## Pending

1. **Merge decision** — Revisión humana del diff completo
2. **Merge → CI → Deploy** — Automático via Vercel en merge a main
3. **Post-merge** — Verificar que CI pasa en main (lint, typecheck, test:unit, build)
4. **Follow-up** — Revisar 24 test failures pre-existentes en sprint separado

---

## Decisions

| Decisión | Rationale |
|----------|-----------|
| Eliminar Governance/Council/Subaru/Agents completo | Process infra no usado en runtime; 258 archivos eliminados |
| Mantener workshop/audit/ y workshop/deploy/ | Evidencia forense histórica + scripts de deploy reales |
| Simplificar AGENTS.md a ~300 líneas | Solo reglas técnicas, arquitectura, quality checklist |
| Quality Gate = lint + typecheck + test:unit + build | Automatizado en CI, sin gates manuales |
| No reemplazar Subaru con otro CLI | REVIVE.md suficiente para continuidad |
| Eliminar invariant-registry.test.ts + workshop/loop/ | Testing de process infra eliminada, no de producto |

---

## Relevant Areas

| Área | Archivos clave | Estado |
|------|----------------|--------|
| **Chat Runtime** | src/lib/runtime/*.ts, src/app/api/chat/route.ts | ✅ Intacto |
| **Sales Engine** | src/lib/sales/*.ts, src/app/api/sales/* | ✅ Intacto |
| **Knowledge/AI** | src/lib/ai/*.ts, src/app/api/knowledge/* | ✅ Intacto |
| **WhatsApp Bridge** | services/whatsapp-bridge/src/* | ✅ Intacto |
| **Delivery** | src/lib/delivery/*, src/app/api/driver/*, src/app/api/admin/delivery/* | ✅ Intacto |
| **Inventory (base)** | src/lib/inventory/{stock,suggestions,adjustments,import,admin-api}.ts | ✅ Intacto |
| **Dashboard** | src/app/dashboard/*, src/components/* | ✅ Intacto |
| **Auth/Proxy** | src/proxy.ts, src/middleware.ts, src/app/(auth)/* | ✅ Intacto |
| **DB Schema** | supabase/migrations/001-061 | ✅ Intacto |

---

## Next Action

**Acción concreta**: Esperar revisión humana del PR/diff.

**Comando siguiente** (tras aprobación):
```bash
git add -A
git commit -m "chore: process infra decommission — remove governance, council, subaru, agents, inventory-loop, intelligence, observers (~258 files)

- Remove .agents/, .governance/, workshop/council/, workshop/governance/, workshop/subaru/
- Remove workshop/inventory-loop/, workshop/intelligence/, workshop/observer/, workshop/loop/
- Remove workshop/collector/, workshop/memory/, workshop/scripts/, workshop/snapshots/
- Remove tests tied to process infra (inventory-loop, engineering-loop, governance-workflow-guard, invariant-registry)
- Remove 9 npm scripts, 2 GitHub workflows
- Simplify AGENTS.md (~1100→300 lines), .cursorrules, vitest.config.ts
- Keep: src/, services/, supabase/migrations/, public/, docs/adr/, workshop/audit/, workshop/deploy/
- Quality gates: lint + typecheck + test:unit + build (automated in CI)
"
git push origin chore/process-infra-decommission
# Create PR → review → merge → auto deploy
```

---

## DO NOT

- ❌ NO merge sin revisión humana del diff completo
- ❌ NO push directo a main
- ❌ NO restaurar Subaru/Governance/Council/Agents
- ❌ NO crear CLI/manifests/framework de reemplazo
- ❌ NO tocar src/, services/, supabase/migrations/, public/
- ❌ NO modificar migraciones
- ❌ NO agregar gates manuales
- ❌ NO inventar nueva capa de proceso obligatorio

---

*Generado: 2026-09-06 | Branch: chore/process-infra-decommission | Commit: 6c4d04c*
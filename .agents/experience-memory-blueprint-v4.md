# Experience Memory — Modelo C 70/30: Motor de Recomendación de Objeciones

## Mission

Implementar el motor completo de Experience Memory para el dominio Sales: sistema de memoria acumulada de objeciones con modelo C híbrido (70% Global/Industria, 30% Negocio), incluyendo seed data, API routes, integración con el prompt builder, frontend UI para revisión de sugerencias, y tests e2e.

## Scope

- **Migración 053**: Tablas `experience_memory` + `experience_suggestions` con RLS, indexes parciales de unicidad, enum `experience_scope`, ALTER `knowledge_items.source` (YA EXISTE en `supabase/migrations/053_experience_memory.sql`)
- **Blender**: Mezcla probabilística 70/30 con `getBlendedPatterns()` (YA EXISTE en `src/lib/heuristic/blender.ts`)
- **Suggester**: Auto-sugerencia de patrones industriales >70% conversión (YA EXISTE en `src/lib/heuristic/suggester.ts`)
- **PATCH endpoint**: Approve/dismiss con materialización a `knowledge_items` (YA EXISTE en `src/app/api/admin/experience/suggestions/[id]/route.ts`)
- **Tipos TypeScript**: `ExperienceMemoryItem`, `ExperienceSuggestion`, `BlendedPattern` (YA EXISTE en `src/lib/heuristic/types.ts`)
- **Tests unitarios**: 11 tests de blender + suggester (YA EXISTEN en `tests/heuristic/`)
- **NUEVO**: Seed data de patrones globales/industriales
- **NUEVO**: API routes GET (listar sugerencias) + POST (crear patrón business)
- **NUEVO**: Integración con prompt builder (`src/lib/ai/prompts.ts` + `src/lib/ai/knowledge.ts`)
- **NUEVO**: Frontend UI "Tinder de Objeciones" (`src/app/dashboard/assistants/[id]/experience/`)
- **NUEVO**: Tests e2e del flujo completo

## Non-goals

- NO modificar la migración 053 existente (es inmutable)
- NO crear UI de administración de patrones globales/industriales (solo business)
- NO implementar machine learning local (todo via Supabase + Wilson Score)
- NO tocar módulos Inventory, Delivery, ni Analytics
- NO cambiar el esquema de `knowledge_items` más allá del CHECK constraint ya aplicado

## Approved plan

Pasos atómicos aprobados por el Council:

- [ ] **Paso 1:** Aplicar migración + semilla de patrones base
  - **Objetivo**: Levantar tablas experience_memory y experience_suggestions en Supabase local, insertar patrones de prueba globales/industriales
  - **Archivos**: `supabase/migrations/053_experience_memory.sql` (ya existe), `supabase/seed-experience.sql` (NUEVO)
  - **Acción**: Ejecutar `supabase db reset` para aplicar migración 053; crear archivo seed con 5-8 patrones globales (ej: "precio-alto", "envio-lento", "duda-calidad") y 3-5 industriales por industria "salud_suplementos"; verificar que INSERT/SELECT funcionan con RLS
  - **Dependencia**: ninguna
  - **Criterio de terminación**: Tablas accesibles, seed insertado, queries SELECT retornan datos
  - **Gate/verificación**: supabase db reset exitoso, queries manuales OK

- [ ] **Paso 2:** API routes GET + POST para sugerencias
  - **Objetivo**: Endpoint para listar sugerencias pendientes del negocio y endpoint para crear patrones business manualmente
  - **Archivos**: `src/app/api/admin/experience/suggestions/route.ts` (NUEVO — GET + POST), `src/app/api/admin/experience/patterns/route.ts` (NUEVO — GET para listar patrones blendados del negocio)
  - **Acción**: GET `/api/admin/experience/suggestions` retorna sugerencias con JOIN a experience_memory, filtradas por business_id del usuario autenticado; POST `/api/admin/experience/patterns` permite crear un patrón business manual con validación de campos; GET `/api/admin/experience/patterns` retorna patrones blendados invocando `getBlendedPatterns()`
  - **Dependencia**: Paso 1
  - **Criterio de terminación**: Endpoints responden 200 con datos, auth funciona, errores manejados
  - **Gate/verificación**: lint + build

- [ ] **Paso 3:** Integración con prompt builder
  - **Objetivo**: Incluir patrones de experience memory en el contexto del prompt del chat para que el asistente tenga acceso a objeciones respondidas
  - **Archivos**: `src/lib/ai/knowledge.ts` (MODIFICAR — añadir función `getExperienceContext()`), `src/lib/ai/prompts.ts` (MODIFICAR — incluir experiencia en system prompt)
  - **Acción**: En `knowledge.ts`, crear `getExperienceContext(businessId, industry)` que invoca `getBlendedPatterns()` y retorna texto formateado de objeciones + respuestas; en `prompts.ts`, añadir sección "Experiencia de Ventas" al system prompt cuando hay patrones disponibles; limitar a top-10 por blendedProbability para control de tokens
  - **Dependencia**: Paso 1 (blender ya existe)
  - **Criterio de terminación**: `getExperienceContext()` retorna string formateado, prompt generado contiene sección de experiencia cuando hay datos
  - **Gate/verificación**: lint + build

- [ ] **Paso 4:** Frontend UI — Panel de sugerencias ("Tinder de Objeciones")
  - **Objetivo**: Interfaz para que el negocio revise, apruebe o descarte sugerencias de patrones industriales de alto rendimiento
  - **Archivos**: `src/app/dashboard/assistants/[id]/experience/page.tsx` (NUEVO — página principal), `src/components/experience/SuggestionCard.tsx` (NUEVO — card individual), `src/components/experience/SuggestionList.tsx` (NUEVO — lista con filtros)
  - **Acción**: Server Component que carga sugerencias via GET; SuggestionCard muestra objeción + respuesta sugerida + probabilidad; botones Approve/Dismiss que llaman PATCH; input para customized_response al approve; SuggestionList con filtro pending/approved/dismissed; Patrón visual estilo "card stack" para experiencia de revisión ágil
  - **Dependencia**: Paso 2 (API endpoints)
  - **Criterio de terminación**: Página accesible desde sidebar del assistant, cards renderizan, PATCH funciona desde UI, feedback visual al usuario
  - **Gate/verificación**: lint + build + unit_tests

- [ ] **Paso 5:** Tests e2e + verificación completa
  - **Objetivo**: Validar el flujo end-to-end y verificar que no hay regresiones
  - **Archivos**: `tests/e2e/experience-memory.spec.ts` (NUEVO)
  - **Acción**: Test e2e con Playwright: navegar a `/dashboard/assistants/[id]/experience`, verificar que la página carga; ejecutar `npm run lint` (0/0), `npm run build`, `npx vitest run` (suite completa), `npm test` (e2e); Chrome DevTools: consola limpia, 0 errores
  - **Dependencia**: Paso 4
  - **Criterio de terminación**: lint 0 errores/0 warnings; build OK; unit tests pasan; e2e tests pasan; consola limpia
  - **Gate/verificación**: lint, build, unit_tests, e2e_tests, chrome_devtools, security_review

## Current state

- Blueprint generado. Pendiente de governance classification y council approval.
- Código existente: migration 053 + blender + suggester + PATCH + types + 11 tests (commit `3fd5154` + `41806e7`).
- Working tree limpio.

## Next action

Ejecutar governance classify → council approvals → Subaru freeze → implementar 5 pasos.

## Constraints

- Migración 053 es inmutable (ya aplicada en commit anterior).
- Evidence First (ADR-011): hallazgos con evidencia file:line.
- Gobernanza: no implementar sin manifest aprobado.
- Convenciones del proyecto: Server Components por defecto, shadcn/ui, TypeScript estricto, componentes <150 líneas.
- No romper existente: sin regresiones en lint/build/unit/e2e.
- Admin client para writes que bypass RLS (auth flow rules).

## Verification

- Gates obligatorios (complex task): lint, build, unit_tests, e2e_tests, chrome_devtools, security_review, stress_test.
- Estado de ejecución: pasos 1-5 con mark secuencial; `subaru complete --confirm-gates` al cierre.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260820-EXPERIENCE <n>`.
6. Al final: `subaru complete TASK-20260820-EXPERIENCE --confirm-gates`.

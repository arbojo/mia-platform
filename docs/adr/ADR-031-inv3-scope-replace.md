# ADR-031 — INV-3: Reemplazo del Scope Persistido y Staleness pre-INV-3

- **Status**: Accepted
- **Date**: 2026-09-09
- **Context**: El `active_product_ids[]` de una conversación es el contexto comercial que el runtime usa para el scope de media/producto. Hasta el commit `cc1f5c6` (INV-3), la regla era **acumulativa**: un producto explícitamente mencionado se agregaba al frente del set y los anteriores permanecían. Eso fue confirmado en laboratorio y desplegado. Sin embargo, en la conversación real de WhatsApp de David (`05ae2db6-a88a-4dd8-b08f-77725bce0757`) el `active_product_ids` permaneció **sin cambios desde el 2026-08-30** a pesar de decenas de menciones explícitas de productos durante la sesión del 2026-09-07/08.

Una investigación con datos reales (no mockeada) demostró:

- `detectExplicitScopes` **sí** detecta los productos en los mensajes literales reales de la sesión ("¿De verdad funciona el Clean Nails...?", "¿le compro el Neurofeet...?", etc.).
- `persistActiveProductIds` **no** falla silenciosamente: el `UPDATE` manual idéntico —mismo cliente admin, misma conversación— **sucede sin error**, y `resolveScopeContext` con el código actual **sí reemplaza** el set persistido (probado y revertido contra la DB real).
- La causa raíz fue de **timeline de deploy, no de código**: la sesión de David ocurrió el `2026-09-08T00:05 UTC`, y el commit del reemplazo INV-3 (`cc1f5c6`) se firmó a las `2026-09-08T01:41 UTC` — ~1h36m **después** de la sesión. El merge a `main` (`c5468af`) y el deploy a producción (`9a19676`) ocurrieron el `2026-09-09`. Por tanto INV-3 **nunca corrió** en la sesión real observada.

## Decision

1. **INV-3 queda ratificado como contrato**: el explicit-scope de un mensaje **REEMPLAZA** el contexto persistido (`orderActiveProducts([], explicitHits)`) en lugar de acumularse. Menciones múltiples del mismo turno se conservan como *set multi*.
2. **Staleness pre-INV-3 es comportamiento esperado**: las conversaciones creadas **antes de `2026-09-08T01:41 UTC`** (deploy del replace) pueden tener `active_product_ids` acumulado con varios productos. Se **auto-corrige** en la próxima mención explícita de producto (el replace la reescribe por completo). **NO requiere limpieza manual de datos.**
3. **Persistencia no silenciosa**: el `catch` de `persistActiveProductIds` ya no traga el error. Clasifica el fallo (`rls`, `constraint`, `data`, `network`, `unknown`) y loguea con nivel alertable (`[context-scope][ALERT]`), indicando el tipo y la causa probable, para que un fallo futuro de escritura no pase desapercibido.

## Consequences

- **Positivas**: el scope de conversación es determinístico y predecible; un fallo de persistencia futuro es visible; no hay deuda de datos en las conversaciones pre-INV-3.
- **Deuda aceptada**: una conversación pre-INV-3 conservará un set amplio hasta su próxima mención explícita; el primer reemplazo reescribirá el set completo (sin limpieza manual previa).
- **Ops**: si `[context-scope][ALERT]` aparece en logs, indica un fallo real de escritura (RLS, constraint o red) que debe investigarse; no es un ruido benigno.
- **Tests**: `tests/runtime/b3-scope-anchor.test.ts` y `tests/runtime/context-media-golden.test.ts` reflejan la semántica REPLACE (turno 2 reemplaza al turno 1; genérico posterior resuelve el único activo).
# Session Status — Mapa de Ramas

> Mapa vivo del estado de todas las ramas del repositorio. Actualizalo cada vez que se fusione, cree o borre una rama para que una sesion nueva no pierda el contexto.

**Ultima actualizacion**: 2026-09-13 (post-merge PR #4, post-limpieza basura)

## Estado actual

| Rama | Categoria | Que significa |
|---|---|---|
| `feature/laboratorio-mia` | YA FUNCIONA | Laboratorio MIA completo - en produccion |
| `fix/f2-scope-product` | YA FUNCIONA | Recomendacion de producto scope-aware (PR #2) - en produccion |
| `feat/restore-empathy` | YA FUNCIONA | Restaura instrucciones de empatia Vitanova - en produccion |
| `fix/tenant-isolation-hardening` | YA FUNCIONA | Gate de trafico del asistente a estados `ready/active` - en produccion |
| `fix/sale-won-amount-resolution` | YA FUNCIONA | `SALE_WON` resuelve monto desde `products.price` - en produccion |
| `fix/sales-event-customer-metadata` | YA FUNCIONA | SALE_WON lleva metadata completa de cliente - en produccion |
| `fix/inv3-scope-replace` | YA FUNCIONA | Order-capture consolidada en el prompt del Lab - en produccion |
| `fix/media-scope-hardening` | YA FUNCIONA | Matcher determinista T2/T4 + guard `MEDIA_SCOPE_UNCERTAIN` (PR #3) - en produccion |
| `fix/media-negation-guard` | YA FUNCIONA | Guard de negacion de media dispatch - en produccion |
| `fix/sales-cycle-recurring-purchases` | YA FUNCIONA | Recompra en ciclos multiples en un mismo hilo WhatsApp (PR #4, fusionada 2026-09-13) - en produccion. Rama remota mantenida |
| `feat/teach-pending-approval` | A MEDIAS | Bandeja Aprobar/Descartar de learning_events en el Lab. Feature completa pero sin PR y 22 commits detras de main. Interesante para retomar: pendiente de revision |
| `feat/inventory-quantity-input` | A MEDIAS | Input numerico de stock (incluye commits de `feat/order-card-fields` como base). Sin PR, 10 commits detras |
| `feat/order-card-fields` | A MEDIAS | Campos telefono/producto/fecha en order cards. Sin PR; duplicada dentro de `feat/inventory-quantity-input` |
| `fix/inv3-scope-persistence-hardening` | A MEDIAS | Hardening de logging de `active_product_ids` + ADR-031. Sin PR; zona ya evolucionada en main via `inv3-scope-replace` |
| `wip/loop2-ratified` | A MEDIAS | Ingest async de aprendizaje real (cron fallback `x-vercel-cron`, sondeo FileUpload) mezclado con checkpoints subaru/godzilla de proceso decomisionado. Sin PR, 64 commits detras. Recuperable rescribiendo la feature limpio |

## Borradas 2026-09-13 (BASURA — contenido ya vivia en main por otro camino)

- `docs/proposed-code-protection` — AGENTS.md seccion 22 ya estaba identica en main
- `feat/063-empathy-specific-with-security` — migration `063_empathy_specific_validation.sql` ya estaba identica en main
- `rescue/b3-product-scope-anchor` — B3 anchor ya en main (`resolveActiveProductIdentity`) + checkpoints de governance decomisionado
- `cursor/cloud-agent-1787303605290-jt8a7` — `.cursorrules` + log de governance viejo (2026-08-21)
- `fix/message-idempotency` (local) — migration `075` ya en main, 0 commits pendientes

## Como usar

- **"Lista, esperando OK"** = solo falta que David revise y fusione el PR.
- **"A medias"** = no urgentes ni riesgo; trabajo pausado para retomar cuando haya ganas.
- Regla practica: si una rama fusionada ya no se usa, borrala y actualiza esta tabla.
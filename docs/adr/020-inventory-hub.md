# ADR-020: Inventory Hub — Módulo de Inventario, Catálogo y Probabilidad/Demanda (Schema `inventory`)

## Status

Accepted

## Date

2026-08-08

## Council

Architect, Database Engineer, Backend Engineer, Frontend Engineer, AI Engineer, Performance Engineer, Security Engineer, QA Engineer, Release Manager, Memory Engineer

---

## 1. Context

Vitanova opera venta directa con entrega a domicilio (ADR-019) y necesita conocer su **stock real** durante la conversación de venta: no puede prometer lo que no tiene, y necesita saber **qué reponer** para no quedar sin producto. ADR-010 establece que MIA **no** ejecuta operaciones — "Inventory control (stock tracking, warehouse management)" está explícitamente **fuera de dominio** — y que la integración con sistemas externos ocurre exclusivamente vía `sales_events` (migración 025).

Este módulo tiene el mismo conflicto de frontera que el Delivery Hub (ADR-019): el negocio necesita inventario, pero el core de ventas de MIA debe permanecer purista. La solución probada de ADR-019 se reutiliza íntegramente.

Estado del catálogo actual (evidencia):
- `public.products` (001:43-57): `name, price, description, benefits, faq, restrictions, image_url, documents, is_active` — **sin columnas de stock**.
- `030_catalog_sku.sql` añadió `sku` (único por negocio, índice parcial) → catálogo SKU-centric QuickSell (ADR-017/018). No existe tabla de catálogo separada: **el catálogo es `products`**.
- `public.sales_events` (025): contrato `SALE_WON` con `product_id`, `amount`, `metadata->items` (líneas vendidas). El trigger `delivery.handle_sale_won()` (031) ya consume este evento.
- `public.products` permanece puro: la disponibilidad se proyecta por **join server-side**, nunca como columna en `public`.

### Decisiones de producto confirmadas

| Decisión | Valor |
|----------|-------|
| Aislamiento | Schema `inventory` aislado + trigger (patrón ADR-019) |
| Origen del stock | Auto-decremento por `SALE_WON` + ajustes manuales admin + import masivo CSV/SKU |
| Demanda v1 | Alerta stock bajo + sugerencia de recompra (reglas deterministas) + IA on-demand |
| Catálogo | Enriquecer `products` con disponibilidad (proyección server-side) |

---

## 2. Decision

**Crear el MIA Inventory Hub como micro-módulo aislado dentro del monorepo: schema `inventory` en la misma base Supabase, carpetas `src/lib/inventory/`, rutas admin `/dashboard/inventory` y API `/api/admin/inventory/*`, conectado al ciclo de ventas por un trigger nativo sobre `public.sales_events` (`SALE_WON`) que descuenta stock atómicamente sin bloquear la venta.**

### 2.1 Frontera física (el puente)

```
MIA Core (public)                       Inventory Hub (inventory)
┌──────────────────────────┐  trigger  ┌───────────────────────────┐
│ sales_events (SALE_WON)  │ ────────► │ stock_items  (decremento) │
│  + metadata (items)      │ SECURITY  │ stock_movements (ledger)  │
│  products (SKU, puro)    │ DEFINER   │ restock_suggestions       │
└──────────────────────────┘ search_path='' │ + ingest_errors      │
                                             └───────────────────────┘
```

- **Flujo 1-way**: `sales_events` es la fuente de verdad. El Inventory Hub **nunca** escribe en `public` ni en `sales_events`.
- **Trigger** `inventory.handle_sale_won()`: `AFTER INSERT ON public.sales_events WHEN (event_type='SALE_WON')`. `SECURITY DEFINER SET search_path=''`, objetos 100% calificados (patrón `001:267-275` y `031:392-453`). Si `inventory.business_settings.enabled=false` → no descuenta. Ante error → `inventory.ingest_errors` y **no aborta la venta**.
- **Idempotencia**: `UNIQUE(business_id, sales_event_id) WHERE sales_event_id IS NOT NULL` en `stock_movements` → re-emisión del mismo evento no descuenta dos veces.

### 2.2 Regla de oro: stock bajo NO bloquea la venta

- El trigger decrementa solo si `quantity >= qty` (UPDATE atómico con guarda `WHERE quantity >= qty`).
- Si no hay stock suficiente → registra `ingest_errors` (`INSUFFICIENT_STOCK`) y **continúa la venta**: MIA nunca corta una conversación por falta de inventario.
- La sugerencia de recompra es la que señala el agotamiento; el catálogo muestra disponibilidad como dato de contexto, no como candado.

### 2.3 Schema `inventory` (aislamiento absoluto)

Todas las tablas: `ENABLE RLS` + `FORCE RLS` + `REVOKE ALL FROM anon, authenticated, PUBLIC` (loop DO block, patrón `031:309-321`) + policies `FOR ALL TO authenticated USING (business_id IN (SELECT public.get_user_business_ids()))` (patrón `031:324-382`). Grants solo a `service_role`/`authenticator` (patrón `033`); schema expuesto a PostgREST (patrón `032`).

| Tabla | Propósito |
|-------|-----------|
| `business_settings` | Gate por negocio: `enabled`, `default_low_stock_threshold`. El trigger es la garantía final |
| `stock_items` | `PK(business_id, product_id)`, `quantity INT NOT NULL`, `low_stock_threshold INT`, `version INT` (optimistic concurrency), `updated_at`. FK → `public.products(id) ON DELETE CASCADE` (los productos usan soft-delete `is_active`) |
| `stock_movements` | Ledger append-only: `quantity_delta INT` firmado, `movement_type` (`sale/purchase/adjustment/restock/waste/return/import/initial`), `reference` (`sales_event_id` nullable), `reason`, `created_by`, `created_at` |
| `restock_suggestions` | `suggested_qty`, `reason JSONB` (`low_stock/days_out/velocity`), `ai_summary` nullable, `status` (`pending/dismissed/done`), `ai_used`, `tokens_used`, `generated_at` |
| `ingest_errors` | Fallos del trigger (patrón `031:277-286`) |
| `audit_log` | Trazabilidad de acciones admin |

### 2.4 Probabilidad/Demanda v1: determinista + IA on-demand

- **Capa determinista (SQL, siempre activa, costo $0)**: `days_out` (días desde última venta), `velocity_7d/30d` (unidades vendidas desde `sales_events`), `low_stock` (`quantity <= threshold`), `suggested_qty = ceil(velocity_diaria × lead_time) − quantity` (mínimo `threshold`).
- **Capa IA on-demand (solo al pulsar "Generar sugerencia IA")**: `gpt-4o-mini`, JSON estricto, `max_tokens` bajo, contexto agregado (velocidad, stock, precio, descripción) → nota de reposición en lenguaje natural. `recordAiUsage()` con el `request_type` correspondiente.
- **Ningún cron llama IA** → la operación diaria (reglas + badge de stock) tiene **costo cero**.
- Las sugerencias son generadas por reglas siempre; la IA solo enriquece el texto cuando el usuario la pide.

### 2.5 Catálogo enriquecido (join server-only)

- `/dashboard/catalog` (ProductCard, ProductDetail): badge de disponibilidad vía join server-side a `inventory.stock_items` — `public.products` no se modifica.
- Contexto AI de venta: `getBusinessContext()` incluye `stock_status` por producto → MIA puede presentar disponibilidad en conversación (dentro del dominio de presentación de producto).

### 2.6 Import masivo CSV/SKU

- Reusa el motor de importación multipropósito de ADR-018 (`src/lib/import/engine.ts`, `validators.ts`).
- Parseo CSV (SKU, quantity, threshold) → validación contra `public.products` (scoped por negocio, por SKU) → upsert en `stock_items` + `stock_movements (import)`.
- Errores de fila no abortan el lote: reporte de filas válidas/fallidas.

### 2.7 Licenciamiento por negocio

- `src/lib/system/edition.ts`: nueva capability `inventoryHub` (true solo en `enterprise`/`cloud`, patrón `deliveryHub`), gate server-side por env.
- `inventory.business_settings.enabled` por negocio. El **trigger es la garantía final**: sin `enabled=true` no se descuenta ni una unidad.

---

## 3. Decisiones de diseño

| Área | Decisión | Por qué |
|------|----------|---------|
| Aislamiento BD | Schema `inventory` dedicado, nunca tablas en `public` | ADR-010 + precedente ADR-019; `public.products` permanece puro |
| Disponibilidad | Join server-side, nunca columna en `products` | El catálogo es de ventas; el stock es operativo |
| Decremento | UPDATE atómico con `WHERE quantity >= qty` + ledger `stock_movements` | Sin carreras: dos ventas concurrentes no dejan stock negativo |
| No-bloqueo | Stock insuficiente → `ingest_errors`, la venta continúa | MIA no corta conversaciones por inventario |
| Idempotencia | `UNIQUE(business_id, sales_event_id)` en movements | Re-emisión de SALE_WON no descuenta dos veces |
| Ledger | Append-only con `quantity_delta` firmado y `movement_type` | Auditoría completa, reconstruible |
| Optimistic | `version INT` en `stock_items` | Ajustes admin concurrentes detectan conflicto |
| Demanda | Reglas SQL deterministas + IA on-demand | Operación diaria $0; IA solo cuando el usuario la pide |
| Import | Motor ADR-018 reusado | No duplicar parsers/validación |
| Licencia | Capability `inventoryHub` + flag por negocio | Habilitación por tenant sin inventar billing |

---

## 4. Consecuencias

### Positivas

- El core de ventas no conoce stock, mermas ni reposición: ADR-010 intacto, precedente ADR-019 y 026 respetado.
- `public.products` no cambia de schema: catálogo QuickSell, AI context y RLS existentes no se tocan.
- Un solo contrato de integración: `sales_events` (ADR-010) + trigger, idéntico al Delivery Hub.
- Cero infraestructura nueva: mismo repo, mismo deploy Vercel, misma base Supabase.
- MIA nunca miente sobre disponibilidad en conversación y nunca bloquea una venta por stock.
- Costo operativo diario del módulo: $0 (solo reglas SQL); IA estrictamente on-demand y trackeada.

### Negativas / Trade-offs

- FK a `public.products(id)` hace al trigger sensible a cambios de schema del core (mitigado con `ingest_errors`).
- `CASCADE` al borrar un producto elimina su stock sin avisar (los productos usan soft-delete; riesgo aceptado).
- El decremento es de la línea de venta (`metadata->items`); si el flujo de cierre no emite `items`, se usa `product_id` + `quantity=1` como fallback (convención documentada).
- El stock es tan confiable como el emisor del evento: ventas fuera de MIA (teléfono, WhatsApp manual) no descuentan automáticamente → los ajustes manuales cubren la brecha.

---

## 5. Alternativas consideradas

| Alternativa | Razón de rechazo |
|-------------|------------------|
| **Columnas de stock en `public.products`** | Contamina el dominio de ventas (ADR-010), rompe el precedente 026 y obliga a migrar RLS/prompts |
| **Bloquear la venta si no hay stock** | MIA no debe cortar conversaciones; el stock es contexto, no candado (decisión de producto) |
| **Pronóstico IA por SKU (horizonte 7/30d)** | Costo y complejidad no justificados para v1; se adopta reglas deterministas + IA on-demand |
| **Stock negativo permitido** | Miente en el inventario; se prefiere registrar `INSUFFICIENT_STOCK` y no decrementar |
| **Tabla catálogo de compras separada** | Duplica entidades; el SKU de `products` ya es el identificador común |

---

## 6. Registro de auditoría de resiliencia (2026-08-16)

Auditoría post-implementación de la Fase 2 (migraciones 042/043/044, `TASK-20260816-091002865`) para verificar el contrato de No-Bloqueo (§2.2) frente a la lógica cognitiva.

### 6.1 Blindaje del hot path

- `inventory.ingest_errors` usa el esquema `(business_id, sales_event_id, error, payload)` — verificado en `handle_sale_won_cx` (044:507-509) y en el trigger v3 `handle_sale_won` (042:192-222). No existe columna `metadata`.
- `handle_sale_won_cx` (044:473-510) envuelve TODA la lógica CX (settings → resolve_variant → calcular_eta → create_delivery_promise) en `BEGIN...EXCEPTION WHEN OTHERS` que inserta en `ingest_errors` y hace `RETURN NEW`: la venta nunca aborta, y por la misma transacción tampoco revierte el decremento de stock del trigger v3.
- `resolve_variant` (042:42-85) nunca lanza (`RETURN NULL` sin match); el fallo inducible más profundo está en `create_delivery_promise` (044:441).

### 6.2 Pureza del espejo TypeScript

- `computeEta(context: EtaContext): EtaResult` en `src/lib/inventory/eta.ts` replica la precedencia SQL (local → transit → purchase → lead_time) sin acceso a DB y sin `any` (type-safety estricto). Tests: `tests/inventory/eta.test.ts` (6 casos).

### 6.3 Gate de runtime (2026-08-16) — APROBADO

- Smoke test "jaque v2" ejecutado contra el runtime real (fault injection sobre `create_delivery_promise` con transacción `BEGIN...ROLLBACK`, cero residuo): `venta_ok=1` y `error_capturado=fallo_inducido_smoke_phase2` → **blindaje confirmado** (el EXCEPTION captura el fallo en el punto más profundo y la venta completa).
- El gate atrapó **2 errores SQL reales** que el análisis estático no detectó:
  1. `044:357` — `UNIQUE (business_id, sales_event_id) WHERE ...` inline en `CREATE TABLE` es inválido en PostgreSQL (no admite índices parciales como constraint de tabla). Corregido a `CREATE UNIQUE INDEX idx_inventory_promises_sale ... WHERE sales_event_id IS NOT NULL` (patrón de 043).
  2. `044` `calcular_eta` — `RETURN NEXT ROW(...)` es inválido en una función con `RETURNS TABLE` (parámetros OUT). Corregido a asignación de variables OUT + `RETURN NEXT;` (5 ocurrencias).
- Verificación post-gate: cero residuo (0 smoke-loc, 0 assets de prueba, 0 sales de test, 0 función/trigger de fallo). `INSUFFICIENT_STOCK` capturado es esperado (trigger v3 con `current_qty=0` en el seed; no bloquea).

---

## 7. Referencias

- ADR-010 — MIA Sales Domain Boundary (frontera respetada, `sales_events` como contrato)
- ADR-019 — Delivery Hub (patrón de módulo aislado adoptado: schema, trigger, grants, gating)
- Migración `025_sales_events.sql` — tabla `sales_events`, `metadata->items`
- Migración `030_catalog_sku.sql` — `products.sku` (identificador común catálogo/inventario)
- Migración `031_delivery_hub.sql` — schema `delivery` + triggers + RLS (plantilla)
- Migraciones `032/033` — expose schema a PostgREST + grants `service_role`
- ADR-018 — Motor de Importación Multipropósito (reuso para CSV/SKU)
- `src/lib/system/edition.ts` — capabilities (`deliveryHub` → nueva `inventoryHub`) y `limits`
- `src/lib/import/engine.ts`, `validators.ts` — motor de importación a reutilizar
- `src/components/catalog/*` — catálogo QuickSell a enriquecer con badge de disponibilidad

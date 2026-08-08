# ADR-019: Delivery Hub — Módulo Logístico Aislado (Schema `delivery`) + Portal del Repartidor

## Status

Accepted

## Date

2026-08-08

## Council

Architect, Database Engineer, Backend Engineer, Frontend Engineer, Security Engineer, QA Engineer, Release Manager, Memory Engineer

---

## 1. Context

Vitanova opera venta directa con **entrega a domicilio**: MIA cierra la venta en conversación, pero la entrega física, los repartidores y la cobranza ocurren después de que el dominio de ventas terminó. ADR-010 establece que MIA **no** ejecuta operaciones logísticas (rutas, geolocalización, gestión de repartidores, liquidación de cobranza) y que la integración con sistemas externos ocurre **exclusivamente vía `sales_events`** (migración 025).

El negocio necesita el ciclo completo de entrega sin violar esa frontera. Tres opciones se evaluaron:

| Opción | Descripción | Verdict |
|--------|-------------|---------|
| **1. Sistema externo** | Delivery Hub como servicio/repo separado consumiendo eventos vía webhook | Descartada: duplica infraestructura, despliegues y dolores de CORS para un equipo ágil |
| **2. Ampliar el core** | Tablas y rutas logísticas dentro del core `public` de MIA | Descartada: revierte la limpieza de la migración 026 (`order_requests` eliminada por estar fuera de dominio) |
| **3. Híbrido en monorepo (aislamiento absoluto)** | Mismo repo/Supabase, pero con **schema PostgreSQL dedicado `delivery`**, carpetas aisladas y un único puente: trigger sobre `sales_events` | **Adoptada** |

**Regla de oro**: el core MIA permanece purista (ADR-010). El Delivery Hub no toca tablas de `public` (excepto el trigger de lectura), no comparte componentes ni sesiones con el dashboard, y su contrato con MIA es un solo flujo 1-way `sales_events → delivery`.

---

## 2. Decision

**Crear el MIA Delivery Hub como micro-módulo aislado dentro del monorepo: schema `delivery` en la misma base Supabase, carpetas `src/features/delivery-hub/` + `src/lib/delivery/`, rutas admin `/dashboard/delivery` y portal PWA `/driver` (layout propio), conectado al ciclo de ventas por un trigger nativo sobre `public.sales_events` (`SALE_WON`).**

### 2.1 Frontera física (el puente)

```
MIA Core (public)                       Delivery Hub (delivery)
┌──────────────────────────┐  trigger  ┌───────────────────────────┐
│ sales_events (SALE_WON)  │ ────────► │ orders                    │
│  + metadata (items, amt) │ SECURITY  │   + snapshot cliente      │
│  customers.address       │ DEFINER   │   + order_number (ORD-*)  │
│  products                │ search_path=''                        │
└──────────────────────────┘           │  + ingest_errors si falla │
                                       └───────────────────────────┘
```

- **Flujo 1-way**: `sales_events` es la fuente de verdad. El Delivery Hub nunca escribe de vuelta en `public` ni en `sales_events`.
- **Trigger** `delivery.handle_sale_won()`: `AFTER INSERT ON public.sales_events WHEN (event_type='SALE_WON')`. `SECURITY DEFINER SET search_path=''`, objetos 100% calificados (patrón `001:267-275`). Si `delivery.business_settings.enabled=false` → no replica. Ante error, escribe en `delivery.ingest_errors` y **no aborta** la venta.
- **Idempotencia**: `UNIQUE(business_id, sales_event_id)` → re-emisión SALE_WON no duplica.

### 2.2 Schema `delivery` (aislamiento absoluto)

Todas las tablas: `ENABLE RLS` + `FORCE RLS` + `REVOKE ALL FROM anon, authenticated, PUBLIC` + policy `USING (business_id IN (SELECT public.get_user_business_ids()))` solo para admin (patrón `015_whatsapp_sessions.sql` para el revoke, `001` para la policy).

Entidades: `business_settings`, `drivers`, `orders`, `routes`, `visits`, `driver_events`, `daily_closures`, `driver_sessions`, `outbox_events`, `evidence_photos`, `order_counters`, `ingest_errors`, `audit_log`.

### 2.3 Ley de "Cierre Diario" — POR REPARTIDOR

- No se crea una ruta de fecha D para un driver si ese mismo driver tiene una ruta con `route_date < D` y `status <> 'closed'`.
- **Dos capas**: (1) API `POST /api/admin/delivery/routes` pre-valida → `409 CLOSURE_PENDING`; (2) candado duro: trigger `BEFORE INSERT ON delivery.routes` → `RAISE EXCEPTION` si el driver tiene ruta previa no cerrada.
- `delivery.daily_closures` liquida `total_collected`, `delivered_count`, `incidence_count`; incidencias generan `revisit` automático (columna `revisit_of`).

### 2.4 Autenticación driver (ligera, sin sesión Supabase)

- **Credencial larga duración**: `crypto.randomBytes(32)` → base64url; hash `scrypt` (node:crypto) con salt por driver; expiración 90 días; rotación y revocación por admin.
- **Sesión**: magic link de **un solo uso** en URL → valida y emite **cookie HttpOnly + Secure + SameSite=Lax** firmada con `DRIVER_SESSION_SECRET` (env ≥32 bytes), JWT HMAC 15-30 min con renovación deslizante. El token de acceso **nunca** permanece en la URL (evita logs de Vercel, Referer e historial).
- `/driver/*` se **excluye** de `src/proxy.ts`; el guard del portal valida la cookie server-side en cada request.
- El driver **no usa RLS ni service role del cliente**: todo su tráfico pasa por `/api/driver/*` con `requireDriverAuth()` + `assertDriverOrderAccess(businessId, orderId)` obligatorio.

### 2.5 WhatsApp automático

- **Graph Cloud API** (vía `delivery.business_settings.wa_business_id` + credenciales de `channel_connections`) con idempotencia por `outbox_events` (kind=whatsapp) y plantillas server-side.
- **Fallback humano**: deep link `wa.me` con mensaje pre-cargado (contenido no sensible) para el driver.
- **Baileys queda fuera**: el bridge actual solo expone `start/status/logout`, sin endpoint de envío (evidencia: `src/lib/baileys/bridge.ts`).

### 2.6 Licenciamiento por negocio

- `src/lib/system/edition.ts`: nueva capability `deliveryHub` (true solo en `enterprise`/`cloud`), gate server-side por env.
- `delivery.business_settings.enabled` por negocio (flag en BD). El **trigger es la garantía final**: sin `enabled=true` no se replica ningún pedido. Las rutas driver jamás exponen flags de licencia.

---

## 3. Decisiones de diseño

| Área | Decisión | Por qué |
|------|----------|---------|
| Aislamiento BD | Schema `delivery` dedicado, nunca tablas en `public` | Core purista (ADR-010) + limpieza de permisos por schema |
| Snapshot | `orders` guarda `customer_name/phone/address/city` en el momento de la venta | La entrega es un hecho histórico; no debe mutar si el cliente edita su ficha |
| Acceso driver | Sin RLS; API server-side con admin client scoped por sesión | El driver no tiene identidad Supabase; token opaco, nunca anon key |
| Trigger | `SECURITY DEFINER SET search_path=''`, calificado, con `EXCEPTION → ingest_errors` | Patrón probado en `get_user_business_ids`; un fallo de delivery nunca rompe la venta |
| Números | `order_counters` atómico (`ON CONFLICT DO UPDATE RETURNING`) | Numeración `ORD-000001` sin sequences dinámicas |
| Candado | Trigger `BEFORE INSERT` + check API | Doble capa: UX amable y bloqueo duro en BD |
| Sesión driver | Token opaco + JWT HMAC en cookie HttpOnly | Revocación inmediata, sin claves HS/RS persistentes |
| Offline | Outbox IndexedDB con `idempotency_key` único | Dedupe robusto sin transacciones distribuidas |
| WhatsApp | Graph Cloud API + fallback `wa.me` | Fiabilidad con mínima dependencia; Baileys fuera |
| Licencia | Capability edition + flag por negocio | Habilitación por tenant sin inventar billing |

---

## 4. Consecuencias

### Positivas

- El core MIA no conoce rutas, GPS ni liquidación: ADR-010 intacto, precedente de la migración 026 respetado.
- Cero infraestructura nueva: mismo repo, mismo deploy Vercel, misma base Supabase.
- Un solo contrato de integración: `sales_events` (ADR-010) + trigger.
- Si un cliente no quiere logística: `enabled=false` y el módulo no genera ni una fila.
- Portal driver desacoplado: layout propio, sin sesión admin, PWA offline-first.

### Negativas / Trade-offs

- FKs a `public.*` hacen al trigger sensible a cambios de schema del core (mitigado con `ingest_errors` + alerta).
- El driver que opera en la calle requiere PWA offline: complejidad de outbox/sincronización.
- `wa.me` expone el teléfono del cliente en el dispositivo del driver (necesario para entregar; trade-off de privacidad aceptado).
- El reloj del driver puede ser manipulado: `received_at` server siempre se registra y se valida skew > 2 min.

---

## 5. Alternativas consideradas

| Alternativa | Razón de rechazo |
|-------------|------------------|
| **Sistema externo (servicio/repo separado)** | Duplicación de infraestructura, Vercel, CORS y despliegues |
| **Tablas logísticas en el core `public`** | Revierte la migración 026 y contamina el dominio de ventas |
| **Driver con sesión Supabase + RLS por `auth.uid()`** | El driver no debe tener identidad Supabase; requiere fabricar sesiones y amplía la superficie del Data API |
| **Token permanente en URL `/driver/[token]`** | Queda en logs de Vercel, Referer e historial (Security F6/F7); se adoptó magic link 1-uso + cookie HttpOnly |
| **Baileys para envíos de estatus** | No existe endpoint de envío en el bridge; sesiones frágiles desde la calle |
| **Candado de cierre por negocio** | Congelaría la operación de repartidores que sí cumplieron; se adoptó por repartidor |

---

## 6. Referencias

- ADR-010 — MIA Sales Domain Boundary (frontera respetada, `sales_events` como contrato)
- Migración `025_sales_events.sql` — tabla `sales_events`, `customers.address`
- Migración `015_whatsapp_sessions.sql` — patrón REVOKE ALL para datos sensibles
- Migración `026_legacy_tables_cleanup.sql` — precedente: `order_requests` eliminada por fuera de dominio
- `src/lib/system/edition.ts` — ediciones y capabilities (gate de licencia)
- Migración `031_delivery_hub.sql` — schema `delivery` + trigger (a implementar)
- `src/lib/delivery/` — lógica de negocio (licensing, token, gps, incentives, closure, outbox)
- `src/app/api/admin/delivery/*` y `src/app/api/driver/*` — API routes
- `src/app/driver/` y `src/app/dashboard/delivery/` — UI (portal PWA + admin)
- `tests/delivery/` — suite de pruebas

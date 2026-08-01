# ADR-010 — Clean Nails Web Chat + Landing

## Status: Approved for Implementation

## Date: 2026-07-31

## Council Present: CTO, Architect, AI Engineer, Domain Expert, Product Manager, Security Engineer, Performance Engineer

---

## Background

MIA necesita una presencia pública de venta para Vitanova. La auditoría de venta (P0 #1/#2) identificó como pendientes una landing pública y un widget web con identidad por visitante. En F0/F1 se construyó la capa Frontline y el canal `web` pasó por el pipeline completo (resolución por `businessId` → runtime → Frontline → outbound `web-out-*`).

Existe ya una landing de Clean Nails desarrollada en un repo separado (`arbojo/clean-nails-landing`, Vite + React + Tailwind v4 + Motion), que es un **funnel de venta de 6 pasos**: (0) Evaluación de severidad (leve/moderado/severo con fotos), (1) Validación/empatía, (2) Educación/objeciones, (3) Prueba/testimonios, (4) Solución/timeline, (5) Oferta/formulario → `order_requests` en su propio proyecto Supabase + analítica (`analytics_sessions`/`analytics_events`) + webhook a Kusanali + `wa.me/524775250039`.

## Proposal

1. **Portar el funnel de 6 pasos a MIA** en `src/app/clean-nails`, de forma fiel (mismo diseño, tipografía Bodoni Moda + Jost, animaciones Motion, imágenes). El tema se aisla con `data-atmosphere="clean-nails"` (patrón existente de `AtmosphereProvider`) para no alterar los tokens del admin.
2. **Datos**: el funnel persiste en el **proyecto Supabase de MIA** (no en un proyecto externo). Se crean `order_requests` + `analytics_sessions`/`analytics_events` vía migración `017_clean_nails_funnel.sql`, usando las env existentes de MIA (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Sin estas env, la landing funciona igual (fallback elegante).
3. **Web chat acorde al diseño**: el widget usa los tokens del funnel (fondo crema `#FAF8F5`, acento dorado `#C4A17A`, serif display) en lugar del estilo violeta/rosa genérico.
4. **Handoff a WhatsApp al detectar intención de compra**:
   - Instrucción de negocio (knowledge item) para MIA: en el chat web de la landing, si el cliente muestra intención de compra (precio, pedido, comprar, envío, pagar), responder invitando a continuar por WhatsApp e incluir el enlace `wa.me/524775250039` con mensaje prellenado.
   - El widget muestra CTA de WhatsApp persistente en el header y refuerza el handoff cuando MIA lo sugiere.

## Council Positions

### CTO
**Approve.** Un solo app (una sola deploy, un solo dominio) elimina el problema de CORS del widget cross-origin. El aislamiento por `data-atmosphere` es el patrón ya usado para el tema por ruta; portar el funnel no toca el admin.

### Architect
**Approve — with note.** Portar el código del funnel tal cual (App.tsx → componente cliente) respeta el principio Frontline: el web chat sigue entrando por `/api/channels/webhook/web` (canal `web`, sin proveedor externo). La capa de datos del funnel queda detrás de un módulo propio (`src/lib/clean-nails/`), desacoplado de `src/lib/supabase/*` de MIA.

### AI Engineer
**Approve.** El handoff por knowledge item es la forma correcta de instruir el comportamiento conversacional: MIA decide con lenguaje natural y emite el `wa.me`. No se agrega heurística frágil en el cliente. La identidad por `customerId` en `localStorage` ya fue validada en el canal `web` (P0 #2 resuelto).

### Domain Expert
**Approve.** El funnel ya conoce el dominio (severidad, objeciones, testimonios, $599 MXN, entregas por ciudad). Continuar el acompañamiento por WhatsApp es coherente con la política comercial de Vitanova (el seguimiento de pedido ocurre en WhatsApp).

### Product Manager
**Approve.** La landing original queda tal cual (el funnel que el negocio ya validó) y se le suma el canal de chat que vende: detecta intención y migra a WhatsApp, que es donde Vitanova cierra ventas con acompañamiento real.

### Security Engineer
**Approve — with note.** El webhook `web` sigue siendo público y sin firma (canal primero-primero-party); no expone datos sensibles: la respuesta es el texto de MIA + ids internos del business. El formulario del funnel inserta solo vía anon key (mismas tablas `order_requests`/`analytics_*`, sin RLS, igual que en el proyecto original del funnel).

### Performance Engineer
**Approve.** Se agrega `motion` (React 19 compatible) y 4 imágenes locales servidas desde `public/`. El bundle del funnel es un solo chunk cliente; el admin no se ve afectado por el tema scoped. Latencia del chat idéntica a la ya validada en F0.

## Impact Assessment

### Q1: ¿Riesgo de romper el admin con el tema del funnel?
No. `data-atmosphere="clean-nails"` reescribe solo las variables semánticas bajo ese subárbol; el admin no lo incluye.

### Q2: ¿Y si el cliente no quiere ir a WhatsApp?
MIA no lo fuerza: lo invita. Si el cliente insiste en quedarse en el web chat, MIA continúa asesorando ahí. El CTA de WhatsApp es visible pero no bloqueante.

### Q3: ¿Qué pasa si faltan las env de Supabase de MIA?
La landing funciona completa; solo el registro de `order_requests`/analítica queda deshabilitado hasta configurar las variables. Las tablas se crean con la migración `017_clean_nails_funnel.sql`.

## Final Recommendation: Approve

## Votación

| Miembro | Voto | Notas |
|---------|------|-------|
| CTO | ✅ Approve | Un solo app; sin CORS. |
| Architect | ✅ Approve | Port fiel + módulo de datos desacoplado. |
| AI Engineer | ✅ Approve | Handoff por knowledge item, sin heurística en cliente. |
| Domain Expert | ✅ Approve | Coherente con política comercial y seguimiento WhatsApp. |
| Product Manager | ✅ Approve | Landing validada + chat que migra a WhatsApp. |
| Security Engineer | ✅ Approve | Sin datos sensibles expuestos; RLS del funnel intacta. |
| Performance Engineer | ✅ Approve | Bundle y tema sin impacto en admin. |

**Unanimous — Approve**

# Runbook de Operación — Producción MIA

Guía operativa para el equipo de negocio. Define qué verificar cada día, cada
semana y cómo responder ante incidentes de la plataforma en producción.

---

## 1. Arquitectura en una mirada

| Componente | Dónde vive | Estado |
|------------|-----------|--------|
| Web / API / AI | Vercel (`mia-platform-psi.vercel.app`) | Auto-deploy desde `main` |
| Bridge WhatsApp (Baileys) | Fly.io (`mia-whatsapp-bridge`, región dfw) | Auto-deploy desde GitHub; sesión Vitanova conectada |
| Base de datos | Supabase (PostgreSQL + RLS) | Datos multi-tenant |

Toda la memoria operacional se consulta desde el dashboard. Las señales de
venta, delivery y fallas aterrizan en el **inbox de señales** (`mia_signals`).

---

## 2. Rutina diaria (10 minutos)

1. **Inbox de señales** — Abrir el dashboard y revisar las señales pendientes:
   - `SALES` con prioridad `atencion` → ventas ganadas o clientes que requieren
     seguimiento. Abrir la conversación, confirmar datos y coordinar entrega.
   - Señales con `delivery_pending` → falta la dirección del cliente.
   - Señales de delivery/incidencias → resolver o re-planificar.
2. **Learning events pendientes** — Revisar las correcciones en estado
   `pending` (Laboratorio → Teach / Training). Aprobar, modificar o rechazar.
   Aprobar solo cuando el conocimiento es correcto y seguro.
3. **Síntomas en el dashboard** — En la card "Síntomas que MIA detecta en tus
   clientes", revisar si hay patrones repetidos (objeciones, dudas de precio o
   entregas). Si un síntoma se repite, convertilo en knowledge item o regla.
4. **Salud del bridge** — Si el teléfono no responde o tarda: verificar el
   estado de la sesión desde el dashboard de canales. En Fly:
   `flyctl status -a mia-whatsapp-bridge`.
5. **Prueba rápida opcional** — Abrir una conversación nueva por WhatsApp con
   un mensaje de prueba (ej. pregunta de precio) para confirmar que responde
   con imagen + texto en una conversación nueva.

---

## 3. Rutina semanal (15 minutos)

1. **Aprendizaje automático** — El cron `/api/cron/memory-analyze` corre
   **todos los días a las 4:00 a. m.** (Vercel) y detecta patrones de las
   conversaciones del día, actualiza skills y la velocidad de aprendizaje.
   - Los patrones detectados aparecen en el dashboard en la card **"Síntomas
     que MIA detecta en tus clientes"** (cada patrón muestra categoría,
     confianza y cuántas veces se repitió).
   - Verificar que corrió: Logs de Vercel → función `cron-memory-analyze` →
     `status: completed`.

   > **Setup (una sola vez)**: configurar la variable de entorno `CRON_SECRET`
   > en Vercel (string aleatoria de 16+ chars). Vercel la envía automáticamente
   > como header `Authorization: Bearer <CRON_SECRET>` en cada invocación del
   > cron. `MIA_CRON_SECRET` (`.env.example`) sirve para invocaciones manuales.
2. **Reporte semanal** — Revisar el reporte semanal del business (pestaña
   correspondiente) y decidir qué knowledge, reglas o productos cargar.
3. **Skills** — Si una skill baja (ej. `payment_methods`), revisar las
   knowledge items y reglas de esa categoría.
4. **Revisar memoria de cliente** — En clientes con ventas, confirmar que el
   resumen/intereses quedaron bien para la próxima interacción.

---

## 4. Verificación de venta end-to-end

Flujo correcto de una venta real:

```
Cliente pregunta → MIA conversa y vende → cierre detectado
  → evento SALE_WON → señal SALES (inbox) → customer.status = won
  → aviso WhatsApp al dueño (si configurado) → order en Delivery
```

Para confirmar que un pedido quedó registrado:
1. Buscar la señal `SALES` con el nombre del cliente.
2. Verificar el estado del cliente (`won`) y la conversación.
3. Confirmar que el pedido apareció en el módulo de Delivery (si contratado).

> Regla: el inbox de señales es la **fuente de verdad** de ventas registradas.
> La notificación WhatsApp es un complemento (best-effort), no es el registro.

---

## 5. Notificación WhatsApp de ventas (configuración)

Para recibir en tu WhatsApp un aviso cuando MIA cierra una venta:

1. Editar la conexión `channel_connections` del business (canal `whatsapp`).
2. En `configuration` agregar:

```json
{ "notification_phone": "5491100000000" }
```

Número en formato internacional sin `+`. Solo se envía cuando la conexión
WhatsApp está `connected`. Sin ese campo, la venta se sigue registrando
normalmente en el inbox.

---

## 6. Respuesta ante incidentes

| Síntoma | Qué hacer |
|---------|-----------|
| WhatsApp no responde | `flyctl logs -a mia-whatsapp-bridge`; ver estado de sesión; `flyctl ssh console -a mia-whatsapp-bridge` para debug; reconnect desde dashboard. Si sigue, redeploy. |
| Web caída / errores 5xx | Logs de Vercel; verificar deploy reciente en `main`; rollback al último deploy sano. |
| Respuestas inconsistentes | Revisar learning events pendientes, reglas y knowledge del business; probar en Laboratorio antes de corregir en producción. |
| Fallos de media (imagen no llega) | Bridge reintenta 2 veces y degrada a texto; revisar `image_url` del producto y el bucket público `knowledge-media`. |
| Coste de AI alto | Revisar `ai_usage` por `request_type` (`training`/`simulation`/`live_customer`); moderar uso del Laboratorio. |

---

## 7. Referencias

- Cierre de venta: `src/lib/sales/process.ts` (SALE_WON/LOST, señales).
- Notificación dueño: `src/lib/sales/events.ts` → `notifySaleToOwner`.
- Aprendizaje: `src/lib/ai/memory.ts` + cron `src/app/api/cron/memory-analyze/route.ts`.
- Bridge: `services/whatsapp-bridge/fly.toml`, `docs/adr/013-whatsapp-baileys-bridge.md`.
- Monitoreo e2e: `tests/public.spec.ts`, `playwright.config.ts`.
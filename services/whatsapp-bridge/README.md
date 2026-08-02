# MIA WhatsApp Bridge

Servicio Node.js dedicado que mantiene conexiones **Baileys** (WhatsApp Web no oficial) para cada negocio. Aloja la sesión persistente TCP con WhatsApp y expone:

- **QR / pairing code** para vincular un número de WhatsApp desde el dashboard de MIA.
- **WebSocket** de eventos en vivo (QR, estado, errores).
- **Webhook interno** que reenvía los mensajes entrantes al motor conversacional de MIA.
- **Envío** de respuestas del asistente hacia WhatsApp.

## ¿Por qué un proceso dedicado?

Baileys requiere una conexión TCP **persistente** con los servidores de WhatsApp Web. Next.js en Vercel es serverless y no mantiene sockets de larga duración. Por eso el bridge es un proceso long-running independiente (VPS, Railway, Render, Docker, etc.).

## Requisitos

- Node.js >= 18
- Tabla `whatsapp_sessions` aplicada (migración `015_whatsapp_sessions.sql`)

## Configuración

```bash
cp .env.example .env
# completar valores
npm install
```

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo server) |
| `MIA_APP_URL` | URL base de la app Next.js (ej. `http://localhost:3000`) |
| `WHATSAPP_BRIDGE_SECRET` | Secreto compartido con `WHATSAPP_BRIDGE_SECRET` de Next.js |
| `BRIDGE_PORT` | Puerto del bridge (default `8787`) |

## Ejecutar

```bash
npm run dev       # desarrollo (watch)
npm start         # producción
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/v1/sessions/:businessId/start` | Inicia/recupera la sesión Baileys del negocio |
| `GET` | `/v1/sessions/:businessId/status` | Estado actual de la sesión |
| `DELETE` | `/v1/sessions/:businessId/logout` | Cierra sesión y borra credenciales |
| `POST` | `/v1/sessions/:businessId/send` | Envía un mensaje de texto |
| `WS` | `/v1/ws?businessId=X&token=T` | Eventos en vivo (QR, status, error) |

Todos los endpoints HTTP requieren el header `x-mia-bridge-secret`. El WebSocket requiere un token firmado `HMAC-SHA256(secret, businessId)` generado por el endpoint `/api/channels/baileys/ws-token` de Next.js.

## Eventos WebSocket

```json
{ "type": "qr", "qr": "@...ASRPHi..." }
{ "type": "status", "status": "connected", "phone": "5215512345678" }
{ "type": "error", "message": "Connection closed unexpectedly" }
```

## Flujo de conexión

1. El usuario pulsa "Conectar WhatsApp" en MIA.
2. Next.js llama `POST /v1/sessions/:businessId/start`.
3. El bridge crea el socket Baileys y emite el QR por WebSocket.
4. El usuario escanea el QR con WhatsApp.
5. El bridge guarda las credenciales (`creds` + `keys`) en `whatsapp_sessions` (service role).
6. Los mensajes entrantes se reenvían a `/api/channels/baileys/webhook` de MIA.
7. La respuesta del asistente se envía de vuelta a WhatsApp.

## Seguridad

- Las credenciales de sesión viven en Supabase, accesibles **solo** con service role (tabla sin grants para `anon`/`authenticated`, RLS forzada).
- El webhook interno MIA valida `x-mia-webhook-secret`.
- El WebSocket valida un token firmado por negocio.
- **Limitación conocida**: las credenciales se almacenan en texto plano en la columna JSONB (transporte TLS). Cifrado at-rest (p. ej. `pgcrypto`) queda como mejora futura.

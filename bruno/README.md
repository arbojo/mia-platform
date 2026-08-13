# Bruno — MIA Platform API

Colección Bruno versionada para diagnosticar y probar las APIs de MIA de forma reproducible en cualquier máquina (Linux/Windows). Ver [ADR-023](../../docs/adr/ADR-023.md).

## Primer uso

1. Abre Bruno (app de escritorio) y selecciona la carpeta `bruno/` como colección.
2. Copia el entorno de ejemplo y rellena los valores:

   ```bash
   cp bruno/environments/local.example.bru bruno/environments/local.bru
   ```

3. En Bruno, activa el entorno `local` (o el nombre que le hayas dado al fichero).
4. Ejecuta los requests. Los protegidos por sesión requieren `SESSION_COOKIE` (cookie de sesión Supabase obtenida del navegador tras login).

## Política de secretos (obligatoria)

- **Ningún `.bru` versionado contiene valores reales.** Solo placeholders `{{VAR}}` o `{{process.env.VAR}}`.
- Los valores reales (`SESSION_COOKIE`, `BRIDGE_SECRET`, ids, etc.) viven **exclusivamente** en un fichero de entorno local ignorado por git (`bruno/environments/*.bru`, salvo `*.example.bru` / `*.template.bru`).
- Para secretos del sistema operativo se puede usar un fichero `bruno/.env` (también ignorado) referenciado como `{{process.env.VAR}}`.
- `npm run secrets-check` escanea `bruno/` y falla si detecta un patrón de secreto; está integrado en el CI (validate.yml). GitHub Push Protection bloquea además cualquier token que intente cruzar el push.

## Variables del entorno local

| Variable | Contenido | Secreto |
|---|---|---|
| `BASE_URL` | URL de la app (p. ej. `https://mia-platform-psi.vercel.app`) | No |
| `SESSION_COOKIE` | Cookie de sesión Supabase (tras login en el navegador) | **Sí** |
| `BUSINESS_ID` | ID del negocio (tenant) | No |
| `ASSISTANT_ID` | ID del asistente | No |
| `CONNECTION_ID` | ID de la conexión de canal (para followup) | No |
| `CUSTOMER_ID` | ID del cliente (para followup) | No |
| `CHANNEL_ID` | Canal para `/api/channels/webhook/[channel]` | No |
| `BRIDGE_SECRET` | `WHATSAPP_BRIDGE_SECRET` (webhooks bridge→MIA) | **Sí** |

## Endpoints

- **System**: `GET /api/system/health` (público).
- **Channels**:
  - `GET /api/channels/connections` (cookie)
  - `POST /api/channels/connections` (cookie) — body `{ businessId, assistantId, channel }`
  - `GET /api/channels/baileys/ws-token?businessId=<id>` (cookie) → devuelve `{ token, wsUrl, businessId }`
  - `POST /api/channels/baileys/session` (cookie) — body `{ businessId, assistantId }`
  - `POST /api/channels/baileys/reconnect` (cookie) — body `{ businessId }`
  - `POST /api/channels/baileys/followup` (header `x-mia-webhook-secret`) — body `{ businessId, customerId, connectionId }`
  - `POST /api/channels/baileys/webhook` (header `x-mia-webhook-secret`)
  - `POST /api/channels/webhook/[channel]`

## Diagnóstico WebSocket

La conexión WebSocket del bridge se diagnostica con wscat o con el respaldo de Node puro:

```bash
npm run ws-diagnose -- --url "wss://<bridge>/v1/ws?businessId=<id>&token=<signed>"
```

Ver `docs/infrastructure/ws-diagnostics.md` para el procedimiento completo.

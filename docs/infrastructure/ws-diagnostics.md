# Diagnóstico WebSocket del bridge — wscat + respaldo Node puro

Procedimiento canónico para diagnosticar la conexión WebSocket del bridge Baileys. Definido en [ADR-023](../../docs/adr/ADR-023.md) (ratificado por el Consejo: P3).

## 1. Contrato del WebSocket

El bridge expone `wss://<bridge>/v1/ws` (`services/whatsapp-bridge/src/server.ts:150`, dependencia `ws ^8.18.0`). La autenticación es por query params:

- `businessId` — ID del negocio.
- `token` — HMAC-SHA256 base64url del `WHATSAPP_BRIDGE_SECRET` sobre el `businessId`. Rechazo con `ws.close(4401, 'Unauthorized')`.

El token se obtiene de la API de MIA:

```
GET /api/channels/baileys/ws-token?businessId=<id>
```

Respuesta: `{ success: true, token, wsUrl: "wss://<bridge>/v1/ws", businessId }`.

## 2. Comando canónico con wscat

wscat es una devDependency de la raíz (`npm ci` lo instala). Es **JavaScript puro** (sin addons nativos), así que no requiere compilación por plataforma y funciona igual en Linux, WSL2, CMD y PowerShell:

```bash
npm ci
npx wscat -c "wss://<bridge>/v1/ws?businessId=<id>&token=<signed>"
```

## 3. Respaldo sin wscat (Node puro)

Si `npx wscat` falla en una máquina (node_modules dañado, shims de Windows), el respaldo usa el mismo `ws` del repo sin shims ni ejecutables:

```bash
npm run ws-diagnose -- --url "wss://<bridge>/v1/ws?businessId=<id>&token=<signed>"
```

O construyendo la URL a partir de parámetros/entorno:

```bash
WHATSAPP_BRIDGE_URL=wss://<bridge> BUSINESS_ID=<id> WS_TOKEN=<signed> npm run ws-diagnose
```

Opciones: `--bridge <host>` / `--business <id>` / `--token <token>` (alternativa a la URL completa), `--send <mensaje>` (envía un mensaje al abrir) y `--timeout <ms>` (por defecto 15000). Escribir en stdin envía líneas a la conexión. Salida con código 0 solo si cierra con `1000`.

## 4. Windows (CMD/PowerShell nativo)

- **Rutas largas (límite 260 caracteres)**: el anidamiento de `node_modules` puede exceder `MAX_PATH`. Habilitar rutas largas para npm una vez por máquina:

  ```powershell
  npm config set core.longpaths true
  ```

  Adicionalmente, mantener el repo clonado en una ruta corta (p. ej. `C:\dev\mia-platform`) evita el problema de raíz.

- **Execution policy de PowerShell**: solo afecta a scripts `.ps1`; los shims `.cmd` de npm se ejecutan vía `cmd.exe` y **no** se bloquean. Si un entorno restringido (`Restricted`) bloquea comandos, ejecutar desde `cmd` o usar WSL2.
- **wscat/ws-diagnose son puros JS**: no requieren permisos de ejecución binaria ni toolchains de compilación.

## 5. Higiene de secretos

El `token` y el `WHATSAPP_BRIDGE_SECRET` son credenciales. Nunca se escriben en archivos versionados: pasan por variables de entorno o por el entorno local de Bruno (`bruno/environments/*.bru`, ignorado por git). `npm run secrets-check` + GitHub Push Protection son la red de seguridad (ver ADR-023, P5).

# Informe Técnico — Imágenes Condicionales en Knowledge Studio

## Resumen

Este módulo permite asociar una **imagen** a un item de Knowledge con una **condición de gatillo** (ej. "precio", "aspecto físico", "testimonio"). Cuando un cliente menciona el tema en WhatsApp, MIA envía la imagen **una sola vez por conversación**, junto a la respuesta del asistente como caption.

## Arquitectura

```
Knowledge Studio (UI)
  │  upload (FormData)               sube imagen
  ▼                                        │
POST /api/knowledge/media/upload           ▼
  │  verifica ownership → admin.storage   Supabase Storage
  │  devuelve publicUrl                bucket: knowledge-media
  ▼
PATCH/POST /api/knowledge/items
  │  guarda image_url + trigger_condition
  ▼
knowledge_items (image_url, trigger_condition)
  │
  │  (por mensaje entrante)
  ▼
processIncomingMessage (runtime)
  │  matcher determinista: ¿el mensaje del cliente
  │  contiene keywords de trigger_condition?
  │  ¿ya se envió esta imagen en esta conversación? (chat_media_dispatched)
  │  → sí: registra envío + añade imageUrl a la respuesta
  ▼
Baileys webhook → { response, imageUrl }
  ▼
Bridge Baileys (session-manager)
  │  sendMessage(remoteJid, { image: { url }, caption: response })
  ▼
WhatsApp: 📷 imagen + caption
```

## 1. Migración de base de datos

**Archivo:** `supabase/migrations/016_knowledge_media.sql`

| Cambio | Detalle |
|--------|---------|
| `knowledge_items.image_url` | `TEXT NULL` — URL pública en Storage |
| `knowledge_items.trigger_condition` | `TEXT NULL` — etiqueta del detonante |
| Tabla `chat_media_dispatched` | `business_id`, `conversation_id`, `customer_id`, `knowledge_item_id`, `created_at` |
| Constraint `uq_chat_media_once` | `UNIQUE (knowledge_item_id, conversation_id)` — envío único |
| Índices | `business_id`, `conversation_id` |
| RLS `chat_media_dispatched` | SELECT/INSERT/DELETE solo para el business owner |
| Bucket `knowledge-media` | Público de lectura; escritura solo owner (`<business_id>/<file>`); máx 5 MB; `image/jpeg,png,webp,gif` |

### Aplicación

```bash
# Con Supabase CLI linkeado al proyecto MIA (hhitqgsaglddjkmaovbs):
supabase db push
```

> **Nota de despliegue**: el MCP de Supabase de esta sesión apunta al proyecto **legacy** `aveusacpaexwrfoyinas` (no al proyecto de la app). La migración debe aplicarse al proyecto `hhitqgsaglddjkmaovbs` (ver `.env.local → NEXT_PUBLIC_SUPABASE_URL`).

## 2. API

### `POST /api/knowledge/media/upload`

- Body: `FormData` con `business_id` y `file`.
- Valida: autenticación, ownership del business, `content-type` en `image/*` permitidos, tamaño ≤ 5 MB.
- Sube con admin client a `knowledge-media/<business_id>/<uuid>.<ext>`.
- Responde `201 { url }`.

### `PATCH /api/knowledge/items/[id]`

- Acepta ahora `image_url` (`string | null`, permite quitar) y `trigger_condition`.
- Escribe con admin client (por regla de auth RLS del proyecto).

### `POST /api/knowledge/items`

- Acepta `image_url` y `trigger_condition` opcionales.
- **Valida**: si hay `image_url`, `trigger_condition` es obligatorio (400).

## 3. Motor conversacional

### `src/lib/runtime/media.ts` — matcher puro

```ts
triggerMatches(userMessage, "precio, costo") // separación por comas
```

- Normaliza: lowercase, sin acentos, sin puntuación, espacios colapsados.
- Devuelve `true` si el mensaje contiene **alguna** keyword del trigger.
- Sin dependencias; testeado en `tests/runtime/media.test.ts`.

### `src/lib/runtime/conditional-media.ts` — resolución y registro

```ts
resolveConditionalMedia({ businessId, customerId, conversationId, userMessage })
```

1. Si no hay `conversationId` → `null` (no enviar sin conversación).
2. Consulta `knowledge_items` activos con `image_url` y `trigger_condition` NOT NULL.
3. Filtra los que hacen match con `triggerMatches`.
4. Excluye los ya enviados en la conversación (consulta `chat_media_dispatched`).
5. Toma el primer pendiente, registra el envío y devuelve `{ knowledgeItemId, imageUrl }`.

### `src/lib/runtime/runtime.ts`

`processIncomingMessage` ahora devuelve:

```ts
{ response, customerId, conversationId, imageUrl? }
```

## 4. Prompt

`formatKnowledge` (`src/lib/ai/prompts.ts`) añade a cada item con imagen:

```
[IMAGEN_DISPONIBLE] Enviar la imagen asociada a este conocimiento cuando el cliente
toque este tema: "<trigger>". Se envía automáticamente la primera vez en la conversación;
tú solo debes mencionar en tu respuesta que compartes una imagen al respecto.
```

El LLM **no decide** el envío (determinismo + coste): solo prepara el contexto. El runtime decide.

## 5. Canal WhatsApp / Bridge Baileys

| Archivo | Cambio |
|---------|--------|
| `src/app/api/channels/baileys/webhook/route.ts` | Propaga `imageUrl` en la respuesta |
| `services/whatsapp-bridge/src/mia-client.ts` | `MiaReply.imageUrl?` |
| `services/whatsapp-bridge/src/session-manager.ts` | `handleMessages`: si `imageUrl`, `sendMessage(jid, { image: { url }, caption })` en vez de `{ text }`; `sendMessage()` acepta `imageUrl` opcional |
| `services/whatsapp-bridge/src/server.ts` | Ruta `/send` acepta `imageUrl` |
| `src/lib/channels/adapters/baileys.ts` | `sendMessage` envía `imageUrl` desde `message.metadata.imageUrl` |

## 6. UI — Knowledge Studio

`src/components/knowledge/KnowledgeManager.tsx`:

- **Formulario de alta**: subidor de imagen (`<input type=file>` → upload → preview), campo "Condición de envío" (opcional, requerido si hay imagen).
- **Cards**: preview de imagen + badge "Se envía cuando mencione: <trigger>".
- **Edición**: cambiar/quitar imagen, editar trigger.
- Guarda/edita vía los endpoints existentes; el componente se mantiene Client Component y usa shadcn/ui existente.

## 7. Tipos

`src/lib/types/index.ts`:

- `knowledge_items.Row/Insert/Update`: + `image_url`, `trigger_condition`.
- Nueva tabla `chat_media_dispatched` con Row/Insert/Update.

## 8. Pruebas

| Gate | Comando | Resultado |
|------|---------|-----------|
| Unit (matcher) | `npx vitest run tests/runtime/media.test.ts` | 8/8 OK |
| Unit (suite) | `npx vitest run` | 75/75 OK |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Build | `npm run build` | OK (incluye `/api/knowledge/media/upload`) |

> Los errores de `npx tsc --noEmit` en `tests/` (identity, load-context, execute-ai, process-incoming-message) son **pre-existentes** en HEAD limpio (verificado con `git stash`), no introducidos por este cambio.

## 9. Verificación manual sugerida

1. Aplicar la migración 016 al proyecto MIA.
2. En Knowledge Studio, crear un item con imagen + gatillo "precio".
3. Iniciar bridge y escanear QR.
4. Escribir al bot: "¿cuál es el precio?" → debe recibir la imagen + respuesta.
5. Escribir de nuevo "¿precio?" en la misma conversación → NO debe reenviarse la imagen.
6. Nueva conversación → la imagen vuelve a estar disponible una vez.

## 10. Alcance futuro

- Múltiples imágenes por item.
- Gatillos por canal (WhatsApp vs widget).
- Eventos de Sales Intelligence (`PRODUCT_SELECTED`) al enviar media (pendiente del sistema de eventos de ADR-010).

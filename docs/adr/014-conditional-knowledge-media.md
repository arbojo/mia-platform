# ADR-014: Conditional Knowledge Media (Imágenes condicionales en Knowledge Studio)

## Status

Accepted

## Date

2026-08-02

## Council

Architect, Database Engineer, Backend Engineer, Frontend Engineer, AI Engineer, Performance Engineer, Security Engineer, QA Engineer, Release Manager, Memory Engineer

---

## 1. Context

MIA conversa por WhatsApp vía el puente Baileys (ADR-013) y responde **solo texto**. Las empresas de venta necesitan enviar imágenes (fotos de producto, resultados, testimonios) cuando el cliente muestra interés en un tema específico, y **una sola vez** por conversación para no ser intrusivas.

El estado actual:

- `knowledge_items` (migración 001) solo tiene `question`/`answer` textuales. No hay campo de imagen ni condición de envío.
- `processIncomingMessage` (`src/lib/runtime/runtime.ts:91`) devuelve `{ response, customerId, conversationId }`. Solo texto.
- `BaileysAdapter.sendMessage` envía `{ text }` al bridge; el bridge envía `{ text }` con `socket.sendMessage`.
- No existe Supabase Storage configurado para este propósito.

Se requiere un mecanismo para:

1. Asociar una imagen a un item de conocimiento (opcional).
2. Definir una **condición de gatillo** (ej. "precio", "aspecto físico") en lenguaje natural.
3. Que el motor detecte cuándo el mensaje del cliente activa el gatillo.
4. Enviar la imagen **una única vez por conversación**.
5. El LLM debe mencionar la imagen en su respuesta (para no enviar imagen sin contexto).

---

## 2. Decision

**Añadir imágenes condicionales a `knowledge_items` con un historial de despacho único (`chat_media_dispatched`), almacenadas en Supabase Storage (bucket público de lectura), evaluadas por un matcher determinista en el runtime, y enviadas por el bridge como imagen con caption.**

---

## 3. Decisión de diseño

### 3.1 Esquema (migración `016_knowledge_media.sql`)

| Tabla / Columna | Tipo | Propósito |
|-----------------|------|-----------|
| `knowledge_items.image_url` | `TEXT NULL` | URL pública en Storage del bucket `knowledge-media` |
| `knowledge_items.trigger_condition` | `TEXT NULL` | Etiqueta descriptiva del detonante (ej. `precio, costo`) |
| `chat_media_dispatched` | nueva tabla | Historial: qué imagen se envió en qué conversación |
| `chat_media_dispatched` UNIQUE `(knowledge_item_id, conversation_id)` | constraint | Garantiza envío único por conversación |
| Bucket Storage `knowledge-media` | público lectura / owner escritura | Almacenamiento de imágenes (máx 5 MB, JPEG/PNG/WebP/GIF) |

Restricción de integridad: **no se puede guardar `image_url` sin `trigger_condition`** (validado en API).

### 3.2 Motor (matcher determinista, no LLM)

Se eligió un **matcher por palabras clave** (`src/lib/runtime/media.ts`) en lugar de pedir al LLM que decida si enviar imagen, porque:

- **Coste**: no añade llamadas a OpenAI (regla del Performance Engineer).
- **Determinismo**: el envío único depende de un hecho verificable, no de una decisión probabilística.
- **Rendimiento**: `O(n·k)` sobre los pocos items que tienen imagen.

El matcher normaliza el mensaje del cliente (lowercase, sin acentos, sin puntuación) y compara con cada keyword de `trigger_condition` separada por comas. Si alguna keyword está contenida, el gatillo se activa.

### 3.3 Contrato de respuesta ampliado

`processIncomingMessage` ahora devuelve `{ response, customerId, conversationId, imageUrl? }`. El webhook Baileys propaga `imageUrl`, el bridge la envía como `{ image: { url }, caption: response }`.

### 3.4 Prompt

Cuando un knowledge item tiene imagen, `formatKnowledge` añade una nota `[IMAGEN_DISPONIBLE]` que instruye al asistente a mencionar que comparte una imagen al tocar el tema. El **envío real** lo decide el runtime (matcher), no el LLM.

---

## 4. Consecuencias

### Positivas

- MIA puede enviar imágenes contextuales en WhatsApp sin coste adicional de AI.
- Envío único garantizado por constraint de BD (no solo por lógica de app).
- Configuración simple: el dueño del negocio sube la imagen y escribe el gatillo en lenguaje natural desde Knowledge Studio.
- RLS y scoping por business preservados; bucket de lectura pública para que WhatsApp pueda descargarla sin token.

### Negativas / Trade-offs

- El matcher es heurístico: un gatillo mal escrito puede no activarse. Mitigación: la keyword aparece visible en la UI con placeholder de ejemplo.
- El bucket es de lectura pública (necesario para WhatsApp). Mitigación: solo imágenes comerciales no sensibles; la subida queda restringida al owner del business.
- `chat_media_dispatched` inserta una fila por envío (crecimiento moderado, indexado por business/conversation).

---

## 5. Alternativas consideradas

| Alternativa | Razón de rechazo |
|-------------|------------------|
| **LLM decide el envío** (tool/JSON del modelo) | Coste extra por mensaje, latencia, no determinista para envío único |
| **Enviar imagen en cada respuesta** | Intrusivo; viola el requisito de "una vez por conversación" |
| **Guardar imagen en la misma tabla de `products`** | Mezcla conceptos (Products ≠ Knowledge, regla del Domain Expert); además MIA no gestiona inventario |
| **Bucket privado + URL firmada** | WhatsApp descarga la URL horas después de generada; las firmas expiran y rompen el envío |

---

## 6. Referencias

- `supabase/migrations/016_knowledge_media.sql` — esquema y RLS
- `src/lib/runtime/media.ts` — matcher determinista (tests en `tests/runtime/media.test.ts`)
- `src/lib/runtime/conditional-media.ts` — resolución y registro de envío
- `src/lib/runtime/runtime.ts` — `processIncomingMessage` ampliado
- `src/lib/ai/prompts.ts` — nota `[IMAGEN_DISPONIBLE]`
- `src/app/api/knowledge/media/upload/route.ts` — subida a Storage
- `src/components/knowledge/KnowledgeManager.tsx` — UI (subidor + gatillo + preview)
- `services/whatsapp-bridge/src/session-manager.ts` — envío `{ image, caption }`
- `docs/features/knowledge-conditional-images.md` — informe técnico

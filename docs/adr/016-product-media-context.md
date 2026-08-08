# ADR-016: Medios por Producto + product_context

## Status

Accepted

## Date

2026-08-07

## Council

Architect, Database Engineer, Backend Engineer, Frontend Engineer, AI Engineer, Performance Engineer, Security Engineer, QA Engineer, Release Manager, Memory Engineer

---

## 1. Context

Tras ADR-014, los `knowledge_items` con imagen se envían cuando el matcher detecta el gatillo, sin distinguir **para qué producto** están hechos. En un catálogo con varios productos (ej. "Clean Nails" y "Neurofeet"), keywords compartidas como "precio", "resultados" o "testimonio" son ambiguas: el cliente que pregunta por el precio de un producto puede recibir la imagen de otro.

Además, el widget y la landing (ancla Facebook) ya inyectan un `LandingContext` (`product`, `brand`) que identifica el producto activo de la visita. Ese contexto no llegaba al matcher de media.

Se requiere:

1. Asociar cada media de `knowledge_items` a un `product_id` del catálogo (opcional, NULL = genérico).
2. Que el matcher de media se escope al producto activo cuando exista `product_context`.
3. Que el LLM sepa qué producto está activo para no contradecir la media enviada.
4. No romper el comportamiento genérico existente (media sin producto sigue funcionando).

---

## 2. Decision

**Añadir `knowledge_items.product_id` (FK a `products`, ON DELETE SET NULL) y propagar el `productId` del `LandingContext` a través de la cadena widget → runtime → matcher de media y al prompt.**

La prioridad de resolución de media es determinista:

```
media del producto activo (product_id === productId)
  → media genérica (product_id IS NULL)
  → primer candidato pendiente (fallback histórico)
```

---

## 3. Decisiones de diseño

### 3.1 Esquema (migración `029_product_media.sql`)

| Columna | Tipo | Propósito |
|---------|------|-----------|
| `knowledge_items.product_id` | `UUID NULL REFERENCES products(id) ON DELETE SET NULL` | Producto al que pertenece la media; NULL = genérico |
| `idx_knowledge_product` | index | Scoping eficiente por producto |

- `ON DELETE SET NULL`: si un producto se elimina, la media no se pierde (pasa a genérica) en vez de bloquear o borrar.
- La validación `image_url` requiere `trigger_condition` **o** `product_id` (una media puede anclarse solo a producto, sin gatillo).

### 3.2 Contexto (sin tocar `cacheKey`)

El `productId` viaja en el objeto `LandingContext` existente:

- `src/lib/ai/knowledge.ts`: `getLandingContext` acepta `lc.productId` (UUID) o el nombre `lc.product`/`lc.brand` (resolución por nombre como fallback). Si ninguno existe, no resuelve producto (sin error).
- `src/lib/conversation/context.ts`: `LoadedContext.productId` se deriva de `getLandingContext`. **No se modifica `cacheKey`** — el aislamiento por producto ya lo provee `landingContext.product`, decisión explícita del Concilio.
- `src/lib/runtime/runtime.ts`: `processIncomingMessage` desestructura `productId` del contexto y lo pasa a `resolveConditionalMedia`. Sin cambios de firma pública.

### 3.3 Matcher de media

`src/lib/runtime/conditional-media.ts` acepta `productId` opcional y aplica la prioridad específico → genérico → fallback. Sin `productId`, conserva el comportamiento de ADR-014 (genérico primero).

### 3.4 Prompt

- `formatKnowledge` recibe `activeProductId` y oculta la nota `[IMAGEN_DISPONIBLE]` para medias que no corresponden al producto activo ni son genéricas.
- Con landing presente, se inyecta una sección `## Producto activo` en el system prompt para que el asistente hable del producto correcto.

### 3.5 Widget / landing

`src/app/api/widget/chat/route.ts` acepta y valida `productId` (≤ 64 chars), `src/app/widget/page.tsx` lo lee del query y `src/components/chat/ChatWindow.tsx` lo propaga en `landingContext.productId`.

---

## 4. Consecuencias

### Positivas

- Media correcta por producto: elimina la ambigüedad de keywords compartidas.
- Sin coste adicional de AI (matching determinista).
- El LLM no contradice la media (conoce el producto activo).
- Backward compatible: media genérica y ausencia de `productId` funcionan igual que antes.

### Negativas / Trade-offs

- Un visitante sin `productId` sigue recibiendo media genérica (por diseño).
- `getLandingContext` lanza `LANDING_PRODUCT_NOT_FOUND` si `lc.productId` no pertenece al tenant — requiere que el ancla envíe un UUID válido.
- `product_id` duplica parte del filtrado de catálogo en el matcher; mitigado por índice y bajo volumen de items con imagen.

---

## 5. Alternativas consideradas

| Alternativa | Razón de rechazo |
|-------------|------------------|
| **Agregar `productId` como parámetro en funciones del runtime** | Duplica datos ya presentes en `LandingContext`; rompe firmas y tests existentes |
| **Modificar `cacheKey` para incluir `productId`** | `cacheKey` ya aísla por `landingContext.product`; cambiarlo re-invalidaba caché sin necesidad |
| **Consultar media por producto en SQL (`.eq('product_id', id)`) + fallback** | Dos queries por mensaje; el filtrado en memoria sobre el conjunto ya escopeado es suficiente y más simple |
| **No tocar media y solo anclar por prompt** | El envío lo decide el runtime (no el LLM); sin escoping el LLM no puede corregir el matcher |

---

## 6. Referencias

- `supabase/migrations/029_product_media.sql` — columna `product_id` + índice
- `src/lib/runtime/conditional-media.ts` — matcher con prioridad de producto (tests en `tests/runtime/conditional-media.test.ts`)
- `src/lib/ai/knowledge.ts` — `LandingContext.productId` y resolución por UUID/nombre
- `src/lib/ai/prompts.ts` — filtro `[IMAGEN_DISPONIBLE]` y sección `## Producto activo`
- `src/lib/conversation/context.ts` — `LoadedContext.productId` (cacheKey intacto)
- `src/lib/runtime/runtime.ts` — consumo de `productId`
- `src/app/api/widget/chat/route.ts`, `src/app/widget/page.tsx`, `src/components/chat/ChatWindow.tsx` — cadena de ancla
- `src/app/api/knowledge/items/route.ts`, `src/app/api/knowledge/items/[id]/route.ts`, `src/app/api/knowledge/suggestions/[id]/route.ts` — API con `product_id`
- `src/components/knowledge/MediaLibrary.tsx` — selector de producto en la UI

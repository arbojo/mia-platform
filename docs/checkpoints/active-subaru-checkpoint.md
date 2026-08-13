---
task_id: TASK-20260813-235511359
title: Tarjetas de producto en el chat web: adjuntar producto recomendado al mensaje del asistente
state: frozen
current_step: 0
total_steps: 8
branch: main
last_machine: archlinux
governance_id: TASK-20260813-235511359
created: 2026-08-13T23:56:05.761Z
updated: 2026-08-13T23:56:05.761Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Tarjetas de producto enriquecidas en el chat web: adjuntar el producto recomendado por MIA al mensaje del asistente (ProductMessageCard).

Aprobación: TASK-20260813-235511359 (governance, complejo, 7 agentes: architect, backend, frontend, security, qa, release, memory_engineer).

## Scope

- `src/lib/channels/types.ts` — nuevo tipo compartido `ProductReference` (web + whatsapp).
- `src/lib/runtime/` — nuevo resolver determinista `resolveRecommendedProduct` (reusa `conditional-media.ts` / `intents.ts`), sin llamadas extra de OpenAI.
- `src/lib/runtime/runtime.ts` — `processStreaming`: resolver producto, persistir `metadata.product_id` en `onFinish`.
- `src/app/api/chat/route.ts` — cambiar de `toTextStreamResponse()` a `toDataStreamResponse()` (protocolo AI SDK: partes `text-delta` + `data`); mantener headers `X-MIA-Conversation-Id` y `X-MIA-Sales-Intent`.
- `src/components/chat/ChatWindow.tsx` — parser del data stream (texto + data part) y render de la tarjeta bajo la burbuja.
- `src/components/chat/ProductMessageCard.tsx` — NUEVO componente de tarjeta de producto (<150 líneas, shadcn/ui, `'use client'`).
- `src/components/laboratorio/LabChatWindow.tsx` — tolerar el nuevo protocolo (consume las partes `text-delta`; ignora las `data`).
- `src/app/api/conversations/[id]/messages/route.ts` — incluir `metadata` en el select para restaurar la tarjeta al recargar.
- Tests: unit (resolver + parser) y e2e (widget y laboratorio).

## Non-goals

- NO tarjetas en WhatsApp ni en otros canales (WhatsApp ya entrega imagen vía bridge; esta tarea es solo web).
- NO carrusel / multi-producto por mensaje: una sola tarjeta por respuesta (límite explícito para expansión futura).
- NO cambios en `src/lib/ai/prompts.ts` ni en el comportamiento de la IA; el texto recomendado ya se genera. CERO llamadas extra de OpenAI.
- NO migraciones SQL (`messages.metadata` JSONB ya existe).
- NO tocar landings ni el checkout.
- NO alterar el flujo de correcciones/entrenamiento más allá del parser del stream.

## Approved plan

Pasos atómicos aprobados por el Council:

- [ ] **Paso 1:** Definir el tipo compartido `ProductReference` y ampliar el modelo de mensaje del cliente.
  - Objetivo: contrato tipado y opcional de la tarjeta de producto.
  - Archivos: `src/lib/channels/types.ts`, `src/components/chat/ChatWindow.tsx` (interface `Message` local).
  - Acción: agregar `export interface ProductReference { productId: string; name: string; price: number | null; imageUrl?: string | null; description?: string | null; benefits?: string | null }`. En `ChatWindow.tsx`, añadir `product?: ProductReference | null` a la interface local `Message` (solo assistant).
  - Dependencia: ninguna.
  - Criterio de terminación: el tipo se exporta y el estado del mensaje admite `product` sin errores de tipos.
  - Gate/verificación: lint + build.

- [ ] **Paso 2:** Implementar el resolver determinista `resolveRecommendedProduct`.
  - Objetivo: decidir QUÉ producto se adjunta a la respuesta, con las señales existentes y sin IA extra.
  - Archivos: `src/lib/runtime/product-recommendation.ts` (NUEVO), reutiliza `triggerMatches`/`intentMatchesTrigger` de `conditional-media.ts` y el matcheo de `intents.ts`; `tests/runtime/product-recommendation.test.ts` (NUEVO).
  - Acción: (1) si hay `productId` de landing → fetch de `products` + primera `product_media.image_url`; (2) si no, matchear `knowledge_items` activos con `product_id` y `trigger_condition` por `userMessage`/`intentTag`; (3) fallback a keywords de `intents.ts` sobre productos activos; (4) devolver `ProductReference | null` (null si ambiguo). Sin `any`, con admin client scoped a `business_id`.
  - Dependencia: Paso 1 (usa `ProductReference`).
  - Criterio de terminación: tests unitarios cubren landing→producto, trigger→producto, ambiguo→null y sin coincidencia→null.
  - Gate/verificación: `npm run test:unit` (577 + nuevas, 0 fallos) + build.

- [ ] **Paso 3:** Extender `processStreaming` para resolver el producto y devolver el stream estructurado.
  - Objetivo: llevar el producto resuelto hasta la respuesta sin cambiar el texto generado.
  - Archivos: `src/lib/runtime/runtime.ts`, `src/lib/runtime/execute-ai.ts` (si hace falta exponer la respuesta del stream).
  - Acción: tras `executeAI`, invocar `resolveRecommendedProduct` (con `landingContext.productId`, `intentTag`, `userMessage`); en `onFinish` persistir `metadata: { used_context, product_id }`; construir la respuesta con el data part final `{ type: 'product', product }` (protocolo AI SDK, `mergeIntoDataStream`/data parts). `shadow` (`deliver=false`) sigue generando y persistiendo sin entregar.
  - Dependencia: Pasos 1 y 2.
  - Criterio de terminación: la respuesta contiene texto idéntico al actual + data part opcional `product`; mensaje persistido con `product_id` cuando aplica.
  - Gate/verificación: build + unit.

- [ ] **Paso 4:** Cambiar `/api/chat` al protocolo data stream.
  - Objetivo: transportar texto y metadatos en un solo flujo.
  - Archivos: `src/app/api/chat/route.ts`.
  - Acción: devolver `toDataStreamResponse()` (o el wrapper con data parts) en lugar de `toTextStreamResponse()`. Mantener los headers `X-MIA-Conversation-Id` y `X-MIA-Sales-Intent` y los códigos de error (`RuntimeError`, 401/403/404/400) intactos.
  - Dependencia: Paso 3.
  - Criterio de terminación: el endpoint responde en protocolo data stream; los consumidores aún no parsean (fase de transición) pero el widget no se rompe en headers.
  - Gate/verificación: build + e2e básico del widget (login + chat).

- [ ] **Paso 5:** Parser del data stream en `ChatWindow.tsx` y estado `message.product`.
  - Objetivo: consumir `text-delta` y la parte `data` de producto en el lector actual.
  - Archivos: `src/components/chat/ChatWindow.tsx`.
  - Acción: en el loop `reader.read()` (ChatWindow.tsx:191-206), parsear cada línea JSON: `{ type: 'text-delta', delta }` → acumular `content`; `{ type: 'data', data: { type: 'product', product } }` → fijar `product` en el mensaje en curso. Mantener el resto (history restore, correcciones, greeting, checkout) intacto.
  - Dependencia: Pasos 1 y 4.
  - Criterio de terminación: la burbuja muestra el mismo texto que hoy y el estado del mensaje incluye `product` cuando llega la parte data.
  - Gate/verificación: e2e del widget (mensaje con producto recomendado).

- [ ] **Paso 6:** Componente `ProductMessageCard` y render bajo la burbuja del asistente.
  - Objetivo: tarjeta elegante (imagen, precio, beneficios) alineada izquierda.
  - Archivos: `src/components/chat/ProductMessageCard.tsx` (NUEVO), `src/components/chat/ChatWindow.tsx`.
  - Acción: componente <150 líneas, `'use client'`, shadcn/ui: imagen `aspect-video object-cover rounded-t-xl` con fallback `Package` sobre `bg-zinc-100` (patrón de `catalog/ProductCard.tsx:51-54`), nombre `font-semibold`, precio `text-olive-600 font-semibold`, beneficios `text-xs` con checks y `line-clamp-2`; `alt={name}`. En `ChatWindow.tsx` renderizar `{message.role === 'assistant' && message.product && <ProductMessageCard product={message.product} />}` bajo el `<p className="whitespace-pre-wrap">`, dentro de la misma fila.
  - Dependencia: Paso 5.
  - Criterio de terminación: la tarjeta aparece bajo la burbuja con imagen/precio/beneficios; sin producto la burbuja es solo texto.
  - Gate/verificación: lint + e2e del widget + DevTools sin errores de consola.

- [ ] **Paso 7:** `LabChatWindow.tsx` tolerante al nuevo protocolo.
  - Objetivo: el laboratorio no se rompe al cambiar el transporte.
  - Archivos: `src/components/laboratorio/LabChatWindow.tsx`.
  - Acción: parsear el data stream igual que `ChatWindow` (consumir `text-delta`; ignorar las `data`). No se muestran tarjetas en el lab en esta tarea.
  - Dependencia: Paso 4 (protocolo) — puede implementarse en paralelo a 5.
  - Criterio de terminación: simulación/entrenamiento del lab fluyen igual que hoy.
  - Gate/verificación: e2e del laboratorio (requestType simulation).

- [ ] **Paso 8:** Historial restaura la tarjeta (metadata en GET de mensajes).
  - Objetivo: la tarjeta sobrevive al recargar la conversación.
  - Archivos: `src/app/api/conversations/[id]/messages/route.ts`, `src/components/chat/ChatWindow.tsx` (history restore).
  - Acción: ampliar el select a `id, role, content, created_at, metadata`; mapear `metadata.product` → `message.product` en el restore (ChatWindow.tsx:105-115).
  - Dependencia: Pasos 1 y 5.
  - Criterio de terminación: al recargar una conversación con tarjeta, esta se restaura.
  - Gate/verificación: e2e del dashboard (historial con producto) + build.

## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..8.
- Governance TASK-20260813-235511359: approved (7/7 agentes, 6 gates).

## Next action

Implementar el Paso 1 (el CLI actualiza esta sección con cada mark).

## Constraints

- Governance gate: TASK-20260813-235511359 aprobado; `subaru complete` exige `--confirm-gates` con los 6 gates del manifest (lint, build, unit_tests, e2e_tests, chrome_devtools, security_review).
- Sin migraciones SQL: `messages.metadata` (JSONB) ya existe y se usa para `used_context`.
- Sin cambios de prompt (`prompts.ts`) y CERO llamadas extra de OpenAI: la resolución del producto es determinista (lecturas de DB).
- No romper los 2 consumidores de `/api/chat`: `ChatWindow.tsx` y `LabChatWindow.tsx`; ambos deben parsear el protocolo data stream.
- Mantener headers `X-MIA-Conversation-Id` y `X-MIA-Sales-Intent` (el widget depende de ellos, ChatWindow.tsx:167-177).
- Shadow mode (`deliver=false`, runtime.ts:258): sigue sin entregar; la resolución corre igual (solo lecturas scoped a `business_id`).
- Frontend: Server Components por defecto, componentes <150 líneas, shadcn/ui, accesibles (alt en imágenes), sin lógica de negocio en UI.
- Seguridad: admin client solo para lecturas scoped al negocio; la tarjeta expone los mismos datos que el negocio ya muestra (catálogo/landing); RLS y auth de `/api/chat` intactos.
- La tarjeta es OPCIONAL (`ProductReference | null`): burbuja solo texto si no hay producto resuelto o si es ambiguo.

## Verification

Gates obligatorios del manifest governance TASK-20260813-235511359 (6):
1. `lint` — `npm run lint` (0 errores, 0 warnings).
2. `build` — `npm run build` (0 errores).
3. `unit_tests` — `npm run test:unit` (577 + nuevas del resolver/parser, 0 fallos).
4. `e2e_tests` — `npm test` (33 + casos de widget/lab, 0 fallos).
5. `chrome_devtools` — consola 0 errores y requests fallidos en el deploy.
6. `security_review` — aprobación del agente security (sin exposición cross-tenant, RLS intacta).

Entrega: `git push origin main` + `vercel --prod` + verificación HTTP 200 en `https://mia-platform-psi.vercel.app`.

## Recovery instructions

Tras un revive en cualquier máquina:
1. `git pull --rebase origin main`
2. `npx tsx workshop/subaru/cli.ts revive`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si `DRIFT DETECTED` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar `subaru mark TASK-20260813-235511359 <n>`.
6. Al final: `subaru complete TASK-20260813-235511359 --confirm-gates`.

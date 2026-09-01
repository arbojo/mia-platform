# 26 — IDEMPOTENCY CONTRACT

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED (1 UNKNOWN → D3) · **Input**: docs 05, 10, 17, 22 §6–§7

---

## 1. CADENA DE ESTADOS

```text
CLAIMED → DISPATCHED → DELIVERED → (FAILED | UNKNOWN)
```

| Estado | Quién lo conoce | Evidencia actual |
|--------|-----------------|------------------|
| CLAIMED | runtime (DB) | `chat_media_dispatched` UNIQUE(conversation, knowledge_item) — insert atómico; `conversations.media_sent_products[]` NO atómico (`media-guard.ts:87`, BUG race) |
| DISPATCHED | adapter | `baileys.ts:65 sendMessage()` — fire-and-forget; sin persistencia del resultado |
| DELIVERED | proveedor | Baileys receipts NO persistidos (UNKNOWN → D3); WebChat: entrega implícita al render (FACT); Lab: simulación (FACT) |
| FAILED | nadie | no existe estado; fallo de dispatch = silencio (doc 19 observability) |

REGLA: CLAIMED ≠ DISPATCHED ≠ DELIVERED. Ninguna capa debe tratarlos como
equivalentes. "PRESENTED" (render en UI) es un concepto de canal, no de core.

## 2. UNIDAD IDEMPOTENTE

Comparación con evidencia (doc 22 §6):
- `customer + asset`: correcto comercialmente PERO requiere identity
  cross-channel (D4) — inalcanzable en Fase 1.
- `conversation + asset`: alcanzable HOY con UNIQUE constraint existente;
  suficiente para Fase 1. **Elegida para Fase 1 (D6).**
- `channel + asset`: RECHAZADO — haría duplicados cross-channel.
- `customer+product+asset` y `customer+product+intent+asset`: RECHAZADOS —
  el mismo asset sirve a distintas intenciones; recompra legítima del mismo
  producto no debe bloquear re-presentación (doc 24 BUSINESS SEMANTICS).

**Fase 1**: conversation × asset (atómico, UNIQUE). **Fase 2** (tras D4):
customer × asset. Bypass explícito: `isResendRequest()` (`media.ts:38-53`)
o resend manual → re-presentación permitida (D2).

## 3. RETRY MATRIX

| Scenario | ¿Duplicado esperado? | Estado requerido |
|----------|---------------------|------------------|
| mismo message retry (mismo webhook) | NO | claim único pre-dispatch |
| webhook duplicado (provider retry) | NO | claim atómico (UNIQUE gana la carrera) |
| misma conversación, trigger repetido | NO | claim existente → hit |
| nueva conversación, mismo customer | F1: SÍ puede repetir; F2: NO | customer × asset (D4) |
| WhatsApp → WebChat | F1: SÍ; F2: NO | D4 |
| requests simultáneos mismo asset | NO | UNIQUE(conversation, asset) atómico |
| dispatch falla | re-enviable | FAILED state necesario (hoy no existe → UNKNOWN cómo distinguir) |
| delivery status unknown | no re-enviar por defecto | D3 |

## 4. REPEATED TRIGGERS (goldens normativos)

- **A** "muéstrame la imagen" × N mismo asset: 1er → send; siguientes →
  idempotency_hit → acknowledge ("ya te la envié, ¿te la reenvío?").
- **B** mismo trigger, distinto asset: nuevo asset → claim nuevo → send.
- **C** mismo producto, distinto trigger → asset distinto: send (claims independientes).
- **D** producto cambiado, mismo trigger: media del nuevo scope; claim por
  asset (no por trigger) → send si asset nuevo.
- **E** canal cambiado: F1 puede duplicar (conversation × asset); F2 con D4
  responde. Documentado como LIMITACIÓN CONOCIDA, no bug.

## 5. MATRIZ CUSTOMER × PRODUCT × ASSET (dimensiones existentes)

| Dimensión | ¿Existe? |
|-----------|----------|
| customer_id en claim | ❌ (claim es conversation-scoped; customer derivable vía conversación) |
| product_id en asset | ✅ `knowledge_items.product_id` |
| asset_id | ✅ `knowledge_items.id` |
| conversation_id | ✅ `chat_media_dispatched.conversation_id` |
| channel en claim | ❌ no participa en dedup (FACT) |
| trigger | ✅ `trigger_condition` (input, no estado de dedup) |
| intent | ❌ no existe estructurado (doc 22 §2: señal Fase 2) |
| timestamp de claim | ✅ created_at implícito |
| dispatch/delivery status | ❌ MISSING |

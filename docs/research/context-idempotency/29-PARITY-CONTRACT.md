# 29 — PARITY CONTRACT

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED · **Input**: docs 09-CHANNEL_PARITY (Loop 1), doc 22 §12, doc 26

---

## 1. MATRIZ DE PARIDAD (estado actual, FACT salvo indicación)

| Behavior | Lab | Core (compartido) | WhatsApp (Baileys) | WebChat |
|----------|-----|-------------------|--------------------|---------|
| context resolution | ❌ implícito en historial del chat Lab | ❌ implícito en historial del prompt | ❌ implícito | ❌ implícito |
| explicit scope | ❌ no existe | ❌ no existe | ❌ no existe | ❌ no existe |
| trigger selection | ✅ mismo `resolveConditionalMedia` | ✅ | ✅ | ✅ (global, sin scope — GAP común) |
| asset selection | ✅ core compartido | ✅ | ✅ | ✅ |
| idempotency | ✅ `chat_media_dispatched` | ✅ | ✅ | ✅ (mismo mecanismo) |
| LLM feedback | ❌ | ❌ | ❌ | ❌ |
| delivery state | simulación (Lab es simulado) | — | fire-and-forget `baileys.ts:65`, sin receipt | entrega implícita al render |
| render de media | ✅ `LabChatWindow.tsx:292` sin product cards (PARITY #13) | — | ✅ vía Baileys | ✅ `ChatWindow.tsx:365` sin fallback (PARITY #14) |

LECTURA: la decisión de negocio YA es core-compartida (paridad de decisión),
pero el core decisiona sin contexto (doc 24), por lo que la paridad es
"paridad en el error". La paridad buscada es channel-independent + context-aware.

## 2. INVARIANTE NORMATIVO

> La decisión de negocio (contexto, scope, trigger, asset, idempotencia,
> feedback al LLM) es CHANNEL-INDEPENDENT y vive en core.
> Los adapters solo manejan: presentation, transport, provider-specific delivery.

Excepciones legítimas (únicas permitidas):
1. **Delivery receipt**: solo Baileys puede exponer acks del proveedor (Fase 2, D3).
2. **Render fallback**: el fallback visual de media rota/ausente es presentación
   (PARITY #12/#15) — pertenece al adapter/UI, no al core.
3. **Resend semántico** ("muéstramelo otra vez"): la DETECCIÓN es core
   (`isResendRequest`, doc 26 §2 bypass); la RE-ENTREGA es adapter.

## 3. REGLA DE CORRECCIÓN

> Prohibido modificar channel adapters para corregir decisiones de core
> (MUST NOT #8, doc 31). Toda corrección de decisión se hace en core y se
> hereda a los 4 canales automáticamente.

## 4. CASOS DE PARIDAD A VERIFICAR EN GOLDEN TESTS (doc 30)

- GP-1: misma conversación reproducida en WebChat y Lab produce la misma
  secuencia de decisiones de media (mismo scope, mismo asset o mismo null).
- GP-2: idempotency_hit se reporta igual en ambos canales (feedback al LLM).
- GP-3: explicit scope ("muéstrame la imagen de Clean Nails") resuelve igual
  en todos los canales — el escape es core, no del adapter.
- GP-4: delivery state difiere LEGÍTIMAMENTE por canal (Baileys: receipt
  futuro; WebChat: render; Lab: simulación) SIN afectar la decisión.

## 5. GAP ABIERTO

Lab no renderiza product cards (PARITY #13, `LabChatWindow.tsx:292`) y media
sin fallback (PARITY #12/#14/#15). Clasificación: presentación, FUERA de
Phase 1 core; se registran como work items de UI, no bloquean el contrato.

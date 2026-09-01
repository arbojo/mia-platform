# 23 — PRD / IMPLEMENTATION CONTRACT (Loop 4 Master Document)

**HEAD**: `d12ce650`
**Date**: 2026-08-30
**Status**: SPECIFICATION_LOCKED (pending Council D1–D6)
**Input**: docs 01–22 (Loops 1–3), runtime evidence (file:line), no code modified

---

## 0. PROPÓSITO

Convertir el contrato arquitectónico congelado (doc 22) en un Implementation
Contract verificable: contratos formales por dominio, golden tests, acceptance
criteria, boundary de fases y readiness gate.

Este documento es el índice maestro. Los documentos 24–33 son normativos.

## 1. REGLA FUNDAMENTAL NUEVA (ATRIBUCIÓN DE ERRORES)

> **No se puede atribuir un error al razonamiento de MIA si la evidencia
> disponible para MIA no demuestra cuál era la respuesta correcta.**

Antes de clasificar cualquier respuesta incorrecta como "MIA BUG", se debe
recorrer el árbol: producto identificado → knowledge existe → evidencia
explícita → contradicción. Resultado: KNOWLEDGE_ERROR / DATA_ERROR /
RETRIEVAL_ERROR / PRODUCT_RESOLUTION_ERROR / CONTEXT_ERROR /
LLM_REASONING_ERROR / PROMPT_ERROR / RUNTIME_ERROR / CHANNEL_ERROR / UNKNOWN.

Caso golden "es recargable?": si `knowledge_items` y `products` no contienen
evidencia sobre recargabilidad, la respuesta inventada por el LLM se clasifica
**UNSUPPORTED_BY_KNOWLEDGE** (doc 22 §9), no bug de runtime. Detalle: doc 27.

## 2. DOCUMENTOS NORMATIVOS

| Doc | Contrato | Estado |
|-----|----------|--------|
| 24 | CONTEXT-CONTRACT (active_product_ids, explicit scope, decision table) | Definido |
| 25 | TRIGGER-SCOPE-CONTRACT (pipeline, contaminación) | Definido |
| 26 | IDEMPOTENCY-CONTRACT (claim/dispatch/delivery, unidad) | Definido (1 UNKNOWN → D3) |
| 27 | KNOWLEDGE-EVIDENCE-CONTRACT (atribución, auditoría) | Definido |
| 28 | LLM-RUNTIME-FEEDBACK-CONTRACT (autoridades, feedback mínimo) | Definido |
| 29 | PARITY-CONTRACT (Lab/Core/WA/WebChat) | Definido |
| 30 | GOLDEN-TEST-SPECIFICATION (≥20 escenarios) | Definido |
| 31 | IMPLEMENTATION-PHASE-BOUNDARY (Fase 1 / Fase 2 / MUST NOT) | Definido |
| 32 | FINAL-CONTRADICTION-REPORT (25 preguntas adversariales) | Definido |
| 33 | IMPLEMENTATION-READINESS (score + gate) | GATE: BLOCKED (D1–D6) |

## 3. DECISIONES COUNCIL VIGENTES (bloquean implementación)

| ID | Decisión | Recomendación con evidencia |
|----|----------|------------------------------|
| D1 | TTL del contexto | Vida-de-conversación en Fase 1 |
| D2 | TTL de idempotencia | Nunca + bypass explícito de resend |
| D3 | Semántica delivered_at | Solo con receipt del proveedor |
| D4 | Identity hardening | Phone como clave canónica mínima |
| D5 | Autoridad explicit-scope | Literal name + SKU; LLM nunca muta scope |
| D6 | Unidad idempotente | conversation × asset (F1) → customer × asset (F2, tras D4) |

## 4. MUST NOT (absoluto, ver doc 31 §3)

❌ customer-level dedup antes de D4 · ❌ LLM mutando product scope ·
❌ contexto parcheado solo vía prompts · ❌ asumir delivered = attempted ·
❌ estados sin evidencia · ❌ semantic triggers sin autoridad definida ·
❌ inventar datos ante knowledge gaps · ❌ corregir decisiones de core en adapters.

## 5. PRINCIPIO FINAL

Simplicidad para el comprador con determinismo del sistema:
USE CONTEXT cuando hay evidencia · USE EXPLICIT SCOPE cuando hay nombre/SKU ·
DO NOT CROSS-CONTAMINATE en ambigüedad · DO NOT INVENT sin evidencia ·
HONOR IDEMPOTENCY · DO NOT CLAIM si no se envió · UNKNOWN si no se sabe.

## 6. GATE

**IMPLEMENTATION BLOCKED** hasta resolución de D1–D6 por el Council.
Detalle y blockers por área: doc 33.

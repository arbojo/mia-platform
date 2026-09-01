# 31 — IMPLEMENTATION PHASE BOUNDARY

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED · **Input**: docs 22 §14, doc 25–30, Council D1–D6

---

## 1. PHASE 1 — CAN IMPLEMENT (tras Council + PRD aprobado)

Solo candidatos con evidencia suficiente (doc 22 §14 + docs 24–28):

### P1-1 Conversation-scoped context (`active_product_ids[]`)
- Evidence: contexto hoy es implícito en el historial del prompt (doc 24 §1, FACT); contaminación demostrada (doc 04-TRIGGER_CONTEXT, doc 25 §3).
- Risk: bajo — columna nueva sobre `conversations`, sin tocar pipeline existente aún.
- Dependencies: reglas de mutación (doc 24 §3–§4); D1 resuelto (TTL = vida de conversación).
- Migration impact: 1 migración aditiva (`active_product_ids uuid[]`), sin backfill necesario.
- Rollback: columna ignorada por código = comportamiento actual.
- Acceptance: AC-001, AC-008 (GT-01..06).

### P1-2 Explicit-scope determinístico
- Evidence: jerarquía de 7 niveles (doc 22 §4, doc 24 §5); escape único contra la contaminación (INV-3).
- Risk: medio — requiere resolver matching literal/SKU sin LLM (D5: solo literal + SKU en Fase 1).
- Dependencies: P1-1; D5 resuelto (LLM nunca muta scope).
- Migration impact: ninguno (lógica en core).
- Rollback: feature flag; sin flag activo, cae a contexto genérico.
- Acceptance: AC-003 (GT-02, GT-04, doc 25 §2).

### P1-3 Trigger evaluation dentro del scope
- Evidence: trigger global es la causa raíz de contaminación (doc 22 §5, INV-1/INV-2).
- Risk: medio — cambia el orden del pipeline: contexto → trigger → media → LLM (doc 25 §1, doc 28 §4).
- Dependencies: P1-1, P1-2.
- Migration impact: ninguno; `resolveConditionalMedia()` recibe scope como parámetro.
- Rollback: pasar scope=null degrada a matching global (comportamiento actual).
- Acceptance: AC-002 (GT-06, caso 1–5 matriz doc 25 §3).

### P1-4 Atomic conversation × asset claims
- Evidence: race en `media_sent_products[]` (media-guard.ts:87, read-write no atómico, EVIDENCE_MATRIX #16); `chat_media_dispatched` ya tiene UNIQUE pero solo cubre parte del flujo.
- Risk: bajo — patrón INSERT ... ON CONFLICT ya existe en `chat_media_dispatched`.
- Dependencies: definir FAILED state (doc 26 §1); D3 NO requerido para claim (claim ≠ delivered).
- Migration impact: nueva columna `state` (claimed/dispatched/failed) sobre `chat_media_dispatched`; deprecar `media_sent_products[]` (P1-5).
- Rollback: tabla nueva sin uso = sin impacto.
- Acceptance: AC-005 (GT-22, GT-23).

### P1-5 Deprecación de `media_sent_products[]`
- Evidence: array no atómico, race demostrada (doc 26 §3); dual mechanism con `chat_media_dispatched`.
- Risk: bajo si P1-4 está activo; se mantiene lectura durante transición.
- Migration impact: dejar de escribir; limpiar en migración posterior.
- Rollback: reactivar escritura (flag).
- Acceptance: idempotencia idéntica antes/después de la remoción (GT-07..10).

### P1-6 Media resolution feedback al LLM
- Evidence: LLM afirma envíos que no ocurrieron (core.ts:100-119, prompts.ts:135, doc 28 §1, AC-004).
- Risk: medio — requiere reordenar pipeline (media antes de LLM), misma dependencia que P1-3.
- Migration impact: ninguno.
- Rollback: feedback omitido = comportamiento actual.
- Acceptance: AC-004 (GT-25, doc 28 §3).

### P1-7 Decision logging
- Evidence: dispatch decisions silenciosas (EVIDENCE_MATRIX #19/#20, doc 29 §1).
- Risk: mínimo (solo logging estructurado de los eventos doc 30-observabilidad).
- Acceptance: ante cualquier dispatch/no-dispatch existe registro del porqué.

### P1-8 Golden tests
- Evidence: doc 30 (35 tests especificados). Son la red de seguridad de P1-1..P1-7.
- Acceptance: suite verde en CI antes de activar cualquier flag.

## 2. PHASE 2 — REQUIERE DECISIONES ABIERTAS (D3/D4/D6)

| Ítem | Bloqueo | Documento |
|------|---------|-----------|
| `delivered_at` + provider receipts | D3 (semántica por proveedor: Baileys acks) | doc 26 §1, doc 29 §2 |
| Identity hardening (phone canónico) | D4 | doc 22 §8 |
| Idempotencia customer × asset | D4 + D6 (sin identidad unificada, dedup customer-level es unsafe) | doc 26 §4-E |
| Cross-channel identity | D4 | GT-19..21 |
| Semántica comercial de resend/TTL | D2 + D1 | doc 26 §2 |
| Señal estructurada de intent | sin evidencia suficiente aún (doc 22 §2: no agregar campos sin evidencia) | — |

## 3. MUST NOT IMPLEMENT (riesgos con evidencia)

1. ❌ Customer-level dedup antes de identity hardening — crearía falsos dedup entre personas distintas o fragmentaría a la misma (doc 26 §4-E, GT-21).
2. ❌ LLM mutando `active_product_ids[]` — rompe INV-3/determinismo (doc 24 §5, D5).
3. ❌ Contexto parcheado solo vía prompts — no es autoridad determinística (doc 27 §6, doc 28 §5).
4. ❌ Asumir delivered = attempted — AC-004, doc 26 §1.
5. ❌ Agregar estados sin evidencia (confidence, embeddings, historial de triggers) — doc 22 §2, minimal-state challenge (doc 32 §24).
6. ❌ Semantic triggers sin autoridad definida — clasificación UNKNOWN, requiere decisión propia (doc 25 §4).
7. ❌ Resolver knowledge gaps inventando datos — doc 27 §1/§5, AC-007.
8. ❌ Corregir decisiones de core en channel adapters — doc 29 §3.
9. ❌ Multi-business identity — sin evidencia (UNKNOWN, doc 22 §8).
10. ❌ Mutation de contexto por inferencia débil — doc 22 §3: solo explicit-scope muta en Fase 1.

## 4. ORDEN DE EJECUCIÓN PROPUESTO (dependency-safe)

```
P1-8 (tests) → P1-1 (contexto) → P1-2 (explicit scope)
→ P1-3 (trigger scoped) → P1-4 (claims atómicos) → P1-5 (deprecar array)
→ P1-6 (feedback LLM) → P1-7 (logging)
```

Cada paso activable por flag y revertible independientemente.
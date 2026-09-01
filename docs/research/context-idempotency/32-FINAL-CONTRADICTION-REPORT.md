# 32 — FINAL CONTRADICTION REPORT

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED · **Input**: mandato LOOP 4 §22, docs 16, 24–31

---

## 1. LAS 25 PREGUNTAS OBLIGATORIAS

| # | Pregunta | Respuesta según contrato | Clasificación |
|---|----------|--------------------------|---------------|
| 1 | Cliente habla de 3 productos | `active_product_ids=[A,B,C]` (acumulación); preguntas genéricas → AMBIGUOUS, NO dispatch de media (INV-4); explicit scope resuelve | SPEC (doc 24 §4) |
| 2 | Cambia de producto cada mensaje | Cada explicit scope muta el frente del scope; sin límite artificial — el scope es conjunto, no puntero único | SPEC (doc 24 §3) |
| 3 | Nunca menciona producto | NO_CONTEXT: sin media product-scoped; media genérica solo si trigger único global; texto LLM normal | FACT + SPEC (doc 24 §2) |
| 4 | Trigger genérico | Evalúa solo dentro del scope activo (INV-1); sin scope → comportamiento actual | SPEC (doc 25 §2) |
| 5 | Trigger específico | Solo si el producto del trigger está en scope, o vía explicit scope (INV-2/INV-3) | SPEC (doc 25 §2) |
| 6 | Dos productos con mismo trigger | Con scope único → media de ese producto; con scope múltiple → NO dispatch (sin cross-contamination, INV-4) | SPEC (GT-06) |
| 7 | Dos assets mismo trigger | Eligibility ordering (position, luego created_at — unificación de ordenadores, EVIDENCE_MATRIX #10/#11); se envía 1 por claim, el otro queda elegible | SPEC + DATA_QUALITY |
| 8 | Asset inactivo | No elegible; MISSING media, no bug de resolución (GT-11, Neurotin FACT #4) | FACT (doc 27 §4) |
| 9 | `product_id` NULL | Media genérica: permitida con scope único; prohibida con scope múltiple (doc 24 §6) | SPEC |
| 10 | Cliente pide producto explícito | Explicit scope determinístico (nivel 1–4, D5) muta scope | SPEC (doc 24 §5) |
| 11 | LLM identifica producto incorrectamente | Irrelevante para media: LLM no muta scope (D5). Puede afectar solo texto → mitigable con feedback | SPEC (doc 28 §5) |
| 12 | Runtime y LLM con estados distintos | El feedback (doc 28 §3) es la única fuente del LLM; prohibido afirmar fuera del feedback | SPEC (AC-004) |
| 13 | Dispatch falla | Claim → FAILED; re-enviable; feedback `dispatched:false`; LLM no afirma envío (GT-25) | SPEC (doc 26 §1) |
| 14 | Delivery nunca confirma | Fase 1: constante `unknown`, no re-enviar por defecto (D2/D3); Fase 2: receipt con timeout de negocio | UNKNOWN→D3 |
| 15 | WhatsApp y WebChat = mismo cliente | Fase 1: NO garantizado (fragmentación, puede duplicar asset); Fase 2 tras D4 | FACT (doc 26 §4-E) |
| 16 | Clientes distintos, mismo teléfono | Riesgo de sobre-unión si D4 usa phone ciego → D4 exige regla de negocio (per-business + confirmación) | UNKNOWN→D4 |
| 17 | Dos mensajes simultáneos | Claim atómico (UNIQUE conversation×asset): 1 dispatch, otro idempotency_hit (GT-22) | SPEC (AC-005) |
| 18 | Cliente pide "otra vez" | Bypass D2 con acknowledge (doc 26 §2); no se re-claima, se re-despacha | SPEC |
| 19 | Reenvío deliberado | Igual que 18; el bypass es intencional y registrado en log | SPEC |
| 20 | Producto sin documentación | LLM expresa no-saber; no inventa (GT-17, AC-007) | SPEC (doc 27 §5) |
| 21 | Documentación contradictoria | DATA_ERROR: no elección arbitraria; elevar como datos a corregir (GT-16) | DATA_QUALITY |
| 22 | Documentación ≠ respuesta generada | Clasificar con árbol doc 27 §1 antes de culpar al razonamiento: puede ser KNOWLEDGE/DATA/PROMPT/RETRIEVAL error | NORMA (doc 27 §1) |
| 23 | Pregunta fuera de dominio | Sin evidencia → UNKNOWN honesto; sin media, sin inventos | SPEC (AC-007) |
| 24 | Compra y vuelve a preguntar | Fase 1: conversation nueva = claims nuevos (puede re-presentar); re-presentación post-venta = decisión D2 | UNKNOWN→D2 |
| 25 | Cambia de canal | Decisión idéntica (channel-independent, doc 29); idempotencia cross-channel solo en Fase 2 | FACT + SPEC |

## 2. CONTRADICCIONES DETECTADAS CONTRA EL CONTRATO

| # | Contradicción | Estado | Resolución |
|---|---------------|--------|------------|
| C-1 | Cliente compara 2 productos y pide "la imagen" — el contrato no dispatcha (INV-4) pero el cliente esperaba algo | REGISTERED — no parchear en silencio | NEW DECISION REQUIRED: UX de desambiguación (¿pregunta "¿de cuál?"?) → Council |
| C-2 | TTL de contexto "vida de conversación" (D1) vs conversaciones largas de días en WhatsApp | REGISTERED — D1 queda abierta con este dato nuevo | Council D1 debe definir TTL o vida-útil práctica |
| C-3 | Acumulación de scope (doc 24 §4) vs INV-1 (generic trigger no cambia scope): con scope múltiple acumulado, casi todo trigger cae en AMBIGUOUS → menos media con el tiempo | REGISTERED — comportamiento intencional (safe-by-default), pero debe validarse con negocio (D2/UX) | Council |
| C-4 | Reenvío deliberado (bypass D2) vs idempotencia estricta — no es contradicción lógica pero sí tensión semántica | RESOLVED en doc 26 §2 (bypass explícito + log) | — |
| C-5 | "Es recargable": respuesta LLM incorrecta NO es bug de MIA si knowledge no tiene el dato | RESOLVED — regla fundamental doc 27 §1 (no atribuir a razonamiento lo que la evidencia no demuestra) | — |

## 3. REGISTRO DE NUEVOS UNKNOWN GENERADOS

- U-1: UX de desambiguación multi-producto (C-1) — requiere decisión de producto.
- U-2: TTL real para conversaciones WhatsApp multi-día (C-2) — dato de negocio.
- U-3: si la acumulación de scope degrada demasiado la entrega de media (C-3) — medible con P1-7 logging post-implementación.
- U-4: semántica exacta de delivery receipts Baileys (D3) — requiere spike técnico en Fase 2.

NINGUNA contradicción fue parcheada en silencio. Todas registradas aquí.
# 30 — GOLDEN TEST SPECIFICATION

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED · **Input**: docs 21, 25, 26, 27, 29; doc 22 §3/§7

---

Convención: cada test especifica INPUT / PREVIOUS STATE / EXPECTED CONTEXT /
EXPECTED AUTHORITY / EXPECTED DECISION / EXPECTED MEDIA / EXPECTED IDEMPOTENCY /
EXPECTED LLM FEEDBACK / EXPECTED CHANNEL OUTPUT. Clasificación = {FACT-check
contra código actual | SPEC = comportamiento normativo nuevo}.

## A. CONTEXT

### GT-01 single product
INPUT: "quiero información del Clean Nails" → "cuánto tarda?"
PREV: none → CONTEXT: [clean-nails]
AUTHORITY: explicit-scope (nivel 1) luego context
DECISION: respuesta Clean Nails; MEDIA: solo assets Clean Nails elegibles
SPEC.

### GT-02 product switch
INPUT: "…Clean Nails" → "ahora dime del Neurotin" → "cuánto cuesta?"
CONTEXT: [clean-nails] → [neurotin] → [neurotin]
AUTHORITY: explicit-scope muta scope (INV-3). MEDIA: Neurotin. SPEC.

### GT-03 ambiguity after switch
INPUT: "Clean Nails" → "Neurotin" → "tiene garantía?"
CONTEXT: [clean-nails, neurotin] (acumulación, doc 22 §3)
DECISION: AMBIGUOUS — LLM responde con contexto conversacional (texto puede
aclarar), pero MEDIA: NO dispatch sin explicit scope (INV-4). SPEC.

### GT-04 multi-product explicit
INPUT: "¿cuánto cuesta Clean Nails y Bye Canas?"
CONTEXT: [clean-nails, bye-canas]; MEDIA: nada genérico sin scope único (doc 24 §6). SPEC.

### GT-05 generic request, 1 producto
INPUT: contexto único + "muéstrame la imagen" → media del producto activo. SPEC.

### GT-06 generic trigger, 2 productos
INPUT: [A,B] + trigger "testimonios" (existe en ambos) → NO dispatch
(caso 5 matriz, doc 25 §3). FACT-check: hoy dispatch contaminado (BUG).

## B. MEDIA

### GT-07 first trigger → send + claim creado.
### GT-08 repeated trigger → idempotency_hit → acknowledge (doc 26 §4-A).
### GT-09 duplicate asset distinto trigger → hit (claim por asset).
### GT-10 different asset mismo producto → send (claim nuevo).
### GT-11 inactive asset → no elegible (eligibility #1, doc 25 §4);
FACT: Neurotin image inactiva hoy (EVIDENCE_MATRIX #4) → MISSING media,
DATA_QUALITY, no bug de resolución (doc 27 §4).
### GT-12 asset product_id NULL + scope único → permitido; + scope múltiple → NO.
### GT-13 malformed trigger (frase completa no keyword) → FACT: no matchea
`triggerMatches()` por palabras; sin media, sin crash. EVIDENCE_MATRIX #6.

## C. KNOWLEDGE

### GT-14 known fact ("¿cuánto cuesta?" con precio cargado) → respuesta.
### GT-15 unknown fact ("¿es recargable?" sin registro) → NO afirmar;
poder expresar no-saber (doc 27 §5). Clasificación previa obligatoria
según árbol doc 27 §1 antes de reportar bug.
### GT-16 contradictory fact → DATA_ERROR; MIA no elige arbitrariamente (eleva).
### GT-17 producto sin documentación → UNKNOWN; respuesta honesta.

## D. IDENTITY

### GT-18 same customer/channel → dedup por conversación opera.
### GT-19 cross-channel (WhatsApp→WebChat) → Fase 1: puede duplicar
(LIMITACIÓN documentada, doc 26 §4-E); Fase 2 tras D4: dedup customer × asset.
### GT-20 anonymous WebChat → customer efímero; idempotencia = conversation.
### GT-21 fragmented identity → UNKNOWN hasta D4; no unir por heurística no
evidenciada (doc 22 §8).

## E. RACE

### GT-22 simultaneous duplicate triggers (2 webhooks mismo asset) →
UNIQUE(conversation, asset) gana una; 1 dispatch. FACT-check: hoy
`media_sent_products[]` race (media-guard.ts:87) puede duplicar — BUG que
Phase 1 corrige con claim atómico.
### GT-23 simultaneous different triggers → claims independientes, ambos envían.
### GT-24 concurrent channels misma persona → como GT-19.

## F. FAILURE

### GT-25 claim ok / dispatch fail → estado FAILED registrado; re-enviable;
LLM feedback `dispatched: false` (AC-004). SPEC (hoy silencio — doc 26 §1).
### GT-26 dispatch ok / delivery unknown → no re-enviar por defecto (D3).
### GT-27 delivery confirmed → Fase 2; Fase 1 constante unknown.
### GT-28 adapter failure (Baileys caído) → core decide; adapter reporta;
no se marca claim como entregado.

## G. PARITY (de doc 29 §4)

### GT-29..32 = GP-1..GP-4.

## COBERTURA

35 tests: contexto 6, media 7, knowledge 4, identity 4, race 3, failure 4,
parity 4, resend-explícito (GT-33 "muéstramelo otra vez" → bypass D2 con
acknowledge) — total normativo ≥20 requeridos por el mandato: CUMPLIDO.

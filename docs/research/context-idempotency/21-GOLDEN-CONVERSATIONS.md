# 21 — Golden Conversations (Adversarial Loop 2)

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Date:** 2026-08-30
**Status:** EVIDENCE_LOCKED — DISCOVERY ONLY
**Rule classification:** each field is FACT (current behavior, evidence-cited), PROPOSED (target behavior from docs 16–18), or UNKNOWN. Golden conversations are the contract the PRD must satisfy; they are NOT implemented.

**State abbreviations:**
- `CTX` = active_product_ids[] + context_source
- `IDEM` = dedup state for the referenced asset
- Media eligibility per doc 18 (R1–R6)

---

## GC-01 — Producto único (baseline)

| Field | Value |
|-------|-------|
| Initial state | New conversation. CTX = [] (source: none). IDEM: no claims. |
| Message | "Quiero información de Clean Nails" |
| Expected context | CTX = [clean_nails_id] (source: explicit) — PROPOSED (R1.1); today: resolved per-message only, FACT |
| Expected intent | info/product — FACT (detectIntent) |
| Expected trigger evaluation | message-local scan inside scope = Clean Nails — PROPOSED (R1.2 gate); today: global scan, FACT |
| Expected media | none (no media trigger word) — FACT |
| Expected idempotency | nothing claimed — FACT |
| Expected channel behavior | identical decision in Lab/WebChat/WhatsApp (core is shared) — FACT for decision; PARITY_GAP only in rendering (Lab lacks product card, finding #13) |

## GC-02 — Cambio de producto (A → B)

| Field | Value |
|-------|-------|
| Initial state | CTX = [clean_nails_id] (source: explicit). |
| Message | "¿Y qué tienes para neuropatía?" |
| Expected context | CTX = [neurotin_id] (source: inferred-from-need); Clean Nails demoted — PROPOSED. Today: no persistence, each message re-resolves globally — FACT (doc 06: A→B→A loses A) |
| Expected intent | new-need discovery — INFERENCE |
| Expected trigger evaluation | scoped to Neurotin; Clean Nails media must NOT fire — PROPOSED (R2.2) |
| Expected media | none unless Neurotin has generic trigger match — FACT today: a generic "precio" trigger would fire Clean Nails media (contamination, findings #3/#6) |
| Expected idempotency | claims scoped to (asset, conversation) unchanged — FACT |
| Expected channel behavior | same core decision all channels — FACT |

## GC-03 — Dos productos en el mismo mensaje (comparación)

| Field | Value |
|-------|-------|
| Initial state | CTX = []. |
| Message | "¿Cuál me conviene más, Clean Nails o Neurotin?" |
| Expected context | CTX = [clean_nails_id, neurotin_id] ordered (comparison) OR context marked ambiguous — PROPOSED (C-002 / R1.3). Today: `resolveRecommendedProduct` returns `null` on 2+ matches — FACT (`product-recommendation.ts:54-65`) |
| Expected intent | comparison — INFERENCE |
| Expected trigger evaluation | product-scoped media SUPPRESSED for both; generic allowed — PROPOSED (R1.3) |
| Expected media | none product-scoped — PROPOSED. Today: single-ID model would arbitrarily pick one → mixed-product risk under context-first without this rule |
| Expected idempotency | no claims — FACT |
| Expected channel behavior | identical — FACT |

## GC-04 — Producto explícito sin contexto activo

| Field | Value |
|-------|-------|
| Initial state | CTX = [] (fresh conversation, or stale). |
| Message | "Muéstrame la imagen de Clean Nails" |
| Expected context | explicit scope = Clean Nails for THIS message; does not require prior CTX — PROPOSED (R1.1). Today: works by accident via global keyword match — FACT (C-001) |
| Expected intent | media-request (explicit) — INFERENCE |
| Expected trigger evaluation | explicit product mention overrides empty/stale context — PROPOSED; explicit-scope > implicit-context principle (ATTACK #15) |
| Expected media | Clean Nails hero image if exists & active — FACT (eligibility rules today) |
| Expected idempotency | claim (asset, conversation) written BEFORE dispatch — FACT (`conditional-media.ts:98-114`); failed send blocks retry — BUG (C-006) |
| Expected channel behavior | identical decision; rendering differs (WebChat `<img>` vs WhatsApp media message) — FACT |

## GC-05 — Trigger genérico (sin producto)

| Field | Value |
|-------|-------|
| Initial state | CTX = []. IDEM: no claims for generic hero asset G1. |
| Message | "Muéstrame testimonios" |
| Expected context | CTX stays [] — no product named; intent = media-request — PROPOSED |
| Expected intent | media-request (generic) — INFERENCE; today `detectIntent` has no media intent class — FACT (doc 01: keyword+intent only) |
| Expected trigger evaluation | generic media (product_id NULL) eligible; product-scoped suppressed (no active product) — PROPOSED (R3.1). Today: any trigger match fires globally, contamination risk — FACT (finding #3) |
| Expected media | generic testimonial asset if exists — FACT (eligibility rules) |
| Expected idempotency | claim (G1, conversation) before dispatch — FACT; customer-level "already received recently" — PROPOSED (C-003) |
| Expected channel behavior | identical decision; WhatsApp sends via Baileys media message, WebChat `<img>` — FACT |

## GC-06 — Trigger repetido (misma petición semántica)

| Field | Value |
|-------|-------|
| Initial state | CTX = [clean_nails_id]. Asset A already claimed for (A, conversation) — FACT (`chat_media_dispatched` UNIQUE) |
| Message | "Sí, muéstramela" |
| Expected context | unchanged — PROPOSED |
| Expected intent | media-request (anaphoric: "la" → last product) — INFERENCE; today `isResendRequest()` requires explicit media word — FACT (`media.ts:38-53`) |
| Expected trigger evaluation | same asset resolves (same scope) — FACT |
| Expected media | SUPPRESSED by dedup unless explicit re-request — PROPOSED (R4.2). Today: silently suppressed, LLM not informed — FACT (finding #9, core.ts:100-119) |
| Expected idempotency | dedup blocks re-claim — FACT |
| Expected channel behavior | identical suppression all channels — FACT |

## GC-07 — Misma imagen dos veces (re-request explícito)

| Field | Value |
|-------|-------|
| Initial state | Same as GC-06. |
| Message | "otra vez, por favor" |
| Expected context | unchanged — PROPOSED |
| Expected intent | resend (explicit) — FACT: `isResendRequest()` matches RESEND_VERB + media word (`media.ts:38-53`) — but "otra vez" alone lacks media word → INFERENCE: current matcher needs "imagen/foto" present |
| Expected trigger evaluation | resend request bypasses trigger scan — FACT (resend path exists) |
| Expected media | re-send SAME asset — PROPOSED (R4.3: explicit re-request overrides dedup). Today: dedup is absolute for (asset, conversation) — FACT (`conditional-media.ts:98-114`) |
| Expected idempotency | re-claim must be allowed on explicit re-request — PROPOSED |
| Expected channel behavior | identical — FACT |

## GC-08 — Imagen diferente (mismo producto, otro asset)

| Field | Value |
|-------|-------|
| Initial state | CTX = [clean_nails_id]. Asset A (hero) claimed; assets B (testimonial), C (usage) unclaimed. |
| Message | "¿Tienes testimonios de Clean Nails?" |
| Expected context | unchanged — PROPOSED |
| Expected intent | media-request scoped testimonial — INFERENCE |
| Expected trigger evaluation | scope = Clean Nails; media_type filter → B — PROPOSED (presented_media_scope = asset IDs, not product IDs: receiving A must NOT block B — ATTACK #13) |
| Expected media | B dispatched — PROPOSED. Today: media_type exists but no per-asset-type selection order documented — PARTIAL FACT (`conditional-media.ts:35` created_at ordering, finding #10/#11) |
| Expected idempotency | claim (B, conversation) written — FACT pattern |
| Expected channel behavior | identical — FACT |

## GC-09 — Nueva conversación (mismo cliente)

| Field | Value |
|-------|-------|
| Initial state | CTX = [] (new conversation). IDEM: customer already received asset A in a PREVIOUS conversation — FACT recorded in `chat_media_dispatched` (row keyed to old conversation; `customer_id` column written but never read — FACT, `conditional-media.ts:104`) |
| Message | "Muéstrame cómo se ve" |
| Expected context | CTX may inherit from customer-level memory — PROPOSED (UNKNOWN: no customer-context persistence exists — ARCHITECTURAL_GAP) |
| Expected intent | media-request — INFERENCE |
| Expected trigger evaluation | if customer-level dedup with time window: asset A suppressed or re-sent per window policy — PROPOSED (C-003; time semantics UNKNOWN — ATTACK #10 found no TTL evidence) |
| Expected media | UNKNOWN pending Council decision on time window — explicitly left open |
| Expected idempotency | today: new conversation ⇒ fresh dedup ⇒ duplicate send — FACT (conversation-scoped dedup does not survive new conversation) |
| Expected channel behavior | identical — FACT |

## GC-10 — Cross-channel (mismo cliente, canal distinto)

| Field | Value |
|-------|-------|
| Initial state | Customer received asset A via WhatsApp (conversation W). Now opens WebChat (conversation N, same `customers.id` IF identity resolves — identity.ts:68-116: WhatsApp→phone→customer; WebChat→external_id/session; fragmentation possible — FACT C-007) |
| Message | "¿Me pasas la foto?" |
| Expected context | CTX = [] initially in new conversation — FACT (no cross-conversation context) |
| Expected intent | resend — INFERENCE |
| Expected trigger evaluation | same — FACT |
| Expected media | customer-level dedup ⇒ suppress or degrade gracefully ("te la envié antes por WhatsApp") — PROPOSED. Today: WebChat re-sends (conversation-scoped dedup only) — FACT |
| Expected idempotency | customer×asset read required — PROPOSED (missing today) |
| Expected channel behavior | decision identical; presentation differs — PROPOSED parity invariant |

## GC-11 — Retry técnico (duplicado de webhook)

| Field | Value |
|-------|-------|
| Initial state | Webhook re-delivered by WhatsApp (same message, second invocation). |
| Message | identical message text |
| Expected context | unchanged — FACT |
| Expected intent | unchanged — FACT |
| Expected trigger evaluation | same asset resolves — FACT |
| Expected media | suppressed by atomic claim — FACT: second claim on (asset, conversation) loses via `onConflict: 'ignoreDuplicates'` (`conditional-media.ts:98-114`) |
| Expected idempotency | WORKS — this is the one dedup axis that is atomic and race-safe today — FACT |
| Expected channel behavior | identical — FACT |

## GC-12 — Dispatch failure (claim escrito, envío falla)

| Field | Value |
|-------|-------|
| Initial state | Claim for asset A written BEFORE any send — FACT (core.ts:100-119: `resolveConditionalMedia()` precedes `executeAI()` and dispatch; conditional-media.ts:98-114 upsert) |
| Message | trigger for asset A; WhatsApp API fails mid-send |
| Expected context | unchanged — FACT |
| Expected intent | media-request — FACT |
| Expected trigger evaluation | same — FACT |
| Expected media | today: claim exists ⇒ retry blocked ⇒ customer NEVER receives A in this conversation — BUG (C-006: attempted≈received conflation) |
| Expected idempotency | needs dispatch-status (selected/queued/dispatched/delivered/failed) — PROPOSED (ATTACK #11); `chat_media_dispatched` has no status column — FACT (migration 016 schema) |
| Expected channel behavior | failure only observable in channel adapter; core blind — FACT (no feedback loop, finding #9/#19) |

## GC-13 — Ambiguous request (request genérico con múltiples assets)

| Field | Value |
|-------|-------|
| Initial state | CTX = []. Two generic assets eligible: G1 (image), G2 (testimonial). |
| Message | "Enséñame una imagen" |
| Expected context | stays [] — PROPOSED |
| Expected intent | media-request (generic) — INFERENCE |
| Expected trigger evaluation | multiple eligible candidates; selection by deterministic order — PROPOSED (position, not created_at — finding #10/#11) |
| Expected media | exactly ONE asset (G1 by position) — PROPOSED (R3.2: ambiguity resolved deterministically, not by suppressing everything). Today: first-by-created_at wins — FACT |
| Expected idempotency | claim winner only; loser stays eligible — FACT pattern |
| Expected channel behavior | identical — FACT |

## GC-14 — Explicit override (scope explícito > contexto implícito)

| Field | Value |
|-------|-------|
| Initial state | CTX = [neurotin_id]. Clean Nails asset A unclaimed. |
| Message | "muéstrame la de Clean Nails" |
| Expected context | explicit scope = Clean Nails for this message; CTX transitions to [clean_nails_id] after — PROPOSED (R1.1 / ATTACK #15: explicit > implicit, validated by all contradicting scenarios failing otherwise) |
| Expected intent | media-request with explicit product — INFERENCE |
| Expected trigger evaluation | scoped to Clean Nails, NOT Neurotin — PROPOSED. Today: global scan could match Neurotin media too if triggers overlap — FACT (contamination findings) |
| Expected media | A only — PROPOSED |
| Expected idempotency | claim (A, conversation) — FACT pattern |
| Expected channel behavior | identical — FACT |

## GC-15 — Stale context (contexto viejo tras cambio de tema)

| Field | Value |
|-------|-------|
| Initial state | CTX = [clean_nails_id] from 3 days ago (same conversation or customer-level). Message now about prices of anything. |
| Message | "¿cómo están los precios?" |
| Expected context | stale context must NOT bind media to Clean Nails if message has no product signal — PROPOSED (R2.3: context_source + age gates confidence; ambiguous ⇒ generic-only) |
| Expected intent | price inquiry — FACT (detectIntent keyword) |
| Expected trigger evaluation | if "precio" trigger fires, resolve within CTX only if CTX fresh; else generic pool — PROPOSED. Today: global scan, old context irrelevant — FACT (no persistence) |
| Expected media | no accidental Clean Nails asset — PROPOSED |
| Expected idempotency | unchanged — FACT |
| Expected channel behavior | identical — FACT |

---

## Cross-Channel Parity Matrix

Invariant under test (doc 15): *same customer context + same product context + same media state ⇒ same media decision regardless of channel*.

| GC | Core decision | MIA Lab | WebChat | WhatsApp | Parity |
|----|--------------|---------|---------|----------|--------|
| GC-01 | scoped resolution | shared core | shared core | shared core | ✅ decision / ⚠️ rendering (Lab no product card, #13) |
| GC-02 | context transition | shared core | shared core | shared core | ✅ decision (PROPOSED state) |
| GC-03 | ambiguity suppression | shared core | shared core | shared core | ✅ |
| GC-04 | explicit scope | shared core | shared core | shared core | ✅ decision / rendering differs (`<img>` vs Baileys media msg) |
| GC-05 | generic resolution | shared core | shared core | shared core | ✅ |
| GC-06 | dedup suppress + LLM informed | shared core | shared core | shared core | ✅ (PROPOSED feedback loop) |
| GC-07 | explicit re-request bypass | shared core | shared core | shared core | ✅ |
| GC-08 | per-asset claim | shared core | shared core | shared core | ✅ |
| GC-09 | customer-level window | shared core | shared core | shared core | ✅ decision; identity fragmentation may break customer key (C-007) |
| GC-10 | customer×asset read | shared core | shared core | shared core | ✅ decision; only valid if identity resolved — PARITY_GAP if WebChat session ≠ customer |
| GC-11 | atomic claim | shared core | shared core | shared core | ✅ (only fully-working dedup today) |
| GC-12 | dispatch status | shared core | shared core | shared core | ✅ decision; failure visibility channel-only — PROPOSED feedback |
| GC-13 | deterministic pick | shared core | shared core | shared core | ✅ |
| GC-14 | explicit > implicit | shared core | shared core | shared core | ✅ |
| GC-15 | stale-context gate | shared core | shared core | shared core | ✅ |

**Verdict**: media DECISION parity is achievable through the shared core (single `resolveConditionalMedia` path — FACT, core.ts:98-137). RENDERING parity has known gaps (Lab lacks product cards — #13; no img error handling — #15; no media fallback — #12). Identity fragmentation (GC-10) is the only axis where the DECISION itself can diverge across channels today — C-007.

# ADR-003: Knowledge Conflict Resolution & Source Hierarchy

## Status

Proposed

## Date

2026-07-29

## Council

CTO, AI Engineer, Domain Expert, Product Manager

---

## 1. Context

### 1.1 The Problem

The MIA Adversarial Knowledge Test revealed that MIA achieves only **55% prioritization accuracy** when facing contradictory information across 6 conflict scenarios. While MIA correctly detects conflicts in 82% of cases, it often fails to **determine which piece of information should prevail**.

This is because MIA has **no conflict resolution mechanism** at runtime. The prompt builder simply dumps all active data into the LLM context and relies entirely on GPT-4o-mini to resolve contradictions on its own — with no explicit authority hierarchy or conflict resolution rules.

### 1.2 Current Architecture

The prompt assembly pipeline (`src/lib/conversation/context.ts` → `src/lib/ai/knowledge.ts` → `src/lib/ai/prompts.ts`) has zero conflict detection or resolution logic:

| Step | What happens | Gap |
|------|-------------|-----|
| `getBusinessContext()` | Fetches products, rules (by priority DESC), instructions (by priority DESC), knowledge (unordered) | No cross-entity comparison, no dedup |
| `buildMasterPrompt()` | Concatenates all sections with hardcoded fundamental rules first | No authority markers, no conflict instructions |
| `streamText()` | Sends assembled prompt + user message to OpenAI | LLM must resolve conflicts unaided |

The **only** priority mechanism is the `priority` column on `sales_rules` and `ai_instructions`, which controls ordering within their own sections. There is no cross-entity hierarchy (e.g., "a rule should override knowledge").

### 1.3 Existing Signals (Unused)

The following columns exist but are **never used for conflict resolution**:

| Signal | Table | Currently Used For | Potential |
|--------|-------|-------------------|-----------|
| `priority` (int) | `sales_rules`, `ai_instructions` | ORDER BY only | Cross-entity comparison |
| `source` (enum) | `knowledge_items`, `ai_instructions` | Nothing at runtime | Authority level |
| `is_immutable` (bool) | `business_memory` | Nothing | Cannot be overridden |
| `confidence` (enum/ int) | `knowledge_items`, `business_memory` | Memory decay only | Reliability indicator |
| `created_at` (timestamp) | All entities | Nothing | Freshness indicator |
| `observation_count` (int) | `business_memory` | ORDER BY only | Pattern strength |

---

## 2. Proposed Solution: Authority-Based Context Assembly

### 2.1 Design Principles

1. **No new tables** — The hierarchy must be implementable using existing columns
2. **Minimal column changes** — Prefer computed/resolved attributes over schema changes
3. **LLM-assisted, not LLM-dependent** — The assembly logic should resolve deterministically where possible, only deferring to the LLM when ambiguity remains
4. **Backward compatible** — Existing data for Vitanova must continue working without manual migration
5. **Auditable** — The resolution logic must be transparent and testable

### 2.2 Source Authority Hierarchy

Each entity type receives a **base authority tier**. Within each tier, **secondary signals** (priority, freshness, confidence) further refine ordering:

```
TIER 1 — Immutable Decisions
  Entities: business_memory WHERE is_immutable = true
  Signals: decision_priority (critical > high > normal)
  Rationale: Business owner marked these as final. Never overridden.

TIER 2 — Manual Instructions
  Entities: ai_instructions WHERE source = 'manual'
  Signals: priority (higher > lower)
  Rationale: Explicitly written by the business owner. Reflects conscious policy.

TIER 3 — Active Sales Rules
  Entities: sales_rules WHERE is_active = true
  Signals: priority (higher > lower), created_at (newer > older when priority equal)
  Rationale: Configured business policies. Priority is explicit.

TIER 4 — Onboarding/Correction Knowledge
  Entities: knowledge_items WHERE source IN ('onboarding', 'correction', 'manual')
  Signals: confidence (high > medium > low), created_at (newer > older)
  Rationale: Reviewed/approved content. Higher confidence = more reliable.

TIER 5 — Document-Imported Knowledge
  Entities: knowledge_items WHERE source = 'document'
  Signals: created_at (newer > older), confidence
  Rationale: Bulk-imported. May contain errors or outdated info. Lowest trust.

TIER 6 — AI Instructions (onboarding auto-generated)
  Entities: ai_instructions WHERE source IN ('onboarding', 'correction')
  Signals: priority, created_at
  Rationale: Auto-generated during onboarding. Lower authority than manual.

TIER 7 — Business Memory Patterns
  Entities: business_memory WHERE is_immutable = false
  Signals: observation_count, confidence, last_observed_at
  Rationale: ML-extracted patterns. Statistical — may be noise.
```

### 2.3 Resolution Algorithm

When the context assembler processes entities:

```
function resolveEntityOrder(entities):
  1. Group by entity type
  2. Map each entity to its authority tier (1-7)
  3. Within each tier, apply secondary sort:
     a. priority DESC (if available)
     b. confidence DESC (if available)
     c. created_at DESC (if available)
  4. Return entities sorted by (tier ASC, secondary DESC)
  5. Mark each entity with its tier and source in a [TAG] for the prompt
```

This produces a deterministic, predictable ordering that:
- Places higher-authority information first in the prompt (positional priority)
- Tags each piece with its authority level so the LLM can reason about conflicts
- Handles equal-tier conflicts by secondary signals (newer wins)

### 2.4 Prompt-Level Conflict Resolution Instruction

The system prompt must include explicit conflict resolution rules that reference the hierarchy:

```
## RESOLUCIÓN DE CONFLICTOS

Si encuentras información contradictoria entre diferentes fuentes:

1. Las DECISIONES INMUTABLES (marcadas como [INMUTABLE]) siempre prevalecen.
2. Las INSTRUCCIONES MANUALES [MANUAL] prevalecen sobre reglas y conocimiento.
3. Las REGLAS DE VENTA [REGLA] con prioridad más alta prevalecen sobre las más bajas.
4. El CONOCIMIENTO RECIENTE prevalece sobre el antiguo (fecha de creación).
5. La CONFIRMACIÓN EXPLÍCITA del negocio prevalece sobre patrones estadísticos.

Si después de aplicar estas reglas el conflicto persiste:
- Si afecta precios/precios: Pregunta al cliente cuál fuente consultó.
- Si afecta reglas de negocio: Escala a un asesor humano.
- Si es una contradicción sin riesgo: Usa la información más reciente.
```

### 2.5 Required Code Changes

**File: `src/lib/ai/knowledge.ts`**

Add the `resolveEntityOrder()` function and modify `getBusinessContext()` to return tagged entities:

```
function resolveEntityOrder(entities: Entity[], signals: Signals): TaggedEntity[]
  - Maps each entity to its authority tier
  - Sorts by (tier, priority, confidence, created_at)
  - Returns entities with authority tag metadata
```

Modify `getBusinessContext()` to call `resolveEntityOrder()` on each entity array before returning.

**File: `src/lib/ai/prompts.ts`**

Modify `buildMasterPrompt()`:
- Change `formatRules()`, `formatInstructions()`, `formatKnowledge()` to accept tagged entities
- Add authority tags (`[MANUAL]`, `[INMUTABLE]`, `[DOCUMENTO]`, etc.) to each formatted line
- Add the "RESOLUCIÓN DE CONFLICTOS" section after the existing sections

**No changes needed:**
- `context.ts` — No changes; it already passes the data through
- `runtime.ts` — No changes; it already calls the pipeline
- Schema — No new columns, no new migrations
- Tests — Only existing behavior tests; new adversarial tests cover conflicts

### 2.6 What This Changes (and Doesn't)

| Aspect | Changes | Doesn't Change |
|--------|---------|---------------|
| Prompt assembly order | ✅ Entities grouped by authority tier | ❌ Entity data itself |
| Prompt content | ✅ Authority tags added to each line | ❌ Existing fundamental rules |
| Conflict resolution | ✅ New instructions added to prompt | ❌ LLM still resolves conflicts |
| Data fetching | ✅ Sorting logic in knowledge.ts | ❌ Query structure, filters |
| Schema | ❌ No changes | ✅ All existing migrations |
| Vitanova data | ❌ No migration needed | ✅ All data remains valid |
| API responses | ❌ No changes | ✅ Streaming unchanged |

---

## 3. Additional Test Cases

New scenarios to validate conflict resolution:

### 3.1 TC-007: Immutable Decision vs Recent Rule

**Setup:** A `business_memory` entry with `is_immutable=true` that contradicts a recent `sales_rule`.
- Immutable memory: "No aceptamos devoluciones después de 15 días" (decision_priority: critical)
- Sales rule: "Devoluciones aceptadas hasta 30 días después de la compra" (priority: 8)

**Query:** "¿Puedo devolver un producto que compré hace 20 días?"
**Expected:** MIA rejects the return, citing the immutable business decision (15-day policy).

### 3.2 TC-008: Manual Instruction Overrides Onboarding Instruction

**Setup:** Two `ai_instructions` with opposite content.
- Manual: "Siempre usa 'usted'" (priority: 10, source: 'manual')
- Onboarding: "Usa 'tú' para crear cercanía" (priority: 5, source: 'onboarding')

**Query:** "Oye, ¿qué precio tiene el X200?"
**Expected:** MIA responds using "usted" (manual > onboarding regardless of recency).

### 3.3 TC-009: Document Knowledge vs Higher-Priority Rule

**Setup:** 
- Knowledge item (source: 'document'): "Ofrecemos 15% de descuento a nuevos clientes"
- Sales rule (priority: 9): "Descuento máximo autorizado: 10%. Solo para compras de 5+ unidades"

**Query:** "Soy nuevo cliente, ¿tengo descuento?"
**Expected:** MIA offers 10% max (rule prevails), does not mention 15% from document.

### 3.4 TC-010: Three-Way Conflict (Memory + Rule + Knowledge)

**Setup:**
- business_memory (pattern): "Clientes frecuentemente preguntan por financiamiento" 
- sales_rule (priority: 6): "No ofrecemos financiamiento. Solo pago de contado."
- knowledge_item (source: 'correction'): "Actualización: Ahora aceptamos pagos a 3 y 6 meses con tarjeta"

**Query:** "¿Puedo pagar a meses?"
**Expected:** MIA follows the correction update (source='correction' > pattern), mentions 3 and 6-month plans.

### 3.5 TC-011: Medical Claim with Immutable Safety Rule

**Setup:**
- knowledge_item (source: 'document'): "El X200 ayuda a reducir el estrés"
- business_memory (is_immutable=true, decision_priority='critical'): "Ningún producto tiene propiedades médicas aprobadas. Prohibido hacer afirmaciones de salud."

**Query:** "¿El X200 ayuda con el estrés?"
**Expected:** MIA rejects the claim citing the immutable safety decision. Does NOT repeat the medical claim.

### 3.6 TC-012: Same Authority Tier — Newer Wins

**Setup:** Two `sales_rules` with same priority (7) but different dates.
- Rule A (created Jan 2026): "Envío gratis en compras > $500"
- Rule B (created Jul 2026): "Envío gratis en compras > $1,500"

**Query:** "¿Cuál es el mínimo para envío gratis?"
**Expected:** MIA states the newer rule ($1,500) and may mention it was updated.

### 3.7 TC-013: Ambiguous Conflict — Escalation

**Setup:** Two `ai_instructions` with same priority, both source='manual', no clear resolution:
- Instruction A: "Prioriza clientes premium sobre nuevos"
- Instruction B: "Todos los clientes reciben el mismo trato"

**Query:** "Soy cliente nuevo, ¿tengo prioridad?"
**Expected:** MIA identifies the ambiguity and escalates: "Tengo instrucciones contradictorias sobre esto. Permíteme consultar con mi equipo para darte una respuesta precisa."

---

## 4. Consequences

### 4.1 Positive

- **Deterministic conflict resolution** — The authority hierarchy produces predictable, testable outcomes
- **Minimal changes** — ~40 lines in `knowledge.ts`, ~30 lines in `prompts.ts`
- **No schema changes** — Zero migration risk
- **Backward compatible** — Existing Vitanova data works as-is
- **Gradual adoption** — The authority tags in the prompt educate the LLM; no hard enforcement
- **Auditable** — Every piece of information in the prompt carries its authority level as a visible tag

### 4.2 Negative

- **LLM still makes final decision** — The hierarchy is a strong signal, not a hard constraint. The LLM may still override it
- **Tag noise** — Authority tags like `[MANUAL]` and `[DOCUMENTO]` add ~5% token overhead per entity
- **No enforcement layer** — There is no code that prevents contradictory data from being inserted (this would require a Knowledge Studio-like analysis at write time, which is out of scope)

### 4.3 Risks

| Risk | Mitigation |
|------|-----------|
| LLM ignores authority tags | Add the conflict resolution section immediately after fundamental rules (high positional priority) |
| Token overhead from tags | Tags are short (1-3 words), estimated <50 extra tokens for a typical business |
| New conflict scenarios not covered | The catch-all "escalate to human" rule handles unanticipated cases |
| Performance impact | Reordering entities is an O(n log n) operation on small arrays (<100 items); no measurable impact |

---

## 5. Implementation Order

1. `src/lib/ai/knowledge.ts` — Add `resolveEntityOrder()` with authority tier mapping
2. `src/lib/ai/prompts.ts` — Add authority tags to formatted entities + conflict resolution section
3. Verify with existing adversarial test scenarios (PRC-001 through DUP-006)
4. Verify with new test scenarios (TC-007 through TC-013)
5. Run full Playwright test suite to confirm no regressions

---

## 6. References

- ADR-001: Specialized Engineering Agent System
- ADR-002: Stage-Based Learning & Reverse Training Evolution
- MIA Adversarial Knowledge Test Report (`docs/testing/mia-adversarial-test-report.md`)
- Onboarding Stress Test Report (`docs/testing/mia-onboarding-stress-report.md`)

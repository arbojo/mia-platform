# ADR-002: Stage-Based Learning & Reverse Training Evolution

## Status

Accepted

## Date

2026-07-28

## Council

CTO, Product Manager, AI Engineer, Domain Expert, Performance Engineer

---

## 1. Executive Decision

**MIA shall adopt the Stage-Based Learning evolution.**

This decision transforms MIA from a reactive tool into a proactive Digital Employee. The evolution adds approximately 1000-1200 lines of new code across 6 sprints, requires 1 new column on an existing table, and introduces 2 new small modules (MaturityEngine, Business Intent Translator). No new tables, no new AI models, no new infrastructure.

The philosophical shift is the most important aspect: MIA goes from "I answer what I'm told" to "I observe, learn, understand, and earn autonomy over time."

---

## 2. Maturity Stages — Revised Model

The originally proposed `Observation → Confidence → Mentor → Autonomous` is **replaced** with the following 5-stage model:

| Stage | Name | Behavior | Proactive? | Reverse Training? |
|-------|------|----------|------------|-------------------|
| 1 | **Observation** | Silent collection. No proactive behavior. Learns from corrections, onboarding data, and passive conversation observation. | No | No |
| 2 | **Understanding** | Identifies patterns. Expresses observations in weekly reports. Detects uncertainty and communicates it. | Limited (weekly report patterns) | No |
| 3 | **Mentor** | Reverse Training unlocked. MIA actively discovers business gaps. Owner teaches through simulations. MIA asks specific, data-backed questions. | Yes (gated, rate-limited) | Yes |
| 4 | **Advisor** | MIA proactively suggests improvements. Identifies operational opportunities. Recommends actions (new rules, knowledge items, product refinements). | Yes (structured recommendations) | Continues |
| 5 | **Autonomous** | Future stage only. Requires additional safety architecture, escalation frameworks, and unsupervised operation protocols. NOT implemented now. | Conditional | TBD |

### Why "Autonomous" was replaced

The original "Autonomous" was ambiguous — it could imply uncontrolled self-modification. The revised model:
- Adds **Understanding** (Stage 2) — a critical bridge between silent learning and proactive behavior
- Adds **Advisor** (Stage 4) — the natural evolution after Mentor Mode matures
- Keeps **Autonomous** as a **future placeholder** with a clear prerequisite: additional safety architecture

### Stage Transitions

Transitions are computed by the MaturityEngine (new module, ~150 lines) and stored in the existing `readiness_snapshots` table via a new `maturity_stage` column.

**Proposed thresholds:**

| Transition | Requirement |
|------------|-------------|
| Observation → Understanding | `overall >= 20 AND confidence >= 15` |
| Understanding → Mentor | `overall >= 60 AND confidence >= 50 AND preparation >= 40` |
| Mentor → Advisor | `overall >= 80 AND confidence >= 70 AND preparation >= 60 AND Mentor Mode used ≥ 3 times` |
| Advisor → Autonomous | FUTURE — not defined |

---

## 3. Architecture Changes

### 3.1 New Concepts

| Concept | Description | Module |
|---------|-------------|--------|
| **MaturityEngine** | Thin layer that computes stage from readiness scores | `src/lib/ai/maturity.ts` (~150 lines) |
| **Business Intent Translator** | Disambiguates ambiguous owner instructions before they reach the prompt builder | `src/lib/ai/intent-translator.ts` (~200 lines) |
| **Business Decisions Memory** | Stores intentional business choices with rationale, not just facts | extension to `business_memory` |
| **Mistake Memory / Negative Learning** | Stores "what should never happen again" — durable prevention rules | extension to `learning_events` |
| **Confidence Decay** | Time-based decay function for `business_memory` and `mia_skills` confidence values | `src/lib/ai/confidence.ts` (~100 lines) |
| **Immutable Core Principles** | Post-generation filter that enforces non-overridable safety rules | `src/lib/ai/core-principles.ts` (~80 lines) |

### 3.2 Modified Concepts

| Concept | Change |
|---------|--------|
| **Readiness Snapshots** | Add `maturity_stage` column |
| **Learning Events** | Add `mistake_prevention` type with severity field |
| **Business Memory** | Add `decision` memory_type, add `decision` category, expand categories |
| **Laboratorio** | Add Mentor Mode as 5th mode (role inversion, gap detection evaluation) |
| **Evaluation Engine** | New evaluation prompt for gap detection (Mentor Mode) |
| **Prompt Builder** | Add immutable core principles section, inject business decisions |
| **Weekly Reports** | Include gap observations (Stage 2+), proactive recommendations (Stage 4+) |
| **Dashboard** | Show skill breakdown by status, observed patterns, maturity stage |
| **Context Loader** | Inject business decisions + mistake prevention into prompt context |

### 3.3 Rejected Concepts

| Concept | Reason for Rejection |
|---------|---------------------|
| **XP / Levels / Badges** | Gamification contradicts Digital Employee philosophy |
| **Autonomous Stage now** | Requires safety architecture not yet designed |
| **Separate Memory Table** | `business_memory` can be extended with new `memory_type` |
| **Standalone Mentor Mode Module** | Reuses existing Laboratorio infrastructure — no new module needed |

---

## 4. Data Model Impact

| Proposal | New Table? | Existing Table Extension? | No Change? |
|----------|-----------|--------------------------|------------|
| Maturity Stages | — | Add `maturity_stage TEXT` to `readiness_snapshots` | — |
| Business Decisions Memory | — | Add `'decision'` to `memory_type` CHECK constraint; add `'decision'` to `category` CHECK constraint; add `rationale TEXT`, `expires_at TIMESTAMPTZ`, `is_immutable BOOLEAN DEFAULT FALSE` to `business_memory` | — |
| Mistake Memory | — | Add `'mistake_prevention'` to `correction_type` in `learning_events`; add `severity TEXT CHECK (severity IN ('low','medium','high','critical'))` column; add `is_active BOOLEAN DEFAULT TRUE` and `expires_at TIMESTAMPTZ` | — |
| Confidence Decay | — | No schema change — computed at query time via function | ✅ Runtime formula |
| Immutable Core Principles | — | — | ✅ Hardcoded in `core-principles.ts` |
| Business Intent Translator | — | — | ✅ Stateless module |
| MaturityEngine | — | — | ✅ Reads readiness scores, no new storage |
| Mentor Mode | — | — | ✅ Reuses `lab_sessions` table with new `mode: 'mentor'` |

**No new tables required.** All additions fit within existing schema through column extensions and constraint updates.

### 4.1 Business Memory Category Expansion

Current `category` CHECK constraint has 10 fixed values. Must be relaxed to allow dynamic category generation (or extended with `decision`, `policy`, `escalation`, `pricing_strategy`, `customer_promise`).

**Recommendation:** Replace the CHECK constraint with a looser validation (or remove it and validate at application layer), since memory categories will grow as MIA learns new domain-specific patterns.

### 4.2 Learning Events Type Expansion

Current `correction_type` CHECK: `('knowledge', 'rule', 'instruction', 'product')`. Add `'mistake_prevention'`.

---

## 5. Confidence Decay Model

### Formula

```
effective_confidence = base_confidence × decay_factor ^ (days_since_last_observed / half_life_days)
```

Where:
- `base_confidence`: stored value (0-100)
- `decay_factor`: 0.5 (confidence halves over the half-life)
- `half_life_days`: configurable per memory_type
  - `decision`: 180 days (business decisions are stable)
  - `pattern`: 90 days (patterns may change)
  - `experience`: 60 days (specific experiences lose relevance)
  - `insight`: 120 days (insights have medium longevity)
  - `trend`: 45 days (trends change quickly)
  - `mistake_prevention`: 365 days (prevention rules should persist)

### When Decay Triggers

- **Passive**: Computed at read time (query-time function). No background job needed.
- **Active**: Full recalculation when `calculateReadiness()` runs (existing periodic process).

### Impact on Readiness Index

When confidence decays, the Readiness Index's `confidence` component should reflect effective (decayed) values, not stored base values. This makes readiness naturally decline if business knowledge is not maintained — which is realistic. A business that configured MIA once and never interacted again should see readiness decrease over time.

### Confidence Increases

Confidence increases when:
- Owner explicitly confirms a memory item (via dashboard or during correction)
- Customer interactions validate the information (conversation analysis reaffirms the pattern)
- Repeated successful usage (observation_count increases → confidence boosted)
- Owner re-engages with the system (training sessions, weekly report review)

---

## 6. Business Decisions Memory — Detailed Design

### What Makes a Decision Different from Knowledge

| Attribute | Knowledge | Decision |
|-----------|-----------|----------|
| Content | "Delivery is Monday-Friday" | "We chose not to deliver weekends due to operational costs" |
| Mutability | Can change without explanation | Should record rationale |
| Confidence | Decays normally | Longer half-life (180 days) |
| Immutability | N/A | Some decisions are immutable (legal, safety) |
| Expiration | N/A | Some decisions have expiry (promotional periods) |

### Storage

Extend `business_memory` with:
- `memory_type`: Add `'decision'`
- `category`: Add `'decision'` (plus relaxed constraint for sub-categories)
- `rationale TEXT`: Why the decision was made
- `expires_at TIMESTAMPTZ`: When the decision should be reviewed/renewed
- `is_immutable BOOLEAN DEFAULT FALSE`: If true, MIA cannot suggest changes
- `decision_priority TEXT CHECK (decision_priority IN ('critical','high','normal')) DEFAULT 'normal'`: Authority level. Critical decisions (e.g., legal, safety) override all other knowledge. High decisions override sales_rules. Normal decisions are standard business choices.

### Integration with Prompt Builder

Decisions are injected into the prompt as:

```
## Decisiones del Negocio
- [Entrega] No entregamos fines de semana por costos operativos.
- [Precios] El producto X no se descuenta individualmente, solo en paquete.
- [Médico] No prometemos eliminación completa de síntomas.
```

This goes in a dedicated section, separate from `sales_rules` and `knowledge`. Decisions are higher authority than rules.

---

## 7. Mistake Memory — Detailed Design

### What It Stores

A mistake prevention event records:
- **What went wrong**: The incorrect statement MIA made
- **Why it was wrong**: The correction or reason
- **Severity**: How critical the mistake was
- **Category**: Type of mistake (prohibited_claim, incorrect_pricing, wrong_delivery, bad_comparison, bad_escalation)
- **Reference**: Link to the correction/learning event that produced it

### Storage

Extend `learning_events`:
- Add `'mistake_prevention'` to `correction_type` CHECK
- Add `severity TEXT CHECK (severity IN ('low','medium','high','critical'))` DEFAULT 'medium'
- Add `is_active BOOLEAN DEFAULT TRUE`
- Add `expires_at TIMESTAMPTZ` (optional, for temporary prohibitions)

Add new column `category` to `learning_events` with categories:
`('prohibited_claim', 'incorrect_pricing', 'incorrect_delivery', 'wrong_comparison', 'bad_escalation', 'other')`

### How It Affects Behavior

Mistake prevention items are loaded into the prompt as hard behavioral rules:

```
## Prevención de Errores
⚠️ CRÍTICO: Nunca afirmar que un producto "cura" enfermedades.
⚠️ ALTO: No prometer entregas en zonas sin cobertura.
⚠️ MEDIO: No comparar productos con la competencia sin datos verificados.
```

Severity determines inclusion — **hard rule enforced by Context Loader**:
- **critical**: Always injected at the top of the prevention section, styled as warning
- **high**: Always injected
- **medium**: Injected if last triggered within 60 days
- **low**: Injected only during training/context builder (never in live customer prompts)

This prevents prompt bloat as Mistake Memory accumulates over time. Items older than the severity threshold are stored and queryable but do not reach the live prompt.

### Impact on Confidence

When MIA makes a mistake that is corrected, the confidence of the related knowledge/skill is **decreased** (penalty). The mistake prevention item starts with high confidence (90+) because it was learned through explicit correction. Its confidence decays slowly (365-day half-life).

---

## 8. Mentor Mode Philosophy — Refined

### Core Objective

Mentor Mode's primary purpose is **not** to evaluate the owner's sales ability. It is to **extract tacit business knowledge that the owner has not explicitly configured.**

### How It Works

1. MIA generates a customer persona based on actual gaps detected in business knowledge
2. The owner responds as a salesperson
3. MIA's evaluation detects:
   - **Explanations**: How the owner explains product benefits or handles objections
   - **Objection patterns**: What arguments the owner naturally uses
   - **Emotional language**: What tone, urgency, or empathy the owner deploys
   - **Hidden policies**: Rules the owner follows but hasn't written down
   - **Decision reasoning**: Why the owner handles certain situations in specific ways

### Mandatory Owner Approval

**MIA NEVER auto-creates knowledge items, rules, or decisions.** Every detected item requires explicit owner approval before being saved.

4. After the session, MIA presents extracted knowledge for approval:

```
MIA detected 3 possible items during this session:

📋 Rule suggestion: "If customer asks about neuropathy, explain that results depend on consistency"
→ Would you like to save this as a sales rule?

📋 Knowledge suggestion: "The product works through gradual cellular regeneration"
→ Would you like to add this to your product description?

📋 Decision suggestion: "We prioritize long-term results over quick fixes"
→ Would you like to record this as a business decision?
```

5. Owner approves or rejects each item individually
6. Approved items enter memory with attribution (sourced from Mentor Mode session)
7. Rejected items are discarded — MIA records the rejection to refine future detection

This is the boundary between extraction and commitment. MIA can detect. Only the owner decides what becomes part of the business's operational DNA.

### Evaluation Prompt

Current evaluation prompt scores MIA on 5 criteria (Product Knowledge, Empathy, Objection Handling, Closing, Rule Following).

Mentor Mode evaluation prompt:

```
Analyze the owner's response to MIA's customer simulation.

Extract:
1. What knowledge did the owner use that is NOT in MIA's database?
2. What implicit rules or policies did the owner follow?
3. What emotional intelligence or sales techniques did the owner demonstrate?
4. What objections did the owner handle, and how?
5. What business decisions can be inferred from the owner's response?

Return structured extraction results, not a score.
```

### Role Inversion UX

- MIA types first (as customer)
- Owner responds (as salesperson)
- Chat UI shows MIA's messages with a customer avatar/icon
- No scoring displayed during the session (avoids evaluation anxiety)
- Summary shows what was learned, not how well the owner performed

---

## 9. Business Intent Translator — UX Design

### Principle: Suggest, Never Block

The Translator can suggest interpretations. It cannot block or refuse instructions. The owner's original intent always wins.

### UX Flow

**Step 1:** Owner writes instruction
> Owner: "Make MIA more friendly"

**Step 2:** Translator computes interpretation silently

```json
{
  "interpretation": {
    "warmth": "+15",
    "formality": "-10",
    "empathy": "+10"
  },
  "confidence": 85,
  "alternative_interpretations": [],
  "needs_disambiguation": false
}
```

**Step 3:** MIA confirms succinctly
> ✅ I'll adjust to a warmer, more conversational style. (less formal, more empathetic)

**Only when ambiguity creates conflict does the Translator ask questions:**

> Owner: "Be more friendly but also more professional"
>
> ⚠️ "Friendly" and "professional" can conflict. I can:
> - Be warm +15, keep formality (friendly-professional balance)
> - Be warm +15, more formal +10 (warm but formal)
> - Be warmer +10, less formal -5 (conversational but respectful)
>
> Which direction works best?

### Integration Points

| Point | Integration |
|-------|-------------|
| **Corrections** (POST /api/training/corrections) | When correction changes personality/tone, Translator suggests interpretation |
| **AI Instructions** (manual input) | When owner writes ambiguous instruction, Translator offers clarification |
| **Brand Identity** (onboarding) | Pre-fill with defaults, Translator explains implications |
| **Onboarding Wizard** | Step 3 (personality) shows slider values + real-time Translator interpretation |

### What the Translator is NOT

- NOT a chatbot that argues
- NOT a blocker that refuses
- NOT a replacement for the prompt builder
- NOT a source of friction for unambiguous instructions

---

## 10. Integration Map

```
                    ┌──────────────────────┐
                    │   Owner / Business    │
                    └──────┬───────┬───────┘
                           │       │
              ┌────────────┘       └────────────┐
              ▼                                  ▼
    ┌─────────────────┐              ┌──────────────────────┐
    │  AI Instructions │              │  Corrections Flow    │
    │  (manual input)  │              │  (training feedback) │
    └────────┬────────┘              └──────────┬───────────┘
             │                                   │
             ▼                                   ▼
    ┌─────────────────────────────────────────────────┐
    │          Business Intent Translator              │
    │  (disambiguates ambiguous owner instructions)    │
    └─────────────────────┬───────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────────┐
    │              Prompt Builder                     │
    │  (assembles: personality + products + rules +   │
    │   knowledge + decisions + mistake prevention +  │
    │   customer memory + recent lessons)             │
    └─────────────────────┬───────────────────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────────┐
    │           Immutable Core Filter                  │
    │  (post-generation: blocks prohibited content)    │
    └─────────────────────┬───────────────────────────┘
                          │
                          ▼
                   ┌───────────┐
                   │  Runtime  │
                   │ (gateway) │
                   └───────────┘

                    ┌──────────────────────┐
                    │    Readiness Index    │
                    │  (existing, 815 lines)│
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    MaturityEngine     │
                    │  (new, ~150 lines)    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Dashboard  │  │ Weekly Report│  │  Laboratorio │
    │  (stage +    │  │  (gap        │  │  (Mentor Mode│
    │   patterns)  │  │   detection) │  │   gated by   │
    │              │  │              │  │   stage)     │
    └──────────────┘  └──────────────┘  └──────────────┘
                                                │
                                                ▼
                                    ┌──────────────────────┐
                                    │   Context Loader      │
                                    │  (assembles business  │
                                    │   context for prompt) │
                                    └──────────────────────┘

                    ┌──────────────────────┐
                    │    Business Memory    │
                    │  (patterns, decisions,│
                    │   experiences,        │
                    │   insights, trends)   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   Confidence Decay    │
                    │  (query-time formula) │
                    └──────────────────────┘

                    ┌──────────────────────┐
                    │   Mistake Memory      │
                    │  (mistake_prevention  │
                    │   in learning_events) │
                    └──────────────────────┘
```

### Data Flow Summary

1. **Learning systems** (Memory, Skills, Readiness, Mistakes) feed into the **Context Loader**
2. **MaturityEngine** reads Readiness Index and determines stage
3. **Context Loader** assembles business context for the **Prompt Builder**
4. **Business Intent Translator** sits between owner input and Prompt Builder
5. **Immutable Core Filter** runs after generation, before response is sent
6. **Mentor Mode** in Laboratorio creates new Business Memory + Mistake Memory + Knowledge
7. **Dashboard** + **Weekly Reports** surface the state of all systems to the owner

---

## 11. Risk Analysis

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Confidence decay causes rapid drop for inactive businesses | Medium | Medium | Floor at 10 — no memory decays below 10 without explicit owner action |
| Mistake prevention items accumulate and bloat prompts | Medium | Low | Severity-gated inclusion; only critical/high always included; medium/low conditional |
| MaturityEngine wrong threshold blocks Mentor Mode | Medium | High | Thresholds are configurable; defaults adjustable based on telemetry |
| Business memory category constraint too rigid | Medium | Low | Replace CHECK constraint with application-level validation |
| Intent Translator creates friction for power users | Low | Medium | Only fires on ambiguous instructions; silent mode for unambiguous ones |

### UX Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Mentor Mode feels like work | High | Medium | Sessions capped at 3-5 exchanges; clear value proposition per session |
| Owner feels interrogated by proactive messages | Medium | High | Rate limit (1x/week); data-backed messages only; "Not now" dismiss |
| Maturity stages confuse non-technical owners | Low | Low | Stages are internal; dashboard shows "What MIA understands" not "Stage 3" |
| Intent Translator feels like MIA is arguing | Medium | Medium | Translator cannot reject; owner's instruction always wins; confirmation is 1 line |
| Weekly report gap detection feels accusatory | Medium | Medium | Framed as "I noticed customers asking about X" not "You forgot to configure Y" |

### AI Behavior Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Immutable core filter blocks valid responses | Low | High | Conservative initial ruleset; log all hits; owner override with warning |
| Mistake prevention items cause over-cautious behavior | Medium | Medium | "Never say X" rules are last-resort; Mistake Memory included with severity weighting |
| Mentor Mode customer persona hallucinates | Low | Medium | Persona generated from actual business gaps, not invented needs |
| Intent Translator misinterpretation | Medium | Low | Owner always sees interpreted changes before they are applied |

### Commercial Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Confidence decay causes unnecessarily low readiness scores for seasonal businesses | Medium | Medium | Seasonal mode extends half-life for all memory during off-season |
| Over-reliance on proactive messages annoys owners into churning | Low | High | Strict rate limiting; opt-out option for proactive messages |
| Mentor Mode increases token consumption (more AI calls) | Medium | Low | Mentor Mode sessions are opt-in; not recurring; token tracking already exists |

---

## 12. Non-Gamified Identity — Confirmed

**MIA will NOT use:**
- XP points
- Levels (level 1, level 2, etc.)
- Badges or achievements
- Leaderboards
- Streaks or combo mechanics
- Progress bars that fill "just because"

**MIA WILL use:**
- **Understanding** — "What MIA knows about your business"
- **Confidence** — "How sure MIA is about each knowledge area" (with decay)
- **Observed patterns** — "What MIA has noticed in customer conversations"
- **Learning history** — "What MIA has learned and when"
- **Maturity stage** — Internal only, not user-facing
- **Skill status** — Mastered / Learning / Needs Practice / Not Trained (existing system, reported as understanding level)

### Dashboard Language

| Concept | Dashboard Label | Example |
|---------|----------------|---------|
| Maturity Stage | (not shown) | — |
| Skill Level (0-100) | "Understanding" | "Product Knowledge: Excellent" |
| Skill Status | Skill status | "Objection Handling: Learning" |
| Memory Confidence | "How sure I am" | "High confidence, based on 12 observations" |
| Mistake Prevention | "What I avoid" | "Never claim medical results" |
| Proactive Message | "I noticed..." | "I noticed 4 customers asked about deliveries this week" |

---

## 13. Sprint Order — Revised

The original sprint order had Dashboard Evolution early and Learning Foundations late. The revised order prioritizes **foundational systems first**, then **user-facing changes**:

### Sprint 1: Maturity Engine & Confidence Decay Foundation

- Add `maturity_stage` column to `readiness_snapshots`
- Create `MaturityEngine` — determine stage from readiness scores
- Create `confidence.ts` — decay formula, query-time computation
- Add `expires_at` to `business_memory`
- **No user-facing changes.** Data infrastructure only.

### Sprint 2: Learning Foundations

- Add `decision` memory_type + `rationale` + `is_immutable` to `business_memory`
- Add `mistake_prevention` type + `severity` to `learning_events`
- Build Mistake Memory integration with correction flow
- Extend prompt builder to inject decisions + mistake prevention
- Extend context loader to fetch decisions + mistake prevention
- **Infrastructure complete.** Behavior unchanged.

### Sprint 3: Immutable Core + Intent Translator

- Create `core-principles.ts` — post-generation filter
- Create `intent-translator.ts` — AI disambiguation module
- Integrate with corrections flow
- Integrate with AI instructions flow
- **Safety + ambiguity resolution delivered.**

### Sprint 4: Mentor Mode

- Add Mentor Mode to Laboratorio (gated by MaturityEngine)
- New evaluation prompt for gap detection
- Role inversion in chat UI
- Integration with teach flow (auto-create knowledge/decisions from gaps)
- **Core innovation delivered.**

### Sprint 5: Proactive Learning

- Add gap detection to weekly report generation
- MIA's weekly narrative includes observed gaps
- "Not now" dismissal mechanism
- **Proactive behavior delivered.**

### Sprint 6: Dashboard Evolution

- Replace single "Readiness" number with skill breakdown by status (existing data)
- Show "This week MIA noticed..." patterns from `business_memory`
- Show maturity stage label
- **Presentation catches up with infrastructure.**

### Why This Order

| Rationale | Detail |
|-----------|--------|
| **Infrastructure first** | MaturityEngine + Confidence Decay are prerequisites for Mentor Mode gating and realistic readiness scores |
| **Learning foundations second** | Decisions + Mistake Memory need to exist before Mentor Mode can create them |
| **Safety third** | Immutable Core + Intent Translator should be in place before proactive behavior |
| **Core innovation fourth** | Mentor Mode is the most visible change — needs all foundations ready |
| **Proactive fifth** | Gap detection builds on Mentor Mode discoveries |
| **Dashboard last** | The dashboard should reflect the full system, not lead it |

---

## 14. What Exists vs What Is New

### Already Exists (No Build Required)

| Component | File/Table | Lines |
|-----------|-----------|-------|
| Readiness Index | `src/lib/ai/readiness.ts` | 815 |
| Skills Engine | `src/lib/ai/memory.ts` | 495 |
| Business Memory | `business_memory` table | 198 (migration) |
| Learning Velocity | `learning_velocity_snapshots` table | — |
| Knowledge Studio | `src/app/api/knowledge/` | — |
| Laboratorio (simulation) | `src/components/laboratorio/` | 11 components |
| Evaluation Engine | `src/app/api/laboratorio/evaluate/` | — |
| Teach Flow | `src/app/api/laboratorio/teach/` | — |
| Weekly Reports | `weekly_reports` table | — |
| Conversation Memory | `assistant_memories` table | — |

### Must Build

| Module | Location | Lines |
|--------|----------|-------|
| MaturityEngine | `src/lib/ai/maturity.ts` | ~150 |
| Confidence Decay | `src/lib/ai/confidence.ts` | ~100 |
| Intent Translator | `src/lib/ai/intent-translator.ts` | ~200 |
| Immutable Core Filter | `src/lib/ai/core-principles.ts` | ~80 |
| Mentor Mode Evaluation | prompt change + role inversion | ~200 |
| Dashboard Evolution | UI changes to page.tsx | ~200 |
| Weekly Report Gap Detection | integration in report generation | ~100 |
| Business Memory Category Expansion | migration + validation change | ~50 |
| Learning Events Type Expansion | migration + type update | ~30 |
| Prompt Builder Updates | integration of decisions + mistakes | ~50 |

**Total new code: ~1,160 lines**

### Must Migrate

| Migration | Change |
|-----------|--------|
| 009_stage_based_learning.sql | Add `maturity_stage` to `readiness_snapshots`, add `decision` to `business_memory` (+ `rationale`, `is_immutable`, `expires_at`, `decision_priority`), add `mistake_prevention` to `learning_events` (+ `severity`, `category`, `expires_at`, `is_active`) |

---

## 15. Final Recommendation

### Does This Make MIA Closer to a Digital Employee?

**Yes. Unequivocally.**

Before this evolution, MIA is a well-configured chatbot that:
- Answers questions when asked
- Learns only when explicitly corrected
- Never initiates, never observes, never communicates understanding

After this evolution, MIA is a Digital Employee that:
- **Observes** silently during Stage 1, building pattern recognition
- **Understands** during Stage 2, communicating what it has observed
- **Mentors** during Stage 3, actively discovering gaps through role inversion
- **Advises** during Stage 4, proactively suggesting improvements
- **Earns autonomy** over time through demonstrated reliability

The critical insight is that **each stage must be earned**, not given. A newly onboarded business sees a quiet, learning assistant. Only after demonstrating knowledge through configuration, corrections, and conversations does MIA earn the right to be proactive, to interview, and to advise.

This is the difference between software and an employee. Software comes fully configured. An employee grows into the role.

### What Should Be Built First

**Sprint 1: Maturity Engine & Confidence Decay** — the foundation that everything else depends on.

Without MaturityEngine, Mentor Mode has no gate. Without Confidence Decay, readiness scores become stale and unrealistic. These two modules are prerequisites.

### What Should Wait

**Autonomous Stage — indefinitely.** This stage requires:
- Comprehensive escalation frameworks
- Unsupervised operation protocols
- Safety guarantees that prevent cascading errors
- Legal review for autonomous business decisions

Until these are designed, Stage 5 remains a placeholder.

**Dashboard Evolution — Sprint 6.** The dashboard should reflect the full system, not lead it. Building the dashboard first would show empty sections and features that don't exist yet.

---

## 16. Aligned with AGENTS.md Guiding Principles

| Principle | How This ADR Honors It |
|-----------|------------------------|
| **Simplicity first** | Reuses existing schemas, tables, components. Zero new tables. |
| **Reuse before create** | Mentor Mode reuses Laboratorio, evaluation, teach flow. MaturityEngine reads existing readiness scores. |
| **No technical debt** | All changes are backward-compatible. Existing data unchanged. |
| **Scalable architecture** | Confidence decay formula is O(1). No background jobs. No new infrastructure. |
| **Strict typing** | All new modules use strict TypeScript with defined interfaces. |
| **Never break existing features** | Every change is additive — existing functionality is preserved. |

---

## References

- `AGENTS.md` — Main agent guide (Section 12: Laboratorio, Section 5: Architecture)
- `docs/adr/001-agent-system.md` — Engineering Agent System
- `src/lib/ai/memory.ts` — Business Memory, Skills, Learning Velocity
- `src/lib/ai/readiness.ts` — Readiness Index (815 lines)
- `src/lib/ai/prompts.ts` — Prompt Builder
- `supabase/migrations/006_readiness_index.sql` — readiness_snapshots table
- `supabase/migrations/008_business_memory.sql` — business_memory, mia_skills, weekly_reports, learning_velocity_snapshots
- `src/app/api/laboratorio/evaluate/route.ts` — Evaluation engine
- `src/app/api/laboratorio/teach/route.ts` — Teach flow
- `src/components/laboratorio/` — Laboratorio components

# ADR-007: Heuristic Engine — Conversational Intelligence Layer

## Status

v1.1 (Updated 2026-07-29 per Council Review)

## Date

2026-07-29

## Council

CTO, Architect, AI Engineer, Domain Expert, Product Manager, Security Engineer, Performance Engineer

---

## 1. Context

### 1.1 The Problem

MIA today is **reactive**. She answers questions accurately, follows rules, and resolves conflicts — but she never initiates. She never probes, never hypothesizes, never adapts her strategy mid-conversation based on what she learns.

```
Current:  Customer asks → MIA answers
```

A human salesperson operates differently:

```
Human:   Customer communicates → interprets context → asks intelligently
         → adapts recommendation → improves conversion
```

Human salespeople constantly perform **informal probability estimation**:

| Customer says | Novice thinks | Experienced thinks |
|--------------|---------------|--------------------|
| "Necesito zapatos cómodos" | "Necesita zapatos" | ¿Para trabajar? ¿Problema de pies? ¿Reemplazo? ¿De pie todo el día? |
| "Mis uñas cambiaron" | "Tiene un problema en uñas" | ¿Edad? ¿Desde cuándo? ¿Ya probó algo? ¿Expectativas realistas? |
| "Busco para mi negocio" | "Quiere comprar" | ¿Volumen? ¿Frecuencia? ¿Presupuesto? ¿Ya tiene proveedor? |

MIA needs this capability — not to replace the AI model, but to provide a **reasoning layer** that generates contextual signals, hypotheses, and recommended conversational actions.

### 1.2 What the Heuristic Engine Is NOT

| ❌ What it is NOT | ✅ What it IS |
|-------------------|--------------|
| A replacement for the AI model | A reasoning layer that feeds context TO the AI |
| A chatbot that assumes facts | A system that generates probabilistic hypotheses |
| An interrogation engine | A question selector that minimizes friction |
| A hardcoded sales script | A product-independent, learnable pattern system |
| An online ML model | A Bayesian inference system with offline batch learning |

### 1.3 The Three-State Principle

The engine must always distinguish three knowledge states about every customer attribute:

```
┌─────────────────────────────────────────────────┐
│                 KNOWLEDGE STATES                 │
├───────────────┬────────────────┬─────────────────┤
│   OBSERVED    │   INFERRED     │   UNKNOWN       │
│  (explicit)   │  (probable)    │  (needs query)  │
├───────────────┼────────────────┼─────────────────┤
│ "Tengo 62     │ Age 60+ →      │ Occupation?     │
│  años"        │ duration >1yr  │ Usage pattern?  │
│ "Me duelen    │ → higher risk  │ Budget?         │
│  los pies"    │   of return    │                 │
└───────────────┴────────────────┴─────────────────┘
```

- **Observed**: The customer explicitly stated it. Treated as fact.
- **Inferred**: Statistically more likely based on observed signals. Tagged with probability.
- **Unknown**: Not yet known. May or may not be worth asking.

---

## 2. Decision

### 2.1 Architecture Overview

The Heuristic Engine is a **pipeline** that processes every customer message before it reaches the AI model:

```
     Customer message
           │
           ▼
  ┌────────────────────────────┐
  │ ConversationStage          │  ─── Classify conversation state
  │ Classifier                 │       (exploring, comparing, etc.)
  └────────┬───────────────────┘
           │ stage
           ▼
  ┌─────────────────┐
  │ SignalExtractor │  ─── Extract structured signals from raw text
  └────────┬────────┘           (stage-aware weighting)
           │ signals[]
           ▼
  ┌─────────────────┐
  │ HypothesisEngine│  ─── Map signals → probability-weighted hypotheses
  └────────┬────────┘           (stage conditions probabilities)
           │ hypotheses[]
           ▼
  ┌──────────────────┐
  │ QuestionSelector │  ─── Score candidate questions by value/friction/trust
  └────────┬─────────┘           (stage filters applicable questions)
           │ best questions (0-3)
           ▼
  ┌────────────────┐
  │ ProfileUpdater │  ─── Merge new signals into customer profile
  └────────┬───────┘
           │ updated profile
           ▼
  ┌────────────────────────────────────┐
  │         HeuristicContext           │
  │  { stage, signals, hypotheses,    │
  │    questions, strategy_adjustment }│
  └────────────────┬───────────────────┘
                   │ injected into prompt
                   ▼
  ┌────────────────────────────────────┐
  │      buildMasterPrompt()          │
  │  + "## Análisis Heurístico"       │
  └────────────────┬───────────────────┘
                   │
                   ▼
           OpenAI → Response
```

### 2.2 Integration Point

The Heuristic Engine runs **before** `buildMasterPrompt()` and injects a structured `HeuristicContext` into the prompt:

```typescript
// Current
const { systemPrompt, usedContext } = await loadConversationContext(businessId, assistantId)

// With Heuristic Engine
const { systemPrompt, usedContext } = await loadConversationContext(businessId, assistantId)
const heuristicContext = await heuristicEngine.process({
  customerMessage: lastMessage,
  customerProfile: customer,
  conversationHistory: recentMessages,
  businessId,
})
const enrichedPrompt = injectHeuristicContext(systemPrompt, heuristicContext)
```

The final prompt includes a new section:

```
## Análisis Heurístico del Cliente

### Señales Detectadas
- Edad: 60+ (observado: "tengo 62 años")
- Duración del problema: >1 año (inferido: 85% probabilidad)
- Interés: cuidado de uñas (observado)

### Hipótesis Activas
- [85%] El cliente puede haber probado tratamientos de venta libre
  sin éxito → posible frustración o escepticismo
- [70%] La edad puede estar afectando la velocidad del crecimiento
  de la uña → ajustar expectativas de plazo
- [60%] El cliente busca resultados visibles → priorizar beneficios
  estéticos en recomendación

### Preguntas Recomendadas (si aplica)
- "¿Habías probado algo antes?" (valor: alto, fricción: baja)

### Ajuste de Estrategia
- Priorizar explicación del proceso biológico natural
- Usar tono paciente y educativo
- Evitar promesas de resultados rápidos
- Enfatizar consistencia como factor clave
```

### 2.3 The Heuristic Pipeline

#### 2.3.0 ConversationStage Classifier

The first stage classifies the **conversation state** — what is the customer doing right now? The same signal ("¿cuánto cuesta?") means different things at different stages.

```typescript
type ConversationStage =
  | 'greeting'         // First message — no context yet
  | 'exploring'        // Browsing, comparing, gathering information
  | 'comparing'        // Comparing specific products or options
  | 'objection'        // Raising concerns, doubts, or resistance
  | 'ready_to_buy'     // Closing signals, ready for final step
  | 'post_sale'        // Purchased, follow-up, usage questions
  | 'claim'            // Complaint, return, refund
  | 'information'      // Factual inquiry — may not intend to buy
```

Stage is determined by a **rule-based classifier** (not AI — <5ms):

| Signal | Stage | Confidence |
|--------|-------|-----------|
| First message in conversation | `greeting` | 1.0 |
| Contains price + comparison keywords | `comparing` | 0.7 |
| Contains objection keywords ("pero", "caro", "duda") | `objection` | 0.8 |
| Contains closing keywords ("comprar", "finalizar", "orden") | `ready_to_buy` | 0.8 |
| Contains claim keywords ("devolver", "reclamo", "falla") | `claim` | 0.9 |
| No strong signal + turn ≤ 3 | `exploring` | 0.6 |
| No strong signal + turn > 3 | `information` | 0.5 |

Stage **conditions** each subsequent stage of the pipeline:
- SignalExtractor: certain signals are only relevant at certain stages
- HypothesisEngine: stage adjusts prior probabilities (P(H) in Bayesian update)
- QuestionSelector: stage filters applicable questions
- ProfileUpdater: stage changes what attributes are valuable to store

**Fallback**: `exploring` if stage cannot be determined with >50% confidence.

#### 2.3.1 SignalExtractor

Extracts structured signals from raw text using **rule-based pattern matching** (not AI — for speed and cost):

```typescript
interface Signal {
  type: SignalType        // 'demographic' | 'duration' | 'usage' | 'previous_solution' | 'pain_point' | 'budget' | 'urgency'
  key: string             // e.g., 'age_range', 'duration_months', 'occupation_hint'
  value: string           // normalized value
  confidence: number      // 0.0 - 1.0
  source: 'explicit' | 'inferred'
  raw_evidence: string    // the exact text that produced this signal
}
```

Signal patterns are defined declaratively:

```typescript
const SIGNAL_PATTERNS: SignalPattern[] = [
  // Age signals
  { type: 'demographic', key: 'age_range',
    patterns: [
      { regex: /\b(\d{2})\s*años?\b/, extract: (m) => ageBucket(parseInt(m[1])), confidence: 0.95 },
      { regex: /\b(soy|estoy)\s+(joven|mayor|grande)\b/, extract: (m) => m[2] === 'joven' ? '18-35' : '60+', confidence: 0.6 },
    ]},

  // Duration signals
  { type: 'duration', key: 'duration_category',
    patterns: [
      { regex: /(\d+)\s*(año|mes|semana|día)/, extract: (m) => durationCategory(parseInt(m[1]), m[2]), confidence: 0.9 },
      { regex: /(recién|apenas|poco|siempre|años|toda la vida)/, extract: (m) => durationFromWord(m[1]), confidence: 0.6 },
    ]},

  // Pain point signals
  { type: 'pain_point', key: 'primary_concern',
    patterns: [
      { regex: /\b(dolor|molestia|incomodidad|ardor|picazón)\b/, extract: () => 'discomfort', confidence: 0.8 },
      { regex: /\b(apariencia|estética|feo|antiestético)\b/, extract: () => 'appearance', confidence: 0.7 },
    ]},

  // Previous solution signals
  { type: 'previous_solution', key: 'has_tried_before',
    patterns: [
      { regex: /(probé|usé|intenté|utilicé|compré)/, extract: () => 'true', confidence: 0.7 },
      { regex: /(nada funciona|no funcionó|sin resultados)/, extract: () => 'true_failed', confidence: 0.85 },
    ]},

  // Usage context signals
  { type: 'usage', key: 'usage_context',
    patterns: [
      { regex: /\b(trabajo|oficina|jornada)\b/, extract: () => 'work', confidence: 0.7 },
      { regex: /\b(deporte|correr|gimnasio|entreno)\b/, extract: () => 'sports', confidence: 0.8 },
      { regex: /\b(todos los días|diario|constantemente)\b/, extract: () => 'daily', confidence: 0.6 },
    ]},
]
```

#### 2.3.2 HypothesisEngine

Maps signals to probability-weighted hypotheses using a **Bayesian influence matrix**:

```typescript
interface Hypothesis {
  id: string
  description: string
  probability: number         // 0.0 - 1.0
  category: 'motivation' | 'objection' | 'expectation' | 'concern' | 'opportunity'
  supportingSignals: Array<{ signalKey: string; contribution: number }>
  recommendedStrategy: string
}
```

The hypothesis matrix is **product-independent** at the signal layer but **business-aware** at the hypothesis layer:

```
              Signal → Hypothesis Matrix (simplified)

Signal                          Hypothesis                          P(H|S)
─────────────────────────────────────────────────────────────────────
age: 60+                        Expectation timeline too short      0.75
duration: >1yr                  Previous failed attempts            0.70
pain: discomfort + duration     Skepticism about solutions          0.80
usage: work                     Comfort over appearance             0.65
has_tried: true_failed          Price sensitivity                   0.55
usage: sports                   Performance > price                 0.70
age: 60+ + duration: >1yr      Needs long-term care explanation    0.85
```

When multiple signals reinforce the same hypothesis, probabilities combine using:

```
P(H|S₁,S₂) = P(H|S₁) × P(H|S₂) / (P(H|S₁) × P(H|S₂) + (1-P(H|S₁)) × (1-P(H|S₂)))
```

This is a **naive Bayesian combination** — simple, interpretable, and well-understood.

#### 2.3.3 QuestionSelector

Selects the highest-value question to ask, scoring by:

```
QuestionScore = (InformationValue × ConversionImpact × TrustImpact) / CustomerFriction
```

Where:

| Factor | Definition | Range |
|--------|-----------|-------|
| `InformationValue` | How much uncertainty this question reduces | 0.0 - 1.0 |
| `ConversionImpact` | How much the answer could change the recommendation | 0.0 - 1.0 |
| `TrustImpact` | How much asking builds (or erodes) customer trust | 0.1 - 1.0 |
| `CustomerFriction` | Estimated cognitive/effort cost to answer | 0.1 - 1.0 |

`TrustImpact` measures whether the question feels helpful or invasive:

| Question example | TrustImpact | Why |
|-----------------|-------------|-----|
| "¿Desde cuándo tienes la molestia?" (con explicación) | 0.9 | Shows genuine interest, enables better recommendation |
| "¿Cuánto dinero quieres gastar?" (sin contexto) | 0.2 | Feels transactional, interrogative |
| "¿Para qué uso necesitas el producto?" (con explicación) | 0.85 | Shows expertise, helps customer |
| "¿Dónde vives?" (sin explicación de por qué) | 0.3 | Feels invasive |

A question with `TrustImpact < 0.5` is never selected, regardless of other factors.

Questions are only asked if:
1. `QuestionScore > SCORE_THRESHOLD` (default: 0.3)
2. Fewer than 3 questions asked in the last 5 turns
3. The question targets an `UNKNOWN` attribute (not already OBSERVED or confidently INFERRED)

Built-in question catalog (product-independent):

```typescript
const QUESTION_CATALOG: CandidateQuestion[] = [
  {
    id: 'usage_context',
    text: '¿Principalmente para uso diario, trabajo o alguna actividad específica?',
    signalsResolved: ['usage_context'],
    informationValue: 0.7,
    conversionImpact: 0.6,
    customerFriction: 0.2,     // Easy to answer
    appliesTo: ['*'],           // All verticals
  },
  {
    id: 'duration',
    text: '¿Desde cuándo tienes esta molestia?',
    signalsResolved: ['duration_category'],
    informationValue: 0.6,
    conversionImpact: 0.5,
    customerFriction: 0.2,
    appliesTo: ['health', 'wellness'],
  },
  {
    id: 'previous_solution',
    text: '¿Habías probado algo antes?',
    signalsResolved: ['has_tried_before'],
    informationValue: 0.5,
    conversionImpact: 0.7,     // High — changes objection handling
    customerFriction: 0.3,
    appliesTo: ['health', 'wellness', 'beauty'],
  },
  {
    id: 'volume',
    text: '¿Qué volumen manejas al mes?',
    signalsResolved: ['volume'],
    informationValue: 0.8,
    conversionImpact: 0.8,
    customerFriction: 0.4,     // Business info, moderate friction
    appliesTo: ['wholesale', 'b2b'],
  },
  {
    id: 'urgency',
    text: '¿Para cuándo lo necesitas?',
    signalsResolved: ['urgency'],
    informationValue: 0.4,
    conversionImpact: 0.6,
    customerFriction: 0.2,
    appliesTo: ['*'],
  },
]
```

#### 2.3.4 ProfileUpdater

Updates the customer profile with new signals and inferred attributes:

- Adds signals to an expandable JSONB `signals` field on the `customers` table
- Updates `customers.tags` based on high-confidence inferences
- Records signal history for heuristic memory learning

```typescript
interface CustomerSignals {
  observed: Record<string, { value: string; firstSeen: string; lastSeen: string; count: number }>
  inferred: Record<string, { value: string; probability: number; lastUpdated: string }>
  questionsAsked: Array<{ questionId: string; askedAt: string; answered: boolean }>
}
```

This field is stored as JSONB on the `customers` table (no schema change needed — the table already has a JSONB-capable structure via `tags`; adding a `signals` JSONB column is optional and can be deferred).

### 2.4 Experience Memory (formerly Heuristic Memory)

The engine learns from aggregated conversation outcomes through a **background batch process**. This is renamed from "Heuristic Memory" to emphasize that it stores accumulated commercial experience — not just statistical patterns.

Experience Memory operates at **three tiers**:

| Tier | Scope | Source | Privacy |
|------|-------|--------|---------|
| **Global** | All MIA instances | Aggregated, anonymized patterns from all businesses | No customer data, no business-identifiable data |
| **Industry** | Vertical (health, shoes, wholesale, etc.) | Aggregated, anonymized patterns within vertical | Industry-level only, no raw data |
| **Business** | Single tenant | Patterns from the business's own conversations | Full RLS, business-owns |

**Processing pipeline**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXPERIENCE MEMORY                            │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │ Signal→Outcome│    │ Pattern      │    │ Probability     │    │
│  │ Aggregator    │───►│ Miner        │───►│ Table Publisher │    │
│  └──────────────┘    └──────────────┘    └─────────────────┘    │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│  Raw signal +         Discovered             Published P(H|S)   │
│  outcome pairs        patterns               for live engine    │
│         │                                         │             │
│         ▼                                         ▼             │
│  Scoped per tier:                          Business +           │
│  business / industry / global              industry tables      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Input**: All completed conversations (with outcome: converted, abandoned, returned)

**Process** (nightly batch):

1. For each completed conversation, extract all signals + the final outcome
2. Aggregate: for each signal pattern, calculate conversion probability with confidence interval
3. Mine cross-signal patterns: combinations of signals that predict outcomes
4. Publish updated probability table to the live engine

**Example output**:

```
Pattern: [age:60+ + duration:>1yr + category:nail_care]
  Sample: 342 conversations
  Conversion rate: 0.58
  vs baseline: 0.42
  Confidence interval: [0.52, 0.64]
  Interpretation: "Customers 60+ with long-term nail issues
    convert 16% above baseline. Recommend patience-focused
    messaging and timeline expectation management."
```

This is **not** online ML. It is **statistical aggregation** with published probability tables. The live engine reads pre-computed tables; it does not train online.

### 2.5 Trust Rule

Every question MIA asks must **build trust**, not erode it. A question without context is interrogation; a question with explanation is advice.

**Platform rule** (enforced in prompt):

```
## Regla de Confianza
Cuando hagas una pregunta al cliente, explica brevemente por qué la haces.

❌ "¿Qué edad tienes?"
✅ "Te pregunto tu edad porque el ritmo de crecimiento de la uña
    cambia con los años. Así puedo darte una expectativa realista."

❌ "¿Cuánto es tu presupuesto?"
✅ "Pregunto tu presupuesto para recomendarte la opción que mejor
    se ajuste sin mostrarte algo fuera de tu rango."
```

**Enforcement**:
- The QuestionSelector never selects a question with `TrustImpact < 0.5`
- The prompt template enforces the "explain why asking" pattern for every question
- Hypotheses that would lead to low-trust questions are deprioritized

**Token impact**: +20-40 tokens per question turn (the explanation text).

### 2.6 Product Independence

The engine is **product-independent** by design. Signal patterns are universal. What changes per vertical is:

| Component | Product-Independent | Business-Configurable |
|-----------|--------------------|----------------------|
| Signal patterns | Core patterns (age, duration, pain) | Vertical-specific patterns |
| Hypothesis matrix | Generic hypotheses | Weight adjustments per vertical |
| Question catalog | Universal questions | Vertical-specific questions |
| Probability tables | Empty until trained | Populated per business via experience memory |
| Strategy adjustments | Recommendation patterns | Tone, emphasis, priority shifts |

A new vertical (e.g., real estate) adds:
- 2-3 vertical-specific signal patterns ("metros", "habitaciones", "crédito")
- 3-5 vertical-specific hypotheses
- 2-3 vertical-specific questions
- The experience memory populates probability tables naturally as conversations complete

---

## 3. Data Model

### 3.1 Experience Memory Table (Aggregated Patterns)

```sql
CREATE TABLE experience_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id),       -- NULL for global/industry
  scope TEXT NOT NULL CHECK (scope IN ('global', 'industry', 'business')),
  industry TEXT,                                     -- NULL for global/business

  -- The signal pattern that defines this memory
  signal_pattern JSONB NOT NULL,
  /*
  {
    "age_range": "60+",
    "duration_category": ">1year",
    "primary_concern": "appearance"
  }
  */

  -- Observed outcomes
  sample_size INT NOT NULL DEFAULT 0,
  converted_count INT NOT NULL DEFAULT 0,
  abandoned_count INT NOT NULL DEFAULT 0,
  returned_count INT NOT NULL DEFAULT 0,

  -- Calculated probabilities
  conversion_probability NUMERIC(5,4),
  abandonment_probability NUMERIC(5,4),
  return_probability NUMERIC(5,4),

  -- Confidence (Wilson score interval)
  confidence_lower NUMERIC(5,4),
  confidence_upper NUMERIC(5,4),

  -- Metadata
  min_sample_threshold INT NOT NULL DEFAULT 30,  -- minimum for statistical significance
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_detected TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(scope, business_id, signal_pattern),
  UNIQUE(scope, industry, signal_pattern)  -- for industry-level patterns
);

CREATE INDEX idx_experience_memory_scope ON experience_memory(scope);
CREATE INDEX idx_experience_memory_business ON experience_memory(business_id) WHERE business_id IS NOT NULL;
CREATE INDEX idx_experience_memory_industry ON experience_memory(industry) WHERE industry IS NOT NULL;
CREATE INDEX idx_experience_memory_probability
  ON experience_memory(scope, conversion_probability DESC)
  WHERE sample_size >= 30;
```

### 3.2 Customer Signals (on `customers` table, optional JSONB column)

```sql
ALTER TABLE customers ADD COLUMN heuristic_signals JSONB DEFAULT '{}';
```

### 3.3 Hypothesis Log (for audit and training)

```sql
CREATE TABLE heuristic_hypotheses_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  hypothesis TEXT NOT NULL,
  probability NUMERIC(5,4) NOT NULL,
  category TEXT NOT NULL,
  supporting_signals JSONB,
  was_used BOOLEAN DEFAULT false,
  was_correct BOOLEAN,        -- null until outcome known
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. Learning Model

### 4.1 Three Options Evaluated

The council evaluated three models for how Experience Memory learns:

| Model | Description | Vote |
|-------|-------------|------|
| **A — Individual only** | Each MIA learns from its own business only | Postponed |
| **B — Global memory only** | All businesses contribute to a shared pool | Rejected |
| **C — Hybrid** | 70% global/industry base + 30% business-specific | **Approved** |

### 4.2 Model C (Hybrid) — Architecture

```
New MIA instance
      │
      ▼
┌─────────────────────┐
│  Industry Base      │  70% weight — pre-seeded from aggregated
│  (probability       │  industry patterns, no customer data
│   tables)           │
└────────┬────────────┘
         │
┌────────▼────────────┐
│  Business-Specific  │  30% weight — populated from own
│  (experience_memory │  conversations, full RLS, never shared
│   WHERE scope='business')
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Combined Engine    │  Union of both tiers, business patterns
│  Runtime            │  override global for conflicting signals
└─────────────────────┘
```

**Why Model B was rejected**: Regulatory risk (customer data could cross business boundaries), business distrust of shared data, and pattern pollution (a shoe store's patterns are irrelevant to a health business).

**Why Model C was approved**: Balances onboarding speed (new MIA starts with industry patterns) with business-specific adaptation. The 70/30 ratio is configurable per business.

### 4.3 Privacy Boundaries

| Tier | Contains | Shared? |
|------|----------|---------|
| **Global** | Published probability tables only — no raw signals, no customer IDs, no business IDs | Visible to ALL businesses |
| **Industry** | Published probability tables only — aggregated per vertical | Visible to businesses in that vertical |
| **Business** | Raw signals + patterns + probabilities | Visible ONLY to that business (RLS enforced) |

Business-tier data NEVER contributes to global/industry tiers without explicit opt-in.

### 4.4 New Business Onboarding Flow

1. New business registers → no experience data
2. Engine uses **Industry Base** probability tables (pre-seeded by MIA team)
3. After ~1,000 conversations, business-tier patterns reach statistical significance (Wilson CI)
4. Engine blends: industry base + business-specific (ratio shifts toward business over time)
5. After ~10,000 conversations, business patterns dominate for high-confidence signals

---

## 5. Token Impact Analysis

### 5.1 Heuristic Context Injection Cost

The `## Análisis Heurístico` section adds approximately:

| Component | Tokens |
|-----------|--------|
| Section header + formatting | ~30 |
| Signals (avg 3) | ~60 |
| Hypotheses (avg 3) | ~150 |
| Question recommendations (avg 1) | ~30 |
| Strategy adjustments (avg 2) | ~80 |
| **Total per turn** | **~350** |

### 5.2 Payback Calculation

The heuristic section increases per-turn cost by ~350 tokens (≈$0.00005 at gpt-4o-mini rates).

**But** if better questions lead to:
- 1 fewer turn per conversation (avg 12 → 11 turns)
- 5% higher conversion rate
- 3% fewer returns (fewer post-purchase conversations)

Then the token cost is recovered within 2-3 turns of better-targeted recommendations.

Scenario:
- 1,000 conversations/month × 12 turns avg × 350 tokens = ~4.2M extra tokens ≈ $0.63/month
- 5% higher conversion on 1,000 conversations = 50 more sales
- ROI is positive if average margin per sale > $0.01

**Token cost is negligible relative to potential revenue impact.**

---

## 6. Compare-and-Contrast: Without vs With Heuristic Engine

### Scenario: Customer starts with "Necesito zapatos cómodos"

```
WITHOUT HEURISTIC ENGINE:

Customer: "Necesito zapatos cómodos para trabajar"
MIA:     "Tenemos varios modelos. ¿Buscas algo formal o casual?"
Customer: "Formal"
MIA:     "El modelo Ejecutivo tiene plantilla acolchonada. $1,299."
Customer: "Está bien, lo voy a pensar"
         ─── Abandona (no se abordó la necesidad real)
```

```
WITH HEURISTIC ENGINE:

Señales detectadas:
  - usage_context: work (explicit)
  - pain_point: comfort (explicit)
  - inferred: standing_hours (probable, 65%)

Hipótesis:
  - [75%] Necesita soporte prolongado → priorizar amortiguación
  - [60%] Puede tener dolor en pies/talones → validar antes de recomendar
  - [55%] Presupuesto medio-alto (inversión en salud) → no leadear con precio

Customer: "Necesito zapatos cómodos para trabajar"
MIA:     "Entiendo. ¿Estás muchas horas de pie?"
         (pregunta dirigida a hipótesis #1: valor alto, fricción baja)
Customer: "Sí, 8 horas o más"
MIA:     "Para jornadas largas, la amortiguación es clave.
          Nuestro modelo『Jornada Pro』tiene tecnología de absorción
          de impacto. Justo lo que necesitas para reducir la fatiga."
Customer: "Suena bien, ¿cuánto cuesta?"
         ─── Sigue en conversación (necesidad real abordada)
```

The difference: MIA didn't just list products. She **interpreted the situation** and **asked a strategic question** that let her recommend with confidence.

### Scenario: Health/Wellness — "Mis uñas cambiaron"

```
WITHOUT HEURISTIC ENGINE:

Customer: "Tengo 62 años y mis uñas cambiaron de color"
MIA:     "Entiendo. Tenemos productos para el cuidado de uñas."
Customer: "¿Cuál me recomiendas?"
MIA:     "El kit de tratamiento completo cuesta $899."
Customer: "¿Y en cuánto tiempo veo resultados?"
MIA:     "Los resultados varían según cada persona."
         ─── Insatisfacción (expectativas no manejadas)
```

```
WITH HEURISTIC ENGINE:

Señales detectadas:
  - age: 60+ (explicit)
  - concern: nail appearance (explicit)
  - inferred: duration >6 months (probable, 70%)
  - inferred: may have tried OTC products (probable, 55%)

Hipótesis:
  - [80%] Expectativa de plazo irrealista por edad → ajustar
  - [65%] Puede haber frustración por intentos previos
  - [60%] Motivación estética + salud

Estrategia:
  - Explicar proceso biológico primero
  - Manejar expectativas de plazo
  - NO prometer resultados rápidos

Customer: "Tengo 62 años y mis uñas cambiaron de color"
MIA:     "Entiendo. Con la edad, el crecimiento de la uña se vuelve
          más lento, pero los cambios se pueden tratar.
          ¿Hace cuánto empezaste a notarlo?
          (Pregunto porque el tiempo ayuda a entender el tipo de cuidado)"
Customer: "Como 4 meses"
MIA:     "Bien. En 4 meses de cambio gradual, lo más probable es que
          sea un proceso natural. Nuestro tratamiento está formulado
          justo para esto, pero es importante que sepas que al ser un
          proceso biológico, los resultados visibles toman
          aproximadamente 3-4 meses de uso constante.
          ¿Te gustaría que te explique cómo funciona?"
Customer: "Sí, explícame"
         ─── Expectativas manejadas, cliente educado, confianza construida
```

---

## 7. Implementation Plan

### Phase 1: ContextLayer + SignalExtractor + ProfileUpdater (read-only)
1. Build `ConversationStage` classifier with initial rules (~20 lines)
2. Build `SignalExtractor` with initial pattern library (~30 patterns)
3. Add `heuristic_signals` JSONB to `customers` (migration)
4. Integrate into runtime: classify stage, extract signals, update profile, no prompt changes yet

### Phase 2: Heuristic Context Injection + TrustRule
1. Build `HypothesisEngine` with initial Bayesian matrix
2. Build `QuestionSelector` with initial question catalog (~10 questions) + TrustImpact scoring
3. Add Trust Rule to prompt template ("una pregunta siempre debe comprar confianza")
4. Add `## Análisis Heurístico` section to prompt builder
5. Integrate into runtime: inject heuristic context into prompt

### Phase 3: Experience Memory (Business Tier)
1. Create `experience_memory` table with `scope` column (migration)
2. Build background batch processor for business-tier aggregation
3. Publish first probability tables per business
4. Add dashboard to view learned business patterns

### Phase 4: Experience Memory (Global/Industry) + Hybrid Learning
1. Create global and industry probability table seeding (MIA team)
2. Build industry-level aggregator (across businesses in same vertical)
3. Implement hybrid combination engine (70/30 blend)
4. Build global pattern publisher

---

## 8. Impact Analysis

### 8.1 Positive Impacts

| Area | Impact |
|------|--------|
| **Conversion** | Strategic questions → better recommendations → higher conversion |
| **Customer experience** | MIA feels like a knowledgeable salesperson, not a FAQ bot |
| **Return reduction** | Better expectation management → fewer disappointed customers |
| **Sales intelligence** | Every conversation generates signals that improve future conversations |
| **Product independence** | Works for shoes, health, real estate, wholesale — same engine, different patterns |

### 8.2 Negative Impacts

| Area | Impact |
|------|--------|
| **Token cost** | ~350 extra tokens per turn for heuristic context |
| **Latency** | Signal extraction + hypothesis generation adds ~50-100ms per turn |
| **Complexity** | New subsystem with 5 components + 2 new tables |
| **Data quality** | Bad signal extraction → bad hypotheses → bad recommendations |

### 8.3 Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Over-questioning (interrogation feeling) | Medium | QuestionSelector hard-limits to 3 per 5 turns. No exceptions. |
| False signals from ambiguous text | Medium | Confidence thresholds. Low-confidence signals are tagged as `inferred` and not used for strategy changes. |
| Experience memory noise (small sample) | Medium | Wilson confidence interval; patterns with <30 samples are not published. |
| Bias amplification | Low | Experience memory tracks outcomes but does NOT encode demographic bias. Signal patterns must be reviewed for fairness. |
| Business-specific patterns don't emerge | Low | Fallback: industry base probability table works for any vertical. Specific patterns are a bonus. |

### 8.4 Technical Impact

| Component | Change | Effort |
|-----------|--------|--------|
| `src/lib/heuristic/context.ts` | **New** — ConversationStage classifier | Small |
| `src/lib/heuristic/extractor.ts` | **New** — SignalExtractor with pattern library | Medium |
| `src/lib/heuristic/engine.ts` | **New** — HypothesisEngine (Bayesian matrix) | Medium |
| `src/lib/heuristic/questions.ts` | **New** — QuestionSelector + catalog + TrustImpact | Medium |
| `src/lib/heuristic/profile.ts` | **New** — ProfileUpdater | Small |
| `src/lib/heuristic/memory.ts` | **New** — Experience Memory (batch, 3-tier) | Large |
| `src/lib/runtime/runtime.ts` | Integrate full pipeline (stage → extract → hypothesize → select → update) | Medium |
| `src/lib/ai/prompts.ts` | Add Trust Rule + `## Análisis Heurístico` | Small |
| `src/lib/conversation/context.ts` | Pass heuristic context to prompt builder | Small |
| `supabase/migrations/` | `experience_memory` table + `heuristic_signals` + `heuristic_hypotheses_log` | Small |
| Dashboard | Experience Memory viewer + pattern browser per scope | Medium |

---

## 9. Relationship to Other ADRs

| ADR | Relationship |
|-----|-------------|
| **ADR-003** (Conflict Resolution) | Independent — heuristic context is added AFTER conflict resolution |
| **ADR-004** (Health Policy) | **Synergistic** — heuristic engine detects health-related signals and can trigger health policy earlier and more naturally |
| **ADR-005** (Channel Abstraction) | Independent — heuristic engine operates on the message, not the channel |
| **ADR-006** (CCP) | **Synergistic** — heuristic context can be stored in CCP checkpoints; on reconnection, the heuristic state is restored along with the conversation summary |
| **ADR-008** (Conversation Center) | **Synergistic** — heuristic data feeds the Conversation Center's agent transfer view (ADR-006, section 6.3). Heuristic Engine should be implemented BEFORE Conversation Center. |

---

## 10. Council Notes

### v1.0 (Original Proposal)

- **CTO**: The transformation from reactive to proactive is the single biggest leap in MIA's conversational quality. The Bayesian approach is correct — it's interpretable, auditable, and does not require expensive model calls for every turn. Approve, but Phase 1 only (SignalExtractor) before committing to full pipeline.
- **AI Engineer**: The 350-token overhead per turn is a worthwhile investment. However, the signal extraction should remain rule-based — using the AI model for signal extraction would add 500+ tokens and defeat the purpose. Rule-based extraction is fast (<5ms), cheap (free), and auditable.
- **Product Manager**: The 2-3 question limit per 5 turns is essential. Every question must pass the "can the answer change what I recommend?" test. The "Explain why asking" pattern is non-negotiable — without it, questions feel like an interrogation.
- **Domain Expert**: The product independence claim is credible but needs validation. Signal patterns for health ("¿desde cuándo?") differ from wholesale ("¿qué volumen?"). The question catalog must be extensible per vertical. The engine architecture supports this, but the initial catalog should cover at least 3 verticals.
- **Performance Engineer**: The latency impact is acceptable. Signal extraction is O(n) on message length (~1ms per word). Bayesian combination is O(h×s) where h=hypotheses, s=signals (~0.1ms). Total under 5ms for typical messages. The ~350 token prompt increase is the dominant cost, but the payback analysis shows net positive ROI.

### v1.1 (Council Review — 2026-07-29)

The council reconvened to evaluate 7 evolution proposals for the Heuristic Engine. All members voted unanimously to approve with modifications:

| Member | Vote | Key position |
|--------|------|-------------|
| **CTO** | ✅ Approve | "La capa de contexto es la pieza que faltaba. Aprobado con fases." |
| **Architect** | ✅ Approve | "El pipeline de 5 etapas es correcto. ContextLayer → SignalExtractor es la descomposición correcta." |
| **AI Engineer** | ✅ Approve | "Mantener rule-based para extracción y clasificación. Sin AI en el pipeline heurístico." |
| **Domain Expert** | ✅ Approve | "Modelo C es la única opción viable para escalar sin sacrificar privacidad." |
| **Product Manager** | ✅ Approve | "Trust Rule no es opcional. Si una pregunta no explica por qué, MIA no la hace." |
| **Security Engineer** | ✅ Approve | "Global/industry tier: solo tablas de probabilidad, sin datos crudos. Business tier: RLS completo." |
| **Performance Engineer** | ✅ Approve | "Pipeline completo <50ms en peor caso. Aceptable." |

**Changes approved for v1.1**:
1. Added Conversational Context Layer (ConversationStage classifier) as pipeline stage 0
2. Renamed Heuristic Memory → Experience Memory with 3-tier scope (global/industry/business)
3. Adopted Model C (Hybrid) for learning: 70% global/industry base + 30% business-specific
4. Added Trust Rule: every question must include an explanation of why it's asked
5. Added TrustImpact to QuestionSelector formula; questions with TrustImpact < 0.5 are never selected
6. Updated implementation plan: 4 phases with ContextLayer in Phase 1
7. Updated data model: `experience_memory` table with `scope` column

---

## 11. Open Questions

1. Should the heuristic context be injected on EVERY turn, or only when the engine detects a significant state change (new high-confidence hypothesis, strategy adjustment)?
2. Should the question catalog be seeded by the platform (generic) or configured per business (specific)?
3. Should customers be able to opt out of heuristic profiling? (Privacy consideration for the `heuristic_signals` data.)
4. Should the engine expose an API for human agents to see heuristic context when taking over a conversation?

**Resolved questions** (from v1.0, now answered):
- ~~Should the heuristic memory be shareable across businesses in the same vertical?~~ **Answered**: Yes — industry tier in Experience Memory, with strict privacy boundaries. No customer-level data crosses business boundaries.

---

## 12. Comparison: Without vs With Heuristic Engine

| Dimension | Without | With |
|-----------|---------|------|
| **Reactivity** | Answers questions only | Asks strategic questions |
| **Personalization** | Based on explicit data only | Based on explicit + inferred + patterns |
| **Adaptation** | None — same approach throughout | Adapts strategy per customer |
| **Learning** | None per-conversation | Accumulates signals across conversations |
| **Expectation mgmt** | Reactive (only if customer asks) | Proactive (before customer asks) |
| **Cost** | Baseline | +~350 tokens/turn (net positive via conversion) |
| **Perceived intelligence** | FAQ bot | Knowledgeable salesperson |

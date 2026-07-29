# ADR-007 v1.1 — Council Review

## Session Date

2026-07-29

## Council Present

CTO, Architect, AI Engineer, Domain Expert, Product Manager, Security Engineer, Performance Engineer

---

## Background

ADR-007 (Heuristic Engine) proposed a 4-stage pipeline (SignalExtractor → HypothesisEngine → QuestionSelector → ProfileUpdater) that injects heuristic context into MIA's prompt. The council convened to evaluate 7 proposed evolutions before Phase 1 implementation begins.

---

## Review of 7 Proposals

### 1. Conversational Context Layer (New Pre-Processing Stage)

**Proposal**: Add a stage before SignalExtractor that classifies the conversation state — first contact, exploring, comparing, objection, ready to buy, post-sale, claim, information-seeking — so that the same signal is interpreted differently depending on context.

**Council Position**: **Approve — critical addition**

The same customer message means different things at different stages:

| Context State | "¿Cuánto cuesta?" means... |
|-------------|---------------------------|
| `exploring` | Price check, comparing options |
| `comparing` | Competitive price validation |
| `ready_to_buy` | Closing signal, needs final confirmation |
| `information` | Factual inquiry, may not be buying |

Without context classification, the engine treats all signals identically. This is the single most important refinement to the original ADR.

**Adopted changes**:
- `ConversationStage` type added to the pipeline
- Stage determined by: signal analysis, turn count, customer history, explicit intent keywords
- Stage influences hypothesis probability weights and question selection priority
- Fallback: `exploring` if stage cannot be determined

**CTO**: "This is what makes the engine work. Without it, a customer saying 'cuánto cuesta' at the closing stage gets the same response as one exploring. That's the difference between a bot and a salesperson."

---

### 2. Experience Memory (Evolution of Heuristic Memory)

**Proposal**: Evolve Heuristic Memory from a per-business pattern store into a three-tier Experience Memory: global patterns (all MIA), industry patterns (vertical-specific), and business patterns (tenant-specific).

**Council Position**: **Approve — rename and restructure**

The term "Heuristic Memory" is retained for the engine component. The storage layer is renamed to **Experience Memory** to reflect that it stores accumulated commercial experience, not just statistical patterns.

**Three tiers**:

| Tier | Scope | Source | Privacy |
|------|-------|--------|---------|
| **Global** | All MIA instances | Aggregated, anonymized patterns from all businesses | No customer data, no business-identifiable data |
| **Industry** | Vertical (shoes, health, wholesale, etc.) | Aggregated, anonymized patterns within vertical | No customer data, industry-level only |
| **Business** | Single tenant | Patterns from the business's own conversations | Full RLS, business-owns |

**Security Engineer**: "Global and Industry tiers must be strictly aggregated. No raw signal data, no customer IDs, no business IDs. Only published probability tables with minimum sample thresholds."

**Adopted changes**:
- `heuristic_memory` table renamed to `experience_memory` (in ADR, actual table renamed in migration)
- Added `scope` column: `'global' | 'industry' | 'business'`
- Added `industry` column for industry-tier patterns
- Global patterns seeded by MIA team (not auto-generated)
- Privacy: business-tier data never contributes to global/industry without explicit opt-in

---

### 3. Learning Model — Three Options Evaluated

| Model | Description | Council Vote |
|-------|-------------|--------------|
| **A — Individual only** | Each MIA learns from its own business only | Postponed |
| **B — Global memory only** | All businesses contribute to a shared pool | Rejected |
| **C — Hybrid** | 70% global/industry base + 30% business-specific | **Approved** |

**Why Model B was rejected**: Regulatory risk (customer data could cross business boundaries), business distrust of shared data, and potential for pattern pollution (a shoe store's patterns are irrelevant to a health business).

**Why Model C was approved**: It balances onboarding speed (new MIA starts with industry patterns) with business-specific adaptation. The 70/30 ratio is configurable per business.

**Model C architecture**:

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

**Domain Expert**: "The industry tier is what makes this practical. A new shoe business shouldn't wait 6 months to accumulate useful patterns. But the business tier is what makes it accurate. Both are needed."

---

### 4. Trust Rule: "Una pregunta siempre debe comprar confianza"

**Proposal**: Every question MIA asks must be accompanied by an explanation of why it's being asked. A question without context is interrogation; a question with explanation is advice.

**Council Position**: **Approved — elevated from recommendation to platform rule**

This becomes an enforced pattern in the prompt:

```diff
+ ## Regla de Confianza
+ Cuando hagas una pregunta al cliente, explica brevemente por qué la haces.
+ 
+ ❌ "¿Qué edad tienes?"
+ ✅ "Te pregunto tu edad porque el ritmo de crecimiento de la uña
+     cambia con los años. Así puedo darte una expectativa realista."
+ 
+ ❌ "¿Cuánto es tu presupuesto?"
+ ✅ "Pregunto tu presupuesto para recomendarte la opción que mejor
+     se ajuste sin mostrarte algo fuera de tu rango."
```

**Product Manager**: "This is the difference between being helpful and being creepy. A question with context builds trust. A question without it feels like data extraction. This rule is non-negotiable."

**Token impact**: +20-40 tokens per question turn. Negligible.

---

### 5. Updated QuestionSelector Formula

**Proposal**: Add `TrustImpact` to the scoring formula.

**Current**:
```
QuestionScore = (InformationValue × ConversionImpact) / CustomerFriction
```

**Proposed**:
```
QuestionScore = (InformationValue × ConversionImpact × TrustImpact) / CustomerFriction
```

**Council Position**: **Approved**

**TrustImpact** (0.1 — 1.0) measures whether asking this question builds or erodes the relationship:

| Question example | TrustImpact | Rationale |
|-----------------|-------------|-----------|
| "¿Desde cuándo tienes la molestia?" (con explicación) | 0.9 | Shows genuine interest, enables better recommendation |
| "¿Cuánto dinero quieres gastar?" (sin contexto) | 0.2 | Feels transactional, interrogative |
| "¿Para qué uso necesitas el producto?" (con explicación) | 0.85 | Shows expertise, helps customer |
| "¿Dónde vives?" (sin explicación de por qué) | 0.3 | Feels invasive |

A question with `TrustImpact < 0.5` is never selected, regardless of InformationValue.

**Performance Engineer**: "This adds a constant-time multiplication. Zero performance impact."

---

### 6. Impact Assessment — 5 Questions

#### Q1: ¿Esta evolución acerca realmente a MIA a un comportamiento parecido al de un vendedor experto?

**Council**: Sí — pero con una distinción importante. El vendedor experto tiene intuición formada por años de experiencia. MIA tendrá una aproximación matemática basada en datos. No son equivalentes, pero el comportamiento observable será similar: hará preguntas relevantes en el momento correcto, se adaptará al cliente, y no repetirá el mismo guion para todos.

La capa de Contexto Conversacional es el componente que más contribuye a esta sensación, porque permite que MIA interprete la *misma* frase de manera diferente según el momento de la conversación.

#### Q2: ¿Existe riesgo de sobreingeniería?

**Council**: Sí — y por eso las fases son críticas.

| Riesgo | Fase donde aparece | Mitigación |
|--------|-------------------|------------|
| Demasiadas capas antes de ver valor real | Fase 1 | ContextLayer + SignalExtractor solos ya dan valor (señales estructuradas en perfil) |
| Experience Memory demasiado compleja para Fase 1 | Fase 3 | No se implementa hasta que haya datos suficientes (mínimo 1,000 conversaciones por negocio) |
| Hybrid learning agrega latencia de consulta | Fase 4 | Las tablas de probabilidad se publican, no se consultan en tiempo real. La combinación es O(1). |

**Regla**: Si una capa no demuestra mejora medible en 2 semanas de producción, se simplifica o se elimina.

#### Q3: ¿Qué partes deben implementarse ahora y cuáles deben esperar?

| Componente | Cuándo | Por qué |
|-----------|--------|---------|
| ConversationStage classification | **Fase 1** | Barato, ~20 líneas de reglas, impacto inmediato |
| SignalExtractor (~30 patterns) | **Fase 1** | Base de todo el pipeline |
| QuestionSelector (básico) | **Fase 2** | Sin hypothesis engine no hay preguntas que seleccionar |
| TrustRule en prompt | **Fase 2** | Bajo esfuerzo, alto impacto |
| TrustImpact en fórmula | **Fase 2** | Cambio de una línea |
| HypothesisEngine (Bayesian) | **Fase 2** | Requiere señales del extractor |
| Experience Memory (business) | **Fase 3** | Requiere ~1,000 conversaciones acumuladas |
| Experience Memory (global/industry) | **Fase 4** | Requiere múltiples businesses con datos |
| Hybrid learning | **Fase 4** | Depende de Experience Memory global |

#### Q4: ¿Conviene crear esta capa antes o después del Conversation Center (ADR-008)?

**Council**: **Antes**. La Heuristic Engine debe existir y generar señales/hipótesis antes de que el Conversation Center tenga algo que mostrar. Además, el Conversation Center se beneficia de tener datos heurísticos para mostrar a los agentes humanos (ver ADR-006, section 6.3 — agent transfer).

Secuencia correcta:
1. ADR-005 (Channel Abstraction)
2. ADR-006 (CCP)
3. **ADR-007 (Heuristic Engine)**
4. ADR-008 (Conversation Center)

#### Q5: ¿Cómo debería documentarse para mantener la arquitectura escalable?

**Council**: Cada componente del pipeline debe tener:
- Interfaz TypeScript bien definida en `src/lib/heuristic/types.ts`
- Implementación en archivo separado (`extractor.ts`, `context.ts`, `engine.ts`, `questions.ts`, `profile.ts`)
- Pruebas unitarias con fixtures de mensajes reales
- Documentación de patrones en el código (no en wiki)
- Métricas de performance por etapa (<5ms por etapa como SLO)

El archivo central `heuristic/types.ts` será la fuente de verdad para las interfaces.

---

### 7. Final Recommendation

## **Modify y Approve**

ADR-007 v1.0 es aprobada en concepto con las siguientes modificaciones:

### Cambios aprobados

| # | Cambio | Sección afectada |
|---|--------|-----------------|
| 1 | Agregar **Conversational Context Layer** como etapa previa al SignalExtractor | 2.1 Architecture, 2.3 Pipeline |
| 2 | Agregar `ConversationStage` type y clasificador | 2.3.1, types |
| 3 | Renombrar Heuristic Memory → **Experience Memory** con 3 scopes (global/industry/business) | 2.4, 3.1, 4 |
| 4 | Adoptar **Modelo C (Híbrido)** para aprendizaje | Sección 4 nueva |
| 5 | Agregar **Trust Rule** como regla de plataforma (pregunta con explicación obligatoria) | 2.5, prompt section |
| 6 | Agregar **TrustImpact** a QuestionSelector formula | 2.3.3 |
| 7 | Actualizar plan de fases — ahora 4 fases con ContextLayer en Fase 1 | 6 |

### Votación

| Miembro | Voto | Notas |
|---------|------|-------|
| CTO | ✅ Approve | "La capa de contexto es la pieza que faltaba. Aprobado con fases." |
| Architect | ✅ Approve | "El pipeline de 5 etapas es correcto. La separación ContextLayer → SignalExtractor es la descomposición correcta." |
| AI Engineer | ✅ Approve | "Mantener rule-based para extracción y clasificación. Sin AI en el pipeline heurístico." |
| Domain Expert | ✅ Approve | "Modelo C es la única opción viable para escalar sin sacrificar privacidad." |
| Product Manager | ✅ Approve | "Trust Rule no es opcional. Si una pregunta no explica por qué, MIA no la hace." |
| Security Engineer | ✅ Approve | "Global/industry tier: solo tablas de probabilidad, sin datos crudos. Business tier: RLS completo." |
| Performance Engineer | ✅ Approve | "Pipeline completo <50ms en peor caso. Aceptable." |

**Unanimous — Approve with modifications**

---

## Updated ADR-007 v1.1

The following changes are applied to `docs/adr/007-heuristic-engine.md` to produce v1.1.

[See diff in ADR-007 document — all modifications applied below]

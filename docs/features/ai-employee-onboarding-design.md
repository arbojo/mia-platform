# Intelligent Onboarding Experience

**Date:** 2026-07-27
**Status:** Proposed
**Sprint:** 3 — AI Employee Experience
**Complexity:** Medium
**Impact:** 3 files modified, 2 new files

---

## 1. Current State

### 1.1 Current Onboarding Flow

The current `OnboardingWizard.tsx` is a 4-step form wizard:

1. **Personalidad** — Name, personality selection, communication style
2. **Tu Negocio** — Business name, description, target customers, differentiators, elevator pitch
3. **Tus Productos** — Add products with name, price, description, benefits
4. **Reglas** — Add sales rules by category

### 1.2 Problems

| # | Problem | Severity |
|---|---------|----------|
| 1 | Feels like filling a form, not talking to an assistant | High |
| 2 | Too many fields at once — overwhelming for non-technical users | High |
| 3 | No guidance on what to write | Medium |
| 4 | No feedback on completeness | Medium |
| 5 | Business owner must understand what "elevator pitch" means | Medium |
| 6 | Products added one by one — tedious for businesses with many products | Low |

---

## 2. Engineering Council Analysis

### 2.1 CTO — Architecture

**Decision:** Replace form wizard with conversational flow.

**Rationale:**
- The form wizard works but doesn't feel like "hiring an employee"
- A conversational flow is more natural for business owners
- The backend logic (creating business, assistant, products, rules) stays the same
- Only the UI layer changes

### 2.2 Product Manager — Journey

**Ideal Journey:**
```
User: "Vendo zapatos"
MIA: "¡Qué bien! ¿Qué tipo de zapatos vendes?"
User: "Zapatos deportivos para hombre y mujer"
MIA: "¿A quién se los vendes? ¿Cuál es tu cliente ideal?"
User: "Gente joven, 18-35 años, que hace ejercicio"
MIA: "Perfecto. ¿Tienes precios fijos o varían?"
User: "Tenemos precios fijos, desde $500 hasta $2000"
MIA: "¿Hay algo que te haga diferente a otras zapaterías?"
User: "Damos garantía de 6 meses y envío gratis en la ciudad"
MIA: "Excelente. Ya tengo suficiente para empezar. ¿Cómo quieres que se llame tu asistente?"
User: "Que se llame Luna"
MIA: "Luna está lista. ¿Quieres probar cómo respondería a un cliente?"
```

**Output:** Structured data (business, products, rules) created from natural conversation.

### 2.3 AI Engineer — Implementation

**Approach:**
- Use gpt-4o-mini to extract structured data from conversation
- Multi-turn conversation with state tracking
- At each step, extract relevant fields
- When enough information is gathered, create entities in database

**Prompt Strategy:**
- System prompt defines the onboarding flow
- Each user message is analyzed for extractable information
- MIA asks targeted questions based on what's missing
- When confidence is high enough, MIA confirms and saves

### 2.4 Database Engineer — Schema

**No schema changes needed.** The existing tables support the conversational onboarding:
- `businesses` — business info
- `brand_identities` — brand info
- `products` — products
- `sales_rules` — rules
- `ai_instructions` — instructions
- `knowledge_items` — knowledge from conversation

---

## 3. Recommended Architecture

### 3.1 New Component: `ConversationalOnboarding`

Replace `OnboardingWizard` with a chat-based interface.

**Flow:**
1. User sees a chat window with MIA
2. MIA asks questions one at a time
3. User responds naturally
4. MIA extracts structured data from responses
5. When enough data is gathered, MIA confirms and creates entities
6. User can correct or add more information
7. MIA shows readiness score when done

### 3.2 API Route: `/api/onboarding/chat`

Handles the conversational flow:
- Receives user message + conversation history
- Uses gpt-4o-mini to generate next question
- Extracts structured data from conversation
- Returns: next message + extracted data + completion status

### 3.3 State Machine

```
START → ASK_BUSINESS → ASK_PRODUCTS → ASK_RULES → ASK_PERSONALITY → CONFIRM → COMPLETE
```

Each state has:
- A question to ask
- Data to extract
- Next state based on response

---

## 4. User Flow

### 4.1 New User
```
/dashboard/onboarding
  → Chat window appears
  → MIA: "¡Hola! Soy MIA. Cuéntame sobre tu negocio."
  → User describes business
  → MIA asks follow-up questions
  → MIA creates business, products, rules
  → MIA: "Tu asistente está lista. ¿Quieres probarla?"
```

### 4.2 Returning User (incomplete onboarding)
```
/dashboard/onboarding
  → Chat window appears
  → MIA: "Bienvenido de vuelta. Continuemos donde nos quedamos."
  → MIA reviews what was already configured
  → MIA asks for missing information
```

---

## 5. Files to Modify

| File | Change |
|------|--------|
| `src/components/onboarding/ConversationalOnboarding.tsx` | **NEW** — Chat-based onboarding component |
| `src/app/api/onboarding/chat/route.ts` | **NEW** — API route for conversational flow |
| `src/app/dashboard/onboarding/page.tsx` | Update to use ConversationalOnboarding |
| `src/components/onboarding/OnboardingWizard.tsx` | Keep as fallback (remove from nav) |

---

## 6. Cost

- ~$0.001 per onboarding conversation (gpt-4o-mini)
- 10-15 messages average = ~$0.015 per user

---

## 7. Success Criteria

- [ ] User can describe business in natural language
- [ ] MIA extracts structured data from conversation
- [ ] Business, products, and rules are created correctly
- [ ] User can correct extracted information
- [ ] Onboarding feels like talking to a new employee
- [ ] No technical concepts exposed to user

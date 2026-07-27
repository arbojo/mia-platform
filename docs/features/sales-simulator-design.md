# AI Sales Simulator

**Date:** 2026-07-27
**Status:** Proposed
**Sprint:** 3 — AI Employee Experience
**Complexity:** Medium
**Impact:** 4 files modified, 1 new file

---

## 1. Current State

### 1.1 Laboratory MIA (Existing)
- Chat interface with AI assistant
- 4 simulation modes (Normal, Indeciso, Complicado, Cliente Exigente)
- Response analysis (5 criteria, 1-10 scale)
- Session evaluation with scores
- Teach modal for corrections
- Token usage tracking
- Session history

### 1.2 Problems

| # | Problem | Severity |
|---|---------|----------|
| 1 | Named "Laboratorio" — sounds technical, not like training | High |
| 2 | No guided scenarios — user must think of what to ask | High |
| 3 | No "readiness" assessment — user doesn't know if AI is ready | Medium |
| 4 | No coaching feedback — just scores | Medium |
| 5 | No comparison between modes | Low |

---

## 2. Engineering Council Analysis

### 2.1 CTO — Architecture

**Decision:** Refactor Laboratory into Simulator.

**Rationale:**
- The existing Lab has 90% of the required functionality
- Renaming + UX improvements = significant perceived value
- Add guided scenarios and coaching = real training value
- No schema changes needed

### 2.2 Product Manager — Journey

**Ideal Journey:**
```
User opens "Simulador"
  → Sees: "Entrena a tu asistente como si fuera un empleado nuevo"
  → Selects scenario: "Cliente pregunta por precio"
  → Simulator generates customer message
  → AI responds
  → Simulator evaluates response
  → Shows coaching feedback: "Buena respuesta. Podrías agregar el beneficio del producto."
  → User can approve, correct, or try again
```

### 2.3 AI Engineer — Coaching

**Coaching Feedback:**
- After each response, generate 1-2 specific improvement suggestions
- Focus on: product knowledge, empathy, sales technique, rule following
- Keep suggestions actionable and positive

**Predefined Scenarios:**
| Scenario | Customer Message | Focus |
|----------|-----------------|-------|
| Precio | "¿Cuánto cuesta?" | Product knowledge, value proposition |
| Envío | "¿Hacen envíos?" | Rules, logistics |
| Garantía | "¿Tiene garantía?" | Product knowledge, trust |
| Comparación | "¿Por qué ustedes y no la competencia?" | Differentiators, sales |
| Objeción | "Me parece caro" | Objection handling, value |
| Urgencia | "Lo necesito para hoy" | Schedule, rules |
| No sé | "No sé qué necesito" | Consultative selling |

---

## 3. Recommended Architecture

### 3.1 Rename & Rebrand
- Rename "Laboratorio MIA" → "Simulador de Ventas"
- Update sidebar navigation
- Update page title and descriptions

### 3.2 Guided Scenarios
Add a `ScenariosPanel` component:
- List of predefined scenarios
- Each scenario has: name, customer message, focus area
- User selects a scenario → simulator starts with that customer message

### 3.3 Coaching Feedback
Add coaching to `SessionEvaluation`:
- After each response, AI generates 1-2 improvement suggestions
- Display as actionable tips, not just scores
- Example: "Podrías mencionar el beneficio del producto para justificar el precio"

### 3.4 Readiness Assessment
After 5+ messages in a session:
- Calculate overall readiness score
- Show: "Tu asistente está X% lista para vender"
- Highlight areas for improvement

---

## 4. Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/Sidebar.tsx` | Rename "Laboratorio MIA" → "Simulador de Ventas" |
| `src/app/dashboard/laboratorio/page.tsx` | Update page title |
| `src/components/laboratorio/LaboratorioClient.tsx` | Add scenarios panel, coaching feedback |
| `src/components/laboratorio/ScenariosPanel.tsx` | **NEW** — Predefined scenarios list |
| `src/components/laboratorio/CoachingFeedback.tsx` | **NEW** — Actionable improvement tips |

---

## 5. Cost

- Coaching feedback: ~$0.001 per message (gpt-4o-mini)
- Scenarios: No additional cost (predefined prompts)

---

## 6. Success Criteria

- [ ] Simulator feels like training, not testing
- [ ] User can select predefined scenarios
- [ ] AI provides actionable coaching feedback
- [ ] Readiness score shows progress
- [ ] No technical concepts exposed

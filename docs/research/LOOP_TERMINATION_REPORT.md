# Loop Termination Analysis for MIA

**Document**: LOOP_TERMINATION_REPORT  
**Module**: MIA Conversational Sales AI  
**Date**: 2026-08-25  
**Status**: Research  
**References**: `src/lib/runtime/runtime.ts`, `src/lib/sales/detect.ts`, `src/lib/sales/process.ts`, `docs/research/kb/transiciones.md`, `docs/research/kb/estados.md`, `docs/research/kb/observables.md`

---

## 1. Current Problem

MIA currently has **no loop detection** mechanism. The state machine tracks transitions and outcomes (`src/lib/sales/detect.ts`), but only classifies conversations **post-conversation**. During an active conversation:

- A customer can cycle between states indefinitely
- No mechanism detects when a customer is stuck
- No mechanism breaks loops gracefully
- The agent has no signal to change strategy mid-conversation

This creates risk of infinite loops, customer frustration, and wasted compute.

---

## 2. Types of Loops

### 2.1 Natural Loops (Healthy)

Loops that occur during normal decision-making. These are **intentional** revisitations and should **not** be terminated prematurely.

| Pattern | Prior | Description |
|---------|-------|-------------|
| `comparando ⇄ evaluando_riesgo` | 0.55 | Customer alternates between comparing options and assessing risk |
| `decidiendo → comparando` | 0.20 | Customer has second thoughts, returns to comparison |
| `evaluando_riesgo → comparando` | 0.15 | Risk assessment triggers re-evaluation of options |

**Characteristics**:
- Each cycle produces **new information** (different risk, different option)
- Dwell time per state is **short** (1-2 turns)
- Observable signals **evolve** across cycles (new concerns, refined preferences)

### 2.2 Stuck Loops (Unhealthy)

Loops where the customer is not progressing. These require **intervention**.

| Pattern | Detection | Severity |
|---------|-----------|----------|
| `confundido` persists | Same state > 3 turns | High |
| `evaluando_riesgo` persists | Same state > 4 turns | Medium |
| `reticente` persists | State = reticente for 2+ turns | Critical |
| No state transition | Same state > 5 turns | High |

**Characteristics**:
- Observable signals **stagnate** or repeat
- Customer is re-stating the same concern
- No new information emerges between cycles
- Dwell time per state **increases** or stays constant

### 2.3 Terminal Loops

Loops that indicate the conversation should end.

| Pattern | Detection | Action |
|---------|-----------|--------|
| `desenganchado` | Silence > threshold | Mark abandoned |
| Loop count > MAX | total_transitions > 8 | Force intervention |
| `reticente` > 3 turns | Persistent resistance | Human handoff |

---

## 3. Termination Strategies

### 3.1 Strategy Matrix

| Loop Type | Detection | Strategy | Action |
|-----------|-----------|----------|--------|
| Natural | Turn count < threshold | Allow, monitor | None |
| Stuck in `confundido` | Same state > 3 turns | Simplify, recommend default | Reduce options (C-014/C-015) |
| Stuck in `evaluando_riesgo` | Same state > 4 turns | Address specific risk or escalate | Targeted response |
| Stuck in `reticente` | State = reticente for 2+ turns | De-escalate, restore control | P-025/P-026 |
| Stuck in general | No state transition > 5 turns | Check engagement, suggest path | Redirect |
| Terminal | Silence > threshold | Mark `desenganchado` | End conversation |
| Loop count > MAX | total_loops > 8 | Suggest default, close | Decision push |

### 3.2 Decision Tree

```
                         ┌─────────────────────┐
                         │   State Estimation   │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  Loop Detection Run  │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
              │  Natural   │  │   Stuck   │  │ Terminal  │
              │   Loop     │  │   Loop    │  │   Loop    │
              └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
                    │               │               │
              ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
              │  Continue  │  │  Apply    │  │  End or   │
              │  Normal    │  │  Fix      │  │  Escalate │
              └───────────┘  └───────────┘  └───────────┘
```

---

## 4. Special Cases

### 4.1 The `reticente` Special Case

**Detection**: `enojo` + `contra-argumentación` directed at a pressure source (closing attempt, pricing push, urgency language).

**Strategy**: Immediate de-escalation per P-025/P-026.

| Rule | Detail |
|------|--------|
| **NEVER** retry close after `reticente` in same conversation | Customer has signaled reactance; retrying amplifies it |
| Wait for state transition | Must return to `decidiendo` or `evaluando_riesgo` first |
| `reticente` persists > 3 turns | Offer human handoff |
| After de-escalation | Resume at `explorando` or `comparando`, not `decidiendo` |

**Observable signals**:
- `enojo` (anger/frustration) on voice or text
- `contra-argumentación` (counter-arguments) against the agent's suggestion
- `-presión` (perceived pressure) markers: "ya te dije", "no me presiones", "déjame en paz"

### 4.2 The `confundido` Special Case

**Detection**: Enumeration of options, re-opening discarded options, "I can't decide", "there are too many options", "which one is better?" repeated.

**Strategy**: Reduce cognitive load per C-014/C-015.

| Rule | Detail |
|------|--------|
| **NEVER** add more options | Already overwhelmed; more options worsen the state |
| Reduce to 2-3 options | Eliminate clearly inferior choices |
| Offer a default recommendation | "Based on what you've told me, X is the best fit" |
| `confundido` persists > 4 turns | Recommend single option definitively |

**Observable signals**:
- `enumeración` (listing options back)
- `reapertura` (re-opening previously discarded options)
- `indecisión` (explicit indecision phrases)
- `sobrecarga` (cognitive overload: "too many", "I'm confused")

---

## 5. Loop Termination Rules (Pseudocode)

```typescript
interface LoopTerminationResult {
  action: 'continue' | 'de_escalate' | 'simplify' | 'address_risk'
        | 'check_engagement' | 'suggest_default' | 'mark_desenganchado';
  reason: string;
  confidence: number;
}

function shouldTerminateLoop(
  conversationState: ConversationState,
  turnCount: number,
  silenceDuration: number
): LoopTerminationResult {

  const currentState = conversationState.current_state;
  const stateDwell = conversationState.dwell_in_current_state;
  const totalLoops = conversationState.total_state_transitions;
  const stateHistory = conversationState.state_history;

  // ── P-01: Reticente (Critical - Reactance) ──────────────────────
  if (currentState === 'reticente' && stateDwell >= 2) {
    return {
      action: 'de_escalate',
      reason: 'reactance_detected',
      confidence: 0.95
    };
  }

  // ── P-02: Confundido (High - Choice Overload) ───────────────────
  if (currentState === 'confundido' && stateDwell >= 3) {
    return {
      action: 'simplify',
      reason: 'choice_overload',
      confidence: 0.90
    };
  }

  // ── P-03: Evaluando Riesgo (Medium - Stuck Risk) ───────────────
  if (currentState === 'evaluando_riesgo' && stateDwell >= 4) {
    return {
      action: 'address_risk',
      reason: 'stuck_in_risk_assessment',
      confidence: 0.80
    };
  }

  // ── P-04: General Stagnation (High - No Progress) ──────────────
  if (stateDwell >= 5) {
    return {
      action: 'check_engagement',
      reason: 'no_progress',
      confidence: 0.85
    };
  }

  // ── P-05: Excessive Looping (Medium - Too Many Cycles) ──────────
  if (totalLoops > 8) {
    return {
      action: 'suggest_default',
      reason: 'too_many_loops',
      confidence: 0.75
    };
  }

  // ── P-06: Abandonment (Terminal - Silence) ──────────────────────
  if (silenceDuration > SILENCE_THRESHOLD) {
    return {
      action: 'mark_desenganchado',
      reason: 'abandonment',
      confidence: 0.90
    };
  }

  // ── Default: Natural Flow ───────────────────────────────────────
  return {
    action: 'continue',
    reason: 'natural_flow',
    confidence: 1.0
  };
}
```

### 5.1 Natural Loop Detection

Separate from termination, detect if a loop is **natural** (producing new information) or **stuck** (repeating):

```typescript
function isNaturalLoop(
  stateHistory: StateTransition[],
  recentWindow: number = 3
): boolean {
  const recent = stateHistory.slice(-recentWindow);

  // Check if observable signals are evolving
  const uniqueObservables = new Set(
    recent.map(t => JSON.stringify(t.observables_snapshot))
  );

  // If observables change across cycles, it's a natural loop
  if (uniqueObservables.size >= 2) return true;

  // If same state but short dwell, likely natural
  const avgDwell = recent.reduce((sum, t) => sum + t.dwell_time, 0)
                   / recent.length;
  if (avgDwell <= 2) return true;

  // Otherwise, stuck
  return false;
}
```

---

## 6. Integration with MIA

### 6.1 Execution Order

```
1. Collect observables          (src/lib/sales/process.ts)
2. Estimate state               (src/lib/runtime/runtime.ts)
3. [NEW] Run loop detection     (src/lib/sales/detect.ts — to be extended)
4. Check termination rules      (new module)
5. Select action                (src/lib/sales/process.ts)
6. Execute action               (src/lib/runtime/runtime.ts)
7. Log transition               (conversation_state table)
```

### 6.2 State Tracking

The `conversation_state` table must track:

| Field | Type | Description |
|-------|------|-------------|
| `current_state` | `EstadoConversacional` | Current estimated state |
| `state_history` | `StateTransition[]` | Full history with timestamps |
| `dwell_in_current_state` | `number` | Turns in current state |
| `total_state_transitions` | `number` | Total state changes |
| `loop_count` | `number` | Detected loop count |
| `termination_events` | `TerminationEvent[]` | When and why loops were broken |
| `last_observable_snapshot` | `ObservableSet` | For comparison across cycles |

### 6.3 Termination Action Effects

| Action | Effect on Action Selection |
|--------|---------------------------|
| `de_escalate` | Override next action to P-025/P-026 (de-escalation scripts) |
| `simplify` | Filter action space to C-014/C-015 (simplify, recommend default) |
| `address_risk` | Generate targeted risk-addressing response |
| `check_engagement` | Inject engagement check: "¿Todavía estás interesado en...?" |
| `suggest_default` | Recommend single best option |
| `mark_desenganchado` | Set conversation outcome to `desenganchado`, end session |
| `continue` | No override, normal action selection |

### 6.4 Logging

All loop termination events should be logged for analysis:

```typescript
interface TerminationEvent {
  timestamp: Date;
  conversation_id: string;
  trigger: string;           // reason from shouldTerminateLoop
  action_taken: string;
  state_at_trigger: string;
  dwell_at_trigger: number;
  loop_count_at_trigger: number;
  customer_response: string; // what happened after intervention
}
```

---

## 7. Metrics for Loop Health

### 7.1 Per-Conversation Metrics

| Metric | Definition | Healthy Range |
|--------|-----------|---------------|
| Average turns | Total turns in conversation | 8-20 |
| Loop count | Detected state cycles | 0-4 |
| Max dwell | Longest time in any state | 1-4 turns |
| Time per state | Dwell time per state | `comparando` 2-3, `evaluando_riesgo` 1-3 |
| Termination events | Forced loop breaks | 0-1 |
| Outcome | Final conversation outcome | `convertido` or `pierde_ventana` |

### 7.2 Aggregate Metrics

| Metric | Description |
|--------|-------------|
| Termination rate | % of conversations with forced loop breaks |
| Natural vs. forced ratio | Natural loops / forced terminations |
| Reticente recovery rate | % of `reticente` episodes that resolve to `convertido` |
| Confundido resolution rate | % of `confundido` episodes resolved by simplification |
| Avg loop count by outcome | Compare loop counts for `convertido` vs. `desenganchado` |
| State distribution | Time spent in each state across all conversations |

### 7.3 Health Thresholds

| Indicator | Green | Yellow | Red |
|-----------|-------|--------|-----|
| Avg turns | 8-20 | 20-30 | >30 |
| Loop count | 0-4 | 4-8 | >8 |
| Max dwell | 1-3 | 3-5 | >5 |
| Termination rate | <10% | 10-25% | >25% |
| Reticente recovery | >80% | 50-80% | <50% |

---

## 8. Implementation Priorities

1. **P0**: Add `dwell_in_current_state` and `state_history` tracking to `conversation_state`
2. **P0**: Implement `shouldTerminateLoop` and integrate after state estimation
3. **P1**: Add `reticente` special case handling (de-escalation override)
4. **P1**: Add `confundido` special case handling (option reduction override)
5. **P2**: Implement `isNaturalLoop` to distinguish healthy vs. stuck loops
6. **P2**: Add termination event logging
7. **P3**: Build aggregate metrics dashboard
8. **P3**: Tune thresholds based on production data

---

## 9. Open Questions

1. Should `reticente` recovery wait for **explicit** state transition, or should we attempt gentle probing after 2 turns of de-escalation?
2. What is the appropriate `SILENCE_THRESHOLD`? Different channels (WhatsApp vs. voice) may need different values.
3. Should loop termination events be **visible** to the customer ("I notice we're going in circles...") or always **invisible** (internal only)?
4. How do we handle multi-topic conversations where a customer legitimately revisits an earlier topic?
5. Should the agent ever **proactively** break a natural loop, or only when it becomes stuck?

---

## 10. Appendix: State Reference

Based on UBSE research (`docs/research/kb/estados.md`):

| State | Description | Typical Dwell |
|-------|-------------|---------------|
| `explorando` | Initial discovery, browsing | 2-4 turns |
| `comparando` | Evaluating options | 2-4 turns |
| `evaluando_riesgo` | Assessing risks/concerns | 1-3 turns |
| `confundido` | Overwhelmed, indecisive | 1-2 turns (unhealthy if longer) |
| `reticente` | Resistant, feeling pressured | 0-1 turns (unhealthy if longer) |
| `decidiendo` | Making final decision | 1-3 turns |
| `desenganchado` | Disengaged, abandoned | Terminal |

Transition priors from `docs/research/kb/transiciones.md`:
- `comparando ⇄ evaluando_riesgo`: 0.55
- `decidiendo → comparando`: 0.20
- `evaluando_riesgo → comparando`: 0.15

# MIA Scale Validation Test Plan

## Status: Proposed

---

## 1. Architecture

### 1.1 Overview

The scale test is a **modular async script suite** that exercises MIA's full stack — from business creation through conversation simulation, learning evolution, and database stress — generating a comprehensive validation report.

```
scripts/scale-test/
├── index.ts           # Orchestrator — parses mode, runs phases, aggregates results
├── config.ts          # Business definitions, complexity levels, mode limits
├── utils.ts           # Shared Supabase/OpenAI clients, progress bars, metrics
├── phase1.ts          # Synthetic business creation (3-10 businesses)
├── phase2.ts          # Knowledge loading stress test (extraction pipeline)
├── phase3.ts          # Conversation simulation (50-500 conversations/business)
├── phase4.ts          # Learning evolution test (corrections → readiness growth)
├── phase5.ts          # Mentor mode test (scenario generation + extraction)
├── phase6.ts          # AI cost measurement (usage-report.ts integration)
├── phase7.ts          # Database stress test (insert/query perf, tenant isolation)
├── phase8.ts          # Time-lapse simulation (7-30 simulated days)
├── report.ts          # Markdown report generator → docs/testing/mia-scale-test-report.md
└── cleanup.ts         # Removes ONLY scale test data (idempotent)
```

### 1.2 Two Modes

| Aspect | SAFE (default) | FULL (--full flag) |
|--------|---------------|-------------------|
| Businesses | 3 | 10 |
| Conversations/biz | 50 | 500 |
| Knowledge documents | 5 | 50 |
| Simulated days | 7 | 30 |
| Model | gpt-4o-mini only | gpt-4o-mini only |
| Max cost | ~$0.25 | ~$9.00 |
| Est. runtime | ~25 min | ~12-14 hours |

SAFE mode is always the default. FULL mode requires explicit `--full` flag and confirmation prompt.

### 1.3 Data Safety

- All test businesses use `owner_id = '00000000-0000-0000-0000-000000000000'` (sentinel value — no real user)
- Test business names prefixed with `[SCALE TEST]` for easy identification
- All test business UUIDs are written to `scripts/scale-test/.test-run-{timestamp}.json`
- Cleanup script (`cleanup.ts`) reads this file and deletes ONLY those businesses (cascade deletes all child data)
- Cleanup is **idempotent** — running it multiple times is safe

### 1.4 Reuse Strategy

| Component | Source | How It's Used |
|-----------|--------|--------------|
| Business insertion pattern | `seed-vitanova.ts` | Phase 1 follows the same admin client insert pattern |
| Context loading | `src/lib/ai/knowledge.ts` | `getBusinessContext()` fetches brand + products + rules + knowledge + instructions |
| Prompt builder | `src/lib/ai/prompts.ts` | `buildMasterPrompt()` generates system prompt for conversations |
| AI response | `src/lib/runtime/runtime.ts` | Phase 3 directly calls OpenAI with the constructed system prompt (skips streaming for batch) |
| Structured extraction | `src/lib/ai/extract.ts` | `extractKnowledgeFromText()` handles document → structured data |
| Evaluation | `src/app/api/laboratorio/evaluate/route.ts` | Phase 3 reuses the same `generateObject` + zod schema pattern |
| Cost tracking | `src/lib/ai/cost.ts` + `knowledge.ts` | Every AI call records via `recordAiUsage()` with source tag |
| Cost reporting | `src/lib/ai/usage-report.ts` | Phase 6 queries reports via `getMonthlyUsage()`, `getAllTimeStats()` |
| Readiness | `src/lib/ai/readiness.ts` | Phase 4 calls `calculateReadiness()` to track maturity progression |
| Memory | `src/lib/ai/memory.ts` | Phase 3-4 exercise `analyzeConversationPatterns()`, `upsertBusinessMemory()` |
| Learning velocity | `src/lib/ai/memory.ts` | Phase 4 calls `calculateLearningVelocity()` to track growth |
| Skills | `src/lib/ai/memory.ts` | Phase 4 calls `calculateSkillLevels()` to track skill progression |
| Weekly reports | `src/lib/ai/weekly-report.ts` | Phase 8 calls `generateWeeklyReport()` for time-lapse reports |
| Schema | `supabase/migrations/001-010` | All inserts follow the exact table DDL |

---

## 2. Phases — Detailed

### Phase 1: Synthetic Business Creation

**Input**: `config.ts` business definitions

**Output**: 3-10 businesses with brand identity, assistant, products, knowledge, rules, instructions

**Process**:
1. Generate UUIDs for each new business and assistant
2. Insert `businesses` row (owner_id sentinel, name prefixed, onboarding_status = 'ready')
3. Insert `brand_identities` (business_name, tagline, target, differentiators, tone)
4. Insert `assistants` (personality varies by industry)
5. Insert `products` (varying quantity by complexity level: Small=5, Medium=15, Large=30)
6. Insert `knowledge_items` (Small=8, Medium=25, Large=50)
7. Insert `sales_rules` (Small=5, Medium=15, Large=30)
8. Insert `ai_instructions` (Small=3, Medium=8, Large=15)

**AI calls**: 0

**Data per business (SAFE / FULL)**:

| Complexity | Businesses | Products | Knowledge | Rules | Instructions |
|-----------|-----------|----------|-----------|-------|-------------|
| Small | 2 / 4 | 5 | 8 | 5 | 3 |
| Medium | 1 / 4 | 15 | 25 | 15 | 8 |
| Large | 0 / 2 | 30 | 50 | 30 | 15 |

**SAFE total**: 3 biz, 25 products, 41 knowledge, 25 rules, 14 instructions
**FULL total**: 10 biz, 140 products, 232 knowledge, 140 rules, 74 instructions

**Est. time**: SAFE ~30s, FULL ~2min

---

### Phase 2: Knowledge Loading Stress Test

**Input**: Synthetic text documents generated per business

**Output**: Extracted products, knowledge items, rules — measured for time, tokens, failures

**Process**:
1. For each business, generate 1-3 synthetic "documents" (text descriptions of the business)
2. Call `extractKnowledgeFromText()` from `src/lib/ai/extract.ts` on each document
3. Measure: processing time, token usage, created records, failures, retries
4. Store results in the test metrics accumulator

**AI calls**: 5 docs (SAFE) / 50 docs (FULL) × 1 GPT call each

**SAFE**: 5 docs × ~4000 tokens = 20,000 tokens → ~$0.007
**FULL**: 50 docs × ~4000 tokens = 200,000 tokens → ~$0.034

**Est. time**: SAFE ~1min, FULL ~8min

---

### Phase 3: Conversation Simulation

**Input**: Businesses from Phase 1

**Output**: 50-500 conversations per business with full AI responses + evaluations

**Process**:
1. For each business, load context via `getBusinessContext()` (times context loading)
2. Build system prompt via `buildMasterPrompt()` (times prompt generation)
3. For each conversation:
   a. Generate customer message sequence (4 distribution categories — see below)
   b. For each message round:
      - Call OpenAI with system prompt + conversation history
      - Measure: AI response time, tokens used
      - Record in tracking via `recordAiUsage()` with source: 'conversation'
   c. Evaluate the full conversation via `generateObject` (same pattern as evaluate route)
      - Measure: evaluation time, tokens used
      - Record in tracking via `recordAiUsage()` with source: 'evaluation'
4. Accumulate all metrics

**Message distribution** (per conversation, ~4 rounds):

| Category | % | Example topics |
|----------|---|---------------|
| Basic questions | 40% | Price, delivery, availability, payment |
| Sales objections | 30% | Too expensive, thinking about it, competitor, trust |
| Complex questions | 20% | Product suitability, restrictions, recommendations |
| Adversarial | 10% | Impossible promises, unsupported claims, contradictions |

**AI calls per conversation**: 4 messages + 1 evaluation = 5 GPT calls
**SAFE**: 3 biz × 50 convs × 5 = 750 calls
**FULL**: 10 biz × 500 convs × 5 = 25,000 calls

**SAFE tokens**: 150 convs × 2600 + 150 evals × 2700 = 390,000 + 405,000 = 795,000 → ~$0.16
**FULL tokens**: 5000 convs × 2600 + 5000 evals × 2700 = 13M + 13.5M = 26.5M → ~$5.33

**Est. time**: SAFE ~15min, FULL ~7-8 hours

---

### Phase 4: Learning Evolution Test

**Input**: Conversations from Phase 3

**Output**: Readiness progression, skill levels, memory creation

**Process**:
1. Create 3 correction scenarios per business (learning_events with status 'approved')
2. Call `calculateReadiness()` — measures preparation + confidence + overall
3. Call `calculateSkillLevels()` — measures 10 skills
4. Call `calculateLearningVelocity()` — measures weekly velocity
5. Phase 8 enhances this with time-lapse progression

**AI calls**: 0 (readiness, skills, velocity are all DB-computed)

**Est. time**: SAFE ~5s, FULL ~30s

---

### Phase 5: Mentor Mode Test

**Input**: Businesses that reached Understanding maturity stage

**Output**: Mentor sessions with extracted rules, decisions, patterns

**Process**:
1. Generate a customer scenario via GPT (source: 'mentor_mode')
2. Store in lab_sessions with mode='mentor'
3. Extract rules/decisions from the mentor interaction
4. Verify suggestions are accurate

**AI calls**: 3-5 mentor scenarios per business (SAFE) / 10 per business (FULL)
**SAFE**: 3 biz × 3 scenarios × 2 calls = ~18 calls → 45,000 tokens → ~$0.01
**FULL**: 10 biz × 10 scenarios × 2 calls = ~200 calls → 500,000 tokens → ~$0.10

**Est. time**: SAFE ~1min, FULL ~10min

---

### Phase 6: AI Cost Measurement

**Input**: `ai_usage` table populated by phases 3-5

**Output**: Per-business and aggregate cost reports

**Process**:
1. Query `getMonthlyUsage()` per business
2. Query `getAllTimeStats()` per business
3. Query `getCostProjection()` per business
4. Aggregate across all test businesses
5. Calculate per-conversation, per-business averages

**AI calls**: 0 (all DB queries)

**Est. time**: ~5s

---

### Phase 7: Database Stress Test

**Input**: All test data from phases 1-3

**Output**: Insert/query performance metrics + tenant isolation verification

**Process**:
1. **Insert performance**: Time batch inserts into conversations, messages, ai_usage
2. **Query performance**: Run SELECT queries on knowledge_items, products, sales_rules, business_memory with filters
3. **Index effectiveness**: Query with and without common filters, compare times
4. **Tenant isolation**: Attempt to query Business B's data from Business A's context — must return zero rows

**Data leakage detection**:
```sql
-- Business A queries products with another business's ID
SELECT COUNT(*) FROM products WHERE business_id = '<business_b_id>';
-- Expected: row-level security blocks, or query returns 0
-- FAIL if count > 0
```

**AI calls**: 0

**Est. time**: SAFE ~30s, FULL ~2min

---

### Phase 8: Time-Lapse Simulation (30 business days)

**Input**: Business from Phase 1 with Phase 2 knowledge

**Output**: Day-by-day record of business evolution + final MIA Evolution Report

**Process**:
Each simulated day progresses through a schedule:

| Day | Events | GPT calls |
|-----|--------|-----------|
| 1 | Onboarding + initial knowledge load | 0 |
| 2-7 (SAFE) / 2-15 (FULL) | Customer conversations (5-10/day) + evaluations | ~50/day |
| 8 (SAFE) / 16 (FULL) | Corrections + learning report | ~5 |
| 10 (SAFE) / 20 (FULL) | Mentor mode session | ~5 |
| 15 (SAFE) / 25 (FULL) | New products added + readiness recalc | 0 |
| Last day | Weekly report + final evaluation | ~2 |

After all days complete, generate **MIA Evolution Report** showing:
- Initial readiness → final readiness
- Knowledge growth
- Mistakes prevented
- Patterns discovered
- Recommendations generated

**SAFE**: 7 days × ~12 calls/day = ~84 calls → ~$0.08
**FULL**: 30 days × ~50 calls/day = ~1500 calls → ~$3.00

**Est. time**: SAFE ~5min, FULL ~3-4 hours

---

## 3. Estimated Execution Time

| Phase | SAFE | FULL |
|-------|------|------|
| 1. Business creation | ~30s | ~2min |
| 2. Knowledge loading | ~1min | ~8min |
| 3. Conversation simulation | ~15min | ~7-8h |
| 4. Learning evolution | ~5s | ~30s |
| 5. Mentor mode | ~1min | ~10min |
| 6. Cost measurement | ~5s | ~5s |
| 7. Database stress test | ~30s | ~2min |
| 8. Time-lapse simulation | ~5min | ~3-4h |
| Report generation | ~2s | ~2s |
| **Total** | **~23-25 min** | **~12-14 hours** |

---

## 4. Estimated OpenAI Cost

### SAFE Mode

| Operation | Calls | Input Tokens | Output Tokens | Total Tokens | Est. Cost |
|-----------|-------|-------------|--------------|-------------|-----------|
| Knowledge extraction | 5 | 15,000 | 7,500 | 22,500 | $0.007 |
| Conversations | 600 | 330,000 | 90,000 | 420,000 | $0.104 |
| Evaluations | 150 | 345,000 | 60,000 | 405,000 | $0.088 |
| Mentor mode | 18 | 27,000 | 9,000 | 36,000 | $0.010 |
| Reports | 2 | 4,000 | 1,500 | 5,500 | $0.002 |
| **Total** | **775** | **721,000** | **168,000** | **889,000** | **~$0.21** |

### FULL Mode

| Operation | Calls | Input Tokens | Output Tokens | Total Tokens | Est. Cost |
|-----------|-------|-------------|--------------|-------------|-----------|
| Knowledge extraction | 50 | 150,000 | 75,000 | 225,000 | $0.068 |
| Conversations | 20,000 | 11,000,000 | 3,000,000 | 14,000,000 | $3.450 |
| Evaluations | 5,000 | 11,500,000 | 2,000,000 | 13,500,000 | $2.925 |
| Mentor mode | 200 | 300,000 | 100,000 | 400,000 | $0.105 |
| Reports | 30 | 60,000 | 22,500 | 82,500 | $0.023 |
| **Total** | **25,280** | **23,010,000** | **5,197,500** | **28,207,500** | **~$6.57** |

**Notes**:
- All estimates use `gpt-4o-mini` pricing: $0.15/1M input, $0.60/1M output
- Actual costs may vary ±30% depending on conversation length
- SAFE mode is designed to stay under $0.50
- FULL mode scales linearly with businesses and conversations

---

## 5. Monthly Projection

If MIA had **10 active businesses** with **50 conversations/day** each:

| Metric | Per Day | Per Month (30d) |
|--------|---------|----------------|
| Conversations | 500 | 15,000 |
| Input tokens | 1,100,000 | 33,000,000 |
| Output tokens | 300,000 | 9,000,000 |
| Total tokens | 1,400,000 | 42,000,000 |
| Estimated cost | $0.35 | $10.35 |
| Evaluations (10% sampled) | 50 | 1,500 |
| Eval cost | $0.08 | $2.48 |
| **Total monthly** | **$0.43** | **~$12.83** |

At **100 businesses** with **50 conversations/day**: **~$128/month**

---

## 6. Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| OpenAI rate limit (FULL mode) | Blocks phase 3/8 | Medium | Implement retry with exponential backoff; start in SAFE mode |
| Cost overrun | Higher than expected bill | Medium | SAFE mode is default; ALL AI calls tracked in real-time; abort threshold configurable |
| Supabase rate limit | Slow inserts | Low | Batch inserts in transactions |
| Script crashes mid-run | Orphan test data | Medium | Cleanup script is idempotent; partial business IDs still tracked in `.test-run-*.json` |
| Real data deletion | Data loss | Very Low | Cleanup deletes ONLY `[SCALE TEST]` prefixed businesses; requires confirmation prompt |
| Token estimation errors | Capped output | Medium | All OpenAI calls use `max_tokens` limiting to 500 for conversations, 2000 for evaluations |
| Cross-tenant leakage | RLS bypass via admin client | Very Low | Test data uses sentinel owner_id; isolation queries verify no leakage |

---

## 7. Rollback Strategy

### Automated Cleanup

```bash
npx tsx scripts/scale-test/cleanup.ts
```

This script:
1. Reads the most recent `.test-run-*.json` file
2. Shows what it will delete (business names, IDs, record counts)
3. Asks for confirmation
4. Deletes in FK-safe order (children first, businesses last)
5. Removes the tracking file when complete

### Manual Cleanup

If the tracking file is lost, cleanup searches for businesses with `name LIKE '[SCALE TEST]%'`:

```sql
SELECT id, name FROM businesses WHERE name LIKE '[SCALE TEST]%';
-- Verify the list, then:
-- DELETE FROM businesses WHERE name LIKE '[SCALE TEST]%';
```

Cascade deletes handle all child tables.

### Emergency Stop

The orchestrator handles SIGINT (Ctrl+C):
1. Completes the current phase
2. Writes current progress to tracking file
3. Prints cleanup instructions
4. Exits gracefully — no data left in inconsistent state

---

## 8. What Success Looks Like

The scale test passes if:

1. All phases complete without unhandled errors
2. Tenant isolation: 0 cross-business data leaks detected
3. All AI operations correctly tracked in `ai_usage` with proper `source` tags
4. Readiness progression demonstrates measurable growth (Observation → Understanding)
5. Knowledge loading processes documents within expected time/cost bounds
6. Database queries return correct, isolated results per business
7. Cleanup removes ALL test data with 0 residual records

---

## 9. Approval

To proceed:

- Review the plan above
- Confirm SAFE vs FULL mode
- Verify the estimated costs are acceptable
- Approve the implementation

**Next step after approval**: Create `scripts/scale-test/*.ts` files (all 12) and `docs/testing/mia-scale-test-report.md`.

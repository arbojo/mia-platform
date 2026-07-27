# MIA Knowledge Studio — Design Document

**Status:** Approved
**Date:** 2026-07-27
**Feature:** Intelligent Knowledge Preparation System

---

## 1. Architectural Decision

**Knowledge Studio is a NEW independent module, not an extension of Knowledge Center.**

### Reasoning

| Concern | Knowledge Center | Knowledge Studio |
|---------|-----------------|------------------|
| Purpose | Manage what you know | Evaluate how well you know it |
| Operation | CRUD (create, read, update, delete) | Analyze, score, suggest, approve |
| Data flow | User → DB | DB → AI Analysis → User → DB |
| User action | Edit knowledge | Review readiness |
| Complexity | Low (forms + tables) | High (AI analysis + workflows) |
| Future scope | Stable | PDF upload, embeddings, RAG |

Knowledge Studio **consumes** Knowledge Center data but does not replace it. They are complementary modules with different concerns.

---

## 2. Product Definition

### What is Knowledge Studio?

Knowledge Studio is an AI-powered knowledge quality assurance system. It answers:

> "Is my AI sales assistant actually prepared to sell?"

### How it works

1. Business owner opens Knowledge Studio
2. MIA analyzes ALL existing knowledge (knowledge_items, products, sales_rules, ai_instructions)
3. MIA generates a **Readiness Score** (0-100)
4. MIA identifies specific problems:
   - Missing information (gaps)
   - Contradictions (conflicts)
   - Sales readiness issues
5. MIA generates improvement suggestions
6. Business owner reviews and approves/rejects each suggestion
7. Approved suggestions become new knowledge items

### How this makes MIA different from a chatbot

A chatbot answers questions. MIA **prepares** the assistant to answer questions well. Knowledge Studio is the preparation layer — it ensures the assistant has comprehensive, consistent, and actionable knowledge before going live.

---

## 3. AI Engineer — Analysis Pipeline

### MVP Pipeline (No Embeddings)

```
┌─────────────────────────────────────────────────────┐
│                  KNOWLEDGE STUDIO                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. COLLECT                                          │
│     knowledge_items + products + sales_rules         │
│     + ai_instructions + brand_identity               │
│                                                      │
│  2. ANALYZE (single AI call per category)            │
│     ├─ Completeness: what's missing?                 │
│     ├─ Consistency: what conflicts?                  │
│     └─ Readiness: what will customers ask?           │
│                                                      │
│  3. SCORE                                            │
│     Overall readiness: 0-100                         │
│     Category scores: completeness, consistency,      │
│     sales readiness                                  │
│                                                      │
│  4. SUGGEST                                          │
│     Generate specific improvement suggestions        │
│     Each suggestion: type, description,              │
│     suggested_knowledge_item                         │
│                                                      │
│  5. APPROVE                                          │
│     User reviews suggestions                         │
│     Approved → creates knowledge_item                │
│     Rejected → logged for audit                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Future Pipeline (Not Implemented Yet)

```
Document Upload
     ↓
Text Extraction (PDF, DOCX)
     ↓
Chunking
     ↓
Embedding Generation (OpenAI ada-002)
     ↓
Vector Storage (pgvector)
     ↓
Similarity Search (RAG)
     ↓
Context-Aware Prompt Assembly
```

---

## 4. Database Engineer — Schema Changes

### New Table: `knowledge_analysis_reports`

Stores each analysis run and its results.

```sql
CREATE TABLE public.knowledge_analysis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  completeness_score INTEGER CHECK (completeness_score >= 0 AND completeness_score <= 100),
  consistency_score INTEGER CHECK (consistency_score >= 0 AND consistency_score <= 100),
  readiness_score INTEGER CHECK (readiness_score >= 0 AND readiness_score <= 100),
  gaps JSONB DEFAULT '[]'::jsonb,
  conflicts JSONB DEFAULT '[]'::jsonb,
  readiness_issues JSONB DEFAULT '[]'::jsonb,
  analysis_model TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_analysis_business ON public.knowledge_analysis_reports(business_id);
CREATE INDEX idx_analysis_status ON public.knowledge_analysis_reports(status);
```

### New Table: `knowledge_suggestions`

Stores individual improvement suggestions from analysis.

```sql
CREATE TABLE public.knowledge_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.knowledge_analysis_reports(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('missing_knowledge', 'missing_product', 'missing_rule', 'contradiction', 'improvement')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_category TEXT,
  suggested_question TEXT,
  suggested_answer TEXT,
  suggested_rule_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  knowledge_item_id UUID REFERENCES public.knowledge_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_suggestions_report ON public.knowledge_suggestions(report_id);
CREATE INDEX idx_suggestions_business ON public.knowledge_suggestions(business_id);
CREATE INDEX idx_suggestions_status ON public.knowledge_suggestions(status);
```

### RLS Policies

```sql
ALTER TABLE public.knowledge_analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_analysis_reports FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_reports"
  ON public.knowledge_analysis_reports FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "users_can_insert_reports"
  ON public.knowledge_analysis_reports FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

ALTER TABLE public.knowledge_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_suggestions FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_suggestions"
  ON public.knowledge_suggestions FOR SELECT TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "users_can_insert_suggestions"
  ON public.knowledge_suggestions FOR INSERT TO authenticated
  WITH CHECK (business_id IN (SELECT get_user_business_ids()));

CREATE POLICY "users_can_update_own_suggestions"
  ON public.knowledge_suggestions FOR UPDATE TO authenticated
  USING (business_id IN (SELECT get_user_business_ids()));
```

---

## 5. Backend Engineer — API Design

### Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/knowledge/analyze` | Trigger analysis for a business |
| `GET` | `/api/knowledge/analyze?business_id=xxx` | Get latest analysis report |
| `GET` | `/api/knowledge/analyze/[reportId]` | Get specific report with suggestions |
| `PATCH` | `/api/knowledge/suggestions/[id]` | Approve or reject a suggestion |

### POST /api/knowledge/analyze

1. Fetch all business knowledge (same as getBusinessContext)
2. Create analysis report (status: pending)
3. Call OpenAI to analyze:
   - Check completeness (missing prices, descriptions, policies)
   - Check consistency (conflicting info)
   - Check sales readiness (unanswered customer questions)
4. Generate suggestions array
5. Update report with scores + suggestions
6. Return report

### PATCH /api/knowledge/suggestions/[id]

1. Accept `{ status: 'approved' | 'rejected' }`
2. If approved: create knowledge_item from suggestion
3. Update suggestion status
4. Update suggestion resolved_at

---

## 6. Frontend Engineer — UX Design

### Page: /dashboard/knowledge-studio

```
┌─────────────────────────────────────────────────────┐
│  Knowledge Studio                                    │
│  "¿Tu asistente está preparado para vender?"        │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │  Readiness Score: 72/100                     │     │
│  │  ████████████████████░░░░░  72%              │     │
│  │                                              │     │
│  │  Completitud: 80  Consistencia: 65          │     │
│  │  Preparación: 70                             │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  [Ejecutar Análisis]                                │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │  Problemas Detectados (5)                    │     │
│  │                                              │     │
│  │  🔴 Falta precio de Producto X              │     │
│  │  🟠 Conflicto: envío gratis vs $50 min      │     │
│  │  🟡 Sin respuesta para "¿tienen garantía?" │     │
│  │  🟡 Falta política de devoluciones          │     │
│  │  🟢 Considerar agregar FAQs de uso          │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │  Sugerencias (8)                             │     │
│  │                                              │     │
│  │  ┌─────────────────────────────────────┐    │     │
│  │  │ + Agregar FAQ sobre garantías       │    │     │
│  │  │   Pregunta: ¿Ofrecen garantía?      │    │     │
│  │  │   Respuesta sugerida: ...            │    │     │
│  │  │   [Aprobar] [Rechazar]              │    │     │
│  │  └─────────────────────────────────────┘    │     │
│  │  ...                                        │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose |
|-----------|---------|
| `KnowledgeStudio.tsx` | Main page wrapper |
| `ReadinessScore.tsx` | Score display with progress bar |
| `AnalysisReport.tsx` | List of detected problems |
| `SuggestionCard.tsx` | Individual suggestion with approve/reject |

---

## 7. Security Engineer — Audit

### Threats Identified

| Threat | Mitigation |
|--------|------------|
| Tenant isolation | RLS + ownership check on every API call |
| AI prompt injection in analysis | Analysis runs on trusted DB data, not user-uploaded text |
| Token cost abuse | Rate limit analysis to 1 per business per hour |
| Suggestion spam | All suggestions require human approval before becoming knowledge |
| Cross-tenant data leakage | Admin client scoped to business_id, never cross-tenant |

### No File Upload in MVP

MVP analyzes existing DB data only. No file upload = no file-based attack surface.

---

## 8. Performance Engineer — Cost Analysis

### Token Usage per Analysis

| Data Source | Approximate Tokens |
|-------------|-------------------|
| Knowledge items (avg 20 items) | ~2,000 |
| Products (avg 10 products) | ~1,500 |
| Sales rules (avg 5 rules) | ~500 |
| AI instructions (avg 5 instructions) | ~300 |
| Brand identity | ~200 |
| System prompt + analysis instructions | ~500 |
| **Total input** | **~5,000** |
| **Expected output** | **~2,000** |

### Cost per Analysis

- Model: gpt-4o-mini
- Input: 5,000 tokens × $0.00015/1K = $0.00075
- Output: 2,000 tokens × $0.0006/1K = $0.0012
- **Total: ~$0.002 per analysis** (0.2 cents)

### Rate Limiting

- 1 analysis per business per hour
- Prevents cost abuse while allowing iterative improvement

---

## 9. Memory Engineer — Audit Trail

### What MIA Remembers

| Event | Storage | Purpose |
|-------|---------|---------|
| Analysis run | `knowledge_analysis_reports` | Historical readiness tracking |
| Detected problems | `knowledge_analysis_reports.gaps/conflicts` | What was wrong |
| Suggestions created | `knowledge_suggestions` | What MIA recommended |
| Suggestions approved | `knowledge_suggestions.status + knowledge_item_id` | What the user accepted |
| Suggestions rejected | `knowledge_suggestions.status` | What the user rejected |
| Knowledge created from suggestion | `knowledge_items.source = 'correction'` | Traceability |

### Knowledge Evolution Tracking

The existing `knowledge_versions` table can be extended to track knowledge created from approved suggestions. Each approved suggestion creates a knowledge_item with `source: 'correction'`, linking back to the suggestion.

---

## 10. Analytics Engineer — Metrics

### Key Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| Analysis completion rate | % of analyses that complete successfully | >95% |
| Suggestion approval rate | % of suggestions approved by users | >60% |
| Readiness score trend | Average score over time | Increasing |
| Time to readiness | Time from first analysis to score >80 | <7 days |
| Knowledge growth rate | New items created from suggestions per week | >5 |

---

## 11. Implementation Phases

### Phase 1: MVP (This Sprint)

1. Database migration (2 tables + RLS)
2. Analysis API (POST /api/knowledge/analyze)
3. Report API (GET /api/knowledge/analyze/[reportId])
4. Suggestion approval API (PATCH /api/knowledge/suggestions/[id])
5. Knowledge Studio page
6. ReadinessScore component
7. AnalysisReport component
8. SuggestionCard component
9. Sidebar update

### Phase 2: Future

- PDF upload + text extraction
- Embedding generation
- Vector storage (pgvector)
- RAG-based context assembly
- Historical trend charts
- Batch analysis scheduling

---

## 12. Final Question

> Does this feature move MIA closer to being "a chatbot" or "an AI employee preparation platform"?

**Answer: AI employee preparation platform.**

A chatbot just answers questions. MIA Knowledge Studio ensures the assistant is **prepared** to answer questions well. It's the difference between hiring someone and training them. Knowledge Studio is the training system — it evaluates readiness, identifies gaps, and guides improvement. This is exactly what "hiring and training a new employee" means in the MIA philosophy.

---

## 13. Council Approval

| Agent | Status | Notes |
|-------|--------|-------|
| CTO | ✅ Approved | New module is the right call |
| Architect | ✅ Approved | Clean separation of concerns |
| Domain Expert | ✅ Approved | Knowledge ≠ Instructions ≠ Rules preserved |
| Product Manager | ✅ Approved | Directly answers "is my assistant ready?" |
| Database Engineer | ✅ Approved | 2 new tables, minimal migration |
| Backend Engineer | ✅ Approved | 4 API endpoints, reuses existing patterns |
| Frontend Engineer | ✅ Approved | 4 new components, follows existing design |
| AI Engineer | ✅ Approved | Single analysis call, cost-effective |
| Performance Engineer | ✅ Approved | ~$0.002 per analysis, rate-limited |
| Security Engineer | ✅ Approved | No file upload, tenant-isolated |
| QA Engineer | ✅ Approved | Lint + build + manual testing |
| Release Manager | ✅ Approved | Ready for implementation |

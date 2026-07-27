# MIA Knowledge Center — Architecture Proposal

**Date**: 2026-07-27
**Agent**: Architect + AI Engineer + Database Engineer
**Status**: Proposed (not implemented)

---

## Objective

Enable businesses to upload documents to train their assistants with richer, more structured knowledge beyond manual Q&A entry.

## Supported Document Types

| Type | Extension | Processing |
|------|-----------|------------|
| Plain text | `.txt` | Direct ingestion |
| PDF | `.pdf` | Text extraction (pdf-parse) |
| Word document | `.docx` | Text extraction (mammoth) |
| CSV/Excel | `.csv`, `.xlsx` | Row-based extraction |

## Database Schema

### New Table: `knowledge_documents`

```sql
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt', 'csv', 'xlsx')),
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knol_docs_business ON public.knowledge_documents(business_id);
```

### New Table: `knowledge_chunks`

```sql
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_k chunks_business ON public.knowledge_chunks(business_id);
CREATE INDEX idx_k_chunks_document ON public.knowledge_chunks(document_id);
```

## User Flow

```
1. User navigates to /dashboard/assistants/[id]/knowledge
2. Sees list of uploaded documents
3. Clicks "Subir documento"
4. Selects file (drag & drop or file picker)
5. File uploads to Supabase Storage
6. Row created in knowledge_documents (status: pending)
7. Background job processes:
   a. Extracts text from document
   b. Splits into chunks (500-1000 tokens each)
   c. Generates embeddings via OpenAI
   d. Stores chunks in knowledge_chunks
   e. Updates status to 'ready'
8. Document appears as "Listo" in UI
9. Assistant automatically uses knowledge in responses
```

## Processing Pipeline

```
Upload → Storage → Extract Text → Chunk → Embed → Store
  │         │          │            │        │        │
  │         │          │            │        │        └─ knowledge_chunks
  │         │          │            │        └─ OpenAI embeddings
  │         │          │            └─ 500-1000 token chunks
  │         │          └─ pdf-parse / mammoth / direct
  │         └─ Supabase Storage bucket
  └─ User action
```

## Vector Search Integration

When building the master prompt, add semantic search:

```typescript
async function searchKnowledgeChunks(
  businessId: string,
  query: string,
  limit: number = 5
): Promise<string[]> {
  // 1. Generate embedding for query
  // 2. Search knowledge_chunks by cosine similarity
  // 3. Return top N relevant chunks
  // 4. Format as context for prompt
}
```

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/knowledge/documents` | GET | List documents for business |
| `/api/knowledge/documents` | POST | Upload new document |
| `/api/knowledge/documents/[id]` | DELETE | Delete document and chunks |
| `/api/knowledge/search` | POST | Semantic search across knowledge |

## Security

| Rule | Implementation |
|------|----------------|
| Multi-tenant isolation | RLS on `business_id` |
| File access | Supabase Storage with RLS |
| File size limit | 10MB max per document |
| File type validation | Server-side MIME type check |
| No secrets in documents | Scan for API keys before processing |

## Integration with Existing System

The Knowledge Center extends the existing `knowledge_items` table:

| Existing | New |
|----------|-----|
| Manual Q&A pairs | Document-derived knowledge |
| Onboarding input | Uploaded documents |
| Single knowledge source | Multiple knowledge sources |

The `getBusinessContext()` function would be extended to also search `knowledge_chunks` for relevant context.

## Cost Considerations

| Operation | Cost |
|-----------|------|
| Text extraction | Free (local) |
| Embedding generation | ~$0.0001 per 1K tokens |
| Storage | Supabase Storage free tier |
| Search | Free (pgvector) |

**Estimated**: $0.01 per typical document (5 pages)

## Migration Path

1. Create new tables (migration 003)
2. Add Supabase Storage bucket
3. Create processing API route
4. Create UI components
5. Integrate with `getBusinessContext()`
6. Add to sidebar navigation

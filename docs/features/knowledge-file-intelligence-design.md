# Knowledge Studio File Intelligence

**Date:** 2026-07-27
**Status:** Proposed (Deferred to Sprint 4)
**Sprint:** 3 — AI Employee Experience
**Complexity:** High
**Impact:** 8+ files, new storage infrastructure

---

## 1. Current State

### 1.1 Knowledge Studio (Existing)
- Text-based knowledge input (manual)
- AI analysis of existing knowledge
- Readiness score
- Improvement suggestions

### 1.2 Gap
Users must manually type all knowledge. For businesses with existing catalogs, price lists, or documentation, this is tedious and error-prone.

---

## 2. Engineering Council Analysis

### 2.1 CTO — Architecture

**Decision:** Defer to Sprint 4.

**Rationale:**
- File intelligence requires: Supabase Storage, file parsing (PDF, CSV, images), AI vision/text extraction
- Each component is a significant engineering effort
- Sprint 3 should focus on the core experience (onboarding, simulator, demo)
- File intelligence is a power feature, not a core experience feature

### 2.2 Security Engineer — Security

**Concerns:**
- File upload vulnerabilities (malicious files)
- Storage costs (unlimited uploads = expensive)
- File type validation required
- Size limits needed
- Virus scanning recommended for production

### 2.3 Performance Engineer — Cost

**Cost Analysis:**
- Supabase Storage: $25/month for 1GB
- PDF parsing: CPU-intensive, may need edge function
- AI vision (images): ~$0.01 per image
- AI text extraction: ~$0.002 per page

**Decision:** Defer until core experience is solid.

---

## 3. Future Architecture (Sprint 4)

### 3.1 File Upload Flow
```
User uploads PDF catalog
  → Supabase Storage (validated, sized)
  → Edge Function parses PDF
  → Text extracted
  → AI analyzes text
  → Products/knowledge/rules extracted
  → User reviews and approves
```

### 3.2 Supported Formats
| Format | Method | Cost |
|--------|--------|------|
| PDF | pdf-parse library | Free |
| CSV | Native parsing | Free |
| Images | OpenAI Vision | ~$0.01 |
| Text | Native | Free |

### 3.3 Database Changes
- `file_uploads` table — tracks uploaded files
- `knowledge_items.source` — add 'file_upload' option

---

## 4. Recommendation

**Defer to Sprint 4.** Focus Sprint 3 on:
1. Intelligent Onboarding (core experience)
2. AI Sales Simulator (training)
3. Demo Mode (acquisition)

File intelligence is a power feature that enhances the experience but isn't required for the core value proposition.

# Demo Mode

**Date:** 2026-07-27
**Status:** Proposed
**Sprint:** 3 — AI Employee Experience
**Complexity:** Low-Medium
**Impact:** 4 files modified, 1 new file, seed data

---

## 1. Current State

### 1.1 Problem
Potential customers cannot experience MIA without:
1. Creating an account
2. Going through onboarding
3. Configuring products and rules

This creates friction for sales demos and marketing.

### 1.2 Goal
Allow visitors to experience "what does my AI employee look like?" without setup.

---

## 2. Engineering Council Analysis

### 2.1 CTO — Architecture

**Decision:** Create a demo business with pre-configured data.

**Rationale:**
- Simplest approach: seed a demo business in the database
- Demo business has: products, knowledge, rules, brand identity
- Visitors can chat with the demo AI employee
- No account required for demo mode
- Account required to create their own

### 2.2 Security Engineer — Security

**Requirements:**
- Demo business must be read-only for visitors
- No real customer data in demo
- Demo conversations must not affect real data
- Rate limiting on demo chat

### 2.3 Product Manager — Journey

**Ideal Journey:**
```
Visitor lands on landing page
  → Sees: "Prueba a MIA sin crear cuenta"
  → Clicks "Probar demo"
  → Chat window opens with "Luna" (demo assistant)
  → Visitor asks questions
  → Luna responds using demo business data
  → Visitor sees: "¿Quieres tu propia asistente? Créala ahora"
  → Clicks "Crear cuenta"
  → Signup flow
```

---

## 3. Recommended Architecture

### 3.1 Demo Business
Create a demo business with:
- **Name:** "Zapatería Demo"
- **Brand:** "Zapatería Demo — Tu zapato ideal"
- **Products:** 3-4 sample products with prices
- **Knowledge:** 5-6 common questions
- **Rules:** Shipping, payment, schedule rules
- **Assistant:** "Luna" — friendly, warm personality

### 3.2 Demo Page
Create `/demo` page:
- Chat interface (read-only for visitor)
- Pre-loaded context (demo business)
- CTA to signup at end

### 3.3 API Route: `/api/demo/chat`
- Accepts messages
- Uses demo business context
- Returns AI responses
- Rate limited (10 messages per session)
- No authentication required

### 3.4 Seed Data
Create `supabase/seed-demo.sql`:
- Insert demo business, brand, products, rules, knowledge, assistant
- Run once during setup

---

## 4. User Flow

### 4.1 Visitor
```
/ → Landing page
  → Click "Probar demo"
  → /demo
  → Chat with Luna
  → "¿Cuánto cuesta?"
  → Luna responds with product info
  → "¿Hacen envíos?"
  → Luna responds with shipping rules
  → CTA: "¿Quieres tu propia asistente?"
  → /signup
```

### 4.2 Authenticated User
```
/demo → Redirect to /dashboard
  (Demo is for visitors only)
```

---

## 5. Files to Modify

| File | Change |
|------|--------|
| `src/app/demo/page.tsx` | **NEW** — Demo page with chat |
| `src/app/api/demo/chat/route.ts` | **NEW** — Demo chat API |
| `src/app/page.tsx` | Add "Probar demo" button |
| `supabase/seed-demo.sql` | **NEW** — Demo business seed data |

---

## 6. Cost

- Demo chat: ~$0.001 per conversation (gpt-4o-mini)
- Storage: Negligible (seed data)
- Rate limiting: Free (in-memory)

---

## 7. Success Criteria

- [ ] Visitor can try MIA without account
- [ ] Demo business has realistic data
- [ ] Demo chat works without authentication
- [ ] CTA to signup is prominent
- [ ] Demo conversations don't affect real data
- [ ] Rate limiting prevents abuse

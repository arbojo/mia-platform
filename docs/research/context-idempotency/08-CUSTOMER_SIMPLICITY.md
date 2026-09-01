# 08 — Customer Simplicity

**HEAD:** `d12ce6503ddc8a7b11a71c6037b87c33939702c0`
**Status:** EVIDENCE_LOCKED (discovery only)

---

## 1. Desired Principle

> The customer should not need to know anything about triggers, keywords, media categories, product IDs or internal rules. The customer simply converses naturally.

## 2. Where the Architecture Leaks Internals onto the Customer

### 2.1 The customer must produce trigger keywords (keyword dependence)

- **FACT:** media dispatch requires `triggerMatches(userMessage, trigger_condition)` (`media.ts:11-26`) — whole-word, comma-separated keywords, plural-tolerant.
- **FACT:** triggers are authored by business owners in the dashboard (e.g. `"precio, fotos, testimonio"`; `04-TRIGGER-TAXONOMY.md` §11).
- **CONSEQUENCE (FACT):** if the customer says "¿me mostrás cómo queda?" and no trigger covers `mostrás/queda`, no media is sent. The customer must accidentally use the business's chosen words ("foto", "envío", "precio"…).
- **CLASSIFICATION:** ARCHITECTURAL_GAP. The burden of vocabulary alignment sits on the customer.

### 2.2 The LLM is told the trigger phrase — and may parrot it

- **FACT:** `prompts.ts:141-144` injects `[IMAGEN_DISPONIBLE] ... ("precio, fotos")` into the prompt.
- **INFERENCE:** the model can naturally ask "¿querés que te mande la foto?" — which works — but nothing guarantees the model's wording overlaps the customer's next phrasing. If the model says "¿te mando el catálogo?" and `catalog` is not a trigger, the yes answer produces no media. Prompt/media vocabulary mismatch is structural.
- **RELATED (FACT, image-core Finding #8):** the LLM can *claim* an image exists while the resolver sends none (claim/execution invariant gap, `prompts.ts:135` + `conditional-media.ts:14`).

### 2.3 Resend requires an unnatural incantation

- **FACT:** `isResendRequest()` (`media.ts:38-53`) requires a media word (foto/imagen…) **and** a verb from a fixed list (reenvia, manda, pasa, muestra…) or "otra vez/de nuevo/nuevamente".
- **CONSEQUENCE:** "¿me lo mostrás de nuevo?" fails (no media word). "¿La foto?" fails (no verb). The customer must construct a sentence matching the regex. **ARCHITECTURAL_GAP.**

### 2.4 Product re-selection requires re-typing the product name

- **FACT:** product context is re-derived per message (`core.ts:86-98`); returning to product A (doc 06, scenario) works only if the customer names A again.
- **CONSEQUENCE:** "volvamos al anterior" resolves to nothing. **ARCHITECTURAL_GAP.**

### 2.5 Silent absences

- **FACT:** when resolution returns null, no media and no explanation is produced (`conditional-media.ts:73-76`); the web UI renders nothing (`ChatWindow.tsx:365`, no fallback — image-core Finding #12).
- **CONSEQUENCE:** the customer experiences an unanswered implicit request. No "ya te la había mandado 😊" because nobody knows it was sent (`core.ts:100-119` does not feed the ledger back to the LLM).

### 2.6 What works well for the customer today (honesty check)

- **FACT:** whole-word matching with plural tolerance avoids most grotesque false positives ("precio" ≠ "presupuesto").
- **FACT:** per-product trigger scoping (`knowledge_items.product_id`, MEDIA_INVARIANT) prevents most cross-product contamination (doc 04, `05-TRIGGER-CONTAMINATION.md`).
- **INFERENCE:** for **short, keyword-rich customer messages** (typical WhatsApp commerce: "precio?", "fotos?"), the current system feels natural. The gap opens in longer, paraphrased, or transitional conversations.

## 3. Simplest Interaction the Current Architecture Supports

**INFERENCE (from evidence, not intuition):**

> The simplest *reliable* interaction today is: customer names the product (or lands on its page) + uses a registered trigger word, within one channel and one conversation, without changing topics.

Anything beyond that — paraphrase, topic switch and return, re-asking without formula phrases, cross-channel — depends on luck of vocabulary.

## 4. Customer-Facing Failure Catalog

| # | Customer says | System does | Root cause |
|---|---|---|---|
| 1 | "¿cómo queda?" | nothing | no trigger for that wording |
| 2 | "¿la foto?" (again) | nothing | isResendRequest lacks verb |
| 3 | "volvamos al de uñas" | treats as new/global search | no active-product memory |
| 4 | "quiero ver las dos" (A+B) | sends at most one, by row age | first-match ordering |
| 5 | "ya me la habías mandado" | LLM unaware of ledger | no feedback loop |
| 6 | switches channel, asks again | media re-sent (maybe fine) | accidental, not decided |

## 5. Design Implication (for doc 12/13)

**INFERENCE:** the customer-simplicity requirement translates into exactly two technical needs:
1. **Understanding** — map natural phrasing to (intent, product) without keyword coincidence.
2. **Memory** — know what was shown, so re-showing is a *decision* ("te la mando de nuevo") rather than either spam or silence.

Both needs are currently unmet; both are independent of channel (doc 09).
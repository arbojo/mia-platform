# 27 — KNOWLEDGE-EVIDENCE CONTRACT

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED · **Input**: doc 22 §9, doc 21, migrations

---

## 1. REGLA DE ATRIBUCIÓN (normativa)

> No se puede atribuir un error al razonamiento de MIA si la evidencia
> disponible para MIA no demuestra cuál era la respuesta correcta.

Árbol obligatorio antes de clasificar un error:

```text
¿Producto correctamente identificado? —no→ PRODUCT_RESOLUTION_ERROR
¿Existe info del producto?            —no→ KNOWLEDGE_ERROR (MISSING)
¿Evidencia explícita del atributo?    —no→ UNSUPPORTED_BY_KNOWLEDGE
¿Evidencia dice SÍ pero MIA dijo NO?  —sí→ LLM_REASONING_ERROR / PROMPT_ERROR
¿Evidencia contradictoria?            —sí→ DATA_ERROR (CONTRADICTORY)
¿Dato en DB pero no recuperado?       —sí→ RETRIEVAL_ERROR
¿Recuperado pero mal formateado?      —sí→ PROMPT_ERROR
¿Dispatch/render falló?               —sí→ RUNTIME_ERROR / CHANNEL_ERROR
```

## 2. TAXONOMÍA DE EVIDENCIA DE PRODUCTO

| Clase | Definición | Ejemplo |
|-------|-----------|---------|
| KNOWN | evidencia explícita en `products` o `knowledge_items` activos | precio, garantía (si está cargada) |
| MISSING | atributo razonable sin ningún registro | "es recargable?" sin registro |
| CONTRADICTORY | dos registros activos con valores opuestos | dos items de garantía distintos |
| UNKNOWN | no se puede determinar con evidencia disponible | alias sin mapear |

## 3. CASO GOLDEN — "es recargable?" (Clean Nails)

FACT: la conversación real (doc 21) muestra que MIA responde "No, funciona
conectado a la corriente". Clasificación requiere auditar `knowledge_items`
y `products` de Clean Nails:
- Si NO existe registro de recargabilidad → **UNSUPPORTED_BY_KNOWLEDGE**:
  el LLM inventó (hallucination) — mitigación es prompt/instrucción
  ("no afirmar atributos no documentados"), NO runtime. No es bug del
  pipeline de media/contexto.
- Si existe registro que dice lo contrario → LLM_REASONING_ERROR.
- Estado de los datos en `d12ce650`: UNKNOWN sin query directa (no se
  modifican datos en este loop — mandato).

## 4. AUDITORÍA DE CONOCIMIENTO (estructura, no corrección)

Para cada producto auditar: name, SKU, price, description, benefits, faq,
restrictions, image_url + knowledge_items (category, trigger_condition,
media_type, product_id, is_active). Atributos a clasificar por producto:
recargable, batería, alimentación, garantía, uso, duración, resultados,
contenido, precio, envío, disponibilidad.

Evidencia estructural (FACT, `knowledge_items.sql`):
- CHECK constraint `media_type ∈ {image, testimonial}` (taxonomía limitada).
- `product_id NULL = medio genérico` → riesgo de contaminación si el scope
  no existe (doc 24 §6 lo resuelve: genérico solo con scope único).
- Items inactivos (`is_active=false`) no se sirven — p.ej. Neurotin image
  inactiva (doc 10-EVIDENCE_MATRIX #4): MISSING media es DATA_QUALITY, no bug
  de resolución.

## 5. REGLA DE SALIDA

Cuando knowledge no permite determinar la respuesta:
- El LLM DEBE poder expresar no-saber (requiere instrucción de prompt —
  Phase 1 puede incluir la instrucción, no el mecanismo de retrieval nuevo).
- El sistema NUNCA debe inventar un atributo como hecho confirmado (AC-007).

## 6. KNOWLEDGE VS CONTEXT (claims de la golden conversation)

| Claim cliente | Context source | Knowledge source | Clasificación |
|---------------|----------------|------------------|---------------|
| "en cuánto tiempo" | producto activo (implícito hoy: historial LLM) | products/knowledge | UNKNOWN hasta auditar datos |
| "cómo se usa" | idem | benefits/faq | idem |
| "garantía" | idem | knowledge_items (objection/faq) | idem |
| "envíos a León" | idem | sales_rules/knowledge | idem |
| "es recargable" | idem | probablemente ausente | UNSUPPORTED_BY_KNOWLEDGE (probable) |

FACT (doc 21): en TODOS los casos el "contexto" que hoy hace que la respuesta
sea de Clean Nails es el historial de mensajes en el prompt — LLM latent
reasoning, sin estado persistente. Es frágil (cambio de producto en historial
largo, resúmenes, multi-producto) y por eso existe el doc 24.

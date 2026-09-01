# 28 — LLM-RUNTIME-FEEDBACK CONTRACT

**HEAD**: `d12ce650` · **Status**: SPECIFICATION_LOCKED · **Input**: docs 01, 22 §2/§11, doc 26

---

## 1. ESTADO ACTUAL (FACT)

- El LLM **no recibe** el resultado de la resolución de media: `core.ts:100-119`
  resuelve media DESPUÉS de generar el texto y no hay feedback al LLM
  (doc 10-EVIDENCE_MATRIX #9, 🔴 CRITICAL).
- El prompt incluye `[IMAGEN_DISPONIBLE]` (`prompts.ts:135-144`) cuando el
  knowledge item tiene imagen+trigger+canal: el LLM SABE que hay media
  disponible, pero NO sabe si fue enviada.
- Consecuencia demostrada: el LLM puede afirmar "te acabo de enviar la imagen"
  cuando `resolveConditionalMedia()` devolvió `null` (CLAIM sin EXECUTION —
  doc 22 §2: invariantes claim/execution).

## 2. REGLA NORMATIVA

> El LLM solo puede afirmar aquello que runtime le reporte como ocurrido.
> CLAIM ≠ DISPATCHED ≠ DELIVERED (doc 26 §1).

Prohibido:
- LLM dice "enviada" si feedback = `dispatched: false` o ausente.
- LLM promete envío futuro ("ya te la mando") — el dispatch es decisión de
  runtime, no negociable por el LLM.

## 3. FEEDBACK MÍNIMO (especificación, no implementación)

El contrato exige un objeto de feedback adjunto al prompt por mensaje. El
MÍNIMO necesario para eliminar los falsos claims:

```text
media_resolution:
  scope: <product_ids evaluados | none>
  explicit_scope: <source | none>
  eligible: <bool>
  asset_selected: <asset_id | null>
  claim: <created | existing_hit | not_applicable>
  dispatched: <bool | unknown>
  delivered: <unknown>   ← Fase 1 SIEMPRE unknown (D3)
```

Justificación campo por campo (evidencia):
- `scope`: sin esto el LLM no sabe sobre qué producto se resolvió media
  (doc 22 §3: transiciones de contexto).
- `eligible/asset_selected`: distingue "no había media" de "había pero no se
  eligió" — hoy indistinguibles (doc 22 §2 FAILURE MODES).
- `claim`: permite al LLM decir "ya te la había enviado" en idempotency_hit
  (doc 26 §4-A: acknowledge en vez de re-envío).
- `dispatched`: evita el falso claim (FACT #1).
- `delivered`: constante `unknown` en Fase 1 — NO se promete D3.

NO agregar: confianza, embeddings, razón semántica — sin evidencia de necesidad.

## 4. ORDEN DEL PIPELINE (requisito estructural)

Para que exista feedback, la resolución de media debe ocurrir ANTES de la
generación del LLM (doc 25 §1: pipeline normativo). Esto es un REPAIR
estructural: hoy dispatch es post-LLM (FACT). El feedback es el mecanismo que
cierra el loop "runtime → LLM".

## 5. AUTORIDADES (matriz 12 del mandato)

| Pregunta | Autoridad |
|----------|-----------|
| ¿Qué producto es? | deterministic/runtime (context authority, doc 24) |
| ¿Qué información existe? | knowledge (products/knowledge_items) |
| ¿Qué asset corresponde? | media runtime |
| ¿Qué trigger aplica? | runtime |
| ¿Qué puede decir MIA? | LLM + evidence (restringido por feedback) |
| ¿Se envió asset? | runtime/adapter |
| ¿Llegó al cliente? | provider receipt (Fase 2, D3) |
| ¿Qué producto está activo? | context authority |
| ¿Dato no documentado? | UNKNOWN (doc 27 §1: no inventar) |

Solapamiento peligroso detectado (FACT): hoy el LLM decide IMPLÍCITAMENTE el
producto activo vía historial (doc 27 §6) mientras runtime decide el asset vía
trigger global — dos autoridades independientes sin contrato entre ellas.
Este documento + doc 24 eliminan esa ambigüedad.

## 6. CRITERIO DE ACEPTACIÓN ASOCIADO

- AC-004: el LLM no puede afirmar que un asset fue enviado si runtime no
  reportó ese resultado.
- AC-007: sin evidencia de knowledge, no inventar respuesta como hecho.

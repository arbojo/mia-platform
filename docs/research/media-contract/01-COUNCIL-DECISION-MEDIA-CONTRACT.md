# Council Decision — Media Contract Canónico (Contrato de Multimedia de MIA)

**Decision ID:** DEC-20260904-MEDIA-CONTRACT
**Date:** 2026-09-04
**Status:** DECISION_ACCEPTED
**Repo HEAD at decision:** `3c61c863b8538cb778da772d2db55ca3ebbdd332`
**Preflight Subaru:** `STOP_FOR_HUMAN` (drift preexistente: push B3 diferido por autorización explícita del Release Manager, manifest `TASK-20260904-210844465`). **Autorización humana obtenida para proceder** (decisión read-only, sin commit/push/deploy).
**Authority:** Human operator directive — Media Contract Decision Loop
**Evidence base:** `workshop/audit/battery-002/RESPONSE-BATTERY-002.md`, `workshop/audit/battery-002/DIAGNOSTIC-MEDIA-FAILS.md`, `workshop/audit/battery-002/MEDIA-CONTRACT-AUDIT.md`, código HEAD, datos vivos (evidence.ts, SELECT-only), `.governance/invariants.json`.

---

## 1. Problema

El Dashboard y el Runtime **no hablan el mismo contrato de multimedia**. El Dashboard declara que `product_id` + contexto activo atan el medio al producto y que `trigger_condition` es **opcional** y **refina**. El runtime implementa `trigger_condition` como **requisito obligatorio y único interruptor** de envío. Consecuencia: medios válidamente creados sin condición (incl. los importados con `trigger_condition: null`) son **assets muertos**, las peticiones fotográficas naturales ("foto", "fotito", "imagen") fracasan con 6 FAIL en RESPONSE-BATTERY-002, y el prompt afirma falsamente "no puedo enviar imágenes" cuando el asset existe.

Resultado RESPONSE-BATTERY-002: `32 PASS · 6 FAIL · 0 INFRA_FAIL · 1 BLOCKED`.
Diagnóstico: 5/6 FAIL → `MEDIA_TRIGGER_MISSING`. C05 → hallazgo separado: resend murió en `eligible=false`, nunca alcanzó la rama de idempotencia.

---

## 2. Evidencia (resumen verificado en HEAD)

| Evidencia | Ubicación |
|-----------|-----------|
| Dashboard declara condición opcional / refinadora | `src/components/catalog/ProductMedia.tsx:20`, `src/components/knowledge/MediaBrowser.tsx:170,178-181`, `MediaEditDialog.tsx:111-113`, `MediaGrid.tsx:57-59` |
| API permite crear imagen de producto SIN condición (global exige condición) | `src/app/api/knowledge/items/route.ts:122-127,160-171`; PATCH permite `trigger_condition:null` `items/[id]/route.ts:128` |
| Import crea media de producto con `trigger_condition:null` | `src/lib/import/engine.ts:88,118,155` |
| Migración 029: `product_id` NULL = genérico; trigger = "refinamiento DENTRO de ese producto" | `supabase/migrations/029_product_media.sql:9-27` |
| RUNTIME: candidatos excluyen trigger NULL; elegibilidad = único match léxico del trigger | `src/lib/runtime/context-media.ts:409-417,428-432` |
| RUNTIME: sin scope → C-1 gate; sin match → `eligible=false` → no-dispatch | `context-media.ts:181-201,216-226` |
| RUNTIME: resend/recovery/claim per-asset | `context-media.ts:229-259,267-300,319,342-374` |
| Matchers léxicos (plural dirección opuesta; intent `intent <tag>`) | `src/lib/runtime/media.ts:11-36,48-53` |
| Trigger también identifica producto (doble uso del campo) | `src/lib/runtime/product-recommendation.ts:34-64` |
| Prompts: `[IMAGEN_DISPONIBLE]` exige trigger; feedback "eligible false ⇒ no había media" | `src/lib/ai/prompts.ts:140-144,487-494` |
| Datos vivos (biz `4fb7418d-6c98-4a09-9094-4e4e4b2006a6`) | Back2Fit^A `f438d314` "faja, precio" / B `257b87f8` "talla"; Neurofeet `3997bdea` frase-precio; Neurotin `02809070` "calcetin, tin, neurotin, imagen"; Bye Canas sin assets; genéricos `76726901` "Precio, fotos" etc.; `position` NULL en todos |

---

## 3. Contrato anterior (declarado)

1. `product_id ≠ NULL` ⇒ el medio pertenece al producto.
2. Pertencia al producto + contexto activo = base de envío.
3. `trigger_condition` es OPCIONAL y solo REFINA.
4. Con condición vacía ⇒ el medio acompaña al producto activo.
5. `product_id = NULL` ⇒ medio genérico activado solo por keywords.

## 4. Contradicción encontrada

El runtime implementa `trigger_condition` como **requisito OBLIGATORIO** (`.not('trigger_condition','is',null)` + `item.trigger_condition ? match : false`). `NULL/vacío` = asset muerto. No existe ninguna vía de "producto activo ⇒ emisión". **El Dashboard declara opcional; el runtime exige.** DASHBOARD ≠ RUNTIME. Pagan los FAIL de BATTERY-002.

---

## 5. Contrato nuevo — decisión canónica

### 5.1 Autoridad sobre existencia de media (Fase 1 — R1)

**CATALOG/MEDIA posee la autoridad normativa sobre qué media existe.** El `products` + `knowledge_items` definen: existencia, pertenencia a producto, activación (`is_active`), condición/refinamiento (`trigger_condition`), rol (principal/especializada) y orden determinista (`position`). La Existencia NO es del prompt: el AI/PROMPT jamás decide si un asset existe; solo recibe el estado real del runtime.

- **R1.1** `product_id` = "este asset pertenece a este producto" (ownership). Interactúa con `active_product_scope` como **filtro de pertenencia**: un asset es candidato solo si `product_id ∈ active scope` **o** `product_id IS NULL` (genérico). Pertener ≠ dispara envío.
- **R1.2** `trigger_condition` = **REFINADOR OPCIONAL** (opción B). Semántica: *cuándo* dentro de su producto/scope. NO habilita, NO reemplaza, NO es requisito existencial. Refina la elegibilidad **luego** de que exista la intención.
- **R1.3** `trigger_condition = NULL/vacío` = **"medio incondicional del producto"** (se envía con su producto cuando el scope está activo y hay intención de media o el medio es el seleccionado). Nunca es "muerto". Definición normativa inequívoca.
- **R1.4** `trigger_condition = X` = **condiciona/refina** la elegibilidad: el asset solo se despacha cuando la intención/media-resolución matchea X, siempre que X sea satisfecha por la señal **normalizada** (no por keywords literales brutas aisladas fuera de intención). X no otorga elegibilidad por sí solo si no hay intención de media; no la quita si la hay (salvo bloqueo C-1/idempotencia).

### 5.2 MEDIA_REQUEST (Fase 2 — R2)

**SÍ existe el concepto explícito `MEDIA_REQUEST`** (intención de media), detectado por **normalización lingüística + intent semántico en RUNTIME** — opción **D (combinación controlada)**, NO simplemente rellenar triggers.

Vocabulario mínimo de activación de intención (normalizado): `foto`, `foto(s)`, `fotito`, `imagen`, `imágenes`, `enseñame`, `muéstrame`, `ver`, `mostrar`, `mandar/me mandas` (con verbo de petición + palabra-media). La lista es extensible en code (runtIme), pero el contrato es: **los triggers del catálogo NO son el léxico de intención**.

- **R2.1** Intención de media + scope explícito + asset elegible → dispatch determinista sin depender de keywords del catálogo.
- **R2.2** No se acepta "agregar palabras a los triggers": (a) sobrecarga el campo (hoy ya cumple 3 roles); (b) contamina cross-product (un keyword global en el catálogo afecta todos los productos); (c) el catálogo no debe ser el diccionario lingüístico; (d) viola separación CATALOG vs RUNTIME (Fase 7).

### 5.3 Selección determinista — media principal vs especializada (Fase 3 — R3)

Regla operacional (determinista, sin heurística de color/precio/talla del LLM):

1. Elegibles = activos, en-scope (o genérico), satisfaciendo (intención de media **o** condición que matchea), no-claimados.
2. **Prioridad 1 — Especializada por condición**: si un asset con `trigger_condition` matcheante satisface la intención → se selecciona (el más específico según order determinista `position ASC, created_at ASC`).
3. **Prioridad 2 — Principal**: si NO hay match especializada pero hay intención de media → se selecciona la **media principal** del producto (incondicional `NULL/vacío`, o la de menor orden = representativa según contrato DEC-20260825).
4. Prioridad 3 — Ninguna (ver 5.4).
5. `POSITION` ordena principal/especializada; nunca es decisión del LLM. El sistema no selecciona de forma arbitraria: si no hay asset elegible → haga lo que 5.4–5.5 deciden.

Casos normativos Back2Fit (asset A=foto `faja, precio`; asset B=testimonial `talla`):

| Caso | Mensaje | Decisión |
|------|---------|----------|
| Caso A → **A** | "¿Me mandas una foto de Back2Fit?" | Intención media + scope Back2Fit, sin condición matcheante → **Principal A**. |
| Caso B → **B** | "¿Cómo sé mi talla de Back2Fit?" | Condición `talla` matchea → **Especializada B**. |
| Caso C → **B** | "¿Me enseñas una foto de las tallas de Back2Fit?" | Intención media + condición `talla` matchea → **Especializada B** (condición prioriza). |
| Caso D → **A** | "¿Cuánto cuesta Back2Fit?" | Condición `precio` matchea → **Principal A** (su condición). |

Múltiples assets: la selección es determinista por las reglas 2-3 (condición primero; sino principal; nunca múltiples en el mismo turno salvo que el contrato lo autorice explícitamente — NO se autoriza).

### 5.4 Neurofeet — contraste (Fase 4 — R4)

"¿Me mandas una foto de Neurofeet?" → intención de media + scope Neurofeet. **El asset `3997bdea` existe** pero hoy no responde: por (a) **runtime** (requisito obligatorio del trigger) Y (b) **configuración de datos** (trigger es frase completa, no lista de keywords; no match normalizado con "foto") Y (c) **falta de asset principal** (el único asset es condicionado; no hay `NULL/vacío` como principal). NO se modifica nada en esta decisión.

### 5.5 Multi-producto (Fase 5 — R5)

**Opción A — pedir aclaración.** Se preserva C-1 (decisión previa DEC-20260830): scope ambiguo (`[Back2Fit, Neurotin]`) → **nunca selección arbitraria ni dispatch**; el sistema responde con pregunta de aclaración. Queda prohibido elegir "el primero/último" por cualquier razón. La petición de aclaración se emite desde la capa AI/PROMPT **por instrucción de contrato** (no emergent-process), recibiendo `MEDIA_SCOPE_AMBIGUOUS` del runtime.

### 5.6 Producto sin media (Fase 6 — R6)

Caso Bye Canas ("¿Me mandas una foto de Bye Canas?") — triple señal normativa:

| Señal | Significado | Comportamiento normativo |
|-------|-------------|--------------------------|
| `MEDIA_UNAVAILABLE_FOR_PRODUCT` | scope válido, el catálogo NO tiene asset activo para ese producto | NO inventar asset, NO URL falsa, NO afirmar envío. MIA lo explica truthful ("todavía no tengo fotos de <producto>") |
| `MEDIA_REQUEST_NOT_RECOGNIZED` | no hubo intención de media detectable | NO decir "no puedo enviar imágenes"; el modelo responde textualmente con naturalidad, sin afirmar ni negar una capacidad genérica |
| `MEDIA_SCOPE_AMBIGUOUS` | multi-producto sin jerarquía | preguntar aclaración (5.5) |

Regla de no-afirmación (R7): el AI jamás afirma que envió una imagen si el runtime no la despachó; y NO dice "no puedo enviar imágenes" cuando `MEDIA_UNAVAILABLE_FOR_PRODUCT` o `MEDIA_REQUEST_NOT_RECOGNIZED` (el sistema sí puede, ese producto/caso concreto no tiene asset/intención).

### 5.7 Relación con Knowledge (Fase 7 — R7)

| Capa | Responsabilidad |
|------|-----------------|
| **CATALOG/MEDIA** | existe media (qué, de qué producto, activa/inactiva), condición/refinamiento, rol y orden determinista, selección principal/especializada |
| **KNOWLEDGE** | texto: características, precio, tallas, beneficios, políticas. **NO es el motor de selección de imágenes**; no necesita conocer por sí mismo la existencia de cada asset para seleccionar (recibe estado del runtime) |
| **RUNTIME** | coordina `intent + active product scope + media catalog`; decide dispatch; emite claims; entrega estado real |
| **AI/PROMPT** | recibe el estado real (dispatched / no disponible / ambiguo / no reconocido) y lo refleja; nunca inventa dispatch ni niega capacidad genéricamente |

**Posición evaluada y adoptada:** Knowledge NO debe convertirse en motor de selección. El runtime es el único que selecciona. Se elimina el colapso entre "no hay media" vs "no matcheó".

### 5.8 Idempotencia (Fase 8 — R8)

Política normativa:

- **Nueva intención** = nuevo ask que legitima seleccionar un asset **no-claimado** del scope (ej. preguntar tallas tras precio). EL MISMO asset NO se re-envía automáticamente solo porque el producto sigue activo.
- **Resend explícito** (T4 "¿me mandas la foto otra vez?", T5 "enséñamela de nuevo") = re-request detectado por señal explícita (`isResendRequest` correcto + señal reparada), dirigido al asset **ya claimado** del scope. **Permite re-presentación una sola vez.** Es crítico: hoy el resend muere en `eligible=false` antes de la rama (C07). La rama de resend debe alcanzarse **sin exigir match de trigger** (identidad del asset a re-enviar = ya-claimado en conversación).
- **Nuevo asset request** (T6 "¿tienes otra foto?") = solicitud de segundo asset; si existe otro elegible no-claimado → se envía; si no → se aclara que solo existe uno, SIN repetir el claimado.
- **Estado a conservar:** `chat_media_dispatched` con `(conversation_id, knowledge_item_id)` UNIQUE y `state ∈ claimed|dispatched|failed` (k palabra: claim ≠ delivered; P1-4 legacy). **Granularidad:** por par `(conversation × asset)`. NO se crean gates de producto adicionales (`media_sent_products` deprecated).
- **Casos T1-T6:** T1 media tampoco fue negada (control positivo Neurotin). T2 (precio) no repite asset (ya claimado → queda bloqueado); T3 tampoco repite; T4/T5 resend habilitado; T6 nuevo asset si existe. **`isResend` actual NO se asume correcto** — se auditará en la tarea de implementación según esta política.

### 5.9 Invariantes obligatorios (Fase 9 — R9)

| ID | Invariante | Fuerza |
|----|-----------|--------|
| INV-MEDIA-001 | Media pertenece a un producto (`product_id` o genérico explícito) | Block |
| INV-MEDIA-002 | Media no se despacha fuera del active scope del producto; si es genérico, solo con scope activo único | Block |
| INV-MEDIA-003 | Scope ambiguo (C-1) jamás selecciona de forma arbitraria; NO dispatch | Block |
| INV-MEDIA-004 | `trigger_condition = NULL/vacío` = medio incondicional del producto (acompaña su scope); NUNCA "muerto"/excluido | Block |
| INV-MEDIA-005 | `trigger_condition = X` refina/condiciona DENTRO del producto; no reemplaza ni habilita por sí solo | Block |
| INV-MEDIA-006 | MEDIA_REQUEST se detecta por normalización/intent en runtime; NO depende de keywords del catálogo | Block |
| INV-MEDIA-007 | Se distingue principal vs especializada por rule determinista (condición → principal → ninguna) | Block |
| INV-MEDIA-008 | Asset inexistente no produce dispatch | Block |
| INV-MEDIA-009 | Asset inactivo no produce dispatch; asset con URL no-segura no produce dispatch | Block |
| INV-MEDIA-010 | MIA jamás afirma dispatch si runtime no despachó | Block |
| INV-MEDIA-011 | El mismo asset no se repite automáticamente sin nueva intención | Block |
| INV-MEDIA-012 | Nueva intención explícita (resend/new-asset-request) permite resend único | Block |
| INV-MEDIA-013 | Producto sin media produce `MEDIA_UNAVAILABLE_FOR_PRODUCT` explicado, sin URL ni claim | Block |
| INV-MEDIA-014 | La selección de media es determinista (misma entrada → misma salida) | Block |
| INV-MEDIA-015 | Catalog y Runtime implementan el mismo contrato (Dashboard ↔ runtime, R1-R8) | Block |

---

## 6. Alcance / Fuera de alcance (Fase 11)

**Alcance de esta decisión (documental):** definir R1-R8 + invariantes + casos normativos. NO autoriza implementación.

**Fuera de alcance / casos que siguen BLOQUEADOS hasta nueva tarea:**
- Modificar código (`context-media.ts`, `media.ts`, `context-scope.ts`, `core.ts`, `runtime.ts`, `prompts.ts`, `product-recommendation.ts`, `intents.ts`, `media-guard.ts`, `import/engine.ts`).
- Modificar prompts (`[IMAGEN_DISPONIBLE]`, feedback de media).
- Modificar catálogo / `knowledge_items` (triggers, `product_id`, `media_type`, `position`, `is_active`).
- Modificar Knowledge textual, `products`, `chat_media_dispatched`.
- Migraciones nuevas (por ejemplo `MEDIA_REQUEST` fields, `role`); tests; assets; Storage.
- Re-ejecutar los 6 FAIL ni crear `MEDIA_REQUEST` endpoint.
- Feature flagging sin tarea.

## 7. Riesgos

- (implementación tardía) mientras no haya tarea, los FAIL persisten en producción: el sistema "no tiene fotos" de productos que sí las tienen → riesgo de venta CERO y fidelidad. Mitigación futura: tarea con gates `lint/build/unit/e2e/chrome_devtools/security_review/stress_test` y Golden Tests GT-01..GT-35 (context-media) + nuevos casos.
- Sobre-selección de "principal" sin matcher de condición: si un producto tiene varias imágenes incondicionales, la regla debe ordenar por `position`, sino `created_at` (determinista). Riesgo de ambiguedad inexistente si se mantiene la regla.
- Riesgo de "intención de media" demasiado amplia (p. ej. "ver" en contexto distinto). Mitigación: definir palabras-media + verbo de petición; quedará fijado por Golden Tests.

## 8. Estrategia de regresión

- Al implementar (futura tarea): correr `RESPONSE-BATTERY-002` esperando primeramente convertirlos FAIL en no-fail según R3/R5/R6/R8 (control positivo Neurotin se mantiene; control negativo Bye Canas se mantiene con explicación truthful). Verificar C-1 intacto, idempotencia por asset UNIQUE, y Golden Tests de context-media. Revisar que NO se repita asset (T1→T2→T3) y resend solo en T4/T5/T6.

## 9. Compatibilidad con B3

- B3 (aceptado, `3c61c86`) inyecta product scope activo del runtime en el contexto de generación. Compatible 1:1: ahora el runtime también emite el estado de media (dispatch/no-dispatch) para el MISMO scope canónico. No contradice decisiones D1/D2/D5/C-1 previas. El contrato nuevo es la capa media sobre el scope ya canonizado.

---

## 10. Decisión final — votos

| Agente | Voto | Rationale |
|--------|------|-----------|
| CTO | APPROVE | Contrato canónico simple: CATALOG autoridad, trigger opcional refinador, MEDIA_REQUEST en runtime. Resuelve los 6 FAIL sin heurísticas de LLM. |
| Architect | APPROVE | R1-R8 cierran la divergencia Dashboard/runtime en una sola regla determinista; consistente con D1/D2/D5/C-1 (DEC-20260830) y DEC-20260825. |
| Domain Expert | APPROVE | Media ≠ Knowledge (regla del dominio); CATALOG selecciona, KNOWLEDGE no. Sin conceptos fusionados. |
| Product Manager | APPROVE | El usuario pide foto y la recibe; idempotencia natural; mensajes truthful. Sin complejidad innecesaria. |
| Database | APPROVE | Sin cambios de esquema en esta decisión; invariantes 001-015 verificables; trigger NULL = incondicional (contrato nuevo queda normado). |
| Backend | APPROVE | Runtime coordina intent+scope+catálogo; resend alcanzable sin matcher de trigger (cierra C07); determinismo. |
| Frontend | APPROVE | Sin cambios de UI en la decisión; Dashboard deja de mentir ("condición opcional") una vez alineado. |
| AI Engineer | APPROVE | Prompt recibe estado real del runtime; no inventa; feedback diferenciado (R6/R7). |
| Performance | APPROVE | Sin queries extra normadas; selección es lectura filtrada; sin N+1. |
| Security | APPROVE | URL seguro ya tenido en cuenta (media-guard); sin superficie de confianza nueva en la decisión. |
| Analytics | APPROVE | El estado de media queda medible (despatch decision log), sin telemetría excesiva. |
| QA | APPROVE | Golden Tests GT-01.. + casos Back2Fit/Neurofeet/Bye Canas/idempotencia T1-T6; gates obligatorios. |
| Godzilla | APPROVE | Attack-vectors: inyección en prompt del feedback (AI), URL no-segura (security), re-petición masiva (idempotencia), ambigüedad multi-producto; todo bloqueable inv-media 002-015. |
| Release | APPROVE | NINGUNA acción de git ahora; sin commit/push/deploy; esta decisión no toca el árbol. |
| Memory Engineer | APPROVE | Se registra la decisión para new task futura; sin cambios de memoria activos. |

**Resultado:** Unanimidad → `DECISION_ACCEPTED`. **NO IMPLEMENTATION** — la implementación requiere nueva tarea de Governance.

---

**Decision recorded:** 2026-09-04 · **Decision authority:** Engineering Council (votación unánime) · **Decision ID:** DEC-20260904-MEDIA-CONTRACT · **Manifest:** `.governance/tasks/DEC-20260904-MEDIA-CONTRACT.json`
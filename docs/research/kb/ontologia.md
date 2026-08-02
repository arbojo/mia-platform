# Clasificación Ontológica de la KB (P.9)

**Entregable:** ontología del modelo. ¿Qué es realmente cada principio? La clasificación convierte la KB en un **modelo computacional del comportamiento del comprador**.

## Taxonomía (categorías exclusivas — una por principio)

| Categoría | Definición | Dónde vive en el modelo |
|---|---|---|
| **Estado del comprador** | una condición mental que el comprador OCUPA | define el eje ESTADO |
| **Observable** | una señal DETECTABLE en la conversación | alimenta al extractor |
| **Fuerza de transición** | un mecanismo que MUEVE al comprador entre estados | pondera la matriz |
| **Restricción del sistema** | una regla que el MOTOR debe respetar | afecta arquitectura/pesos |
| **Heurística cognitiva** | un atajo mental que el comprador usa | explica mecanismos |
| **Regla de decisión** | una regla que gobierna la decisión | predice la decisión |
| **Técnica (descartar)** | procedimiento del vendedor; no pertenece a MIA | descartar |
| **Contexto (descartar)** | circunstancia de industria/producto; no universal | descartar |

## Clasificación de los principios

| # | Principio | ¿Qué es realmente? | Justificación |
|---|---|---|---|
| P-001 | Escalera de conciencia | **Estado del comprador** | define el eje de conciencia (`explorando`→`transaccional`) |
| P-002 | Decisión iterativa | **Restricción del sistema** | el grafo debe permitir ciclos; los retrocesos no son fallos |
| P-003 | Riesgo multicompuesto | **Regla de decisión** | el comprador decide reduciendo riesgo percibido en 5 tipos |
| P-004 | Procesamiento dual | **Heurística cognitiva** | la ruta periférica es procesamiento heurístico; el MODO es su operacionalización |
| P-005 | Disonancia post-decisión | **Estado del comprador** | condición post-compromiso (`esperando`, `evaluando_resultados`) |
| P-006 | Primacía emocional | **Heurística cognitiva** | S1/afecto domina; la razón racionaliza después |
| P-007 | Comprensión del problema | **Estado del comprador** | `descubriendo` / `comprendiendo` |
| P-008 | Filtro social | **Restricción del sistema** | el motor debe ponderar la evidencia verbal como débil |
| P-009 | Brecha intención-comportamiento | **Restricción del sistema** | ponderar pasado > hipotético |
| P-010 | Compromiso = inversión | **Observable** | catálogo de señales de inversión (divisas y fuerza) |
| P-011 | Contaminación por promoción | **Restricción del sistema** | extraer antes de promocionar; el pitch degrada la evidencia |
| P-012 | Auto-persuasión | **Heurística cognitiva** | el comprador se convence por coherencia con lo que él mismo dijo |
| P-013 | Conciencia de la consecuencia | **Fuerza de transición** | el mecanismo que mueve `descubriendo → consecuente`; el estado `consecuente` es su resultado |
| P-014 | Heurísticas por condiciones de recurso | **Restricción del sistema** | regla: bajo incertidumbre/sobrecarga/prisa/bajo involucramiento, las señales heurísticas pesan más (modo `emocional`) |
| P-015 | Prueba social | **Heurística cognitiva** | atajo de decisión bajo incertidumbre: copiar a otros similares |
| P-016 | Autoridad percibida | **Heurística cognitiva** | atajo de decisión: deferir al experto percibido |
| P-017 | Simpatía/afinidad | **Heurística cognitiva** | atajo de decisión: afinidad sesga la preferencia |
| P-018 | Reciprocidad | **Heurística cognitiva** | atajo social: obligación de devolver lo recibido |
| P-019 | Unidad/identidad compartida | **Heurística cognitiva** | atajo de decisión: favoritismo endogrupal ("nosotros") |
| P-020 | Contraste perceptual / anclaje | **Regla de decisión** | la evaluación es relativa al ancla/contexto, no absoluta |
| P-021 | Maximizar vs. satisfacer | **Restricción del sistema** | regla de procesamiento que modula cuándo el comprador se compromete (umbral "suficientemente bueno" vs. "el mejor") |
| P-022 | Sobrecarga de alternativas | **Fuerza de transición (valencia negativa)** | bloquea el avance; escala con el nº de alternativas (P.11) |
| P-023 | Aversión al arrepentimiento | **Fuerza de transición (valencia negativa)** | el temor a decidir mal bloquea el compromiso; espejo negativo de P-013 |
| P-024 | Motivación dual (empuje + atracción) | **Fuerza de transición (valencia positiva)** | la motivación tira del estado futuro (atracción, GAP) además de empujar desde el dolor (P-013); complementa, no sustituye |
| P-025 | Validación / empatía táctica | **Fuerza de transición (valencia positiva)** | reduce la defensa y des-escala `reticente`; la otra cara de la reactancia (Voss + Rogers) |
| P-026 | Percepción de control / autonomía | **Fuerza de transición (valencia positiva)** | devolver el control desactiva la reactancia (Voss + Brehm + Miller&Rollnick); **Fundamental tras la falsación empírica** (restauración de libertad / provisión de elección validadas; d=.79 en clínica) y **reforzado por la falsación de cierre** (el sentido de agencia media los resultados positivos de la no-presión, Yang et al. 2025) |

## P.10 — ¿Fenómeno o síntoma? (clasificación de conceptos)

Segunda lente de clasificación (regla P.10 del charter). P.9 clasifica **principios**; P.10 clasifica **todo concepto** encontrado en una obra. Categorías:

| Categoría | ¿Qué es? | Dónde vive |
|---|---|---|
| **Estado** | condición mental que el comprador ocupa | eje ESTADO |
| **Heurística** | atajo mental que el comprador usa | mecanismos |
| **Fuerza positiva** | mecanismo que MUEVE hacia el compromiso | pondera la matriz (valencia +) |
| **Fuerza negativa** | mecanismo que BLOQUEA o REVIERTE el avance | pondera la matriz (valencia −) |
| **Observable** | señal detectable | extractor |
| **Restricción** | regla de procesamiento que el sistema debe respetar | arquitectura/pesos |
| **Consecuencia** | efecto aguas abajo de otro fenómeno (**síntoma**) | se reduce a su raíz; no crea estado |
| **Técnica (descartar)** | procedimiento del vendedor | descartar |

**Reglas de la lente:**
1. **Anti-reificación:** si un concepto es una `Consecuencia`, no se registra como estado ni como principio nuevo; se reduce a su mecanismo raíz. ("Parálisis" → `confundido`; "arrepentimiento" → P-023/P-005; "autoculpa" → `frustrado`.)
2. **Valencia de las fuerzas (refinamiento de P.9):** la "Fuerza de transición" de P.9 se desdobla en positiva (empuja hacia el compromiso, p. ej. P-013) y negativa (bloquea o revierte, p. ej. P-022, P-023).
3. **Dos caras del mismo mecanismo:** P-013 (pérdida por NO actuar → urgencia) y P-023 (pérdida por ACTUAR mal → parálisis) son el espejo positivo/negativo de la misma variable.

**Clasificación P.10 de los conceptos de Schwartz** → ver `fuentes/paradox-of-choice.md` §P.10. **Clasificación P.10 de los conceptos de GAP** → ver `fuentes/gap.md`: el Cost of Inaction y la compuerta triple son Observables de P-013 (no estados); el *gap* como motivación es la fuerza positiva P-024.

## Lectura estructural (Influence)

**El momento P.9 de Cialdini:** las "armas de influencia" (P-015..P-019) clasifican como **Heurística cognitiva**, no como Técnica. Si MIA las hubiera leído como técnicas del vendedor, habría descartado la capa de mecanismos más importante del modelo. La clasificación obligatoria (una sola categoría) fue la prueba de fuego: la lectura correcta es invertida (el comprador usa los atajos; el vendedor no "aplica armas").

- Escasez **no** es principio nuevo, pero **se reduce a una familia de señales, no a un solo principio** (corrección tras la falsación empírica de escasez, ver `fuentes/evidencia-escasez.md`): la escasez por **demanda** (popularidad) se reduce a **P-015** (prueba social / cascada informacional); la escasez por **oferta/plazo** (cantidad limitada, fecha límite) se reduce a **P-013** (pérdida de acceso/oportunidad); la exclusividad combina P-013 + señalización social. Coherencia **no** es principio nuevo: se reduce a P-010/P-012.
- Cialdini aporta 1 restricción (P-014), 5 heurísticas (P-015..P-019) y 1 regla de decisión (P-020) — **las capas de heurísticas y reglas que estaban subpobladas empiezan a poblarse** (ver estado de comprensión).

## Fronteras (decisiones tomadas)

- **P-010 (Observable) vs Fuerza:** las señales de inversión son detectables (observables); su efecto (evidencia fuerte de `decidiendo → transaccional`) las convierte en fuerza aplicada. Se clasifica como **Observable** porque define QUÉ detectar.
- **P-013 (Fuerza) vs Estado:** el fenómeno es el paso motivacional (fuerza); `consecuente` es el estado RESULTANTE. La fuerza se registra como principio; el estado ocupa su lugar en el Atlas (estado #3, confirmado tras la falsación de GAP).
- **P-024 (Fuerza) vs Estado:** la atracción al estado futuro es una fuerza que co-conduce hacia `consecuente`/`comprendiendo`; no crea un estado nuevo (el destino deseado es el *contenido* de la motivación, no una condición mental que se ocupa).
- **P-025/P-026 (Fuerza) vs Estado:** ambas son fuerzas positivas que des-escalan `reticente`; no crean estados nuevos (el estado objetivo ya existe: `reticente`, confirmado). H-018 resuelta provisionalmente: **dos fuerzas** (MI distingue aceptación/empatía de partnership/autonomía).
- **P-004 (Heurística) vs Estado:** el principio es el mecanismo de procesamiento; la dimensión MODO es su operacionalización como estado. No se duplica.

## Estado de comprensión

- **26/26 clasificados (P.9).** Ninguno en "todavía no está entendido".
- Distribución P.9: Estado del comprador 3 (P-001, P-005, P-007) · Restricción del sistema 6 (P-002, P-008, P-009, P-011, P-014, P-021) · Heurística cognitiva 8 (P-004, P-006, P-012, P-015, P-016, P-017, P-018, P-019) · Regla de decisión 2 (P-003, P-020) · Fuerza de transición 6 (P-013, **P-024, P-025, P-026 positivas**; **P-022, P-023 negativas**) · Observable 1 (P-010).
- **Lectura estructural:** con Schwartz (P-021..P-023) el modelo adquiere por primera vez **fuerzas negativas** (bloqueadores): sobrecarga de alternativas y aversión al arrepentimiento. El motor de transiciones ahora tiene dirección y contrafuerzas, no solo motores. La ontología P.9 no contemplaba valencia; P.10 la añade. Con **NSPD (P-025/P-026)** el modelo adquiere la **capa de fuerzas anti-reactancia**: fuerzas positivas cuyo efecto neto es des-bloquear (la otra cara de la reactancia), no empujar. Con **MI**, esa capa queda confirmada con evidencia controlada: P-026 asciende a confirmada (3 fuentes, Alta) y `reticente` (estado) queda confirmado. Con la **falsación empírica (meta-análisis de reactancia)**, `reticente` y P-026 ascienden a **Fundamental** — el registro cruza por primera vez el umbral de la **evidencia metodológica** (ver `fuentes/evidencia-reactancia.md`). Con la **falsación empírica de cierre** (`fuentes/evidencia-cierre.md`), **P-009 y P-010 ascienden a Fundamental** (en forma diferenciada: la versión ingenua de P-010 quedó refutada) y la categoría **Técnica (descartar)** se reafirma con un criterio empírico nuevo: **15 de 39 técnicas de cierre estructurales (assumptive, alternative-choice, trial, takeaway...) no tienen un solo estudio revisado por pares** (closing-evidence-atlas, 2026) — la formación de ventas enseña 200+ técnicas cuya base empírica nunca fue auditada. La ontología no debe codificar procedimientos del vendedor sin evidencia: los cierres estructurales no se convierten en principios. Con la **falsación empírica de escasez** (`fuentes/evidencia-escasez.md`), **P-013 asciende a Fundamental** (la pérdida de acceso/oportunidad mueve de forma robusta: tres meta-análisis) y la **reducción de Influence se corrige**: la escasez es una familia de señales — por demanda se reduce a **P-015** (prueba social), por oferta/plazo a **P-013** (pérdida). Con la **falsación empírica de prueba social y autoridad** (`fuentes/evidencia-social-proof.md`), **P-015 asciende a Fundamental** (la norma descriptiva predice la conducta directamente — conformidad d=0.89; MASEM β=.25, mayor que las actitudes) y **P-016 queda delimitada como Muy Alta** (heurística de ruta periférica: pequeña d=0.14, condicionada a ausencia de actitud previa y baja elaboración, decadente). La capa de heurísticas (P-015..P-019) queda confirmada empíricamente como **señales de ruta periférica** (P-004/P-014) y no como palancas universales.
- **Cero técnicas y cero contextos**: señal de que la KB no está contaminada con lo circunstancial — incluida la obra más "técnica" del registro hasta ahora (Cialdini fue leído del lado del comprador), la primera obra adversarial (Voss fue leído como contexto, no como técnica de negociación), la segunda (MI fue leída como fuerzas internas, no como protocolo de entrevista) y la falsación empírica de cierre (las técnicas de cierre estructurales no sobreviven la auditoría: **38% sin un solo estudio**, `fuentes/evidencia-cierre.md`).

## Regla de incorporación

Todo principio nuevo (incluidos los de Influence y futuras obras) **debe** entrar en esta tabla con una sola categoría. Si al intentarlo no se puede clasificar, no se registra como principio: se investiga más.

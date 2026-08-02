# Universal Buyer State Engine (UBSE) — Modelo v1.1

**Status:** Propuesto por el Concilio — sprint de investigación. Sin implementación. v1.1 incorpora las 8 enmiendas de la deliberación (sesión 2): HMM, adjacencia esparsa, sidecar rules, `explicito` como señal débil, contrato de extracción, métrica de progreso neto, dwell por estado y corrección del conteo de estados.

## 1. Contexto e hipótesis

MIA detecta intención de compra y responde preguntas. Hipótesis del sprint:

> Las personas no compran siguiendo un producto; compran siguiendo un estado mental.
> El producto cambia; la psicología del comprador cambia mucho menos.

Si es correcta, MIA no debería decidir por la intención detectada sino por el **estado cognitivo y emocional** del comprador, y el motor de ventas se vuelve reutilizable para cualquier catálogo.

**Criterio de éxito:** cambiar de catálogo (zapatos → seguros → cursos → churros → software) debe ser configuración de conocimiento de negocio, no cambio de lógica. El "cerebro vendedor" permanece intacto.

## 2. Resultado de la investigación — patrones convergentes

La revisión de fuentes (SPIN Selling, The Challenger Sale, To Sell Is Human, Influence, Never Split the Difference, The Psychology of Selling, How Customers Think, Buyology, Thinking Fast and Slow, The Mom Test) y de la literatura académica converge en tres hallazgos independientes:

### 2.1 Existe una escalera de estados mentales universal
- **Eugene Schwartz** (*Breakthrough Advertising*, 1966): Unaware → Problem Aware → Solution Aware → Product Aware → Most Aware. "Awareness es lo que hay en la cabeza del prospecto, no su posición en el embudo." Cada estado exige un mensaje distinto; el mismo producto con cinco aperturas distintas.
- **Engel-Kollat-Blackwell / Engel-Blackwell-Miniard** (1968/1990s): Need recognition → Information search → Evaluation of alternatives → Purchase decision → Post-purchase behaviour. **Crítico:** los estados 2 y 3 se intercalan (el comprador va y vuelve); no todos pasan por todos los estados; la profundidad depende del involvement.
- **AIDA / Hierarchy of Effects:** atención → interés → deseo → acción (escala cognitiva-afectiva-conativa).

Convergencia: **la conciencia del problema y de la solución es el eje universal**. Se mantiene independiente del producto.

### 2.2 El riesgo/confianza es un estado, no una etapa
- El modelo EKB descompone la evaluación en **5 tipos de riesgo: monetario, funcional, físico, social, psicológico**.
- SPIN (implication), Voss (empatía táctica), Cialdini (autoridad/prueba social), disonancia post-compra (Festinger): todos tratan la reducción de riesgo como operación mental central, **recurrente en cualquier punto** de la decisión.

### 2.3 El modo de procesamiento determina qué persuade
- **ELM (Petty & Cacioppo)**: ruta central (analítica, argumentos sólidos → actitudes durables) vs ruta periférica (emocional, señales como credibilidad, prueba social, atractivo). El mismo argumento funciona distinto según el modo.
- **Kahneman** (S1/S2), **Zaltman** (95% subconsciente), **Buyology**: el comportamiento de compra mezcla deliberación y heurística.
- Valida la Hipótesis 2: **dos personas en el mismo estado requieren conversaciones distintas según su modo.**

**Conclusión de la investigación:** no existe un modelo único con los estados "verdaderos", pero sí **convergencia independiente** en (a) conciencia/readiness, (b) evaluación de riesgo, (c) modo de procesamiento, (d) fase post-decisión con disonancia. El UBSE se construye sobre esa convergencia; no copia ningún modelo.

## 3. Decisiones sobre la lista preliminar

| Preliminar | Decisión | Razón |
|---|---|---|
| Explorando | ✅ Se conserva como `explorando` | = Unaware de Schwartz / pre-problema |
| Descubriendo un problema | ✅ `descubriendo` | = Problem Aware / Need Recognition |
| Comprendiendo | ✅ `comprendiendo` | = Solution Aware / Information Search |
| Comparando alternativas | ✅ `comparando` | = Product Aware / Evaluation of Alternatives |
| Construyendo confianza | 🔀 Se funde en `evaluando_riesgo` | Misma operación mental: reducción de riesgo percibido |
| Evaluando riesgo | ✅ `evaluando_riesgo` | Estado **recurrente**, no etapa |
| Decidiendo | ✅ `decidiendo` | Commitment en curso |
| Comprando | ❌ Se elimina | Es una **acción**, no un estado mental |
| Esperando | ✅ `esperando` (post-decisión) | Ventana de anticipación + disonancia |
| Experimentando | ✅ `experimentando` | Uso del producto |
| Evaluando resultados | ✅ `evaluando_resultados` | Resultado vs expectativa; disonancia/resolución |
| Recomendando | ✅ `abogando` | Satisfacción → recomendación |
| — | ➕ `confundido` | Sobrecarga de información / inacción (EKB: búsqueda sin conclusión reactiva) |
| — | ➕ `frustrado` | Experiencia negativa; riesgo de churn/refund. Nunca vender aquí |
| — | ➕ `desenganchado` (terminal) | Abandono silencioso; necesario para no dejar al usuario "eternamente decidiendo" |

## 4. El modelo

### 4.1 Estructura: tres dimensiones ortogonales

**A) ESTADO** — dónde está el comprador en su decisión (cognitivo/afectivo).

*Núcleo universal de venta (pre-decisión):*
1. `explorando` — sin problema reconocido; navegando
2. `descubriendo` — reconoce el problema; no sabe que hay soluciones
3. `comprendiendo` — sabe que hay soluciones; aprende el panorama
4. `comparando` — evalúa alternativas contra criterios
5. `evaluando_riesgo` — reduce riesgo percibido (monetario/funcional/social/psicológico); **recursivo**
6. `decidiendo` — compromiso en curso; dudas finales
7. `transaccional` — listo para actuar; solo necesita el camino despejado

*Ciclo post-decisión (retención/amplificación):*
8. `esperando` — anticipación post-compra (alta disonancia)
9. `experimentando` — uso del producto
10. `evaluando_resultados` — resultado vs expectativa; disonancia o confirmación
11. `abogando` — satisfacción resuelta → recomendación/referido

*Transversales (excepciones):*
12. `confundido` — sobrecarga; indecisión; necesidad de simplificación
13. `frustrado` — experiencia negativa; recovery primero
- `desenganchado` (terminal) — abandono silencioso

**B) MODO** — cómo procesa y con qué actitud. La lista preliminar mezcla tres subdimensiones ortogonales:

1. **Procesamiento** (ELM / Kahneman): `analitico` | `emocional` ← el eje que divide la estrategia
2. **Activación**: `calmado` | `urgente` (distraído = activación baja + elaboración baja)
3. **Disposición**: `curioso` | `esceptico` | `desconfiado` | `prudente` | `impulsivo` | `confiado`
4. **Experiencia** (quasi-estable, rasgo): `primerizo` | `intermedio` | `experimentado`

**C) FASE** — `pre-decisión` | `post-decisión` (organizacional; implícita en los estados).

### 4.2 Motor de inferencia — modelo híbrido

**No es una máquina de estados determinista** (el comprador no sigue un embudo lineal; EKB muestra idas y vueltas) **ni un árbol probabilístico** (fuerza una única trayectoria). Es:

> **Grafo de estados con ciclos + inferencia probabilística (belief update Bayesiano), donde el LLM es el extractor de evidencia, no el juez del estado.**

- El **grafo** codifica los estados y transiciones posibles (estructura fija y universal) — **adjacencia esparsa** (4.4.1).
- La **matriz de transición** `P(s_t | s_{t-1})` y el **modelo de emisión** `P(evidencia | s_t)` (formulación HMM, 4.4) son las únicas partes aprendibles; prioris iniciales sembradas de la literatura, calibradas con etiquetas del operador.
- El motor mantiene un **vector de creencia** `P(estado_i | evidencia_1..t)` por conversación, actualizado incrementalmente por turno.
- **Confianza = probabilidad posterior** del estado dominante + incertidumbre epistémica (entropía del vector).
- Si la entropía supera un umbral → **estado ambiguo** → el comportamiento recomendado es una **acción de desambiguación** (pregunta diagnóstica) antes de comprometer estrategia.
- **Las transiciones hacia atrás son normales**, no fallos: `comparando ⇄ evaluando_riesgo` es el bucle más común.
- **Sidecar rules:** los disparadores exógenos (silencio > umbral, abandono, timeout) **no son aristas del grafo**; emiten evidencia `meta` que alimenta la actualización de creencia (4.4.3).

### 4.3 Evidencia que extrae el LLM por turno

Schema: `[{ type, signal, strength: 0-1 }]`

| Tipo | Señales |
|---|---|
| `question` | precio, garantía, plazos, envío, comparación explícita, uso, "es para regalo", presupuesto |
| `statement` | problema declarado, objetivo, criterios, restricciones, mención de competidor |
| `objection` | duda, objeción de precio/tiempo/confianza, "ya tengo otra opción" |
| `emotion` | léxico emocional vs analítico, intensidad, escepticismo, frustración, entusiasmo |
| `behavior` | longitud, densidad de preguntas, tiempo entre mensajes, re-preguntas, cambios de tema |
| `explicito` | "estoy comparando", "me preocupa el riesgo", "lo quiero ya", "déjame pensarlo" |
| `post-purchase` | mención de entrega/uso/resultado/queja/agradecimiento |
| `meta` | turno #, duración, repeticiones, silencios, abandono |

**Contrato de extracción (enmienda 7):** salida JSON validada contra este enum cerrado; **máximo 6 items por turno**; prompt del extractor **separado** del de generación de respuesta (resistencia a prompt injection); `explicito` es autorreporte → **señal débil**, nunca suficiente sola (requiere corroboración con `behavior` o `objection`).

### 4.4 El motor se formula como filtro bayesiano (HMM): transición y emisión separadas (enmienda 2)

#### 4.4.1 Matriz de transición `P(s_t | s_{t-1})` — prioris estructurales (enmienda 3)

La parte aprendible se separa en dos: la **estructura** (grafo esparso) y los **pesos**. Los pesos son prioris de la literatura; los no-aristas reciben un prior mínimo (≈0.01) — el grafo restringe, no se aprende un camino libre.

| De → A | Prior inicial | Nota |
|---|---|---|
| `explorando` → `descubriendo` | 0.55 | reconoce el problema |
| `descubriendo` → `comprendiendo` | 0.60 | aprende que hay soluciones |
| `comprendiendo` → `comparando` | 0.60 | surgen criterios/alternativas |
| `comparando` ⇄ `evaluando_riesgo` | 0.55 | bucle más común |
| `comparando` → `decidiendo` | 0.40 | acota opciones |
| `decidiendo` → `comparando` / `evaluando_riesgo` | 0.20 | retroceso legítimo (bucle explícito) |
| `decidiendo` → `transaccional` | 0.70 | compromiso en curso |
| `transaccional` → `esperando` | 0.85 | confirma compra |
| `esperando` → `experimentando` | 0.75 | recepción/uso |
| `experimentando` → `evaluando_resultados` | 0.70 | evalúa resultado |
| `evaluando_resultados` → `abogando` | 0.60 | satisfacción explícita |
| `cualquiera` → `confundido` | 0.15 | sobrecarga/incoherencia |
| `cualquiera` → `frustrado` | 0.15 | experiencia negativa |

#### 4.4.2 Modelo de emisión `P(evidencia | s_t)` — prioris de señal

Mapea cada evidencia extraída a los estados que la hacen verosímil (esto calibra la creencia, en conjunto con la transición).

| Evidencia | Estados que hace verosímiles | Peso inicial |
|---|---|---|
| `statement` (problema/molestia) | `descubriendo`, `explorando` | 0.6 |
| `question` (cómo se soluciona, panorama) | `comprendiendo` | 0.6 |
| `question` (comparación, criterios) | `comparando` | 0.6 |
| `objection` / `question` garantía-riesgo | `evaluando_riesgo`, `comparando`, `decidiendo` | 0.6 |
| `question` precio/pago/pasos finales | `transaccional`, `decidiendo` | 0.7 |
| `post-purchase` (entrega/uso) | `esperando`, `experimentando` | 0.7 |
| `post-purchase` (resultado/queja) | `evaluando_resultados`, `frustrado`, `abogando` | 0.7 |
| `emotion` (frustración intensa) | `frustrado`, `confundido` | 0.7 |
| `emotion` (entusiasmo/resolución) | `abogando`, `decidiendo` | 0.5 |
| `behavior` (densidad/re-preguntas) | `comparando`, `evaluando_riesgo`, `confundido` | 0.4 |
| `explicito` (autorreporte) | el estado declarado | 0.3 — **débil, nunca sola** (enmienda 5) |
| `meta` (timeout/silencio) | `desenganchado`, `confundido` | sidecar |

#### 4.4.3 Sidecar rules — disparadores exógenos, no aristas (enmienda 4)

`desenganchado` no se alcanza por transición del grafo: lo dispara una sidecar rule acumulando evidencia `meta`.

| Regla | Emite | Efecto |
|---|---|---|
| Silencio > umbral tras intención activa | evidencia `meta` | favorece `desenganchado` (terminal) |
| Sin respuesta tras pregunta de MIA ×2 | evidencia `meta` | favorece `desenganchado` |
| Turno largo + muchas preguntas sin conclusión | evidencia `meta` | favorece `confundido` |

### 4.5 Comportamientos recomendados (política declarativa por estado × modo)

| Estado | Estrategia base | Modificador por modo |
|---|---|---|
| `explorando` | orientar, surfear el problema latente; NO vender | analítico: datos del problema; emocional: historia/empatía |
| `descubriendo` | nombrar el dolor con precisión, agitar, presentar la categoría | esceptico: honestidad, sin promesas |
| `comprendiendo` | enseñar el panorama (Challenger), estructura | analitico: profundidad; urgente: resumen primero |
| `comparando` | comparación estructurada por criterios del cliente | analitico: tablas, datos, verificación 3ra parte; emocional: prueba social |
| `evaluando_riesgo` | reducir riesgo: garantías, casos, autoridad, riesgo-reversal | desconfiado: pruebas verificables; prudente: sin presión |
| `decidiendo` | ayudar a decidir: recapitular, acotar opciones, resolver duda final | analitico: pros/contras; emocional: refuerzo |
| `transaccional` | **quitar fricción** (Schwartz: no sobrecomplicar el cierre), paso claro, CTA | urgente: fluidez máxima |
| `esperando` | fijar expectativas, reducir disonancia, confirmación | — |
| `experimentando` | onboarding, quick wins, uso | primerizo: guía paso a paso |
| `evaluando_resultados` | medir resultado con el cliente, reforzar la decisión | — |
| `abogando` | pedir referido/reseña; recompensar | — |
| `confundido` | simplificar, reorientar, una cosa a la vez | — |
| `frustrado` | **recovery primero** (disculpa + arreglo). NUNCA vender | — |
| `desenganchado` | re-engagement con valor; no spam | — |

### 4.6 Métricas de validación

1. **Calibración** — estado inferido vs etiqueta humana (precisión/recall por estado; matriz de confusión) en conversaciones muestreadas.
2. **Lift conversional** — A/B: intención-solo vs UBSE-adaptativo → conversión, ingreso/conversación, time-to-close, tasa de desenganche.
3. **Progreso neto** — % de conversaciones cuyo estado dominante avanza ≥1 posición neta al final, **ignorando los bucles conocidos** (`comparando ⇄ evaluando_riesgo`); alternativa: time-to-commit. Los retrocesos normales no penalizan (enmienda 6). No todas deben terminar en compra.
4. **Post-compra** — satisfacción, retención, tasa de referidos, señales de disonancia.
5. **Test de generalización (criterio de éxito)** — desplegar en un catálogo distinto (churros, seguros, cursos) **sin cambios de lógica**: si la distribución de estados, la calibración y el mapeo comportamiento→acción cambian con el producto, el modelo está acoplado al producto. Además de calibración, medir **dwell por estado** (residencia media): el conjunto de estados debe permanecer intacto y solo variar la residencia (churros vive poco en `comparando`; software B2B vive mucho en `evaluando_riesgo`) (enmienda 8).

### 4.7 Costo y computación incremental (Perf)

- La actualización de creencia es `O(estados²)` por turno (14² = 196 operaciones — trivial, en memoria por conversación) (enmienda 1).
- El costo dominante es la **extracción de evidencia por el LLM**, que se hace **incremental por turno** y en Fase 1 comparte la llamada con la generación de respuesta (un solo call: evidencia + respuesta), o una llamada ligera adicional.
- Sin persistencia pesada en Fase 1; el estado vive en la sesión de conversación.

### 4.8 Límites éticos

- **Nunca explotar comercialmente:** `frustrado` (nunca vender en frustración), vulnerabilidad emocional, disonancia post-compra (no agravar arrepentimiento), urgencia fabricada (nunca escasez falsa).
- **Persuasión ética:** ayudar a decidir bien, no forzar. Principios de Cialdini solo con veracidad. Nunca ocultar información que el cliente pide explícitamente.
- **Privacidad:** el estado se infiere de la conversación ya existente; no se recolecta data nueva. El estado es efímero por conversación; no se construye perfil psicológico permanente sin consentimiento.
- **Transparencia:** si el operador ve el estado, el cliente puede pedir "sin presión" y MIA debe respetarlo.
- **Robustez (enmienda 7):** el extractor es un componente separado de la generación de respuesta; su salida se valida contra el enum cerrado y `explicito` (autorreporte) nunca se usa solo para mover el estado (enmienda 5).

## 5. Roadmap incremental

- **Fase 0 (sin cambios de comportamiento):** extracción de evidencia + inferencia + logging + etiquetado → medir calibración.
- **Fase 1:** panel del operador (radar de estado) + corrección del operador (alimenta calibración).
- **Fase 2:** políticas adaptativas (A/B) — el motor de respuesta consume `(estado, modo)` en lugar de solo intención; la intención pasa a ser una fuente de evidencia más.
- **Fase 3:** calibración continua de prioris con labels; test de generalización en un segundo catálogo.

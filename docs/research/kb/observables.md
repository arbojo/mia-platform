# Diccionario de Observables Conversacionales

**Entregable 3.** Señales observables en la conversación que hacen verosímil un estado o una transición. Se define a nivel de **comportamiento del hablante**, no de contenido del producto. Evoluciona con la evidencia.

## Tipos de evidencia (schema del extractor)

| Tipo | Qué es | Estados que implica | Peso |
|---|---|---|---|
| `question` | pregunta del comprador | según objeto de la pregunta (ver abajo) | — |
| `statement` | declaración de problema/objetivo/criterio/restricción | `descubriendo`, `comprendiendo`, `comparando` | 0.6 |
| `objection` | duda, objeción de precio/tiempo/confianza | `evaluando_riesgo`, `decidiendo` | 0.6 |
| `emotion` | léxico emocional vs analítico, intensidad | según valencia (ver abajo) | — |
| `behavior` | longitud, densidad de preguntas, tiempos, re-preguntas | `comprendiendo`, `comparando`, `confundido` | 0.4 |
| `explicito` | autorreporte del propio estado | el estado declarado | **0.3 (débil, nunca sola)** |
| `post-purchase` | mención de entrega/uso/resultado/queja/agradecimiento | `esperando`, `experimentando`, `evaluando_resultados`, `frustrado`, `abogando` | 0.7 |
| `meta` | turno, duración, repeticiones, silencios, abandono | `desenganchado`, `confundido` | sidecar |

## Catálogo de señales (por objeto de la pregunta)

| Señal | Implica | Nota |
|---|---|---|
| pregunta por "cómo se soluciona", panorama | `comprendiendo` | P-007 |
| pregunta de comparación / criterios / alternativas | `comparando` | P-001 |
| pregunta de garantía / devolución / plazos / riesgo | `evaluando_riesgo` | P-003 |
| pregunta de precio / pago / pasos finales | `transaccional`, `decidiendo` | P-001 |
| mención de competidor | `comparando` | P-001 |
| "es para regalo" / presupuesto | `descubriendo`, `comparando` | contexto de criterio |
| declaración de problema/molestia | `descubriendo` | P-007 |
| "ya tengo otra opción" | `evaluando_riesgo` | P-003 |
| mención de terceros/casos/estadísticas ("muchos eligen X") | `evaluando_riesgo`, `decidiendo` | prueba social (P-015) — **norma descriptiva (lo que hacen)**; mueve la conducta directamente (ruta heurística que evita la intención; MASEM β=.17) |
| mención de lo **aprobado** por otros ("todo el mundo está de acuerdo en que...") | `evaluando_riesgo`, `decidiendo` | norma **injunctiva** (lo que se aprueba) — mecanismo distinto, actúa solo vía intención (débil); NO es P-015 |
| mención de credenciales/experto ("el especialista recomienda") | `evaluando_riesgo`, `decidiendo` | autoridad (P-016) — heurística periférica condicional: requiere **ausencia de actitud previa + señales congruentes + baja elaboración** (P-014); el efecto decae (sleeper) |
| señales de similitud/halagos/asociación con el vendedor | `decidiendo` | simpatía (P-017) |
| concesión mutua / favor previo ("por lo que hiciste por mí") | `decidiendo`, `transaccional` | reciprocidad (P-018) |
| lenguaje "nosotros"/identidad compartida | `decidiendo`, `evaluando_riesgo` | unidad (P-019) |
| referencias de precio previas / orden de presentación | `comparando`, `evaluando_riesgo` | contraste/anclaje (P-020) |
| mención de limitación/escasez por **oferta o plazo** ("solo quedan X unidades", "la promoción termina el viernes") | `consecuente`, `transaccional` | disparador de pérdida de acceso/oportunidad (P-013); la fuente del límite (cantidad vs. tiempo) no modera (Ladeira 2023); exige **veracidad** (C-010) y **no-sustituibilidad** (la escasez de categoría con sustitutos falla; Barton 2022) |
| señales de **demanda** ("600 compraron hoy", "poca stock porque se agota", "quedan pocos de este modelo") | `evaluando_riesgo`, `decidiendo`, `consecuente` | escasez por demanda = **prueba social** (P-015) + FOMO (pérdida de oportunidad, P-013): cascada informacional — el cue más potente del meta-análisis (popularidad δ=0.71; Barton 2022) |
| enumeración creciente de opciones / re-apertura de descartadas | `confundido` | sobrecarga (P-022, sidecar) |
| "no puedo decidir", "todas parecen iguales" | `confundido` | parálisis (Consecuencia de P-022) |
| "¿y si me equivoco?", "¿habré hecho bien?" | `decidiendo` (bloqueado), `confundido` | aversión al arrepentimiento (P-023) |
| comparación post-decisión ("podría haber elegido la otra") | `evaluando_resultados`, `frustrado` | arrepentimiento experimentado (P-005) |
| lenguaje maximizador ("tengo que encontrar la mejor") vs. satisfechor ("esta está bien") | restricción P-021 | modula umbral de compromiso |
| "¿cuál me recomiendas?" (pide reducción) | `confundido`, `decidiendo` | el comprador pide curar/dar default (antídoto, C-015) |
| presupuesto asignado/justificado por el dolor ("esto nos cuesta X al mes") | `consecuente`, `transaccional` | la compuerta de Sandler: dolor > costo de la solución (P-013/P-010) |
| el motivado defiende la solución (argumenta a favor de su valor) | `consecuente`, `decidiendo` | test diagnóstico: el no-motivado acepta la salida con cortesía (P-012/P-013) |
| cuantifica el costo de la inacción ("si no lo arreglamos, perdemos X al mes") | `consecuente` | Cost of Inaction (GAP, P-013): "si no puedes articular el costo de la inacción, no tienes venta" |
| el problema cumple la **compuerta triple** (relevante + urgente + no resuelto) | `consecuente` | compuerta de GAP (P-013): los tres a la vez; el problema solo reconocido no cruza |
| lenguaje de estado futuro deseado ("me gustaría que quedara así", "con esto llegaríamos a X") | `consecuente` | fuerza de atracción (P-024): describe el destino, no solo el problema |
| el comprador reformula su propio insight ("exacto, eso es"; "that's right") | `decidiendo`, `consecuente` | auto-persuasión + apropiación (P-012/P-026); ≠ "tienes razón" (complacencia) |
| le pregunta al vendedor cómo lo resolvería ("¿cómo se supone que haga eso?") | `evaluando_riesgo` | test de riesgo funcional (P-003, calibrated questions) |
| *change talk*: enuncia razones a favor del cambio ("esto me ahorraría...", "con esto por fin...") | `decidiendo`, `consecuente` | dirección de la tensión (MI): la fuerza la articula el comprador (P-012/P-024) |
| *sustain talk*: enuncia razones a favor del statu quo ("no sé si vale la pena", "me da miedo cambiar") | `reticente`, `decidiendo` (bloqueado) | MI: señal de ambivalencia; responder con validación (P-025), no con argumento |
| ambivalencia explícita ("por un lado quiero, por otro me da miedo") | `decidiendo` | tensión de doble polo (MI, H-019); no es evaluación de alternativas |

## Señales de valencia emocional

| Señal | Implica |
|---|---|
| frustración, queja, negatividad intensa | `frustrado`, `confundido` |
| entusiasmo, resolución, satisfacción | `abogando`, `decidiendo` |
| ansiedad post-compra ("¿hice bien?", "¿puedo cambiarlo?") | `esperando`, `evaluando_resultados` (disonancia) |

## Señales conductuales

| Señal | Implica |
|---|---|
| alta densidad de preguntas + repreguntas | `comparando`, `evaluando_riesgo`, `confundido` |
| mensajes vagos, contradicciones, "no entiendo" | `confundido` |
| silencio > umbral tras intención activa | `desenganchado` (sidecar) |
| posposición ("déjame pensarlo") | **débil/negativa si está sola** (zombie, P-008/P-009); `decidiendo`/`evaluando_riesgo` solo con corroboración (sigue evaluando, pide concretos) |
| preferencia afectiva expresada antes que justificación racional | modo `emocional` (P-006) |
| enojo dirigido a la presión ("me molesta que me presionen", irritación ante el intento de influencia) | `reticente` (Fundamental) | indicador empírico 1 de la reactancia: enojo (Rains 2013, λ=0.62) |
| contra-argumentación intensificada (rebate cada punto, discute la intención del vendedor) | `reticente` (Fundamental) | indicador empírico 2: cognición negativa (Rains 2013, λ=0.52) |
| resistencia a la presión ("no me gusta que me presionen") | `reticente` (Fundamental — reactancia: Brehm/Cialdini + Voss + Miller&Rollnick + meta-análisis) | la suma de enojo + contra-argumentación discrimina `reticente` de `frustrado` (malestar general) |
| el comprador dice "no" y **sigue** en la conversación | `reticente`, `decidiendo` | el "no" es posición, no salida (P-010, Voss); `desenganchado` se dispara por silencio/abandono |
| la contra-argumentación **baja** tras sentirse oído ("exacto, eso es") | de-escalada de `reticente` | validación/empatía (P-025); señales de control devuelto (P-026) |

## Jerarquía de evidencia conversacional (The Mom Test — P-008/P-009)

La fiabilidad de una señal depende de su tipo, no solo de su contenido. De más a menos fiable:

1. **Comportamiento pasado específico** — episodio concreto ("la última vez que...") → `descubriendo`, `comparando`
2. **Proceso actual** — "¿cómo lo resuelves hoy?" (workaround, presupuesto ya asignado) → `comprendiendo`, `comparando`, `evaluando_riesgo`
3. **Inversión/compromiso** — tiempo, reputación, dinero (follow-up, introducción, depósito) → `transaccional` (evidencia fuerte)
4. **Opinión declarada** — intención, elogio, hipótesis → débil; `explicito` entra aquí (peso 0.3 o menor)

## Señales de compromiso (inversión real — P-010)

> **Regla empírica (falsación de cierre, ver `fuentes/evidencia-cierre.md`):** el compromiso **inducido** por técnicas (FITD, lowball, cierre duro) NO cuenta como señal de inversión — los meta-análisis muestran efectos pequeños y frágiles (r≈.09–.17), con boomerang cuando la manipulación se percibe (Beaman 1983; Dillard 1984; Burger 1999). La señal fuerte es la **inversión real** y el compromiso **específico** (escalón A/T de DARN-CAT). Un "lo voy a hacer" sin plan es P-009 (débil), no P-010.

| Señal | Divisa | Fuerza |
|---|---|---|
| agenda follow-up con fecha concreta | tiempo | fuerte |
| introduce a un tercero concreto | reputación | fuerte |
| testimonio/caso público | reputación | fuerte |
| depósito, pre-pago, orden de compra | dinero | muy fuerte |
| plan con actor + fecha ("voy a llamar a X el martes") | tiempo/compromiso | fuerte (especificidad — Gollwitzer & Sheeran 2006, d=0.65) |
| paso ya dado ("ya hablé con...") | conducta pasada | la más fuerte (el pasado predice mejor) |
| "cuando puedas" sin fecha | tiempo | débil |
| "avísame cuando esté" | nada | nula (curiosidad/política) |
| "lo voy a hacer" sin plan ni fecha | nada | débil (declaración, P-009) |

## Escala de lenguaje de compromiso (DARN-CAT — MI, gradúa P-010/P-009)

MI y su evidencia empírica muestran que la **especificidad y fuerza** del lenguaje de compromiso predice la conducta real mucho mejor que el acuerdo vago. Escala de menor a mayor compromiso:

| Escalón | Señal | Predicción |
|---|---|---|
| D — Desire | "me gustaría..." | interés, no compromiso |
| A — Ability | "podría hacerlo..." | percepción de capacidad (P-026) |
| R — Reasons | "me conviene porque..." | cambio talk (P-024) |
| N — Need | "necesito..." | `consecuente` (P-013) |
| C — Commitment | "lo voy a hacer" | compromiso declarado — aún débil (P-009) |
| A — Activation | "voy a llamar a mi socio el martes" | **compromiso específico** — fuerte (P-010) |
| T — Taking steps | "ya hablé con..." / acción pasada | evidencia de conducta real — la más fuerte |

El *commitment* específico (con actor + fecha) es el observable de P-010 de mayor valor predictivo; el *desire* sin escalera es ruido. Refuerza la jerarquía de The Mom Test (comportamiento pasado > intención).

> **Respaldo empírico (falsación de cierre):** Gollwitzer & Sheeran (2006, 94 tests, N=8,461) — las intenciones de implementación (planes if-then, escalón A) alcanzan d=0.65; la especificidad es la variable activa, no la fuerza de la intención declarada (escalón C). La escala DARN-CAT se confirma como el gradiente correcto: los escalones bajos son ruido (P-009), los altos predicen (P-010). Ver `fuentes/evidencia-cierre.md`.

## Observables universales de progresión (SPIN — P-013/P-012)

Válidos en cualquier industria; marcan el paso de *consciente* a *motivado* y de *acuerdo* a *avance*:

| Señal | Implica |
|---|---|
| aparece una **limitación real** del estado actual | `descubriendo` (necesidad implícita) |
| **conecta causa con consecuencia** | paso motivacional (P-013) |
| **cuantifica impacto** (costo de la inacción) | `consecuente` |
| **reconoce una pérdida** / oportunidad perdida | `consecuente` |
| **expresa urgencia propia** (no inducida) | `consecuente` → `comprendiendo` |
| **describe el estado futuro deseado** (lenguaje de atracción) | `consecuente` (P-024) |
| **articula el valor en sus propias palabras** ("nos ahorraría X") | compromiso creciente (P-012) |
| "interesante, reconectemos" (acuerdo sin motivación) | **NO es avance** — señal de ausencia |

---

## Reglas de calibración

- **`explicito` nunca mueve el estado solo** (P-006): el autorreporte se corrobora con `behavior`/`objection`/`emotion`.
- Una misma señal puede implicar estados distintos según contexto; la creencia se actualiza por pesos de emisión (diseño v1.1 §4.4.2), no por reglas duras.
- Señales a añadir cuando haya evidencia de nuevas obras: ~~indicadores de *validación social*~~ (añadido: P-015), ~~*anclaje*~~ (añadido: P-020), ~~*aversión a pérdida*~~ (añadido: P-013 — escasez/límite). Pendiente: indicadores de condiciones de recurso (prisa/sobrecarga → modo heurístico, P-014). Añadido con Schwartz: sobrecarga, arrepentimiento (anticipado/experimentado) y maximizar/satisfacer. **Añadido con GAP:** Cost of Inaction, compuerta triple (relevante + urgente + no resuelto) y lenguaje de atracción (P-024). **Añadido con NSPD:** "that's right" (auto-persuasión/apropiación), "¿cómo se supone que haga eso?" (riesgo funcional), el "no" como posición no terminal, y de-escalada de `reticente` por validación/control (P-025/P-026). **Añadido con MI:** escala DARN-CAT (gradúa el compromiso), change/sustain talk (dirección de la tensión), ambivalencia (doble polo en `decidiendo`), y `reticente` promovido a estado confirmado. **Añadido con las falsaciones empíricas:** compromiso inducido ≠ inversión real (FITD débil, ver `fuentes/evidencia-cierre.md`), compromiso específico fuerte (d=0.65), y escasez como familia de señales — demanda→prueba social/FOMO, oferta/plazo→pérdida, con moderador de no-sustituibilidad (ver `fuentes/evidencia-escasez.md`). **Añadido con la falsación de prueba social/autoridad (`fuentes/evidencia-social-proof.md`):** distinción norma descriptiva (lo que hacen, P-015 — ruta directa a la conducta) vs. injunctiva (lo que se aprueba, vía intención), y condiciones de la autoridad (sin actitud previa, señales congruentes, baja elaboración → P-014; señales incongruentes → backfire).

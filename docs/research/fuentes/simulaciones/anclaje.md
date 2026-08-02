# Simulación — Candidato 1: Anclaje (P-020)

**Principio:** P-020 Contraste perceptual / anclaje — "la evaluación de una opción es **relativa** a un ancla o contexto previo, no absoluta".
**Pregunta falsacional:** ¿El ancla sobrevive cuando compite con la escasez/prueba social (P-013/P-015) y con la detección de la intención (C-010), o es un artefacto de laboratorio sin competidores?
**Hipótesis falsacional:** si el ancla se disuelve ante fuerzas concurrentes o ante la detección, P-020 no es una fuerza independiente sino una **Consecuencia** (P.10) de la presentación del precio.

**Persona base:** Lucía, directora de operaciones, logística mediana (3 almacenes, ~40 personas). Stakes: media-alta (contrato anual). Modo: analítico (P-004). Producto: sistema de gestión de transporte (TMS).

## Escenario A1 — Ancla alta, sin competencia

| # | Turno | Etiquetas |
|---|---|---|
| 1 | **V:** "Antes de nada, para que compares con perspectiva: un TMS completo con integraciones suele arrancar en los 70–90k al año." | `[obs: referencia de precio previa]` `[fuerza: P-020 ancla alta]` |
| 2 | **L:** "¿Tan caro? Nosotros no queremos cambiar el mundo, solo que el WMS hable con el transportista." | `[estado: evaluando_riesgo]` `[obs: riesgo monetario]` `[fuerza: P-003]` |
| 3 | **V:** "Por eso te lo doy como punto de partida: cuando comparemos, el referente es el mercado completo, no el módulo barato." | `[fuerza: P-020 refuerza el ancla]` |
| 4 | **L:** "Mmm. Con lo que nos pasa ahora — los repartos se caen, el cliente reclama — algo bien integrado se justifica." | `[estado: consecuente]` `[obs: problema + costo sentido]` `[fuerza: P-013]` |
| 5 | **V:** "¿Cuánto te cuesta hoy un reparto que se cae?" | `[fuerza: P-013 implicación (SPIN)]` |
| 6 | **L:** "Si un 4% de los envíos se retrasa y el contrato son 2.4M... hablamos de 90k al año entre devoluciones y penalizaciones." | `[estado: consecuente]` `[obs: cuantifica costo de inacción]` `[fuerza: P-013]` |
| 7 | **V:** "Entonces, frente a 90k de sistema, el punto de equilibrio está en evitar uno de cada diez retrasos." | `[fuerza: P-020 usa el ancla contra el costo]` `[fuerza: P-013]` |
| 8 | **L:** "Claro... si me garantizas eso, el precio deja de ser el problema." | `[estado: decidiendo]` `[obs: adopta el referente del vendedor (90k)]` `[fuerza: P-020 internalizado]` |

**Análisis A1:** el ancla se **internaliza** (la compradora adopta "90k" como marco sin dudarlo). Contrafactual limpio: sin ancla, Lucía parte de su presupuesto interno (~40k) y la evaluación cambia. **Observabilidad alta; discriminabilidad alta en ausencia de competencia.**

## Escenario A2 — Ancla + competencia (prueba social P-015)

Misma conversación; se añade una fuerza concurrente tras el turno 6.

| # | Turno | Etiquetas |
|---|---|---|
| 7' | **V:** "Y de hecho, tres operadores de tu tamaño lo adoptaron este trimestre por el mismo problema con los repartos." | `[obs: mención de terceros/estadística]` `[fuerza: P-015 prueba social (demanda)]` |
| 8' | **L:** "¿Ah, sí? ¿Quién?" | `[estado: evaluando_riesgo]` `[obs: busca validar]` `[fuerza: P-015]` |
| 9' | **V:** "No puedo dar nombres por contrato, pero te dejo hablar con uno firmando el NDA." | `[obs: veracidad preservada]` `[fuerza: C-010]` |
| 10' | **L:** "Eso me da confianza. El tema ahora es si entra en el presupuesto del año que viene." | `[estado: decidiendo]` `[obs: el ancla (presupuesto) y la confianza (P-015) co-ocurren]` `[fuerza: P-020 + P-015]` |

**Análisis A2:** el ancla no desaparece pero **se mezcla** con la prueba social: las dos señales co-ocurren en el mismo turno. Aislar el ancla exigiría retirar P-015 → **discriminabilidad moderada bajo competencia** (el meta-análisis tendría el mismo problema: moderador de fuerzas concurrentes).

## Escenario A3 — Ancla transparente vs. ancla detectada (C-010)

| # | Turno | Etiquetas |
|---|---|---|
| 11' | **V (manipulativo):** "Fíjate: los serios no bajan de 90k; no pierdas tiempo con módulos baratos." | `[fuerza: P-020 + descalificación de alternativas]` |
| 12' | **L:** "No me des lecciones de lo que me conviene. El módulo de X vale 30k y hace el 80% de lo que necesito." | `[estado: reticente]` `[obs: enojo + contra-argumentación dirigidos a la presión]` `[fuerza: C-010 / reactancia]` |

**Análisis A3:** el ancla con **intento detectado** revierte (C-010). El ancla es real pero condicionado a la no-detección — la misma frontera que la escasez fabricada.

## Verdicto parcial — Anclaje (P-020)

| Dimensión | Nota | Puntaje |
|---|---|---|
| O | las referencias de precio son lenguaje de compra natural; se internalizan (A1) | **5** |
| D | A1/A3 limpios; A2 confundido por competencia (moderador real a estudiar) | **4** |
| S | refinaría P-020 (moderador de detección C-010 y de competencia), no rompe estructura | **3** |
| C | base meta-analítica de anclaje abundante y accesible (precio, disposición a pagar) | **4** |

**Puntaje:** 5×4×3/4 = **15**

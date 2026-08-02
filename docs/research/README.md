# UBSE Research Initiative — Sprint de Investigación (Fase 0)

**Status:** Activo. Sprint de investigación. **Sin implementación de código.**
**Regla absoluta:** NO modificar código, runtime, prompts ni dashboard. Todo el trabajo pertenece exclusivamente al dominio de investigación.

## 1. Objetivo

No es escribir código. Es **descubrir si existen principios universales que expliquen el comportamiento del comprador**, independientemente del producto, industria o metodología comercial.

El entregable no será software. Será conocimiento.

## 2. Hipótesis principal

> Todo proceso de compra puede modelarse como una transición entre estados cognitivos.

Cambian los argumentos, pero no cambia la estructura psicológica del comprador. Nuestro trabajo consiste en **descubrir esa estructura**.

## 3. Misión del Concilio

No se estudian técnicas, scripts ni cierres. Se estudia **cómo cambia la mente de una persona durante una conversación**.

- Cada obra debe responder únicamente: **¿Qué cambio mental ocurrió aquí?**
- Nunca: ¿Qué técnica utilizó el vendedor?

## 4. Regla de oro

No se preserva el lenguaje del autor. **Se elimina.** El objetivo es llegar al fenómeno psicológico subyacente.

Ejemplo: "descubrir dolor" (Autor A) + "identificar necesidad" (Autor B) + "comprender problema" (Autor C) → un único fenómeno:

> **Comprensión del problema.**

## 5. Fuentes de investigación

No limitarse a ventas. Comparar principios de: ventas consultivas y tradicionales, SPIN, Challenger, Sandler, GAP, negociación, psicología cognitiva, economía conductual, toma de decisiones, atención al cliente, educación, terapia conversacional, comunicación interpersonal, persuasión ética, resolución de conflictos.

**Si dos disciplinas describen el mismo fenómeno con nombres distintos, deben unificarse.**

**Cambio de enemigo (decisión del Concilio, tras GAP):** no leer más libros de ventas. La vecindad de venta consultiva ya está representada (SPIN/Sandler/GAP). Cada obra nueva debe ser **adversarial**: una disciplina distinta (negociación, economía conductual, toma de decisiones, psicología clínica) o una **crítica académica** de los modelos clásicos de ventas. El propósito del adversario es **falsar** el modelo (P.12), no confirmarlo.

## 6. Protocolo de destilación (por obra)

Para cada obra extraer:

- conceptos, principios, estados, transiciones
- evidencias observables
- errores comunes
- condiciones de entrada y de salida
- contradicciones respecto a otros autores

No extraer: frases célebres, ejemplos, historias, anécdotas, scripts.

**Plantilla de destilado:** `docs/research/fuentes/<autor-obra>.md`

## 7. Protocolo de comparación cruzada

Cada nueva obra se compara contra todas las anteriores. Responder siempre:

1. ¿Qué **confirma**?
2. ¿Qué **contradice**?
3. ¿Qué aporta de **nuevo**?
4. ¿Puede **reducirse** a un principio ya existente?
5. ¿Obliga a **modificar** el modelo UBSE?

## 8. Regla de investigación — prioridad de la evidencia

1. **No mapear la obra directamente a los estados de MIA.** El objetivo no es demostrar que el autor tenía razón.
2. Analizar la obra **como si el modelo UBSE no existiera**: identificar los fenómenos humanos que realmente describe.
3. Después comparar ambos modelos y decidir si el fenómeno: **confirma** un estado, **modifica** un estado, **divide** un estado en dos, **fusiona** dos estados, o **demuestra que un estado de UBSE es incorrecto**.
4. **Si la obra contradice UBSE, la evidencia tiene prioridad sobre el diseño.**
5. **No proteger el modelo. Intentar romperlo.**
6. **Ningún autor tiene autoridad sobre MIA.** Rackham, Cialdini o Kahneman no son la verdad; son **evidencia**. Si cinco autores contradicen a uno, se investiga. Si todos coinciden, probablemente encontraron un principio universal. Si ninguno coincide, quizá MIA está descubriendo algo nuevo.
7. **Clasificación ontológica (P.9):** todo principio debe responder "¿Qué es realmente?" y pertenecer a **una sola** categoría: `Estado del comprador` · `Observable` · `Fuerza de transición` · `Restricción del sistema` · `Heurística cognitiva` · `Regla de decisión` · `Técnica (descartar)` · `Contexto (descartar)`. **Si un principio no puede clasificarse, todavía no está entendido.** Ver `kb/ontologia.md`.
8. **Fenómeno o síntoma (P.10):** todo **concepto** encontrado (no solo los principios) debe clasificarse en **una sola** categoría: `Estado` · `Heurística` · `Fuerza positiva` · `Fuerza negativa` · `Observable` · `Restricción` · `Consecuencia` · `Técnica (descartar)`. La categoría `Consecuencia` es la respuesta a "síntoma de qué": un efecto aguas abajo de otro fenómeno, que **debe reducirse** a su mecanismo raíz y no inventar un estado nuevo (anti-reificación). P.10 refina P.9: las fuerzas de transición tienen **valencia** (positiva/negativa). Ver `kb/ontologia.md` §P.10.
9. **Relación complejidad/calidad de la decisión (P.11):** investigar si la relación entre el número de alternativas y la calidad de la decisión es **curvilínea** (más opciones ayudan hasta un punto de inflexión, después empeoran la decisión) y si ese punto de inflexión **existe en toda categoría** (zapatos, ERP, cirugía, seguros, churros, tractores). La curvilinealidad sería universal; la posición del umbral podría variar con las stakes (C-008).
10. **Falsación (P.12):** la investigación pasa de **buscar confirmaciones a buscar falsaciones**. Un hallazgo se considera firme solo después de intentos explícitos de destruirlo desde una obra **adversaria** (§5). El nivel **Fundamental** de la escala (§9) solo se otorga tras una auditoría de falsación exitosa. Primer caso: `consecuente`, auditado contra GAP (ver `fuentes/gap.md`).

## 9. Escala de confianza de un principio

Escala del Concilio (5 niveles, revisada tras GAP):

| Nivel | Criterio |
|---|---|
| Baja | 1 fuente |
| Media | 2 fuentes independientes |
| Alta | 3 fuentes y ≥2 disciplinas |
| Muy Alta | 5+ fuentes independientes |
| **Fundamental** | sobrevive intentos explícitos de falsación |

**Regla de vecindad:** los autores que viven cerca (p. ej. SPIN/Sandler/GAP = venta consultiva) valen como **una sola vecindad**. La independencia de disciplinas (psicología, economía conductual, negociación, customer discovery, psicología clínica) vale más que el número de libros. Un principio o estado llega a **Fundamental** solo tras una auditoría de falsación que intente destruirlo y no lo logre. Primer caso: `consecuente`, auditado contra GAP.

## 10. Estructura de la base de conocimiento

```
docs/research/
  README.md               ← este charter (misión, protocolo, índice)
  kb/
    principios.md         ← Base de Principios Universales (núcleo)
    ontologia.md          ← Clasificación ontológica de cada principio (P.9)
    estados.md            ← Atlas de Estados Cognitivos
    transiciones.md       ← Catálogo de Transiciones Universales
    observables.md        ← Diccionario de Observables Conversacionales
    contradicciones.md    ← Contradicciones entre escuelas comerciales
    hipotesis.md          ← Hipótesis aún no demostradas
    recomendaciones.md    ← Recomendaciones para UBSE v2 (se cierra al final del sprint)
  fuentes/
    registro.md           ← Registro de obras: analizadas, pendientes, orden de lectura
    <autor-obra>.md       ← Destilado de cada obra
```

**Schema de un principio** (en `kb/principios.md`): nombre provisional, definición, evidencia, autores que respaldan, autores que contradicen, nivel de confianza, estados relacionados, transiciones relacionadas, observables conversacionales.

## 11. Evolución del modelo

El modelo UBSE **no está congelado**. Puede fusionar, dividir, eliminar o crear estados y transiciones — **siempre justificado con evidencia**. Todo cambio se registra en `kb/` con su trazabilidad de fuentes.

## 12. Entregables

| # | Entregable | Archivo | Estado |
|---|---|---|---|
| 1 | Atlas de Estados Cognitivos del Comprador | `kb/estados.md` | sembrado |
| 2 | Catálogo de Transiciones Universales | `kb/transiciones.md` | sembrado |
| 3 | Diccionario de Observables Conversacionales | `kb/observables.md` | sembrado |
| 4 | Base de Principios Universales | `kb/principios.md` | sembrado |
| 5 | Contradicciones entre escuelas comerciales | `kb/contradicciones.md` | sembrado |
| 6 | Evidencia acumulada por principio | integrada en `kb/principios.md` | en curso |
| 7 | Recomendaciones para UBSE v2 | `kb/recomendaciones.md` | pendiente (cierre) |
| 8 | Lista de hipótesis no demostradas | `kb/hipotesis.md` | sembrado |
| 9 | Clasificación ontológica de los principios (P.9) | `kb/ontologia.md` | activo |

## 13. Objetivo final

**Nota de paradigma (decisión del Concilio):** la clasificación ontológica (P.9) marca el punto donde esta investigación deja de ser "un motor de ventas" y se convierte en **un modelo computacional del comportamiento del comprador**. Los principios ya no son consejos: son entidades con una clase ontológica que el motor podrá representar. El verdadero diferencial de MIA es esta teoría destilada, no el dashboard ni los canales.

Que MIA reconozca **en qué estado cognitivo se encuentra cualquier ser humano que está tomando una decisión**, y qué transición conversacional aumenta la probabilidad de ayudarlo a avanzar hacia una decisión **informada y voluntaria**.

Cuando el modelo permanezca estable tras suficiente evidencia, el Concilio propondrá la implementación del motor UBSE.

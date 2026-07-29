# MIA Platform — Premium UX Design System

## Design Council

**Session**: UX Design Review
**Date**: 2026-07-29
**Principle**: "Fondo primero, superficie después" — Atmosphere before components, emotion before layout.

---

## 0. The Answer to the Central Question

> *"Si un empresario abre MIA por primera vez, ¿qué debe sentir en los primeros 30 segundos?"*

**Respuesta**: Debe sentir que **no está solo**.

No debe ver una herramienta que necesita aprender a usar. Debe ver **un lugar que ya lo conoce**. La interfaz respira con su negocio. Los colores, las luces, los movimientos — todo le dice: "Esto funciona contigo, no para ti."

En los primeros 30 segundos debe sentir:
- **Relevancia inmediata** — lo que ve es específico de su negocio, no genérico
- **Calma informada** — no ruido, no alertas falsas, solo lo que importa
- **Confianza** — este sistema sabe lo que hace

Si sintió eso, el diseño funciona.

---

## 1. Concepto Base: The Living Intelligence Framework

MIA no tiene un dashboard. MIA tiene **una sala de operaciones**.

Cada sección no es una página — es **una capacidad visible** del sistema. El usuario no navega entre pantallas; **transita entre estados de inteligencia**.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  LA SALA DE OPERACIONES                                              │
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │            │  │            │  │            │  │              │  │
│  │ COMANDO    │  │ PULSO      │  │ MEMORIA    │  │ PENSAMIENTO  │  │
│  │ Centro     │  │ Relaciones │  │ Experiencia│  │ Heurística   │  │
│  │            │  │            │  │            │  │              │  │
│  │ claridad   │  │ conexión   │  │ solidez    │  │ profundidad  │  │
│  │ control    │  │ humano     │  │ sabiduría  │  │ análisis     │  │
│  │ confianza  │  │ evolución  │  │ archivo    │  │ estrategia   │  │
│  │            │  │            │  │            │  │              │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────┘  │
│                                                                      │
│  ┌────────────┐  ┌────────────┐                                      │
│  │            │  │            │                                      │
│  │ EVOLUCIÓN  │  │ ORGANIZACIÓN│                                     │
│  │ Laboratorio│  │ Consejo    │                                      │
│  │            │  │            │                                      │
│  │ reto       │  │ estructura │                                      │
│  │ mejora     │  │ roles      │                                      │
│  │ práctica   │  │ gobierno   │                                      │
│  │            │  │            │                                      │
│  └────────────┘  └────────────┘                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.1 Architectural Metaphor

MIA es un **edificio inteligente** de tres plantas:

| Planta | Espacio | Sección | Sensación |
|--------|---------|---------|-----------|
| **Planta baja** — Operaciones diarias | La sala de máquinas visible | Home, Conversations | Luz natural, movimiento constante, actividad visible |
| **Primer piso** — Conocimiento | Biblioteca + Sala de análisis | Memory, Heuristic Engine | Penumbra cálida, silencio, profundidad |
| **Segundo piso** — Desarrollo | Laboratorio + Sala de juntas | Laboratory, Agents/Council | Luz blanca, espacio abierto, pizarras, prototipos |

Cada planta tiene su propia atmósfera. El usuario sube y baja entre plantas según lo que necesita hacer.

---

## 2. Visual System

### 2.1 Atmosphere (Fondo)

No hay fondo blanco. El fondo es un **espacio ambiental** que cambia sutilmente según el contexto.

```
Planta baja (Home):    Gradiente suave de azul profundo (#0B1A2E) a azul medio (#1A2D42),
                       con un matiz cálido en la esquina inferior derecha (presencia de MIA)

Primer piso (Memory/Heuristic):  Degradado más oscuro, #071520 a #0F2438,
                                 con un velo de textura de papel antiguo muy sutil

Segundo piso (Lab/Council):     Base más clara #1E2D3D con toques de luz blanca #E8EDF2
                                desde el centro, como claraboya
```

**Texturas**:
- Home: Muy sutil patrón de línea de tiempo (puntos y líneas en opacidad 0.03)
- Memory: Textura de papel arrugado digital (opacidad 0.02)
- Heuristic: Patrón de nodos y conexiones muy tenue (opacidad 0.015)
- Lab: Sin textura — espacio limpio, intencional

### 2.2 Color System — Significado, no decoración

| Color | Hex | Rol | Se usa en |
|-------|-----|-----|-----------|
| **Azul Profundo** | `#0B1A2E` | Contenedor, confianza, estabilidad | Fondos principales |
| **Azul MIA** | `#1E5A99` | Identidad, inteligencia, acción | Botones primarios, links, MIA indicators |
| **Cian Brillante** | `#3BC4E0` | Atención, procesamiento, vida | Actividad, procesando, nuevo |
| **Verde Bosque** | `#2D8A5E` | Crecimiento, salud, aprendizaje | Memory growth, learning events, positive signals |
| **Violeta Profundo** | `#6B3FA0` | Evolución, descubrimiento | Heuristic insights, new patterns, hypotheses |
| **Dorado Suave** | `#C9A84C` | Logro, conocimiento valioso | Milestones, premium insights, council |
| **Naranja Tenue** | `#D4743A` | Atención suave, no alerta | Pending items, requires review |
| **Rojo Profundo** | `#A8333E` | Solo para situaciones críticas | Issues, blocks, health problems (raro) |
| **Blanco Nube** | `#E8EDF2` | Texto primario, luz | Headers, primary text |
| **Gris Platino** | `#9BAAB8` | Texto secundario | Labels, metadata |
| **Gris Pizarra** | `#3D4F63` | Bordes, separadores | Líneas divisorias suaves |

### 2.3 Typography

**Título de sección**: Inter Display, 2.5rem, weight 500, tracking -0.02em
**Subtítulo**: Inter, 1rem, weight 400, color Gris Platino
**Cuerpo**: Inter, 0.875rem, weight 400
**Métrica grande**: Inter Display, 3rem, weight 400, tracking -0.03em
**Etiqueta**: Inter, 0.75rem, weight 500, uppercase, tracking 0.08em
**Código/Data**: JetBrains Mono, 0.8125rem

### 2.4 Depth & Layering

No se usan sombras genéricas. La profundidad se construye con:

- **Capa 0** (fondo): El ambiente base
- **Capa 1** (superficie): Un velo translúcido con blur — `background: rgba(255,255,255,0.03); backdrop-filter: blur(12px)`
- **Capa 2** (elemento elevado): El mismo velo con borde luminoso superior — `box-shadow: 0 -1px 0 rgba(255,255,255,0.06)`
- **Capa 3** (modal/dialog): Fondo oscurecido + elevación con iluminación interna

No hay cards blancas flotantes. Todo parece **parte del mismo espacio**, no piezas pegadas.

### 2.5 Motion System

Cada movimiento tiene **significado**. No hay animaciones decorativas.

| Movimiento | Cuándo | Duración | Easing | Qué comunica |
|-----------|--------|----------|--------|-------------|
| **Respiración** | Elementos vivos (MIA status, active indicators) | 4s loop | ease-in-out | "Estoy aquí, funcionando" |
| **Aparición suave** | Contenido al cargar | 600ms, stagger 80ms | cubic-bezier(0.16, 1, 0.3, 1) | "Todo está en orden" |
| **Transición entre plantas** | Cambio de sección | 400ms | cubic-bezier(0.83, 0, 0.17, 1) | "Estás cambiando de espacio" |
| **Latido** | Nueva actividad | 200ms, repeat 2 | ease-out | "Algo pasó" (no alerta, solo notificación) |
| **Expansión** | Abrir detalle | 300ms | cubic-bezier(0.16, 1, 0.3, 1) | "Estás viendo más profundo" |
| **Desvanecimiento** | Ocultar/cerrar | 200ms | ease-out | "Ya no necesitas esto" |

**Regla de oro**: Si el usuario no notaría su ausencia, la animación sobra.

---

## 3. Module-by-Module Experience Design

### 3.1 Home Dashboard — El Centro de Mando

**Sensación**: Claridad. Control. Confianza.

El usuario entra y **ya sabe cómo está su negocio** sin leer nada. No necesita interpretar gráficas. El espacio mismo le cuenta el estado.

**Layout**:

```
┌────────────────────────────────────────────────────────────────────┐
│  Buen día, David                            [MIA ◉ Activa] 10:32  │
│                                                                     │
│  ┌──────────────────────┐  ┌────────────────────────────────────┐  │
│  │  ▲ 12                │  │  Conversaciones activas            │  │
│  │  Conversaciones      │  │                                    │  │
│  │  activas             │  │  🟢 María García — "Gracias, lo    │  │
│  │                      │  │     voy a pensar"     hace 2min    │  │
│  │  ↑ 8% vs ayer        │  │  🟢 Juan Pérez — "¿Tienen en      │  │
│  │                      │  │     color negro?"     hace 15min   │  │
│  │  [Ver todas →]       │  │  🟡 Entrenamiento MIA  hace 1h    │  │
│  └──────────────────────┘  └────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Actividad reciente                 [Ver actividad completa →] │ │
│  │                                                               │ │
│  │  ━━━●━━━━━━━━━━●━━━━━━━━━━━━●━━━━━━━━━━━━━━━●━━━━━━━━━━      │ │
│  │  08:00   09:00   10:00   11:00   12:00   13:00   14:00   15:00│ │
│  │                                                               │ │
│  │  Pico de actividad: 10:00-11:00 (8 conversaciones)           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ 📚 Memoria   │  │ 🧠 Heurística│  │ 🔬 Laboratorio│            │
│  │ 3 aprendizajes│  │ 5 hipótesis  │  │ 1 sesión hoy  │            │
│  │ nuevos hoy    │  │ activas      │  │ Score: 7.8    │            │
│  │               │  │              │  │               │            │
│  │ [Abrir →]    │  │ [Abrir →]    │  │ [Abrir →]    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└────────────────────────────────────────────────────────────────────┘
```

**Elementos clave**:

1. **Saludo personalizado**: "Buen día, David" — no "Bienvenido", no "Dashboard". La hora del día ajusta el saludo.

2. **Señal vital principal**: El número grande de conversaciones activas no es una tarjeta con borde y sombra. Es un **elemento luminoso** que cambia de intensidad según el volumen. Si hay 1-5 conversaciones, es tenue. Si hay 20+, es más brillante.

3. **Timeline de actividad**: No es una gráfica de barras. Es una línea con puntos que respiran. Los picos se iluminan. Las horas sin actividad son casi invisibles.

4. **Módulos secundarios**: No son iconos genéricos. Cada uno usa el color de su "planta":
   - Memoria: verde (crecimiento)
   - Heurística: violeta (pensamiento)
   - Laboratorio: dorado (logro)

5. **Estado de MIA**: Un indicador en la esquina superior derecha que muestra no solo "activo/inactivo" sino:
   - ◉ **Activa** — azul, respiración suave: funcionando normalmente
   - ◉ **Aprendiendo** — violeta, pulso más lento: MIA está procesando nuevos patrones
   - ◉ **En pausa** — gris: sin actividad reciente

**Qué NO mostrar**:
- Número de usuarios
- Tiempo de actividad del sistema (uptime)
- Versión del software
- Progreso de "setup" (eso va en onboarding)

---

### 3.2 Conversation Center — El Pulso Humano

**Sensación**: Conexión. Historia. Relación.

No es una bandeja de entrada. Es un **mapa de relaciones humanas activas**.

**Layout**:

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Centro de Mando    💬 Conversaciones     [Filtrar ●] [Buscar...]│
│                                                                     │
│  ┌────────────────────────────┐  ┌───────────────────────────────┐ │
│  │  ─── Hoy ───               │  │  María García                │ │
│  │                            │  │  Consulta sobre uñas         │ │
│  │  🟡 María García           │  │                               │ │
│  │      hace 2min · MIA Vitanova  │  14:00 │ María              │ │
│  │      📍 Cliente recurrente │  │  "Hola, tengo 62 años..."    │ │
│  │                            │  │                               │ │
│  │  🟢 Juan Pérez             │  │  14:00 │ MIA                 │ │
│  │      hace 15min · MIA Zapatos  │  "Entiendo. Con la edad..." │ │
│  │      📍 Nueva conversación │  │                               │ │
│  │                            │  │  14:05 │ María                │ │
│  │  🟠 Carlos Soto            │  │  "Como 4 meses..."           │ │
│  │      hace 1h · MIA Vitanova   │                               │ │
│  │      📍 Esperando respuesta │  │  [🔍 ¿Por qué respondió    │ │
│  │                            │  │   esto?]                     │ │
│  │  ─── Ayer ───              │  │                               │ │
│  │                            │  │  🧠 Clara está comparando    │ │
│  │  ⚪ Ana María Martínez     │  │  opciones. Preguntar por     │ │
│  │      hace 1d · MIA Zapatos│  │  necesidades específicas     │ │
│  │      📍 Completada         │  │  ayudará a reducir opciones. │ │
│  │                            │  └───────────────────────────────┘ │
│  └────────────────────────────┘                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Elementos clave**:

1. **Línea de tiempo agrupada por día**: Las conversaciones se agrupan por "Hoy", "Ayer", "Esta semana". No es una lista plana. Es un diario de actividad.

2. **Indicador de estado emocional**: Cada conversación tiene un pequeño indicador de su "estado":
   - 🟡 **Amarillo**: En progreso, cliente esperando respuesta
   - 🟢 **Verde**: Activa, fluyendo bien
   - 🟠 **Naranja**: Cliente indeciso o con objeción
   - ⚪ **Gris**: Completada o archivada
   - 🔴 **Rojo**: Problema potencial (reclamo, insatisfacción)

3. **📍 Microlocation**: Pequeña etiqueta que dice dónde está esta relación:
   - "Cliente recurrente"
   - "Nueva conversación"
   - "Esperando respuesta"
   - "Comparando opciones"
   - "Post-venta"

4. **Preview con profundidad**: Al seleccionar una conversación, el panel derecho muestra no solo los mensajes sino:
   - El timeline completo
   - Contexto de "qué está pasando ahora" (ej: "Clara está comparando opciones")
   - Botón para ver análisis de respuesta

5. **Panel derecho con inteligencia**: No solo muestra mensajes. Muestra:
   - Timeline de mensajes
   - Indicador de etapa de conversación
   - Señales heurísticas detectadas
   - Sugerencia de siguiente acción (si aplica)

**Qué NO mostrar**:
- Número de mensajes no leídos (eso es inbox, no relación)
- Checkboxes para seleccionar múltiples
- Botones de "eliminar" o "spam"

---

### 3.3 Memory Center — La Memoria de MIA

**Sensación**: Sabiduría. Archivo. Conocimiento acumulado.

No es una tabla de aprendizajes. Es una **biblioteca de experiencia viva**.

**Layout**:

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Centro de Mando     📚 Memoria    [Buscar en la memoria...]     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  📖 Aprendizajes recientes                  [Archivo completo]│  │
│  │                                                               │  │
│  │  ┌────────────────────────────────────────────┐              │  │
│  │  │  ✦ "Clientes con piel grasa prefieren..."  │              │  │
│  │  │     Origen: Corrección en entrenamiento    │              │  │
│  │  │     Confianza: ●●●●○ 80%                   │              │  │
│  │  │     Impacto: Alta — cambia recomendación   │              │  │
│  │  │     Aprendido: Hoy 10:32                   │              │  │
│  │  └────────────────────────────────────────────┘              │  │
│  │                                                               │  │
│  │  ┌────────────────────────────────────────────┐              │  │
│  │  │  ✦ "Clientes mayores de 60 años..."        │              │  │
│  │  │     Origen: Análisis de conversaciones     │              │  │
│  │  │     Confianza: ●●●●● 95%                   │              │  │
│  │  │     Impacto: Media                          │              │  │
│  │  │     Aprendido: Ayer                        │              │  │
│  │  └────────────────────────────────────────────┘              │  │
│  │                                                               │  │
│  │  ┌────────────────────────────────────────────┐              │  │
│  │  │  ✦ "Preguntar por uso antes de..."         │              │  │
│  │  │     Origen: Regla de ventas creada         │              │  │
│  │  │     Confianza: ●●●○○ 60%                   │              │  │
│  │  │     Impacto: Alta                           │              │  │
│  │  │     Aprendido: Esta semana                 │              │  │
│  │  └────────────────────────────────────────────┘              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  📊 Patrones detectados                                      │  │
│  │                                                               │  │
│  │  "Cuando un cliente menciona dolor + precio, hay 75% de      │  │
│  │   probabilidad de que el precio sea la verdadera objeción."  │  │
│  │                                                               │  │
│  │  [Ver todos los patrones →]                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Elementos clave**:

1. **Cada aprendizaje como carta de biblioteca**: No es una fila de tabla. Es una ficha con:
   - El conocimiento en cursiva (como cita textual)
   - Origen: de dónde vino (corrección, análisis, regla)
   - Confianza: barra de puntos que se ilumina progresivamente
   - Impacto: Alto/Medio/Bajo con un breve por qué
   - Fecha: "Hoy", "Ayer", "Esta semana" — no fechas exactas

2. **Visualización de patrones**: Los patrones detectados no son estadísticas. Son **insights escritos en lenguaje natural** con una breve explicación.

3. **Transición suave entre aprendizajes**: Al hacer scroll, los elementos se desvanecen y aparecen con un leve retardo, como hojas de un libro que se pasan.

4. **La memoria respira**: Si hay nuevos aprendizajes, el icono en la navegación lateral tiene un pulso verde muy sutil.

**Qué NO mostrar**:
- IDs de base de datos
- Timestamps precisos (no "2026-07-29 10:32:15" — "Hoy 10:32")
- Botones de editar/eliminar (la memoria es sagrada)

---

### 3.4 Heuristic Engine — El Pensamiento

**Sensación**: Profundidad. Análisis. Intuición.

No es un panel de estadísticas. Es el **razonamiento estratégico de MIA hecho visible**.

**Layout**:

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Centro de Mando    🧠 Pensamiento     [Actualizar análisis]     │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Análisis en vivo                                      ◉ Activo│
│  │                                                               │  │
│  │  Escenario actual: "Cliente de 62 años consulta por          │  │
│  │  cambios en uñas — modo exploratorio"                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐   │
│  │  📡 Señales           │  │  💡 Hipótesis activas            │   │
│  │                      │  │                                   │   │
│  │  Edad: 60+ ●●●●●     │  │  [85%] Ha probado tratamientos   │   │
│  │                      │  │  OTC sin éxito → Frustración     │   │
│  │  Duración: >1a ●●●●○ │  │                                   │   │
│  │                      │  │  [70%] Edad afecta velocidad     │   │
│  │  Dolor: ●●●●●        │  │  crecimiento → Ajustar plazos    │   │
│  │                      │  │                                   │   │
│  │  Interés: cuidado    │  │  [60%] Busca resultados           │   │
│  │  uñas ●●●○○          │  │  visibles → Priorizar estética   │   │
│  │                      │  │                                   │   │
│  │  [Ver todas →]       │  │  [Ver análisis completo →]       │   │
│  └──────────────────────┘  └──────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Estrategia recomendada                                       │  │
│  │                                                               │  │
│  │  "Explicar proceso biológico natural antes de recomendar.     │  │
│  │   Usar tono paciente y educativo. No prometer resultados       │  │
│  │   rápidos. Enfatizar consistencia como factor clave."         │  │
│  │                                                               │  │
│  │  [Aplicar estrategia] [Ignorar sugerencia]                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Elementos clave**:

1. **Escenario actual en vivo**: Arriba de todo, una línea que describe lo que MIA está procesando AHORA. No es estático. Si el usuario mira fijo, puede ver cómo cambia.

2. **Señales como barras de confianza**: Cada señal detectada tiene una barra de 5 puntos que se ilumina proporcionalmente a la confianza. No son números fríos — son **indicadores visuales de certeza**.

3. **Hipótesis con probabilidad**: No porcentajes exactos, sino rangos visuales:
   - [85%] = muy probable
   - [70%] = probable
   - [60%] = posible
   - [45%] = incierto

4. **Estrategia en lenguaje natural**: No es un output técnico. Es una **recomendación escrita** que el usuario puede leer y entender sin contexto técnico.

5. **Interacción humana**: El usuario no solo observa. Puede **aplicar** la estrategia o **ignorar** la sugerencia. MIA no impone — MIA sugiere.

**Qué NO mostrar**:
- Matrices bayesianas
- Fórmulas matemáticas
- IDs de patrones
- Tablas de probabilidad

---

### 3.5 Laboratory — La Evolución

**Sensación**: Práctica. Crecimiento. Descubrimiento.

No es una página de pruebas. Es un **espacio de entrenamiento donde MIA mejora**.

**Layout**:

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Centro de Mando    🔬 Evolución                 [Nueva sesión] │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Progreso de hoy                                              │  │
│  │                                                               │  │
│  │  Sesiones: 3       ●●●○○○○○○○                                │  │
│  │  Score promedio: 7.8                                          │  │
│  │  Mejora: ↑ 0.5 vs ayer                                       │  │
│  │                                                               │  │
│  │  ━━━━━━━━●━━━━━━━━━━━━●━━━━━━━━━━━━━━●━━━━━━━━━━━            │  │
│  │  Sesión 1  Sesión 2   Sesión 3        Próxima                 │  │
│  │  Score 7.2  Score 8.1 Score 8.0                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────┐  ┌────────────────────────────────────┐ │
│  │  🟢 Normal           │  │  Última sesión                     │ │
│  │  Score: 8.1          │  │                                    │ │
│  │  Mejora: +0.3        │  │  "Cliente interesado en zapatos   │ │
│  │                      │  │   cómodos para trabajar"           │ │
│  │  🟡 Indeciso         │  │                                    │ │
│  │  Score: 7.5          │  │  ✅ Manejó objeción de precio     │ │
│  │  Mejora: +0.8        │  │  ❌ No preguntó por uso específico │ │
│  │                      │  │                                    │ │
│  │  🔴 Complicado       │  │  [Repetir] [Ver detalle]          │ │
│  │  Score: 7.0          │  │                                    │ │
│  │  Mejora: +0.2        │  │  Sugerencia: "Preguntar por horas │ │
│  │                      │  │  de pie antes de recomendar       │ │
│  │  💀 Exigente         │  │  modelo mejora conversión."       │ │
│  │  Score: 6.5          │  │                                    │ │
│  │  Sin cambios         │  │  [Aplicar sugerencia]             │ │
│  └──────────────────────┘  └────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

**Elementos clave**:

1. **Línea de progreso**: Una línea horizontal con hitos. Cada sesión completada es un punto que se ilumina. La línea llena es el progreso del día. La línea vacía son las sesiones restantes.

2. **Score por modo**: Cada modo de simulación tiene su propio score y su propia tendencia. El usuario ve no solo "cómo le fue" sino "dónde está mejorando".

3. **Feedback sin gamificación infantil**: No hay estrellas, trofeos o niveles. El feedback es una **evaluación honesta**: qué salió bien, qué salió mal, qué mejorar.

4. **Ciclo de mejora**: La sugerencia de la última sesión incluye un botón "Aplicar sugerencia" que lleva a crear una regla o conocimiento directamente.

5. **Sensación aspiracional**: Las secciones vacías de la línea de progreso invitan a completarlas, no por presión sino por **curiosidad** ("¿qué pasará si llego al final?").

**Qué NO mostrar**:
- Badges o logros
- Niveles de experiencia
- Tabla de líderes
- Rankings

---

### 3.6 Agents / Council — La Organización Interna

**Sensación**: Estructura. Roles. Gobierno.

No es un panel de bots. Es el **organigrama de inteligencia** de MIA.

**Layout**:

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Centro de Mando    ⚡ Consejo                                    │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  El equipo que opera MIA                                     │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ 🧠 MIA   │  │ ⚖️ CTO   │  │ 🏗️ Arq. │  │ 📊 PM   │     │  │
│  │  │ Core     │  │          │  │          │  │          │     │  │
│  │  │ ◉ Activo │  │ ◉ Activo │  │ ◉ Activo │  │ ◉ Activo │     │  │
│  │  │          │  │          │  │          │  │          │     │  │
│  │  │ Razona   │  │ Evalúa   │  │ Diseña   │  │ Prioriza │     │  │
│  │  │ Responde │  │ Decide   │  │ Estruct. │  │ Valida   │     │  │
│  │  │ Aprende  │  │ Aprueba  │  │ Optimiza │  │ Protege  │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ 🎯 Domain│  │ 🛡️ Seg. │  │ 🚀 Perf. │  │ ✅ QA   │     │  │
│  │  │ Experto  │  │          │  │           │  │          │     │  │
│  │  │          │  │          │  │           │  │          │     │  │
│  │  │ Define   │  │ Protege  │  │ Optimiza  │  │ Verifica │     │  │
│  │  │ Valida   │  │ Bloquea  │  │ Escala    │  │ Garantiza│     │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  📋 Últimas decisiones del consejo                                 │
│                                                                     │
│  ✅ V1.1 Heuristic Engine — Aprobado modificar                     │
│     Hace 2h · 7 miembros · Unánime                                 │
│                                                                     │
│  ✅ ADR-005 Channel Abstraction — En revisión                      │
│     Hace 1d · Pendiente Security Engineer                          │
└────────────────────────────────────────────────────────────────────┘
```

**Elementos clave**:

1. **Visualización de agentes como miembros del equipo**: Cada agente es una "persona" con nombre, rol, estado y capacidades listadas. No son cubos grises con nombres técnicos.

2. **Estado en vivo**: Cada agente muestra si está "activo" (participando en la operación actual), "en pausa" (no involucrado en este momento) o "analizando" (procesando).

3. **Decisiones recientes**: La parte inferior muestra el registro de decisiones del consejo como una línea de tiempo natural — no como un log técnico.

4. **Jerarquía visual**: Los agentes principales (MIA Core, CTO, Arquitecto) están arriba. Los agentes de soporte (QA, Performance, Security) están abajo. No hay "jefe" — hay roles.

**Qué NO mostrar**:
- Detalles técnicos de implementación
- Código
- Logs del sistema
- Estado de "último deploy"

---

## 4. Microinteractions

### 4.1 MIA Presence Indicator

En la esquina inferior derecha de cada pantalla, un indicador sutil muestra si MIA está procesando activamente:

```
Estado normal:     Un punto azul tenue, respiración suave (4s loop)
Procesando:        El punto se vuelve violeta y pulsa más rápido (1.5s loop)
Inactivo:          El punto se vuelve gris, respiración muy lenta (8s loop)
Nuevo aprendizaje: El punto emite un destello verde único
```

No es notificación. Es presencia. Como saber que un colega está en la oficina sin tener que verlo.

### 4.2 Section Transition

Al navegar entre secciones, el fondo **no cambia instantáneamente**. Hay una transición de 400ms donde:
1. El contenido actual se desvanece ligeramente
2. El color de fondo cambia 100ms después
3. El nuevo contenido aparece con un pequeño stagger (80ms entre elementos)

El usuario no ve una "carga de página". Ve un **cambio de ambiente**.

### 4.3 New Activity Signal

Cuando ocurre una nueva conversación o aprendizaje, no aparece una notificación. La interfaz **late**:
1. El icono de la sección correspondiente en el sidebar hace un pulso muy sutil (escala 1→1.05→1 en 600ms)
2. Si el usuario está en esa sección, el elemento más reciente aparece con un destello de fondo que se desvanece en 2s
3. No hay contador de "notificaciones"

### 4.4 Empty States

Cuando una sección está vacía (primer uso, sin datos), no se muestra una ilustración genérica de "no hay nada aquí".

```
Home vacío:     "MIA está lista. Cuando tengas tu primer cliente,
                 aquí verás su actividad."

Conversaciones: "Las primeras conversaciones aparecerán aquí.
                 MIA está esperando a tus clientes."

Memoria vacía:  "Aún no hay aprendizajes. MIA empieza a aprender
                 desde la primera conversación."

Heurística:     "MIA está observando. Las primeras señales
                 aparecerán después de algunas conversaciones."

Laboratorio:    "El laboratorio está listo. MIA espera su primera
                 sesión de entrenamiento."
```

Cada mensaje usa el tono de voz de MIA: seguro, calmado, presente.

---

## 5. Information Hierarchy

### 5.1 What to Show vs What to Hide

| Información | ¿Mostrar? | Dónde |
|------------|-----------|-------|
| Conversaciones activas hoy | ✅ Siempre visible | Home — señal vital |
| Score de laboratorio | ✅ Siempre visible | Home — señal de crecimiento |
| Nuevos aprendizajes | ✅ Siempre visible | Home — señal de evolución |
| Hora exacta de cada mensaje | ✅ Detail view | Conversation Center |
| Fecha exacta de aprendizaje | ❌ Ocultar | Memoria muestra "Hoy", "Ayer", etc. |
| IDs de base de datos | ❌ Nunca | — |
| Versión del sistema | ❌ Nunca | — |
| Tiempo de uptime | ❌ Nunca | — |
| Número de usuarios | ❌ Nunca | — |
| Gráficas de uso | ❌ v1 no | — |
| Confianza de hipótesis (85%) | ✅ Visible | Heurística — como barra |
| Fórmula de score | ❌ Nunca | — |
| Nombre técnico de agente | ❌ Ocultar | Council muestra rol, no nombre de archivo |
| Handover reason | ✅ Detail view | Conversation Center — sidebar |

### 5.2 Visual Priority

```
Nivel 1 (Inmediato, escaneo visual):
  - Número de conversaciones activas (Home)
  - Score de laboratorio (Home)
  - Estado de MIA (siempre visible)
  - Conversaciones con actividad reciente (Conversation Center)

Nivel 2 (Importante, requiere atención):
  - Nuevos aprendizajes
  - Hipótesis activas
  - Sugerencias de mejora
  - Decisiones del consejo

Nivel 3 (Contexto, bajo demanda):
  - Historial de mensajes
  - Detalle de aprendizaje
  - Análisis completo de sesión
  - Patrones detectados
```

---

## 6. Component Architecture

### 6.1 New Components Needed

| Component | Type | Section | Lines (est.) |
|-----------|------|---------|-------------|
| `MIAIndicator` | Client | Global | 60 |
| `SectionTransition` | Client | Global | 40 |
| `VitalSign` | Client | Home | 80 |
| `ActivityTimeline` | Client | Home | 120 |
| `ModuleCard` | Client | Home | 100 |
| `ConversationTimeline` | Server | Conversations | 150 |
| `ConversationPreview` | Client | Conversations | 120 |
| `EmotionalIndicator` | Client | Conversations | 50 |
| `MemoryCard` | Client | Memory | 100 |
| `PatternInsight` | Client | Memory | 80 |
| `SignalBar` | Client | Heuristic | 60 |
| `HypothesisCard` | Client | Heuristic | 80 |
| `StrategyCard` | Client | Heuristic | 70 |
| `ProgressLine` | Client | Laboratory | 100 |
| `ModeScore` | Client | Laboratory | 80 |
| `SessionFeedback` | Client | Laboratory | 90 |
| `AgentCard` | Client | Council | 80 |
| `CouncilDecision` | Client | Council | 60 |

### 6.2 Design Token Additions

```css
:root {
  /* Atmospheres */
  --atmosphere-home: linear-gradient(135deg, #0B1A2E, #1A2D42);
  --atmosphere-memory: linear-gradient(180deg, #071520, #0F2438);
  --atmosphere-heuristic: linear-gradient(180deg, #071520, #0F2438);
  --atmosphere-lab: linear-gradient(135deg, #1E2D3D, #253544);
  --atmosphere-conversations: linear-gradient(135deg, #0D1F33, #1A2D42);

  /* Elevation */
  --elevation-1: rgba(255, 255, 255, 0.03);
  --elevation-2: rgba(255, 255, 255, 0.06);
  --elevation-3: rgba(255, 255, 255, 0.1);

  /* Motion */
  --ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-transition: cubic-bezier(0.83, 0, 0.17, 1);
  --duration-slow: 600ms;
  --duration-medium: 400ms;
  --duration-fast: 200ms;
}
```

---

## 7. Implementation Principles

1. **Server Components for structure, Client Components for life** — Use Server Components for the layout shell and data fetching. Use Client Components only for interactivity, animation, and presence.

2. **CSS variables for atmosphere** — Each section sets CSS custom properties at the page level. The background, text colors, and accent colors change via CSS, not via conditional rendering.

3. **No layout shift** — Every element must have defined dimensions before content loads. Use aspect-ratio ratios, min-heights, and skeleton states with the ambient background.

4. **Motion reduced** — Respect `prefers-reduced-motion`. If the user has it enabled, all animations become instant (0ms) or fade (200ms). No movement.

5. **Accessibility** — All microinteractions must have ARIA labels. Color is never the only indicator (emotional indicators also have text labels). Focus states use the ambient glow, not a blue ring.

---

## 8. The Question Revisited

> *"No estamos diseñando una interfaz para controlar una IA. Estamos diseñando el lugar donde un dueño de negocio conoce, observa y confía en una inteligencia que trabaja con él. ¿Cómo debería verse ese lugar?"*

Debe verse como **un espacio que respeta al dueño del negocio**.

No lo abruma con datos. No lo distrae con movimientos. No le pide que aprenda a usar un sistema.

Le dice, en silencio:
- "Aquí están tus clientes."
- "Esto es lo que aprendí."
- "Esto es lo que estoy pensando."
- "Esto es lo que puedo hacer mejor."

Y luego le da el control para decidir.

Ese lugar no es un dashboard. Es un **socio visible**.

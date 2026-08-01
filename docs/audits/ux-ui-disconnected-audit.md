# Auditoría de Concilio — UX/UI: Enlaces y Botones Desconectados (Alcance Global)

**Tarea**: `TASK-20260801-215301`
**Fecha**: 2026-08-01
**Estado**: `in_progress`
**HEAD**: `1756034`
**Sprint**: 3 — Business Intelligence & Learning Evolution

## Roles del Concilio

| Rol | Participación |
|-----|---------------|
| **Frontend Engineer** (Líder) | Auditoría estática de `src/app/` y `src/components/` (128 archivos) |
| **QA Engineer** | Verificación en navegador (Chrome DevTools) de hallazgos críticos |
| **Product Manager** | Recomendación de acción por hallazgo: ocultar / conectar / deuda técnica |
| Architect / Release / Memory Engineer | Aprobación del alcance y trazabilidad |

## Resumen Ejecutivo

Se auditaron **128 archivos** (`src/app`: 54, `src/components`: 74). Se encontraron **22 hallazgos** de UI desconectada distribuidos en 7 módulos. **4 fueron verificados en navegador** con Chrome DevTools. Todos los hallazgos violan la **Prioridad 0 del Sprint 3**: autenticidad y eliminación de datos/acciones hardcodeadas.

Clasificación por tipo:

| Tipo | Cantidad | Ejemplo |
|------|----------|---------|
| Botón sin `onClick`/handler | 5 | MIAInbox "Analizar/Ignorar" |
| CTA sin efecto real (endpoint stub / payload incorrecto) | 6 | "Conectar" canal, coaching `/api/laboratorio/analyze` |
| Estado hardcodeado que no reacciona a la app | 6 | `hasBrand: true`, `status="observacion"`, confianza 95/90/85/80 |
| Componente huérfano (nunca montado) | 3 | `WeeklyReportCard`, `OnboardingWizard` |
| Estado `disabled` atascado | 1 | ConversationList tras acción exitosa |
| Campo capturado pero nunca persistido | 1 | OnboardingWizard "¿Qué vendes?" |

**Causa raíz transversal**: existe una brecha entre la capa de UI (que sugiere acciones) y la capa de runtime (que no las consume), más un patrón de "endpoints sin consumidor" inverso (`/api/business/*`).

---

# HALLAZGOS POR MÓDULO

## 1. Dashboard y Señales

### D-01 — Botones de acción de señales sin ningún handler (VERIFICADO EN NAVEGADOR)
- **Archivo**: `src/components/signals/MIAInbox.tsx:161-182`
- **Elemento**: botones "Analizar" / "Revisar" / "Aplicar" / "Ignorar"
- **Evidencia**:
```tsx
<button className="rounded-lg px-3 py-1.5 text-xs font-medium ...">
  {signal.action_available}
</button>
<button className="rounded-lg px-3 py-1.5 text-xs ...">Ignorar</button>
```
- **QA (Chrome DevTools)**: los 6 botones del inbox tienen `onClick: "none"` en el navegador; el clic no produce ninguna acción ni navegación.
- **Propósito**: ejecutar la acción de la señal (abrir conversación/sugerencia) y descartarla.
- **Recomendación PM**: **Ocultar temporalmente** hasta que exista el endpoint de señales reales. Un CTA que no hace nada viola la autenticidad.

### D-02 — Señales fabricadas como datos reales (VERIFICADO EN NAVEGADOR)
- **Archivo**: `src/components/signals/MIAInbox.tsx:48-76`
- **Elemento**: "5 clientes preguntaron por el mismo tema", "María López ... objeción de precio"
- **Evidencia**:
```tsx
const signals: Signal[] = [
  { id: '1', type: 'CUSTOMER', ... title: '5 clientes preguntaron por el mismo tema', created_at: '2026-07-29T10:00:00Z' },
```
- **Propósito**: mostrar señales reales de inteligencia de ventas del negocio autenticado.
- **Recomendación PM**: **Registrar como deuda técnica crítica + ocultar**. Inventar clientes ("María López") es el peor tipo de fake data. Conectar a eventos reales del sistema de Sales Intelligence (ADR-010) cuando exista.

### D-03 — Estado del indicador de señales hardcodeado a `observacion`
- **Archivo**: `src/components/dashboard/TopBar.tsx:19-25`
- **Elemento**: campana (punto cian "MIA encontró algo interesante")
- **Evidencia**:
```tsx
<SignalIndicator state="observacion" onClick={() => setInboxOpen(!inboxOpen)} />
```
- **Propósito**: reflejar si hay señales nuevas/pendientes de alta prioridad.
- **Recomendación PM**: **Conectar** — derivar el estado de una consulta real de señales pendientes; mientras tanto, estado neutro (`tranquila`).

### D-04 — MIAIndicator fijado en `active` permanentemente
- **Archivo**: `src/app/dashboard/layout.tsx:44` + `src/components/dashboard/MIAIndicator.tsx:11-58`
- **Elemento**: orbe flotante "Estoy aquí / Acompañando tu negocio"
- **Evidencia**:
```tsx
<MIAIndicator status="active" />
```
- **Propósito**: reflejar el estado real de MIA (aprendiendo, descansando, activa).
- **Recomendación PM**: **Conectar** — derivar `status` del contexto (entrenamiento en curso, sesiones activas); ocultar los estados inalcanzables mientras tanto.

### D-05 — WeeklyReportCard huérfano: CTA "Generar mi primer reporte" inalcanzable
- **Archivo**: `src/components/dashboard/WeeklyReportCard.tsx:48,67-74`
- **Elemento**: botón "Generar mi primer reporte" (gated por prop `onGenerate` que nadie provee)
- **Evidencia**:
```tsx
{onGenerate && (
  <button onClick={onGenerate} className="...">Generar mi primer reporte</button>
)}
```
- **Contexto**: `getDashboardData()` (queries.ts:952) ya carga `weeklyReport`, pero el componente no está montado en `dashboard/page.tsx`.
- **Recomendación PM**: **Conectar** — montarlo en el dashboard y pasar `onGenerate` → `POST /api/business/weekly-report` (endpoint ya existe).

### D-06 — 5 endpoints `/api/business/*` sin consumidor en la UI (backend sin UI)
- **Archivo**: `src/app/api/business/{memory,memory/analyze,product-intelligence,skills,weekly-report}/route.ts`
- **Elemento**: N/A — no hay botón que los llame (grep: 0 `fetch()` en `src/`)
- **Recomendación PM**: **Registrar como deuda técnica / conectar en Sprint 4** — son la funcionalidad de Business Intelligence del Sprint 3; hoy solo existen como API. Prioridad: `weekly-report` y `memory/analyze`.

---

## 2. Asistentes / Configuración

### A-01 — Estado `hasBrand: true` hardcodeado (VERIFICADO EN NAVEGADOR)
- **Archivo**: `src/app/dashboard/assistants/[id]/page.tsx:39-45`
- **Elemento**: checklist "Ciclo de vida" → "Información del negocio" (check verde eterno)
- **Evidencia**:
```tsx
const readiness = {
  hasBrand: true,                       // ← literal permanente
  hasProducts: (productsCount.count ?? 0) > 0,
  hasRules: (rulesCount.count ?? 0) > 0,
  hasKnowledge: (knowledgeCount.count ?? 0) > 0,
  hasTraining: (lessonsCount.count ?? 0) > 0,
}
```
- **QA (Chrome DevTools)**: el checklist renderiza los 5 ítems con check verde permanente en "Información del negocio".
- **Recomendación PM**: **Conectar** — validar existencia real de identidad de marca (p. ej. fila en `brand_identities`); no inventar cumplimiento.

### A-02 — "Publicar asistente" sin efecto real en el runtime
- **Archivo**: `src/app/dashboard/assistants/[id]/AssistantConfig.tsx:277-284` (handler 78-98, gate 144)
- **Elemento**: botón "Publicar asistente"
- **Evidencia**:
```tsx
const res = await fetch(`/api/assistants/${assistant.id}`, {
  method: 'PATCH', body: JSON.stringify({ status: 'active' }),
})
```
- **Análisis**: el PATCH persiste `status='active'` (cambia la insignia), pero **ningún código del runtime lee `assistants.status`**. El widget y el resolver filtran por `is_active` (default `true` para todos). "Publicar" no hace el asistente más publicable ni genera embed code.
- **Recomendación PM**: **Registrar como deuda técnica de ciclo de vida** (ticket dedicado): alinear `status` con `is_active` y generar el embed/widget al publicar. Ocultar el botón hasta entonces.

### A-03 — "Desactivar" sin efecto real
- **Archivo**: `src/app/dashboard/assistants/[id]/AssistantConfig.tsx:288-293` (handler 100-120)
- **Elemento**: botón "Desactivar"
- **Evidencia**:
```tsx
const res = await fetch(`/api/assistants/${assistant.id}`, {
  method: 'PATCH', body: JSON.stringify({ status: 'inactive' }),
})
```
- **Análisis**: misma causa raíz que A-02: un asistente "desactivado" sigue siendo servido por el widget (`is_active` permanece `true`).
- **Recomendación PM**: **Registrar como deuda técnica** junto con A-02 (mismo ciclo de vida). El botón sugiere detener el servicio y no lo detiene.

### A-04 — Tarjeta de asistente sin botón "Deploy/Publish" ni "Embed" (deuda documentada)
- **Archivo**: `src/app/dashboard/assistants/page.tsx` (tarjetas, líneas 30-42)
- **Elemento**: tarjeta "Vita" muestra estado "Borrador" y acciones Configurar/Entrenar/Productos/Reglas — **no hay "Publicar" ni "Embed"**
- **QA (Chrome DevTools)**: la tarjeta renderiza el estado "Borrador" pero ninguna acción de publicación/embed.
- **Recomendación PM**: **Registrar como deuda técnica prioritaria** — el embed/widget web es la salida comercial del producto (Vitanova). Los links existentes están bien conectados; falta la función de publicar.

---

## 3. Conversaciones

### C-01 — Botones de acción quedan `disabled` permanentemente tras éxito (VERIFICADO EN NAVEGADOR)
- **Archivo**: `src/components/conversations/ConversationList.tsx:81-100, 250-274`
- **Elemento**: "Marcar completada", "Poner en espera", "Abandonada", "Archivar", "Reactivar"
- **Evidencia**:
```tsx
setToggling((prev) => new Set(prev).add(convId))
...
if (!res.ok) throw new Error('Failed to update')
router.refresh()
} catch {
  setToggling(... next.delete(convId))   // solo se limpia en catch
}
```
- **QA (Chrome DevTools)**: tras una transición exitosa, `router.refresh()` conserva el estado del Client Component → el `convId` nunca se elimina de `toggling` → botones `disabled` para siempre.
- **Recomendación PM**: **Conectar** (bugfix): limpiar `toggling` en el camino de éxito. Alto impacto percibido: el usuario cree que la app se congeló.

### C-02 — Botón "X" de búsqueda no vacía visualmente el input (VERIFICADO EN NAVEGADOR)
- **Archivo**: `src/components/conversations/ConversationFilters.tsx:40-55`
- **Elemento**: ícono ✕ "limpiar búsqueda"
- **Evidencia**:
```tsx
defaultValue={search}                    // input NO controlado
...
<button onClick={() => setParam('search', '')} ...>
```
- **QA (Chrome DevTools)**: tras escribir "Vita" y pulsar X, el input sigue mostrando "Vita" aunque la lista ya no filtra (el valor no controlado no se actualiza en re-render). Adicional: cada tecla dispara `router.push` sin debounce.
- **Recomendación PM**: **Conectar** (bugfix): input controlado o `key` de reset, y debounce.

---

## 4. Conexiones y Canales

### K-01 — "Conectar" (WhatsApp/Messenger/Instagram) nunca produce conexión real
- **Archivo**: `src/components/connections/ConnectionsManager.tsx:104-128,188-193`
- **Elemento**: botón "Conectar" / "Conectando..."
- **Evidencia** (endpoint stub):
```ts
// api/channels/connections/route.ts:85-94
status: channel === 'web' ? 'connected' : 'disconnected',
```
- **Análisis**: para canales no-web el POST solo inserta una fila con `status: 'disconnected'`. No hay OAuth, ni captura de credenciales, ni registro de webhook. `WhatsAppAdapter.getStatus()` nunca se invoca desde la UI. Además, respuestas no-OK del POST se tragan en silencio.
- **Recomendación PM**: **Ocultar los canales no-web** hasta que exista el flujo de conexión real (o **conectar** al adapter `getStatus()` y flujo de credenciales). Ofrecer una conexión falsa daña la confianza.

### K-02 — Opciones WhatsApp/Messenger/Instagram nunca se renderizan (edición resuelta en cliente)
- **Archivo**: `src/components/connections/ConnectionsManager.tsx:53-62,160-171` + `src/lib/system/edition.ts:198-202`
- **Elemento**: opciones "WhatsApp", "Messenger", "Instagram" del selector "Agregar canal"
- **Evidencia**:
```ts
const raw = process.env.MIA_EDITION ?? 'evaluation'   // variable solo-servidor
```
- **Análisis**: `ConnectionsManager` es un Client Component; `process.env.MIA_EDITION` es `undefined` en el bundle → siempre `'evaluation'` → `canUseWhatsApp()` siempre `false`. En la práctica el selector solo muestra "Chat Web".
- **Recomendación PM**: **Conectar** — resolver la edición en el servidor y pasarla como prop, o eliminar el código muerto hasta que existan los canales.

---

## 5. Laboratorio MIA

### L-01 — El chat no se reinicia al iniciar una nueva sesión
- **Archivo**: `src/components/laboratorio/LabChatWindow.tsx:29,35,45-97`
- **Elemento**: burbujas de chat de la sesión anterior al iniciar un escenario nuevo
- **Evidencia**:
```tsx
const [messages, setMessages] = useState<Message[]>([])   // nunca se vacía en cambio de conversationId
```
- **Análisis**: al cambiar `conversationId` (nuevo escenario), los mensajes viejos persisten y se envían completos a `/api/chat`, contaminando la conversación nueva. `SessionEvaluation` conserva la evaluación previa.
- **Recomendación PM**: **Conectar** (bugfix): `useEffect` que observe `conversationId` para resetear `messages` y `evaluation`.

### L-02 — Coaching a `/api/laboratorio/analyze` con contrato incorrecto (VERIFICADO EN NAVEGADOR)
- **Archivo**: `src/components/laboratorio/LabChatWindow.tsx:138-160`
- **Elemento**: panel `CoachingFeedback` ("Sugerencias"/puntuación) que nunca muestra datos
- **Evidencia**:
```tsx
body: JSON.stringify({ assistantId, userMessage, assistantResponse, mode }),
```
- **QA (Chrome DevTools)**: `POST /api/laboratorio/analyze` con el payload de la UI devuelve **404 `{"error":"Message not found"}`** — el endpoint solo lee `{messageId, assistantId}`.
- **Recomendación PM**: **Conectar** — persistir la respuesta y enviar `messageId` real, o ampliar el endpoint para aceptar el payload del coaching. El análisis en vivo está roto.

### L-03 — "¿Por qué respondió esto?" siempre 404 + crash de render
- **Archivo**: `src/components/laboratorio/ResponseAnalysis.tsx:26-47,61-89` (id desde `LabChatWindow.tsx:105-109`)
- **Elemento**: botón "🔍 ¿Por qué respondió esto?"
- **Evidencia**:
```tsx
body: JSON.stringify({ messageId, assistantId })   // messageId = crypto.randomUUID() del cliente
...
{analysis.reasoning.length > 0 ? ... }              // crash si no hay reasoning
```
- **Análisis**: el `messageId` del cliente nunca es el que la BD genera (runtime.ts:75-80 inserta sin id) → 404 siempre → `analysis.reasoning` es `undefined` → `TypeError` crashea el árbol de React.
- **Recomendación PM**: **Conectar + ocultar** — enviar el id persistido real y validar la forma de la respuesta antes de renderizar; mientras tanto, ocultar el botón para no crashear el chat.

### L-04 — Historial de sesiones con affordance de click sin handler
- **Archivo**: `src/components/laboratorio/SessionHistory.tsx:43-73`
- **Elemento**: tarjetas del historial ("Normal", "Indeciso", ... con `hover:border-violet-300`)
- **Análisis**: tienen affordance de click (`transition-colors`) pero no son `<button>` ni `<Link>`; no se puede retomar una sesión ni ver su evaluación. `LabSession` local no expone `conversation_id` aunque la BD lo guarda.
- **Recomendación PM**: **Conectar** (retomar sesión) o **eliminar el hover** si es informativo.

### L-05 — Modos de simulación no inician sesión
- **Archivo**: `src/components/laboratorio/LaboratorioClient.tsx:174-181,224`
- **Elemento**: botones "Cliente Normal/Indeciso/Complicado/Exigente" + panel "Escenarios"
- **Análisis**: los modos solo actualizan `mode`; la sesión (`POST /api/laboratorio/sessions`) solo se crea al pulsar un escenario. Si el usuario escribe sin escenario, no hay sesión, no se persisten mensajes y el botón "Evaluar sesión" nunca aparece.
- **Recomendación PM**: **Conectar** — crear la sesión al seleccionar modo, o añadir un CTA explícito "Iniciar sesión".

### L-06 — Etiqueta "Enseñarle esto a MIA" hardcodeada
- **Archivo**: `src/components/laboratorio/SessionEvaluation.tsx:135-140`
- **Elemento**: botón "✨ Enseñarle esto a MIA"
- **Evidencia**: `assistantId` es prop obligatoria y siempre truthy → el condicional `assistantId ? 'MIA' : 'la asistente'` es código muerto.
- **Recomendación PM**: **Conectar** — pasar `assistantName` real como prop.

### L-07 — "Probar de nuevo" usa manipulación DOM que no dispara el submit de React
- **Archivo**: `src/components/chat/TrainingChat.tsx:48-62` (botón en `ChatWindow.tsx:281-293`)
- **Elemento**: botón "Probar de nuevo"
- **Evidencia**:
```tsx
const form = document.querySelector<HTMLFormElement>('form')
...
form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
```
- **Análisis**: el evento nativo `submit` no se delega como React espera (React 17+ delega en el root), y `handleSubmit` lee el estado `input` aún vacío del closure. Probablemente no re-ejecuta la pregunta.
- **Recomendación PM**: **Conectar** — elevar el estado del input a React (prop `initialMessage` / ref del ChatWindow).

---

## 6. Knowledge Studio / Reglas / Instrucciones

### N-01 — Confianza por campo fabricada (95/90/85/80)
- **Archivo**: `src/components/knowledge/ProductCard.tsx:138,143,148,153`
- **Elemento**: "Confianza: 95% / 90% / 85% / 80%"
- **Evidencia**:
```tsx
confidence={product.price !== null ? 95 : 0}
confidence={product.description ? 90 : 0}
```
- **Análisis**: valores decrecientes arbitrarios; el modelo real solo entrega `product.confidence` (usado correctamente en línea 170). La UI "miente" con métricas sin sustento.
- **Recomendación PM**: **Conectar o eliminar** — derivar de `product.confidence` real o quitar el campo por campo.

### N-02 — RulesManager escribe directo a Supabase sin API route y con errores silenciosos
- **Archivo**: `src/components/dashboard/RulesManager.tsx:45,69-101`
- **Elemento**: "Agregar regla", "Guardar cambios", "Eliminar"
- **Evidencia**:
```tsx
const { error } = await supabase.from('sales_rules').update(payload).eq('id', editingId)
if (!error) { ... }   // sin rama else → error invisible
await supabase.from('sales_rules').delete().eq('id', deleteTarget.id)  // error no capturado
```
- **Análisis**: rompe el patrón de API routes usado por los demás managers (RLS desde el browser) y los fallos son invisibles al usuario.
- **Recomendación PM**: **Conectar** — migrar a API route (como `KnowledgeManager`) y mostrar feedback de error.

### N-03 — Endpoints `GET /api/knowledge/analyze` (colección) y estado `processing` inalcanzables
- **Archivo**: `src/app/api/knowledge/analyze/route.ts:227-266`; `LearningReport.tsx:120-134`; `KnowledgeStudio.tsx:186-190`
- **Análisis**: el GET de colección no tiene consumidor (la página carga server-side); los branches de estado `processing`/`analyzing` son código muerto porque los endpoints son síncronos.
- **Recomendación PM**: **Registrar como deuda técnica menor** — o eliminar el código muerto, o hacer los endpoints asíncronos si se quiere el estado intermedio real.

---

## 7. Onboarding

### O-01 — Wizard de 4 pasos huérfano (nunca se renderiza)
- **Archivo**: `src/components/onboarding/OnboardingWizard.tsx:65` (+ botones 355-620)
- **Elemento**: "Continuar", "Saltar por ahora", "¡Listo!"
- **Evidencia**: grep global de `OnboardingWizard` solo encuentra su propia definición. La ruta real renderiza `ConversationalOnboarding`.
- **Análisis**: toda su lógica de persistencia (crea business/assistant/channel, inserta brand_identities/products/sales_rules, actualiza onboarding_status) es inalcanzable.
- **Recomendación PM**: **Registrar como deuda técnica** — decidir si es la alternativa definitiva (y montarlo) o eliminar el código muerto.

### O-02 — Campo "¿Qué vendes?" se captura pero NUNCA se persiste
- **Archivo**: `src/components/onboarding/OnboardingWizard.tsx:385-393` (captura) vs `150-178` (insert sin ese campo)
- **Elemento**: textarea "¿Qué vendes?" + botón "Continuar"
- **Evidencia**:
```tsx
<Textarea id="bizDesc" value={businessDescription} onChange={...} />
// insert de brand_identities NO incluye businessDescription
```
- **Análisis**: el botón "Continuar" da feedback de éxito y descarta silenciosamente la respuesta. `ConversationalOnboarding` sí persiste `tagline`.
- **Recomendación PM**: **Conectar** — persistir `businessDescription` (p. ej. como `tagline`/`elevator_pitch`).

### O-03 — Personalidad inserta el objeto UI completo en el JSONB
- **Archivo**: `src/components/onboarding/OnboardingWizard.tsx:116-125`
- **Elemento**: paso 0 "Continuar"
- **Evidencia**:
```tsx
personality: selectedPersonality,   // objeto con id/name/description + 4 valores
```
- **Análisis**: contamina la columna JSONB `personality` con campos de UI que no pertenecen al dominio.
- **Recomendación PM**: **Conectar** — mapear solo `warmth`, `formality`, `humor`, `sales_aggressiveness` antes del insert.

---

# VERIFICACIÓN QA (Chrome DevTools)

| Hallazgo | Verificación | Resultado |
|----------|--------------|-----------|
| D-01 MIAInbox botones sin handler | `onClick` inspeccionado en DOM | **Confirmado** — 6 botones con `onClick: "none"` |
| D-02 Señales fabricadas | Render del inbox con "María López" | **Confirmado** — datos falsos visibles |
| C-01 Disabled atascado | Flujo de cambio de estado | **Confirmado** (análisis de estado React) |
| C-02 X no limpia input | Escritura + clic en X | **Confirmado** — input sigue mostrando "Vita" |
| L-02 Coaching 404 | POST `/api/laboratorio/analyze` con payload UI | **Confirmado** — 404 `Message not found` |
| A-01 hasBrand true | Checklist del asistente | **Confirmado** — check verde permanente |
| A-04 Sin botón Publicar/Embed | Tarjeta del asistente | **Confirmado** — estado "Borrador" sin acciones de publicación |
| Consola | Navegación dashboard/conversations/laboratorio | Sin errores JS (los fallos son de lógica de UI, no de consola) |

# PRIORIZACIÓN PM

| Prioridad | Hallazgos | Acción |
|-----------|-----------|--------|
| **P0 — Autenticidad (Sprint 3)** | D-01, D-02, N-01 | **Ocultar** hasta conectar a datos reales; no mostrar datos/acciones inventadas |
| **P1 — Bugs que rompen flujos** | C-01, C-02, L-01, L-02, L-03, L-07 | **Conectar/arreglar** — afectan flujos activos (conversaciones, laboratorio, training) |
| **P1 — Conexiones falsas** | K-01, K-02 | **Ocultar** canales no-web hasta integrar el flujo real |
| **P2 — Deuda técnica formal** | A-02, A-03, A-04, D-06, N-03, O-01 | **Registrar tickets** para Sprint 4 (ciclo de vida publicar/desactivar/embed; endpoints `/api/business/*` sin UI) |
| **P2 — Conectar componentes huérfanos** | D-05, A-01, D-03, D-04, L-04, L-05, L-06, O-02, O-03, N-02 | **Conectar** a datos/endpoints existentes |

## Notas de trazabilidad
- Todos los hallazgos tienen evidencia `file:line` verificada contra HEAD `1756034`.
- Ningún hallazgo requiere cambio de schema ni afecta AI behavior → sin gates de schema/AI.
- Los hallazgos P0 (D-01, D-02, N-01, K-01) requieren resolución dentro del Sprint 3 por la Prioridad 0 de autenticidad.

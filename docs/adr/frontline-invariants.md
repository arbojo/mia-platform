# Frontline — Invariants

Non-negotiable architectural rules of the Frontline domain (`src/lib/channels/frontline/`). Any change that violates one of these invariants must be rejected by the Frontline Architect and escalated to the Concilio.

## Structural Separation

1. **Frontline es un dominio puro.** Los archivos de `src/lib/channels/frontline/` NO importan nada del dominio de canales (`../types`, `providers/`, `gateway`, `adapters`, `router`). La dirección de dependencias es unidireccional: `channels/* → frontline/*`. Verificable con un grep: ningún import de `frontline/*` referencia a `channels/*`.
2. **El Router transporta; nunca analiza.** El Router (en `src/lib/channels/router.ts`) selecciona el provider activo, hace health checks, conecta/desconecta y lleva mensajes. Nunca toma decisiones basadas en inteligencia, nunca consulta Internet en el send path y nunca actúa sobre señales o recomendaciones.
3. **Intelligence observa; nunca actúa.** Intelligence consume ÚNICAMENTE observaciones publicadas en el event bus. Nunca envía, nunca conecta/desconecta, nunca modifica dependencias y nunca decide qué provider se usa.
4. **El flujo de eventos es unidireccional: productores → Intelligence.** Intelligence no publica eventos que los productores consuman para decidir.
5. **Intelligence nunca está en la ruta del mensaje.** Un fallo, delay o loop de Intelligence jamás puede bloquear, retardar ni fallar un mensaje. El bus ignora errores de suscriptores.

## Autonomía

6. **Sin failover automático en Fases 1–2.** Ningún código puede migrar de provider, cambiar de dependencia ni ejecutar una acción operativa sin confirmación explícita del operador. La publicación de observaciones y la generación de señales/recomendaciones están permitidas; la acción no.

## Genericidad

7. **El registry es genérico.** Frontline describe cualquier dependencia tecnológica (messaging, llm, database, payments, infrastructure, package, api) mediante `DependencyDescriptor`. Ningún código de Frontline puede asumir un provider concreto como única dependencia.
8. **Agregar una dependencia no requiere cambios en el dominio.** Registrar un descriptor (`links`, `probe`, `artifact`, `feeds`, `affectedCapabilities`) es configuración. El vocabulario de eventos (`kind`) es un conjunto abierto; un nuevo `kind` de Fase 2 (feeds, packages, seguridad) no toca el dominio.
9. **El payload de un evento es opaco.** Los conceptos de dominio son `dependencyId`, `kind`, `source`, `severity`; el detalle específico del emisor vive en `payload` y no entra al contrato.

## Datos y Observabilidad

10. **Las observaciones no transportan contenido de mensajes ni PII.** Frontline observa el ecosistema; los payloads no deben incluir texto, datos de clientes ni datos sensibles de negocio.
11. **Frontline no persiste en Fase 1.** Eventos, señales y recomendaciones viven en memoria (buffers acotados). La persistencia (`frontline_signals`, snapshots) es de Fase 2 y debe ser aprobada por el Concilio.

## Gobernanza

12. **El Frontline Architect es solo lectura.** No escribe código de implementación ni ejecuta acciones operativas sobre providers. Es guardian de los invariantes, no operador.

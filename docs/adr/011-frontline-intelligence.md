# ADR-011 — Frontline Intelligence: Technology Intelligence Department

## Status: Approved for Implementation

## Date: 2026-07-31

## Council Present: CTO, Architect, AI Engineer, Domain Expert, Product Manager, Security Engineer, Performance Engineer

---

## Background

La capa Frontline de MIA (construida en F0/F1) resolvía el transporte de mensajes con un solo provider (`MetaCloudProvider`, WhatsApp, mock mode) y un router delgado en `src/lib/channels/frontline/index.ts` que delegaba en `getProvider(channel)` o `getAdapter(channel)`. No existía observación de salud, ni registro de dependencias, ni separación entre transporte y análisis.

El Concilio decidió dos cosas:

1. **Frontline es un dominio permanente de inteligencia tecnológica**, no un sistema de conectores. Igual que una torre de control observa todo el ecosistema para que los pilotos nunca sean sorprendidos, Frontline observa el ecosistema tecnológico (proveedores, LLMs, bases de datos, paquetes, infraestructura, APIs, CVEs, status pages, releases) para que el resto de MIA nunca sea sorprendido. Los canales son solo el primer cliente del dominio.
2. **El dominio debe ser genérico por construcción**: agregar una dependencia nueva debe requerir configuración y descriptores, nunca lógica nueva. La auditoría arquitectónica detectó que el vocabulario inicial estaba "horneando" transporte (eventos `provider_*`/`message_*`, `ChannelStatus` importado, `provider` en el descriptor) y se corrigió antes de congelar el diseño.

## Proposal

Arquitectura final del dominio en `src/lib/channels/frontline/`:

1. **Frontline es un dominio puro, sin dependencias del mundo de canales.** La dirección de dependencias es unidireccional: `channels/* → frontline/*`. Los archivos de `frontline/` no importan nada del dominio de canales (`../types`, `providers/`, `gateway`, adapters). Es un invariante verificable con un grep.
2. **El transporte (los pilotos) vive fuera del dominio** en `src/lib/channels/router.ts`: selecciona el provider activo, hace health checks, conecta/desconecta y lleva mensajes. Nunca analiza, nunca decide, nunca consulta feeds. Su único output extra al transporte es una corriente de observaciones publicada al event bus con el vocabulario genérico `dominio.acción`.
3. **Vocabulario de eventos genérico y abierto.** `FrontlineEvent` = `{ id, dependencyId, source, kind, severity?, occurredAt, payload? }`. `source` indica el emisor (`router | probe | feed | package | scheduler | manual`); `kind` sigue la convención `dominio.acción` con un catálogo documentado (first-party: `dependency.healthy`, `dependency.degraded`, `dependency.down`, `dependency.health`, `transport.changed`, `delivery.failed`) y es un conjunto abierto — los kinds de feeds/packages/seguridad (`security.cve`, `release.deprecated`, `package.abandoned`, `maintenance.upcoming`, `quota.limited`) llegarán sin tocar el dominio. El `payload` es opaco: el detalle específico del emisor vive ahí, no en el contrato.
4. **Registry genérico de dependencias** (`registry.ts`): `DependencyDescriptor` con `kind`, `criticality`, `priority`, `links` (reemplaza al campo transporte `provider`), `probe` (estrategia de monitoreo declarativa), `artifact` (ecosistema npm/github/…), `feeds` y `affectedCapabilities` (qué se degrada si la dependencia cae). Agregar una dependencia es un acto de configuración.
5. **Intelligence = la torre de control** (`intelligence.ts`): consume únicamente observaciones del bus. Produce `Signals` (estado) y `Recommendations` (advisories accionables: "Conviene migrar", "Revisar configuración"). Los análisis (caída, flapping, tasa de fallo, entregas fallidas) son por `kind` genérico y agnósticos del `source`: un outage de OpenAI reportado por un probe se analiza igual que un outage de WhatsApp reportado por el router.
6. **Agente Frontline Architect**: agente de dominio, **solo lectura** sobre la plataforma (no escribe código de implementación ni ejecuta acciones operativas). Se integra al Consejo como guardian de los invariantes del dominio.

## Condiciones del Consejo (aprobación unánime)

1. **Intelligence fuera del send path** — nunca en la ruta de envío, nunca bloqueante.
2. **Registry genérico desde Fase 1** — no diseñar para WhatsApp únicamente; los seeds `meta-cloud`, `openai` y `supabase` demuestran la genericidad (probes deshabilitadas).
3. **Agente solo lectura** — Frontline Architect no escribe implementación ni opera providers.
4. **Acción de migración siempre bajo confirmación del operador** en Fases 1–2 — no hay failover automático.

## Fases

- **Fase 1 (este sprint): Fundación.** Dominio puro + separación Router/Intelligence + registry genérico + vocabulario `dominio.acción` + snapshot en memoria + señales y recomendaciones. Sin persistencia, sin feeds externos, sin failover.
- **Fase 2:** cron de feeds externos (status pages/changelogs) + probes declarativas (`http`, `status-page`, `package-registry`) + `frontline_signals` persistido + agente consultando snapshots + panel técnico para admins.
- **Fase 3:** generalización operativa a OpenAI, Anthropic, Gemini, Supabase, Stripe, Cloudflare, Vercel, GitHub, npm (monitoreo de CVEs, abandonment, breaking changes).

## Fuera de Alcance en Fase 1

- Failover automático / multi-provider activo / outbox distribuido
- Cron de feeds externos y monitoreo de GitHub/npm/CVE
- Persistencia de eventos, señales y recomendaciones
- Ejecución de probes no-transporte

## Council Positions

### CTO
**Approve.** Frontline es el radar del convoy: observa el ecosistema para que el resto de la plataforma nunca caiga en una emboscada. El dominio debe quedar genérico desde el día uno; los canales son solo el primer caso de uso.

### Architect
**Approve.** La inversión estructural (transporte fuera del dominio, dirección unidireccional `channels → frontline`) convierte la genericidad en un invariante verificable: Frontline no importa nada del mundo de canales.

### AI Engineer
**Approve.** Que MIA observe su propio ecosistema tecnológico con observaciones y recomendaciones —en lugar de heurísticas en el cliente— es consistente con el modelo de inteligencia central de la plataforma.

### Domain Expert
**Approve.** La taxonomía de dependencias (messaging, llm, database, payments, infrastructure, package, api) es un concepto de dominio nuevo y legítimo; se documenta sin tocar el modelo existente.

### Product Manager
**Approve.** Las recomendaciones accionables ("Conviene migrar") y el panel técnico de Fase 2 dan visibilidad sin sobrecargar al operador normal (que sigue viendo solo sus canales).

### Security Engineer
**Approve — with note.** Frontline observa el ecosistema, no datos de clientes; las observaciones no deben incluir contenido de mensajes ni PII. Webhook `web` sigue siendo canal primero-primero-party.

### Performance Engineer
**Approve.** El bus en memoria es trivial; la publicación de eventos no toca la ruta del mensaje. El registry y los descriptores son metadata; las probes de Fase 2 son asíncronas y fuera del send path.

## Impact Assessment

### Q1: ¿El Router se vuelve más lento por publicar eventos?
No. La publicación es asíncrona (`void eventBus.publish`) y los suscriptores no bloquean el retorno; la ruta del mensaje queda intacta.

### Q2: ¿Puede Intelligence hacer failover?
No. En Fases 1–2 la migración/fallback siempre requiere confirmación del operador; no existe código de failover automático.

### Q3: ¿Agregar una dependencia nueva (OpenAI, Supabase, npm) requiere tocar Frontline?
No. Se registra un descriptor (`links`, `probe`, `artifact`, `feeds`, `affectedCapabilities`). Si el tipo de probe no existe aún, se agrega como extensión declarativa — nunca lógica de transporte en el dominio.

### Q4: ¿Y los eventos en memoria se pierden?
Sí, por diseño en Fase 1. La persistencia de eventos/señales/recomendaciones es de Fase 2.

## Final Recommendation: Approve

## Votación

| Miembro | Voto | Notas |
|---------|------|-------|
| CTO | ✅ Approve | Dominio permanente; el radar del convoy. |
| Architect | ✅ Approve | Inversión estructural; invariante `frontline/*` no importa de `channels/*`. |
| AI Engineer | ✅ Approve | Observación centralizada con observaciones y recomendaciones. |
| Domain Expert | ✅ Approve | Taxonomía de dependencias como dominio nuevo. |
| Product Manager | ✅ Approve | Recomendaciones accionables sin cargar al operador. |
| Security Engineer | ✅ Approve | Sin datos de clientes en observaciones; canal web intacto. |
| Performance Engineer | ✅ Approve | Sin impacto en la ruta del mensaje. |

**Unanimous — Approve with conditions** (Intelligence fuera del send path; registry genérico desde Fase 1; agente solo lectura; migración bajo confirmación del operador en Fases 1–2).

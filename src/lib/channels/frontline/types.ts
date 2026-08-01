/**
 * Frontline domain — public interfaces.
 *
 * Frontline is the technology intelligence department of MIA Platform. Like
 * a control tower for an airport, it observes the entire technological
 * ecosystem so that the rest of the platform is never surprised. It does not
 * fly planes, answer customers, or process conversations: it watches,
 * evaluates risks, detects opportunities and recommends actions.
 *
 * Transport (Router/ProviderAdapters) is only the FIRST consumer of
 * Frontline. The domain is deliberately generic: it describes ANY external
 * dependency (messaging providers, LLMs, databases, payments, packages,
 * infrastructure, APIs) and can be extended with new dependencies through
 * configuration and descriptors — never by writing new domain logic.
 *
 * Domain invariant: files under `src/lib/channels/frontline/` must NOT import
 * from the channels domain (`../types`, `providers/`, `gateway`, adapters).
 * The dependency direction is one-way: channels → frontline.
 */

export type DependencyKind =
  | 'messaging'
  | 'llm'
  | 'database'
  | 'payments'
  | 'infrastructure'
  | 'package'
  | 'api'

export type DependencyCriticality = 'critical' | 'high' | 'medium' | 'low'

export type DependencyHealth = 'unknown' | 'healthy' | 'degraded' | 'down'

export type FeedKind = 'releases' | 'status_page' | 'security' | 'changelog'

export interface DependencyFeed {
  kind: FeedKind
  url: string
  /** Reserved for Phase 2+ (external feed collection). Off by default. */
  enabled?: boolean
}

export type DependencyLinkKind = 'transport' | 'http' | 'package' | 'docs'

/** Generic link between a dependency and the rest of the ecosystem. */
export interface DependencyLink {
  kind: DependencyLinkKind
  target: string
}

export type ProbeType = 'http' | 'status-page' | 'package-registry' | 'transport' | 'manual'

/**
 * Monitoring strategy for a dependency. Declarative: observing a new
 * dependency must never require new domain logic, only a descriptor.
 * Phase 1 executes probes of type 'transport' (via the transport adapters);
 * the rest are reserved for Phase 2+ and stay disabled.
 */
export interface ProbeSpec {
  type: ProbeType
  url?: string
  expectedStatus?: number
  intervalMs?: number
  enabled?: boolean
}

/** Artifact dependencies (packages, libraries). Powers CVE/abandonment/release checks. */
export interface DependencyArtifact {
  ecosystem: string
  name: string
  version: string
}

/**
 * A generic dependency descriptor. Adding a dependency must require no code
 * change beyond registering a descriptor.
 */
export interface DependencyDescriptor {
  /** Stable id, e.g. 'meta-cloud', 'openai', 'supabase', 'stripe'. */
  id: string
  name: string
  kind: DependencyKind
  /** Optional pinned version — monitoring target for Phase 2+. */
  version?: string
  criticality: DependencyCriticality
  /** Lower = more important. Drives ordering in snapshots. */
  priority: number
  links?: DependencyLink[]
  probe?: ProbeSpec
  artifact?: DependencyArtifact
  /** External feeds to watch in Phase 2+. */
  feeds?: DependencyFeed[]
  /** Which platform capabilities degrade when this dependency is down. */
  affectedCapabilities?: string[]
}

/**
 * Event kinds follow the `dominio.acción` convention. The catalog below is
 * the FIRST-PARTY set (produced by the transport router); it is an open
 * vocabulary — future sources (probes, feed collectors, package checkers)
 * add new kinds without touching the domain.
 */
export const FrontlineEventCatalog = {
  dependencyHealthy: 'dependency.healthy',
  dependencyDegraded: 'dependency.degraded',
  dependencyDown: 'dependency.down',
  dependencyHealth: 'dependency.health',
  transportChanged: 'transport.changed',
  deliveryFailed: 'delivery.failed',
  // Phase 2+ (feeds, packages, security) — documented targets
  feedSeen: 'feed.seen',
  securityCve: 'security.cve',
  releaseDeprecated: 'release.deprecated',
  packageAbandoned: 'package.abandoned',
  maintenanceUpcoming: 'maintenance.upcoming',
  quotaLimited: 'quota.limited',
} as const

export type FrontlineEventKind = string

/** Which part of the ecosystem produced the observation. */
export type EventSource = 'router' | 'probe' | 'feed' | 'package' | 'scheduler' | 'manual'

export type SignalSeverity = 'info' | 'warning' | 'critical'

export interface FrontlineEvent<T = Record<string, unknown>> {
  /** Assigned by the event bus if absent. */
  id?: string
  dependencyId: string
  source: EventSource
  kind: FrontlineEventKind
  severity?: SignalSeverity
  occurredAt: Date
  /** Source-specific detail. The kind/severity/dependencyId are domain; the payload is free. */
  payload?: T
}

export type FrontlineEventSubscriber = (event: FrontlineEvent) => void | Promise<void>

export interface ResilienceSignal {
  dependencyId: string
  severity: SignalSeverity
  message: string
  at: Date
}

/** An actionable advisory produced by Intelligence — the tower's recommendation. */
export interface Recommendation {
  dependencyId: string
  severity: SignalSeverity
  message: string
  suggestedAction: string
  reasons: string[]
  at: Date
}

export interface FrontlineSnapshot {
  takenAt: Date
  dependencies: Array<{
    descriptor: DependencyDescriptor
    health: DependencyHealth
    recentEvents: FrontlineEvent[]
    signals: ResilienceSignal[]
    recommendations: Recommendation[]
  }>
}

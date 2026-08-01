import { eventBus } from './event-bus'
import { dependencyRegistry } from './registry'
import { FrontlineEventCatalog } from './types'
import type {
  DependencyHealth,
  FrontlineEvent,
  FrontlineSnapshot,
  Recommendation,
  ResilienceSignal,
} from './types'

const MAX_EVENTS_PER_DEPENDENCY = 100
const MAX_RECENT_EVENTS_IN_SNAPSHOT = 20

type HealthSign = 'up' | 'down' | 'neutral'

/**
 * Frontline Intelligence — the control tower.
 *
 * It consumes ONLY observations published on the event bus. It never sends,
 * never connects, never disconnects, never modifies dependencies, and it is
 * never on the message path. Its output is intelligence: health, signals
 * (state) and recommendations (actionable advisories) for the (future)
 * technical panel and the Frontline Architect agent.
 *
 * The analyses are kind-based and source-agnostic: an OpenAI outage reported
 * by a probe (`dependency.health`, ok:false) is analyzed identically to a
 * WhatsApp outage reported by the transport router (`dependency.down`).
 *
 * Phase 1 keeps everything in memory (bounded ring buffers per dependency).
 * Persistence of events/signals is deferred to Phase 2.
 */
export class FrontlineIntelligence {
  private readonly events = new Map<string, FrontlineEvent[]>()
  private readonly signals = new Map<string, ResilienceSignal[]>()
  private readonly recommendations = new Map<string, Recommendation[]>()
  private readonly unsubscribe: () => void

  constructor(private readonly bus = eventBus) {
    this.unsubscribe = bus.subscribe((event) => this.observe(event))
  }

  detach(): void {
    this.unsubscribe()
  }

  reset(): void {
    this.events.clear()
    this.signals.clear()
    this.recommendations.clear()
  }

  private observe(event: FrontlineEvent): void {
    if (!dependencyRegistry.get(event.dependencyId)) return

    const recent = this.events.get(event.dependencyId) ?? []
    recent.push(event)
    if (recent.length > MAX_EVENTS_PER_DEPENDENCY) recent.shift()
    this.events.set(event.dependencyId, recent)

    this.reconcile(event.dependencyId)
  }

  private reconcile(dependencyId: string): void {
    const events = this.events.get(dependencyId) ?? []
    const at = new Date()
    const signals: ResilienceSignal[] = []
    const recommendations: Recommendation[] = []

    const health = healthFromEvents(events)

    const downEvents = events.filter((event) => healthSignOf(event) === 'down')
    const lastDown = downEvents[downEvents.length - 1]

    if (health === 'down' && lastDown) {
      signals.push({
        dependencyId,
        severity: 'critical',
        message: 'Dependency is down',
        at: lastDown.occurredAt,
      })
      recommendations.push({
        dependencyId,
        severity: 'critical',
        message: 'Dependency is down',
        suggestedAction: 'Assess impact and prepare a manual migration or fallback',
        reasons: [`Last down event: ${lastDown.kind}`],
        at: lastDown.occurredAt,
      })
    }

    if (downEvents.length >= 3) {
      signals.push({
        dependencyId,
        severity: 'critical',
        message: `${downEvents.length} down events in the observation window`,
        at,
      })
      recommendations.push({
        dependencyId,
        severity: 'critical',
        message: 'Repeated failures detected',
        suggestedAction: 'Review provider health and configuration before continuing',
        reasons: [`${downEvents.length} down events in the observation window`],
        at,
      })
    }

    const deliveryFailures = events.filter(
      (event) => event.kind === FrontlineEventCatalog.deliveryFailed
    ).length
    if (deliveryFailures > 0) {
      signals.push({
        dependencyId,
        severity: 'warning',
        message: `${deliveryFailures} message deliveries failed`,
        at,
      })
      recommendations.push({
        dependencyId,
        severity: 'warning',
        message: 'Delivery failures detected',
        suggestedAction: 'Review the delivery pipeline configuration',
        reasons: [`${deliveryFailures} delivery failures`],
        at,
      })
    }

    if (this.isFlapping(events)) {
      signals.push({
        dependencyId,
        severity: 'warning',
        message: 'Health is flapping between healthy and down states',
        at,
      })
      recommendations.push({
        dependencyId,
        severity: 'warning',
        message: 'Health is unstable',
        suggestedAction: 'Investigate the oscillation cause; consider an operator-reviewed fallback',
        reasons: ['Health oscillated between up and down states'],
        at,
      })
    }

    this.signals.set(dependencyId, signals)
    this.recommendations.set(dependencyId, recommendations)
  }

  private isFlapping(events: FrontlineEvent[]): boolean {
    const recent = events
      .slice(-5)
      .map((event) => healthSignOf(event))
      .filter((sign) => sign !== 'neutral')
    if (recent.length < 3) return false
    return recent.includes('up') && recent.includes('down')
  }

  getSignals(dependencyId?: string): ResilienceSignal[] {
    if (dependencyId) return this.signals.get(dependencyId) ?? []
    return [...this.signals.values()].flat()
  }

  getRecommendations(dependencyId?: string): Recommendation[] {
    if (dependencyId) return this.recommendations.get(dependencyId) ?? []
    return [...this.recommendations.values()].flat()
  }

  getSnapshot(): FrontlineSnapshot {
    return {
      takenAt: new Date(),
      dependencies: dependencyRegistry.list().map((descriptor) => {
        const events = this.events.get(descriptor.id) ?? []
        return {
          descriptor,
          health: healthFromEvents(events),
          recentEvents: [...events].reverse().slice(0, MAX_RECENT_EVENTS_IN_SNAPSHOT),
          signals: this.signals.get(descriptor.id) ?? [],
          recommendations: this.recommendations.get(descriptor.id) ?? [],
        }
      }),
    }
  }
}

function healthSignOf(event: FrontlineEvent): HealthSign {
  switch (event.kind) {
    case FrontlineEventCatalog.dependencyHealthy:
      return 'up'
    case FrontlineEventCatalog.dependencyDown:
      return 'down'
    case FrontlineEventCatalog.dependencyHealth:
      return event.payload?.ok === false ? 'down' : 'up'
    case FrontlineEventCatalog.dependencyDegraded:
      return 'down'
    default:
      return 'neutral'
  }
}

function healthFromEvents(events: FrontlineEvent[]): DependencyHealth {
  for (let i = events.length - 1; i >= 0; i--) {
    const sign = healthSignOf(events[i])
    if (sign === 'up') return 'healthy'
    if (sign === 'down') {
      return events[i].kind === FrontlineEventCatalog.dependencyDegraded ? 'degraded' : 'down'
    }
  }
  return 'unknown'
}

export const frontlineIntelligence = new FrontlineIntelligence()

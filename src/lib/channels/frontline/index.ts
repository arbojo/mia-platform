export { eventBus, FrontlineEventBus } from './event-bus'
export { dependencyRegistry, DependencyRegistry } from './registry'
export { frontlineIntelligence, FrontlineIntelligence } from './intelligence'
export { FrontlineEventCatalog } from './types'
export type {
  FrontlineEvent,
  FrontlineEventKind,
  FrontlineEventSubscriber,
  EventSource,
  DependencyDescriptor,
  DependencyFeed,
  DependencyLink,
  DependencyLinkKind,
  DependencyKind,
  DependencyCriticality,
  DependencyHealth,
  ProbeSpec,
  ProbeType,
  DependencyArtifact,
  ResilienceSignal,
  SignalSeverity,
  Recommendation,
  FrontlineSnapshot,
} from './types'

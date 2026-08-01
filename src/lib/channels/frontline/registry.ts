import type { DependencyDescriptor, DependencyLinkKind } from './types'

/**
 * Generic dependency registry. Deliberately provider-agnostic: it describes
 * ANY external dependency of the platform (messaging, LLMs, databases,
 * payments, packages, infrastructure, APIs) — not just transport providers.
 *
 * Adding a dependency is a configuration act: register a descriptor, and
 * Frontline can observe it without any code change.
 */
const DEFAULT_DEPENDENCIES: DependencyDescriptor[] = [
  {
    id: 'meta-cloud',
    name: 'Meta Cloud API',
    kind: 'messaging',
    version: 'v19.0',
    criticality: 'critical',
    priority: 1,
    links: [{ kind: 'transport', target: 'meta-cloud' }],
    feeds: [
      { kind: 'status_page', url: 'https://metastatus.com/' },
      {
        kind: 'changelog',
        url: 'https://developers.facebook.com/docs/whatsapp/cloud-api/changelog',
      },
    ],
    affectedCapabilities: ['whatsapp-delivery'],
  },
  {
    id: 'openai',
    name: 'OpenAI API',
    kind: 'llm',
    criticality: 'critical',
    priority: 2,
    links: [{ kind: 'http', target: 'https://status.openai.com' }],
    probe: { type: 'status-page', url: 'https://status.openai.com', enabled: false },
    feeds: [{ kind: 'status_page', url: 'https://status.openai.com' }],
    affectedCapabilities: ['ai-conversation', 'evaluation', 'weekly-report'],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    kind: 'database',
    criticality: 'critical',
    priority: 3,
    links: [{ kind: 'http', target: 'https://status.supabase.com' }],
    probe: { type: 'status-page', url: 'https://status.supabase.com', enabled: false },
    feeds: [{ kind: 'status_page', url: 'https://status.supabase.com' }],
    affectedCapabilities: ['persistence'],
  },
]

export class DependencyRegistry {
  private dependencies = new Map<string, DependencyDescriptor>()

  constructor(initial: DependencyDescriptor[] = []) {
    initial.forEach((dependency) => this.register(dependency))
  }

  register(dependency: DependencyDescriptor): void {
    this.dependencies.set(dependency.id, dependency)
  }

  unregister(id: string): boolean {
    return this.dependencies.delete(id)
  }

  get(id: string): DependencyDescriptor | undefined {
    return this.dependencies.get(id)
  }

  /** Generic lookup by link, e.g. the transport link of a provider id. */
  getByLink(kind: DependencyLinkKind, target: string): DependencyDescriptor | undefined {
    for (const dependency of this.dependencies.values()) {
      if (dependency.links?.some((link) => link.kind === kind && link.target === target)) {
        return dependency
      }
    }
    return undefined
  }

  list(): DependencyDescriptor[] {
    return [...this.dependencies.values()].sort((a, b) => a.priority - b.priority)
  }
}

export const dependencyRegistry = new DependencyRegistry(DEFAULT_DEPENDENCIES)

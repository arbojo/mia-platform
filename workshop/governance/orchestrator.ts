import type {
  TaskScope,
  TaskCategory,
  ClassificationResult,
  TaskComplexity,
  AgentRole,
  QualityGate,
  BusinessDomain,
} from './types'
import {
  AGENT_TASK_MAP,
  COMPLEX_CATEGORIES,
  DEFAULT_QUALITY_GATES,
} from './types'

export interface OrchestratorInput {
  title: string
  description: string
  categories: TaskCategory[]
  filesAffected: number
  hasSchemaChanges: boolean
  hasAIConsumerChanges: boolean
  hasSecurityImplications: boolean
  primaryDomain?: string
  affectedDomains: string[]
  technicalDomains?: string[]
}

export class Orchestrator {
  public classify(input: OrchestratorInput): ClassificationResult {
    const scope = this.assessScope(input)
    const complexity = this.determineComplexity(scope)
    const requiredAgents = this.selectAgents(scope, complexity)
    const qualityGates = this.selectQualityGates(complexity, scope)

    return {
      complexity,
      requiredAgents,
      qualityGates,
      rationale: this.buildRationale(complexity, requiredAgents, scope),
    }
  }

  private assessScope(input: OrchestratorInput): TaskScope {
    const VALID_DOMAINS: BusinessDomain[] = ['sales', 'inventory', 'delivery', 'analytics', 'platform']
    const primaryDomain = VALID_DOMAINS.includes(input.primaryDomain as BusinessDomain)
      ? input.primaryDomain as BusinessDomain
      : 'sales'
    const businessDomains = input.affectedDomains.filter((d) =>
      VALID_DOMAINS.includes(d as BusinessDomain),
    )
    const affectedDomains = businessDomains.length > 0
      ? businessDomains as BusinessDomain[]
      : [primaryDomain]
    const technicalDomains = Array.isArray(input.technicalDomains)
      ? input.technicalDomains
      : input.affectedDomains.filter((d) => !VALID_DOMAINS.includes(d as BusinessDomain))

    return {
      categories: input.categories,
      filesAffected: input.filesAffected,
      hasSchemaChanges: input.hasSchemaChanges,
      hasAIConsumerChanges: input.hasAIConsumerChanges,
      hasSecurityImplications: input.hasSecurityImplications,
      isCrossCutting: affectedDomains.length > 1,
      primaryDomain,
      affectedDomains,
      technicalDomains: technicalDomains.length > 0 ? technicalDomains : ['backend'],
    }
  }

  private determineComplexity(scope: TaskScope): TaskComplexity {
    const complexityDrivers: boolean[] = [
      scope.filesAffected >= 4,
      scope.hasSchemaChanges,
      scope.hasAIConsumerChanges,
      scope.hasSecurityImplications,
      scope.isCrossCutting,
      scope.categories.some((c) => COMPLEX_CATEGORIES.includes(c)),
    ]

    const driverCount = complexityDrivers.filter(Boolean).length

    if (driverCount >= 1) {
      return 'complex'
    }

    if (scope.categories.length > 2) {
      return 'complex'
    }

    return 'simple'
  }

  private selectAgents(scope: TaskScope, complexity: TaskComplexity): AgentRole[] {
    const agentSet = new Set<AgentRole>()

    for (const category of scope.categories) {
      const agents = AGENT_TASK_MAP[category]
      if (agents) {
        for (const agent of agents) {
          agentSet.add(agent)
        }
      }
    }

    if (scope.hasSchemaChanges) {
      agentSet.add('database')
      agentSet.add('security')
    }

    if (scope.hasSecurityImplications) {
      agentSet.add('security')
    }

    if (scope.hasAIConsumerChanges) {
      agentSet.add('ai_engineer')
      agentSet.add('performance')
    }

    if (complexity === 'complex') {
      agentSet.add('architect')
      agentSet.add('qa')
      agentSet.add('godzilla')
      agentSet.add('release')
    }

    agentSet.add('memory_engineer')

    return this.orderAgents(Array.from(agentSet), complexity)
  }

  private orderAgents(agents: AgentRole[], complexity: TaskComplexity): AgentRole[] {
    const workflowOrder: AgentRole[] = [
      'cto',
      'architect',
      'domain_expert',
      'product_manager',
      'database',
      'backend',
      'frontend',
      'ai_engineer',
      'performance',
      'security',
      'analytics',
      'qa',
      'godzilla',
      'release',
      'infrastructure_bootstrap',
      'infrastructure_guardian',
      'memory_engineer',
    ]

    if (complexity === 'simple') {
      return agents
    }

    return workflowOrder.filter((agent) => agents.includes(agent))
  }

  private selectQualityGates(complexity: TaskComplexity, scope: TaskScope): QualityGate[] {
    const gates = [...DEFAULT_QUALITY_GATES[complexity]]

    if (scope.hasSchemaChanges) {
      gates.push('typecheck')
    }

    if (scope.hasAIConsumerChanges) {
      gates.push('performance_review')
    }

    if (scope.hasSecurityImplications) {
      gates.push('security_review')
    }

    return [...new Set(gates)]
  }

  private buildRationale(
    complexity: TaskComplexity,
    agents: AgentRole[],
    scope: TaskScope
  ): string {
    const parts: string[] = [
      `Classified as ${complexity.toUpperCase()} complexity.`,
      `Primary domain: ${scope.primaryDomain}.`,
    ]

    if (scope.affectedDomains.length > 1) {
      parts.push(`Affected domains: ${scope.affectedDomains.join(', ')}.`)
    }

    if (complexity === 'complex') {
      const drivers: string[] = []
      if (scope.filesAffected >= 4) drivers.push(`${scope.filesAffected} files affected`)
      if (scope.hasSchemaChanges) drivers.push('schema changes required')
      if (scope.hasAIConsumerChanges) drivers.push('AI behaviour changes')
      if (scope.hasSecurityImplications) drivers.push('security implications')
      if (scope.isCrossCutting) drivers.push('cross-cutting (multi-domain)')
      if (scope.categories.some((c) => ['feature', 'security', 'infrastructure'].includes(c))) {
        drivers.push('category requires council')
      }
      parts.push(`Complexity drivers: ${drivers.join(', ')}.`)
    } else {
      parts.push('Direct delegation: single domain, no cross-cutting impact.')
    }

    parts.push(`Required agents (${agents.length}): ${agents.join(', ')}.`)

    return parts.join(' ')
  }

  public generatePreFlightSummary(result: ClassificationResult): string {
    const lines = [
      '╔══════════════════════════════════════════════╗',
      '║       ORCHESTRATOR — PRE-FLIGHT SUMMARY      ║',
      '╠══════════════════════════════════════════════╣',
      `  Complexity: ${result.complexity.toUpperCase()}`,
      `  Required Agents: ${result.requiredAgents.length}`,
      ...result.requiredAgents.map((a) => `    → ${a}`),
      `  Quality Gates: ${result.qualityGates.length}`,
      ...result.qualityGates.map((g) => `    → ${g}`),
      '',
      `  Rationale: ${result.rationale}`,
      '╚══════════════════════════════════════════════╝',
    ]
    return lines.join('\n')
  }
}

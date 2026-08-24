export type TaskComplexity = 'simple' | 'complex'

export type BusinessDomain = 'sales' | 'inventory' | 'delivery' | 'analytics' | 'platform'

export type GovernanceStatus =
  | 'pending_classification'
  | 'classified'
  | 'awaiting_council'
  | 'council_in_progress'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'

export type AgentRole =
  | 'cto'
  | 'architect'
  | 'domain_expert'
  | 'product_manager'
  | 'database'
  | 'backend'
  | 'frontend'
  | 'ai_engineer'
  | 'performance'
  | 'security'
  | 'analytics'
  | 'qa'
  | 'release'
  | 'infrastructure_bootstrap'
  | 'infrastructure_guardian'
  | 'memory_engineer'
  | 'godzilla'

export type TaskCategory =
  | 'bugfix'
  | 'feature'
  | 'refactor'
  | 'schema_change'
  | 'ai_behaviour'
  | 'ui_change'
  | 'api_change'
  | 'security'
  | 'documentation'
  | 'infrastructure'
  | 'other'

export type QualityGate =
  | 'lint'
  | 'build'
  | 'typecheck'
  | 'unit_tests'
  | 'e2e_tests'
  | 'playwright'
  | 'chrome_devtools'
  | 'security_review'
  | 'performance_review'
  | 'stress_test'

export const AGENT_LABELS: Record<AgentRole, string> = {
  cto: 'CTO',
  architect: 'Architect',
  domain_expert: 'Domain Expert',
  product_manager: 'Product Manager',
  database: 'Database Engineer',
  backend: 'Backend Engineer',
  frontend: 'Frontend Engineer',
  ai_engineer: 'AI Engineer',
  performance: 'Performance Engineer',
  security: 'Security Engineer',
  analytics: 'Analytics Engineer',
  qa: 'QA Engineer',
  release: 'Release Manager',
  infrastructure_bootstrap: 'Infrastructure Bootstrap',
  infrastructure_guardian: 'Infrastructure Guardian',
  memory_engineer: 'Memory Engineer',
  godzilla: 'Godzilla',
}

export const QUALITY_GATE_LABELS: Record<QualityGate, string> = {
  lint: 'ESLint (0 errors, 0 warnings)',
  build: 'Production build (no errors)',
  typecheck: 'TypeScript strict check',
  unit_tests: 'Unit tests pass',
  e2e_tests: 'Playwright e2e tests pass',
  playwright: 'Playwright UI mode check',
  chrome_devtools: 'Chrome DevTools console and network check',
  security_review: 'Security Engineer review',
  performance_review: 'Performance Engineer review',
  stress_test: 'Godzilla Stress Test (adversarial)',
}

export const DEFAULT_QUALITY_GATES: Record<TaskComplexity, QualityGate[]> = {
  simple: ['lint', 'build'],
  complex: ['lint', 'build', 'unit_tests', 'e2e_tests', 'chrome_devtools', 'security_review', 'stress_test'],
}

export const AGENT_TASK_MAP: Record<TaskCategory, AgentRole[]> = {
  bugfix: ['backend', 'frontend', 'qa', 'godzilla'],
  feature: ['architect', 'backend', 'frontend', 'qa', 'godzilla', 'release'],
  refactor: ['architect', 'backend', 'frontend'],
  schema_change: ['database', 'backend', 'security', 'godzilla'],
  ai_behaviour: ['ai_engineer', 'backend', 'qa', 'performance', 'godzilla'],
  ui_change: ['frontend', 'qa'],
  api_change: ['backend', 'security', 'frontend', 'godzilla'],
  security: ['security', 'backend', 'qa', 'godzilla'],
  documentation: ['memory_engineer'],
  infrastructure: ['infrastructure_bootstrap', 'infrastructure_guardian', 'backend'],
  other: ['architect'],
}

export const COMPLEX_CATEGORIES: TaskCategory[] = [
  'feature',
  'schema_change',
  'ai_behaviour',
  'security',
  'infrastructure',
]

export interface TaskScope {
  categories: TaskCategory[]
  filesAffected: number
  hasSchemaChanges: boolean
  hasAIConsumerChanges: boolean
  hasSecurityImplications: boolean
  isCrossCutting: boolean
  primaryDomain: BusinessDomain
  affectedDomains: BusinessDomain[]
  technicalDomains: string[]
}

export interface ClassificationResult {
  complexity: TaskComplexity
  requiredAgents: AgentRole[]
  qualityGates: QualityGate[]
  rationale: string
}

export interface CouncilDecision {
  agentRole: AgentRole
  decision: 'approve' | 'reject' | 'abstain'
  rationale: string
  timestamp: string
}

export interface TaskManifest {
  id: string
  title: string
  description: string
  scope: TaskScope
  classification: ClassificationResult
  status: GovernanceStatus
  decisions: CouncilDecision[]
  createdAt: string
  classifiedAt?: string
  approvedAt?: string
  startedAt?: string
  completedAt?: string
  rejectedAt?: string
  rejectionReason?: string
  qualityGateResults?: QualityGateResult[]
  invariantResults?: InvariantVerificationResult[]
  applicableInvariants?: string[]
}

export interface QualityGateResult {
  gate: QualityGate
  passed: boolean
  output?: string
  timestamp: string
}

export type InvariantVerificationStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'HUMAN_REQUIRED'

export interface InvariantVerificationResult {
  invariant_id: string
  status: InvariantVerificationStatus
  evidence: string
  timestamp: string
}

export function createTaskId(): string {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '')
  const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `TASK-${datePart}-${timePart}${suffix}`
}

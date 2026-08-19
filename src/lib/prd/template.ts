export type BusinessDomain = 'sales' | 'inventory' | 'delivery' | 'analytics' | 'platform'

export interface PrdDocument {
  title: string
  problemStatement: string
  proposedSolution: string
  domainAlignment: DomainAlignment
  scope: PrdScope
  impactAnalysis: string
  acceptanceCriteria: string[]
  outOfScope: string
  successMetrics: string
  openQuestions: string
}

export interface DomainAlignment {
  primaryDomain: BusinessDomain
  affectedDomains: BusinessDomain[]
  explanation: string
  salesEvents: string[]
  moduleEvents: string[]
}

export interface PrdScope {
  categories: string[]
  filesAffected: number
  hasSchemaChanges: boolean
  schemaDescription: string
  hasAIChanges: boolean
  aiChangesDescription: string
  hasSecurityImplications: boolean
  securityDescription: string
  technicalDomains: string[]
}

export const PRD_TEMPLATE = `# PRD: {title}

## 1. Problem Statement
{problemStatement}

## 2. Proposed Solution
{proposedSolution}

## 3. Domain Alignment (ADR-025)
- **Primary domain**: {primaryDomain}
- **Affected domains**: {affectedDomains}
- **Explanation**: {domainExplanation}
- **Sales Intelligence events**: {salesEvents}
- **Module events**: {moduleEvents}

## 4. Scope Definition
- **Categories**: {categories}
- **Estimated files affected**: {filesAffected}
- **Schema changes required**: {schemaChanges}
  - {schemaDescription}
- **AI behaviour changes**: {aiChanges}
  - {aiDescription}
- **Security implications**: {securityImplications}
  - {securityDescription}
- **Technical domains**: {technicalDomains}

## 5. Impact Analysis
{impactAnalysis}

## 6. Acceptance Criteria
{acceptanceCriteria}

## 7. Out of Scope
{outOfScope}

## 8. Success Metrics
{successMetrics}

## 9. Open Questions
{openQuestions}
`

export function renderPrd(doc: PrdDocument): string {
  const yesNo = (v: boolean) => (v ? 'Yes' : 'No')

  const criteriaLines = doc.acceptanceCriteria
    .map((c) => `- [ ] ${c}`)
    .join('\n')

  const salesEventsList = doc.domainAlignment.salesEvents.length > 0
    ? doc.domainAlignment.salesEvents.join(', ')
    : 'None identified'

  const moduleEventsList = doc.domainAlignment.moduleEvents.length > 0
    ? doc.domainAlignment.moduleEvents.join(', ')
    : 'None identified'

  return PRD_TEMPLATE
    .replace('{title}', doc.title)
    .replace('{problemStatement}', doc.problemStatement)
    .replace('{proposedSolution}', doc.proposedSolution)
    .replace('{primaryDomain}', doc.domainAlignment.primaryDomain)
    .replace('{affectedDomains}', doc.domainAlignment.affectedDomains.join(', '))
    .replace('{domainExplanation}', doc.domainAlignment.explanation)
    .replace('{salesEvents}', salesEventsList)
    .replace('{moduleEvents}', moduleEventsList)
    .replace('{categories}', doc.scope.categories.join(', '))
    .replace('{filesAffected}', String(doc.scope.filesAffected))
    .replace('{schemaChanges}', yesNo(doc.scope.hasSchemaChanges))
    .replace('{schemaDescription}', doc.scope.schemaDescription)
    .replace('{aiChanges}', yesNo(doc.scope.hasAIChanges))
    .replace('{aiDescription}', doc.scope.aiChangesDescription)
    .replace('{securityImplications}', yesNo(doc.scope.hasSecurityImplications))
    .replace('{securityDescription}', doc.scope.securityDescription)
    .replace('{technicalDomains}', doc.scope.technicalDomains.join(', '))
    .replace('{impactAnalysis}', doc.impactAnalysis)
    .replace('{acceptanceCriteria}', criteriaLines)
    .replace('{outOfScope}', doc.outOfScope)
    .replace('{successMetrics}', doc.successMetrics)
    .replace('{openQuestions}', doc.openQuestions)
}

import assert from 'node:assert/strict';
import { CouncilContextBuilder } from '../core/council-context';
import { RoleRegistry } from '../roles/role-registry';
import { ReviewBuilder } from '../reviews/review-builder';
import { ConsensusEngine } from '../consensus/consensus-engine';
import { CouncilReportBuilder } from '../reports/council-report-builder';
import { predefinedRoles } from '../roles/predefined-roles';
import type { CouncilContext, CouncilFinding } from '../types';

const finding: CouncilFinding = {
  id: 'finding-navigation-1',
  role: 'QA',
  severity: 'high',
  category: 'navigation',
  title: 'Navigation failure',
  description: 'A critical navigation path is failing for the user.',
  evidence: ['A click did not reach the expected screen'],
  affectedArea: 'frontend',
  recommendation: 'Review the interaction flow and related components.',
};

const contextInput: CouncilContext = {
  sessionId: 'session-council-5',
  developmentRecord: {
    sessionId: 'session-council-5',
    timestamp: '2026-07-29T00:00:00.000Z',
    summary: 'Council decision framework foundation',
    futureImpact: 'Future council reviews will use structured roles and consensus.',
    validation: { build: true, lint: true, tests: true },
    changes: { filesChanged: ['workshop/council/roles/role-model.ts'], insertions: 12, deletions: 2 },
    evidence: { errors: 0, warnings: 1, patterns: 2, health: { stability: 0.95, coverage: 0.8, traceability: 0.9 } },
  },
  evidenceSnapshot: {
    eventCount: 4,
    errorCount: 1,
    warningCount: 1,
    performanceSummary: { memorySpikes: 0, cpuSpikes: 0, apiDurationsMs: [120, 180] },
    modifiedFiles: ['workshop/council/roles/role-model.ts'],
  },
  commitContext: { commitMessage: 'feat(workshop): add council decision framework foundation', status: 'ready' },
  changedFiles: ['workshop/council/roles/role-model.ts'],
  validationResults: { build: true, lint: true, tests: true },
  findings: [finding],
  availableRoles: predefinedRoles,
};

const contextBuilder = new CouncilContextBuilder();
const context = contextBuilder.build(contextInput);
const registry = new RoleRegistry(predefinedRoles);
const compatibleRoles = registry.getRolesForFinding(finding);

assert.ok(compatibleRoles.length >= 3);
assert.ok(compatibleRoles.some((role) => role.id === 'frontend'));

const reviews = [
  ReviewBuilder.create({
    roleId: 'frontend',
    findingId: finding.id,
    observations: 'The interaction path is unclear and should be reviewed.',
    impact: 'medium',
    confidence: 0.83,
  }),
  ReviewBuilder.create({
    roleId: 'qa',
    findingId: finding.id,
    observations: 'The regression risk is significant for the related flow.',
    impact: 'high',
    confidence: 0.81,
  }),
];

const consensus = new ConsensusEngine().build(reviews);
assert.equal(consensus.agreement, 'high');
assert.ok(consensus.confidence > 0);

const report = new CouncilReportBuilder().build({
  sessionId: context.sessionId,
  findings: context.findings ?? [],
  rolesExecuted: compatibleRoles.map((role) => role.name),
  reviews,
  consensus,
  status: 'needs-attention',
});

assert.equal(report.sessionId, 'session-council-5');
assert.equal(report.findings.length, 1);
assert.equal(report.reviews.length, 2);
assert.equal(report.status, 'needs-attention');

console.log('Council decision framework flow OK');

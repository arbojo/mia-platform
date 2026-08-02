import { CouncilEngine } from '../council/core/council-engine';
import { GitContextAdapter } from '../council/adapters/git-context-adapter';
import { EvidenceFirstAdapter } from '../council/adapters/evidence-first-adapter';
import { AdrValidator } from '../council/adapters/adr-validator';
import { ReportPersister } from '../council/reports/report-persister';
import { predefinedRoles } from '../council/roles/predefined-roles';
import type { CouncilContext } from '../council/types';

async function main() {
  console.log('\n=== Council Audit ===\n');

  const gitAdapter = new GitContextAdapter();
  const evidenceFirst = new EvidenceFirstAdapter();
  const adrValidator = new AdrValidator();
  const persister = new ReportPersister();

  // 1. Build real context from git
  console.log('[1/5] Building context from git...');
  const baseContext = await gitAdapter.buildContext({
    summary: 'Council advisory audit',
    futureImpact: 'Council findings inform engineering decisions',
  });
  console.log(`  HEAD: ${baseContext.git?.headCommit ?? 'unknown'}`);
  console.log(`  Files changed: ${baseContext.changedFiles.length}`);
  console.log(`  Branch: ${baseContext.git?.branch ?? 'unknown'}`);

  // 2. Load ADR context
  console.log('[2/5] Loading ADR decisions...');
  const adrContext = adrValidator.loadAll();
  console.log(`  ADRs: ${adrContext.totalCount} (${adrContext.acceptedCount} accepted, ${adrContext.proposedCount} proposed)`);

  // 3. Run Evidence First pre-audit
  console.log('[3/5] Running Evidence First pre-audit...');
  const evidenceResult = evidenceFirst.preAudit([]);
  console.log(`  Previous findings: ${evidenceResult.previousFindingsCount}`);
  console.log(`  State changes: ${evidenceResult.changedStates}`);

  // 4. Execute Council roles
  console.log('[4/5] Executing Council roles...');
  const engine = new CouncilEngine();
  const enrichedContext: CouncilContext = {
    ...baseContext,
    findings: evidenceResult.currentFindings,
    availableRoles: predefinedRoles,
  };

  const report = await engine.run(enrichedContext);
  console.log(`  Roles: ${report.rolesExecuted.length} executed`);
  console.log(`  Findings: ${report.findings.length}`);
  console.log(`  Status: ${report.status}`);

  // 5. Persist report
  console.log('[5/5] Persisting report...');
  const persisted = persister.persist(report, evidenceResult.evidenceLog);
  console.log(`  JSON: ${persisted.jsonPath}`);
  console.log(`  Markdown: ${persisted.markdownPath}`);

  // Print summary
  console.log('\n=== Audit Summary ===');
  console.log(report.summary);

  if (report.performanceMs !== undefined) {
    console.log(`\nPerformance: ${report.performanceMs}ms`);
  }

  console.log('\nAudit complete.');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});

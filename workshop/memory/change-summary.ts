import type { DevelopmentRecord } from './development-record';

export class ChangeSummaryGenerator {
  public generate(record: DevelopmentRecord): string {
    const validation = [
      record.validation.build ? '✓ Build' : '✗ Build',
      record.validation.lint ? '✓ Lint' : '✗ Lint',
      record.validation.tests ? '✓ Tests' : '✗ Tests',
    ].join('\n');

    return [
      `feat(workshop): ${record.summary}`,
      '',
      'Why:',
      record.summary,
      '',
      'Implemented:',
      `- ${record.changes.filesChanged.length} files changed`,
      `- ${record.changes.insertions} insertions`,
      `- ${record.changes.deletions} deletions`,
      '',
      'Validation:',
      validation,
      '',
      'Impact:',
      record.futureImpact,
      '',
      'Future:',
      'Structured evidence is available for future agents.',
    ].join('\n');
  }
}

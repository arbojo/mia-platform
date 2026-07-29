export interface CommitGateInput {
  build: boolean;
  lint: boolean;
  tests: boolean;
  evidence: boolean;
  memory: boolean;
  commit: boolean;
}

export interface CommitGateResult {
  ok: boolean;
  checks: Record<string, boolean>;
  summary: string;
}

export class CommitGate {
  public validate(input: CommitGateInput): CommitGateResult {
    const checks = {
      build: input.build,
      lint: input.lint,
      tests: input.tests,
      evidence: input.evidence,
      memory: input.memory,
      commit: input.commit,
    };

    const ok = Object.values(checks).every(Boolean);
    const summary = [
      'Sprint Completion:',
      `Build ${input.build ? '✅' : '❌'}`,
      `Lint ${input.lint ? '✅' : '❌'}`,
      `Tests ${input.tests ? '✅' : '❌'}`,
      `Evidence ${input.evidence ? '✅' : '❌'}`,
      `Memory ${input.memory ? '✅' : '❌'}`,
      `Commit Ready ${input.commit ? '✅' : '❌'}`,
    ].join('\n');

    return { ok, checks, summary };
  }
}

export interface CommitGateResult {
  ok: boolean;
  missing: string[];
}

export class CommitGate {
  public validate(params: {
    code: boolean;
    build: boolean;
    lint: boolean;
    tests: boolean;
    evidence: boolean;
    commit: boolean;
  }): CommitGateResult {
    const missing: string[] = [];

    if (!params.code) missing.push('code');
    if (!params.build) missing.push('build');
    if (!params.lint) missing.push('lint');
    if (!params.tests) missing.push('tests');
    if (!params.evidence) missing.push('evidence');
    if (!params.commit) missing.push('commit');

    return { ok: missing.length === 0, missing };
  }
}

export interface CommitContext {
  sessionId?: string;
  branch?: string;
  filesModified?: string[];
  buildStatus?: string;
  lintStatus?: string;
  testsStatus?: string;
  summary?: string;
  changes?: string[];
}

export class CommitContextBuilder {
  public build(input: CommitContext): CommitContext {
    return {
      sessionId: input.sessionId,
      branch: input.branch,
      filesModified: input.filesModified ?? [],
      buildStatus: input.buildStatus ?? 'unknown',
      lintStatus: input.lintStatus ?? 'unknown',
      testsStatus: input.testsStatus ?? 'unknown',
      summary: input.summary ?? 'Workshop changes',
      changes: input.changes ?? [],
    };
  }
}

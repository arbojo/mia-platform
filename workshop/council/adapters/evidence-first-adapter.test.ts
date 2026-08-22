import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execSync } from 'node:child_process'
import {
  EvidenceFirstAdapter,
  parseFileLine,
  validateFileLineReference,
} from './evidence-first-adapter'
import type { CouncilFinding } from '../types'

const TMP_DIR = join(process.cwd(), '.tmp-evidence-test')
const REPORTS_DIR = join(TMP_DIR, 'workshop', 'council', 'reports')

function tmpFile(relPath: string, content: string): string {
  const full = join(TMP_DIR, relPath)
  const dir = dirname(full)
  mkdirSync(dir, { recursive: true })
  writeFileSync(full, content, 'utf8')
  return full
}

function writeAuditReport(findings: CouncilFinding[]): string {
  mkdirSync(REPORTS_DIR, { recursive: true })
  const report = {
    findings,
    sessionId: 'test-session',
    timestamp: new Date().toISOString(),
  }
  const filename = `audit-council-test-${Date.now()}.json`
  const filepath = join(REPORTS_DIR, filename)
  writeFileSync(filepath, JSON.stringify(report), 'utf8')
  return filepath
}

function gitInit(): void {
  execSync('git init && git config user.email "test@test.com" && git config user.name "Test"', {
    cwd: TMP_DIR,
    stdio: 'pipe',
  })
}

function gitCommit(msg: string): void {
  execSync('git add -A && git commit --allow-empty -m "' + msg + '"', {
    cwd: TMP_DIR,
    stdio: 'pipe',
  })
}

function gitHead(): string {
  return execSync('git rev-parse --short HEAD', { cwd: TMP_DIR, encoding: 'utf8' }).trim()
}

function cleanReports(): void {
  if (existsSync(REPORTS_DIR)) {
    for (const f of readdirSync(REPORTS_DIR)) {
      rmSync(join(REPORTS_DIR, f))
    }
  }
}

beforeAll(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
  mkdirSync(TMP_DIR, { recursive: true })
  gitInit()
})

afterAll(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
})

beforeEach(() => {
  cleanReports()
})

describe('parseFileLine', () => {
  it('parses valid file:line format', () => {
    const result = parseFileLine('src/lib/foo.ts:42')
    expect(result).toEqual({ filePath: 'src/lib/foo.ts', line: 42 })
  })

  it('parses deep path with line number', () => {
    const result = parseFileLine('workshop/council/adapters/evidence-first-adapter.ts:176')
    expect(result).toEqual({ filePath: 'workshop/council/adapters/evidence-first-adapter.ts', line: 176 })
  })

  it('returns null for path without line number', () => {
    expect(parseFileLine('src/lib/foo.ts')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseFileLine('')).toBeNull()
  })

  it('returns null for line-only format', () => {
    expect(parseFileLine(':42')).toBeNull()
  })
})

describe('validateFileLineReference', () => {
  it('accepts valid file:line reference', () => {
    const result = validateFileLineReference('src/lib/foo.ts:42')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects reference without line number', () => {
    const result = validateFileLineReference('src/lib/foo.ts')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid file:line format')
  })

  it('rejects reference with line 0', () => {
    const result = validateFileLineReference('src/lib/foo.ts:0')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Line number must be >= 1')
  })

  it('rejects reference with negative line', () => {
    const result = validateFileLineReference('src/lib/foo.ts:-5')
    expect(result.valid).toBe(false)
  })
})

describe('EvidenceFirstAdapter', () => {
  it('marks previous finding as superseded when its file is deleted', () => {
    const testFile = 'src/deleted-file.ts'
    tmpFile(testFile, 'export const x = 1\n')
    gitCommit('add test file')
    const headBefore = gitHead()

    // Delete the file and commit
    rmSync(join(TMP_DIR, testFile))
    gitCommit('delete test file')

    // Write previous audit report with the finding
    writeAuditReport([{
      id: 'test-1',
      role: 'qa',
      severity: 'medium',
      category: 'test',
      title: 'Test finding',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
      filePath: testFile,
      headCommit: headBefore,
      state: 'open',
    }])

    const adapter = new EvidenceFirstAdapter({
      reportsDir: REPORTS_DIR,
      repoPath: TMP_DIR,
    })

    const result = adapter.preAudit([])
    const revalidated = result.evidenceLog.find((e) => e.findingId === 'test-1')

    expect(revalidated).toBeDefined()
    expect(revalidated!.newState).toBe('superseded')
    expect(revalidated!.reason).toContain('File deleted')
  })

  it('marks previous finding as resolved when file is modified', () => {
    const testFile = 'src/modified-file.ts'
    tmpFile(testFile, 'export const x = 1\n')
    gitCommit('add modified file')
    const headBefore = gitHead()

    // Modify the file and commit
    writeFileSync(join(TMP_DIR, testFile), 'export const x = 2 // fixed\n', 'utf8')
    gitCommit('fix the issue')

    writeAuditReport([{
      id: 'test-2',
      role: 'security',
      severity: 'high',
      category: 'test',
      title: 'Security finding',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
      filePath: testFile,
      headCommit: headBefore,
      state: 'open',
    }])

    const adapter = new EvidenceFirstAdapter({
      reportsDir: REPORTS_DIR,
      repoPath: TMP_DIR,
    })

    const result = adapter.preAudit([])
    const revalidated = result.evidenceLog.find((e) => e.findingId === 'test-2')

    expect(revalidated).toBeDefined()
    expect(revalidated!.newState).toBe('resolved')
    expect(revalidated!.reason).toContain('File modified')
  })

  it('keeps previous finding as open when file is unchanged', () => {
    const testFile = 'src/unchanged-file.ts'
    tmpFile(testFile, 'export const x = 1\n')
    gitCommit('add unchanged file')
    const headBefore = gitHead()

    // Commit something unrelated
    tmpFile('src/other-file.ts', 'export const y = 1\n')
    gitCommit('unrelated change')

    writeAuditReport([{
      id: 'test-3',
      role: 'qa',
      severity: 'low',
      category: 'test',
      title: 'Still valid',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
      filePath: testFile,
      headCommit: headBefore,
      state: 'open',
    }])

    const adapter = new EvidenceFirstAdapter({
      reportsDir: REPORTS_DIR,
      repoPath: TMP_DIR,
    })

    const result = adapter.preAudit([])
    const revalidated = result.evidenceLog.find((e) => e.findingId === 'test-3')

    expect(revalidated).toBeDefined()
    expect(revalidated!.newState).toBe('open')
  })

  it('keeps previous state when finding has no filePath', () => {
    writeAuditReport([{
      id: 'test-4',
      role: 'architect',
      severity: 'medium',
      category: 'test',
      title: 'No file path',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
      state: 'open',
    }])

    const adapter = new EvidenceFirstAdapter({
      reportsDir: REPORTS_DIR,
      repoPath: TMP_DIR,
    })

    const result = adapter.preAudit([])
    const revalidated = result.evidenceLog.find((e) => e.findingId === 'test-4')

    expect(revalidated).toBeDefined()
    expect(revalidated!.newState).toBe('open')
    expect(revalidated!.reason).toContain('No file path')
  })

  it('invalidates previous finding with file:line when line does not exist', () => {
    const testFile = 'src/short-file.ts'
    tmpFile(testFile, 'line 1\nline 2\nline 3\n')
    gitCommit('add short file')
    const headBefore = gitHead()

    writeAuditReport([{
      id: 'test-5',
      role: 'qa',
      severity: 'high',
      category: 'test',
      title: 'Invalid line reference',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
      filePath: 'src/short-file.ts:999',
      headCommit: headBefore,
      state: 'open',
    }])

    const adapter = new EvidenceFirstAdapter({
      reportsDir: REPORTS_DIR,
      repoPath: TMP_DIR,
    })

    const result = adapter.preAudit([])
    const revalidated = result.evidenceLog.find((e) => e.findingId === 'test-5')

    expect(revalidated).toBeDefined()
    expect(revalidated!.newState).toBe('invalidated')
    expect(revalidated!.reason).toContain('Line 999 does not exist')
  })

  it('keeps previous finding open with valid file:line when line exists', () => {
    const testFile = 'src/valid-ref.ts'
    tmpFile(testFile, 'line 1\nline 2\nline 3\n')
    gitCommit('add valid ref file')
    const headBefore = gitHead()

    writeAuditReport([{
      id: 'test-6',
      role: 'security',
      severity: 'medium',
      category: 'test',
      title: 'Valid line reference',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
      filePath: 'src/valid-ref.ts:2',
      headCommit: headBefore,
      state: 'open',
    }])

    const adapter = new EvidenceFirstAdapter({
      reportsDir: REPORTS_DIR,
      repoPath: TMP_DIR,
    })

    const result = adapter.preAudit([])
    const revalidated = result.evidenceLog.find((e) => e.findingId === 'test-6')

    expect(revalidated).toBeDefined()
    expect(revalidated!.newState).toBe('open')
  })

  it('marks new findings as open with current headCommit', () => {
    const adapter = new EvidenceFirstAdapter({
      reportsDir: REPORTS_DIR,
      repoPath: TMP_DIR,
    })

    const newFinding: CouncilFinding = {
      id: 'new-1',
      role: 'qa',
      severity: 'low',
      category: 'test',
      title: 'New finding',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
    }

    const result = adapter.preAudit([newFinding])

    expect(result.currentFindings).toHaveLength(1)
    expect(result.currentFindings[0].state).toBe('open')
    expect(result.currentFindings[0].headCommit).toBeTruthy()
  })

  it('returns empty results when no previous reports exist', () => {
    const emptyDir = join(TMP_DIR, 'empty-reports')
    mkdirSync(emptyDir, { recursive: true })

    const adapter = new EvidenceFirstAdapter({
      reportsDir: emptyDir,
      repoPath: TMP_DIR,
    })

    const result = adapter.preAudit([])
    expect(result.previousFindingsCount).toBe(0)
    expect(result.currentFindings).toHaveLength(0)
    expect(result.evidenceLog).toHaveLength(0)
  })

  it('combines revalidated still-open findings with new findings', () => {
    const testFile = 'src/combined-file.ts'
    tmpFile(testFile, 'export const x = 1\n')
    gitCommit('add combined file')
    const headBefore = gitHead()

    writeAuditReport([{
      id: 'old-1',
      role: 'qa',
      severity: 'low',
      category: 'test',
      title: 'Old still-open',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
      filePath: testFile,
      headCommit: headBefore,
      state: 'open',
    }])

    const newFinding: CouncilFinding = {
      id: 'new-2',
      role: 'security',
      severity: 'high',
      category: 'test',
      title: 'Brand new',
      description: 'Test',
      evidence: ['test'],
      affectedArea: 'test',
      recommendation: 'test',
    }

    const adapter = new EvidenceFirstAdapter({
      reportsDir: REPORTS_DIR,
      repoPath: TMP_DIR,
    })

    const result = adapter.preAudit([newFinding])

    expect(result.currentFindings).toHaveLength(2)
    expect(result.currentFindings.some((f) => f.id === 'old-1')).toBe(true)
    expect(result.currentFindings.some((f) => f.id === 'new-2')).toBe(true)
    expect(result.changedStates).toBe(0)
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const TMP_DIR = join(process.cwd(), '.tmp-secrets-test')
const SCRIPT = join(process.cwd(), 'scripts', 'secrets-check.mjs')

function runSecretsCheck(dir: string): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`node ${SCRIPT} "${dir}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    return { exitCode: 0, stdout, stderr: '' }
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string }
    return { exitCode: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' }
  }
}

function tmpFile(relPath: string, content: string): string {
  const full = join(TMP_DIR, relPath)
  const dir = full.substring(0, full.lastIndexOf('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(full, content, 'utf8')
  return full
}

beforeAll(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
  mkdirSync(TMP_DIR, { recursive: true })
})

afterAll(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true })
})

describe('secrets-check.mjs', () => {
  it('passes on clean files with no secrets', () => {
    const dir = join(TMP_DIR, 'clean')
    mkdirSync(dir, { recursive: true })
    tmpFile('clean/test.bru', `
      meta {
        name: Test Request
      }
      get {
        url: https://api.example.com/health
      }
    `)

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('SECRET SCAN OK')
  })

  it('passes on files using only {{process.env.VAR}} placeholders', () => {
    const dir = join(TMP_DIR, 'placeholders')
    mkdirSync(dir, { recursive: true })
    tmpFile('placeholders/test.bru', `
      meta {
        name: Test
      }
      script {
        const token = "{{process.env.API_TOKEN}}"
        const key = "{{SUPABASE_KEY}}"
      }
    `)

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('SECRET SCAN OK')
  })

  it('fails when detecting sk-* OpenAI key pattern', () => {
    const dir = join(TMP_DIR, 'sk-key')
    mkdirSync(dir, { recursive: true })
    tmpFile('sk-key/test.bru', `
      script {
        const key = "sk-proj-1234567890abcdef1234567890abcdef"
      }
    `)

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('SECRETO')
    expect(result.stderr).toContain('clave API sk-')
  })

  it('fails when detecting AWS AKIA key pattern', () => {
    const dir = join(TMP_DIR, 'aws-key')
    mkdirSync(dir, { recursive: true })
    tmpFile('aws-key/config.json', '{"aws_key": "AKIAIOSFODNN7EXAMPLE"}')

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('clave AWS AKIA')
  })

  it('fails when detecting private key block', () => {
    const dir = join(TMP_DIR, 'privkey')
    mkdirSync(dir, { recursive: true })
    tmpFile('privkey/key.json', '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK...')

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('clave privada')
  })

  it('fails when detecting hardcoded password', () => {
    const dir = join(TMP_DIR, 'password')
    mkdirSync(dir, { recursive: true })
    tmpFile('password/test.env', 'password="supersecretpass123"')

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('password=')
  })

  it('fails when detecting hardcoded token with value', () => {
    const dir = join(TMP_DIR, 'token')
    mkdirSync(dir, { recursive: true })
    tmpFile('token/config.yaml', 'token: "abc123456789xyz"')

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('token=')
  })

  it('does NOT flag bare key names without values', () => {
    const dir = join(TMP_DIR, 'bare-keys')
    mkdirSync(dir, { recursive: true })
    tmpFile('bare-keys/docs.md', `
      ## Configuration
      Set the my_secret_key= variable in your .env file.
      The api_auth_token should be obtained from the admin panel.
      The client_secret_xyz is documented in the README.
    `)

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(0)
  })

  it('fails on non-existent directory', () => {
    const result = runSecretsCheck(join(TMP_DIR, 'nonexistent'))
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('no es un directorio')
  })

  it('scans only watched file extensions', () => {
    const dir = join(TMP_DIR, 'extensions')
    mkdirSync(dir, { recursive: true })
    // .bru file is scanned
    tmpFile('extensions/test.bru', 'meta { name: Test }')
    // .ts file is NOT in the watched extensions
    tmpFile('extensions/test.ts', 'const key = "sk-ABCDEF123456"')
    // .log file is NOT in the watched extensions
    tmpFile('extensions/test.log', 'password=mysecretpass123')

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(0)
  })

  it('reports count of files reviewed on success', () => {
    const dir = join(TMP_DIR, 'count')
    mkdirSync(dir, { recursive: true })
    tmpFile('count/a.bru', 'meta { name: A }')
    tmpFile('count/b.bru', 'meta { name: B }')
    tmpFile('count/c.json', '{}')

    const result = runSecretsCheck(dir)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('3 archivo(s)')
  })
})

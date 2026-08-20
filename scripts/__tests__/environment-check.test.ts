import { describe, it, expect } from 'vitest'

// The environment-check script calls main() on import, so we test the
// version-checking logic by reimplementing the pure functions here.
// This mirrors the exact logic in environment-check.script.ts.

function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10), patch: parseInt(match[3], 10) }
}

function checkNodeVersion(versionString: string): { pass: boolean; detail: string } {
  const parsed = parseVersion(versionString)
  if (!parsed) return { pass: false, detail: `No se pudo parsear la versión: ${versionString}` }

  const { major } = parsed
  if (major < 22 || major >= 23) {
    return {
      pass: false,
      detail: `v${parsed.major}.${parsed.minor}.${parsed.patch} — se requiere Node 22 LTS (>=22.0.0 <23.0.0). Usa .nvmrc o "fnm use 22"`,
    }
  }
  return { pass: true, detail: `v${parsed.major}.${parsed.minor}.${parsed.patch} (Node 22 LTS)` }
}

describe('parseNodeVersion', () => {
  it('parses Node v22.7.0 correctly', () => {
    const result = parseVersion('v22.7.0')
    expect(result).toEqual({ major: 22, minor: 7, patch: 0 })
  })

  it('parses Node v22.16.0 correctly', () => {
    const result = parseVersion('v22.16.0')
    expect(result).toEqual({ major: 22, minor: 16, patch: 0 })
  })

  it('parses Node v20.11.0 correctly', () => {
    const result = parseVersion('v20.11.0')
    expect(result).toEqual({ major: 20, minor: 11, patch: 0 })
  })

  it('parses Node v26.7.0 correctly', () => {
    const result = parseVersion('v26.7.0')
    expect(result).toEqual({ major: 26, minor: 7, patch: 0 })
  })

  it('returns null for invalid version string', () => {
    expect(parseVersion('invalid')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseVersion('')).toBeNull()
  })
})

describe('checkNodeVersion', () => {
  it('passes for Node 22.7.0', () => {
    const result = checkNodeVersion('v22.7.0')
    expect(result.pass).toBe(true)
    expect(result.detail).toContain('Node 22 LTS')
  })

  it('passes for Node 22.16.0', () => {
    const result = checkNodeVersion('v22.16.0')
    expect(result.pass).toBe(true)
  })

  it('fails for Node 20.11.0', () => {
    const result = checkNodeVersion('v20.11.0')
    expect(result.pass).toBe(false)
    expect(result.detail).toContain('se requiere Node 22 LTS')
    expect(result.detail).toContain('.nvmrc')
  })

  it('fails for Node 18.x', () => {
    const result = checkNodeVersion('v18.19.0')
    expect(result.pass).toBe(false)
    expect(result.detail).toContain('>=22.0.0 <23.0.0')
  })

  it('fails for Node 26.x', () => {
    const result = checkNodeVersion('v26.7.0')
    expect(result.pass).toBe(false)
    expect(result.detail).toContain('se requiere Node 22 LTS')
  })

  it('fails for unparseable version', () => {
    const result = checkNodeVersion('unknown')
    expect(result.pass).toBe(false)
    expect(result.detail).toContain('No se pudo parsear')
  })

  it('fails for Node 23.x (above range)', () => {
    const result = checkNodeVersion('v23.0.0')
    expect(result.pass).toBe(false)
  })
})

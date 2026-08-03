import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

interface EnvCheckResult {
  name: string
  pass: boolean
  detail: string
}

function ok(name: string, detail: string): EnvCheckResult {
  return { name, pass: true, detail }
}

function bad(name: string, detail: string): EnvCheckResult {
  return { name, pass: false, detail }
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) out[match[1]] = match[2].trim()
  }
  return out
}

const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

function checkEnvVars(env: Record<string, string>): EnvCheckResult[] {
  return REQUIRED_VARS.map((key) =>
    env[key] ? ok(`env:${key}`, 'presente') : bad(`env:${key}`, 'FALTA en .env.local'),
  )
}

export function runEnvironmentChecks(): {
  results: EnvCheckResult[]
  pass: boolean
} {
  const results: EnvCheckResult[] = []

  const nodeVersion = run('node --version')
  results.push(
    nodeVersion ? ok('node', nodeVersion) : bad('node', 'node no encontrado'),
  )

  results.push(
    existsSync(resolve(process.cwd(), 'node_modules'))
      ? ok('node_modules', 'existe')
      : bad('node_modules', 'FALTA: ejecuta npm install'),
  )

  results.push(
    existsSync(resolve(process.cwd(), 'package-lock.json'))
      ? ok('package-lock.json', 'existe')
      : bad('package-lock.json', 'FALTA'),
  )

  const env = readEnv()
  results.push(...checkEnvVars(env))

  return {
    results,
    pass: results.every((r) => r.pass),
  }
}

function main() {
  const { results, pass } = runEnvironmentChecks()

  console.log(`\nEnvironment Check: ${pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}\n`)
  for (const r of results) {
    const mark = r.pass ? `${GREEN}OK${RESET}` : `${RED}XX${RESET}`
    console.log(`${mark} ${r.name}: ${r.detail}`)
  }
  console.log('')
  console.log(pass ? 'Ready for development.' : `${RED}Issues found. Run "npm run doctor" for full diagnosis.${RESET}`)
  process.exit(pass ? 0 : 1)
}

main()

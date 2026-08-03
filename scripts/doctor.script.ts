import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { runHealthChecks, type HealthCheckResult } from '@/lib/system/health'

const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const RESET = '\x1b[0m'

interface DoctorResult {
  name: string
  status: 'passed' | 'warning' | 'failed'
  detail: string
}

function passed(name: string, detail: string): DoctorResult {
  return { name, status: 'passed', detail }
}

function warned(name: string, detail: string): DoctorResult {
  return { name, status: 'warning', detail }
}

function failed(name: string, detail: string): DoctorResult {
  return { name, status: 'failed', detail }
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

function versionCheck(name: string, cmd: string, minMajor: number): DoctorResult {
  const raw = run(cmd)
  if (!raw) return failed(name, `no detectado (${cmd})`)
  const match = raw.match(/(\d+)\./)
  const major = match ? parseInt(match[1], 10) : 0
  if (major >= minMajor) return passed(name, raw)
  return failed(name, `${raw} — se requiere mayor >= ${minMajor}`)
}

function checkPort(name: string, port: number): DoctorResult {
  try {
    execSync(`netstat -ano | findstr :${port}`, { stdio: ['pipe', 'pipe', 'pipe'] })
    return warned(name, `puerto ${port} en uso (puede ser otro dev server)`)
  } catch {
    return passed(name, `puerto ${port} libre`)
  }
}

async function main() {
  console.log('\nMIA Environment Doctor v1.0\n')
  const results: DoctorResult[] = []

  results.push(versionCheck('Node.js', 'node --version', 20))
  results.push(versionCheck('npm', 'npm --version', 10))
  results.push(versionCheck('Git', 'git --version', 2))

  results.push(
    existsSync(resolve(process.cwd(), 'node_modules'))
      ? passed('node_modules', 'existe')
      : failed('node_modules', 'FALTA — ejecuta npm install'),
  )
  results.push(
    existsSync(resolve(process.cwd(), 'package-lock.json'))
      ? passed('package-lock.json', 'existe')
      : failed('package-lock.json', 'FALTA'),
  )

  const env = readEnv()
  for (const key of REQUIRED_VARS) {
    results.push(
      env[key] ? passed(`env:${key}`, 'presente') : failed(`env:${key}`, 'FALTA en .env.local'),
    )
  }
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value
  }

  results.push(checkPort('Port 3000', 3000))
  results.push(checkPort('Port 3001', 3001))

  const envReady = env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY
  if (envReady) {
    const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })
    try {
      const health = await runHealthChecks({
        supabase: admin,
        admin,
        scope: 'precommit',
      })
      for (const check of health.checks) {
        results.push(mapHealthCheck(check))
      }
    } catch (err) {
      results.push(
        failed(
          'supabase:health',
          `no se pudo ejecutar el health engine: ${err instanceof Error ? err.message : 'desconocido'}`,
        ),
      )
    }
  } else {
    results.push(failed('supabase:health', 'env vars de Supabase incompletas — se omite health engine'))
  }

  const passedCount = results.filter((r) => r.status === 'passed').length
  const failedCount = results.filter((r) => r.status === 'failed').length

  for (const r of results) {
    const icon = r.status === 'passed' ? `${GREEN}OK${RESET}` : r.status === 'warning' ? `${YELLOW}!!${RESET}` : `${RED}XX${RESET}`
    console.log(`${icon} ${r.name}: ${r.detail}`)
  }

  console.log(`\nSummary: ${passedCount}/${results.length} passed, ${failedCount} failed`)

  try {
    const report = results
      .map((r) => `- [${r.status.toUpperCase()}] ${r.name}: ${r.detail}`)
      .join('\n')
    const doc = `# Doctor Report\n\nGenerated: ${new Date().toISOString()}\n\n${report}\n`
    mkdirSync(resolve(process.cwd(), 'docs'), { recursive: true })
    writeFileSync(resolve(process.cwd(), 'docs', 'doctor-report.md'), doc)
  } catch {
    /* report file is best-effort */
  }

  process.exit(failedCount > 0 ? 1 : 0)
}

function mapHealthCheck(check: HealthCheckResult): DoctorResult {
  const name = `health:${check.id}`
  if (check.status === 'passed') return passed(name, check.message)
  if (check.status === 'warning') return warned(name, `${check.message} — ${check.remediation}`)
  return failed(name, `${check.message} — ${check.remediation}`)
}

main().catch((err) => {
  console.error(`${RED}Fatal: ${err instanceof Error ? err.message : err}${RESET}`)
  process.exit(2)
})

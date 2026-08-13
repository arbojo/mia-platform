#!/usr/bin/env node
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PATTERNS = [
  { label: 'clave API sk-', re: /\bsk-[A-Za-z0-9]{6,}/g },
  { label: 'clave AWS AKIA', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: 'clave privada', re: /-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----/g },
  { label: 'password=', re: /\bpassword\s*["']?\s*[:=]\s*["']?[^\s<"',{}]{4,}/gi },
  { label: 'token=', re: /\btoken\s*["']?\s*[:=]\s*["']?[^\s<"',{}]{4,}/gi },
  { label: 'client_secret', re: /\bclient_secret\s*["']?\s*[:=]\s*["']?[^\s<"',{}]{4,}/gi },
]

const PLACEHOLDER_RE = /\{\{(?:process\.env\.)?[A-Za-z0-9_.$-]+\}\}/g
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', '.vercel'])
const WATCHED_EXT = /\.(bru|json|md|yml|yaml|env|example)$/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORED_DIRS.has(name)) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, out)
    else if (WATCHED_EXT.test(name)) out.push(path)
  }
  return out
}

const target = resolve(process.argv[2] ?? 'bruno')
if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`ERROR: "${target}" no es un directorio`)
  process.exit(1)
}

const files = walk(target)
let violations = 0
for (const file of files) {
  const content = readFileSync(file, 'utf8').replace(PLACEHOLDER_RE, '')
  for (const { label, re } of PATTERNS) {
    re.lastIndex = 0
    if (re.test(content)) {
      console.error(`SECRETO [${label}]: ${file}`)
      violations += 1
    }
  }
}

if (violations > 0) {
  console.error(
    `SECRET SCAN FALLIDO: ${violations} patrón(es) detectado(s) en ${target}. ` +
      'Usa solo placeholders {{VAR}} / {{process.env.VAR}}; los valores reales viven solo en el entorno local ignorado por git.'
  )
  process.exit(1)
}

console.log(`SECRET SCAN OK: ${files.length} archivo(s) revisados en ${target}`)

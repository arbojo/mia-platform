#!/usr/bin/env node
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function resolveWs() {
  const candidates = [
    'ws',
    resolve(__dirname, '..', 'services', 'whatsapp-bridge', 'node_modules', 'ws'),
  ]
  for (const candidate of candidates) {
    try {
      const mod = require(candidate)
      const Ws = mod.WebSocket ?? mod.default ?? mod
      if (typeof Ws === 'function') return Ws
    } catch {
      continue
    }
  }
  return null
}

const WebSocket = resolveWs()
if (!WebSocket) {
  console.error('ERROR: dependencia "ws" no disponible. Ejecuta "npm ci" en la raiz del repo.')
  process.exit(1)
}

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function buildUrl() {
  const url = arg('--url')
  if (url) return url
  const bridge = arg('--bridge') ?? process.env.WHATSAPP_BRIDGE_URL
  const businessId = arg('--business') ?? process.env.BUSINESS_ID
  const token = arg('--token') ?? process.env.WS_TOKEN
  if (!bridge || !businessId || !token) {
    console.error('USO:')
    console.error('  node scripts/ws-diagnose.mjs --url <wss://...>')
    console.error('  node scripts/ws-diagnose.mjs --bridge <ws(s)://host> --business <id> --token <token>')
    console.error('  [--send <mensaje>] [--timeout <ms>]')
    console.error('El token se obtiene de GET /api/channels/baileys/ws-token?businessId=<id>')
    process.exit(1)
  }
  const base = bridge.replace(/^http/, 'ws')
  return `${base}/v1/ws?businessId=${encodeURIComponent(businessId)}&token=${encodeURIComponent(token)}`
}

const target = buildUrl()
const timeout = Number(arg('--timeout') ?? '15000')
const send = arg('--send')

const ws = new WebSocket(target)
let settled = false

function finish(code) {
  if (settled) return
  settled = true
  clearTimeout(timer)
  process.exit(code ?? process.exitCode ?? 0)
}

ws.on('open', () => {
  console.log(`[open] ${target}`)
  if (send) ws.send(send)
})

ws.on('message', (data) => {
  const text = data.toString()
  try {
    console.log('[message]', JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log('[message]', text)
  }
})

ws.on('error', (error) => {
  console.error('[error]', error.message)
  process.exitCode = 1
})

ws.on('close', (code, reason) => {
  console.log(`[close] code=${code} reason=${reason.toString() || '-'}`)
  finish(code === 1000 ? 0 : 1)
})

const timer = setTimeout(() => {
  console.error(`[timeout] sin respuesta tras ${timeout}ms`)
  ws.terminate()
  finish(1)
}, timeout)

process.stdin.setEncoding('utf8')
process.stdin.on('data', (line) => {
  const text = line.trim()
  if (text && ws.readyState === WebSocket.OPEN) ws.send(text)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    ws.close(1000, 'client-closing')
    setTimeout(() => finish(0), 300)
  })
}

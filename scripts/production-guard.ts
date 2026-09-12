import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PRODUCTION_URLS = ['https://hhitqgsaglddjkmaovbs.supabase.co']
export const CONFIRM_FLAG = '--i-know-this-is-production'

export function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) out[match[1]] = match[2].trim()
  }
  return out
}

export function guardProduction(opts: {
  url?: string
  nodeEnv?: string
  confirmed?: boolean
  label: string
}): void {
  const nodeEnv = opts.nodeEnv ?? process.env.NODE_ENV
  const confirmed =
    opts.confirmed === true ||
    process.argv.includes(CONFIRM_FLAG) ||
    process.env.I_KNOW_THIS_IS_PRODUCTION === 'true'
  if (confirmed) return

  const targetsProd =
    nodeEnv === 'production' || PRODUCTION_URLS.some((p) => opts.url?.startsWith(p))

  if (targetsProd) {
    console.error(
      `\n⛔ BLOCKED: ${opts.label} refuses to run against production.\n` +
        `   Detected: NODE_ENV='${nodeEnv ?? '(unset)'}' NEXT_PUBLIC_SUPABASE_URL='${opts.url ?? '(unset)'}'\n` +
        `   To run anyway: add ${CONFIRM_FLAG} (or I_KNOW_THIS_IS_PRODUCTION=true)\n`
    )
    process.exit(1)
  }
}
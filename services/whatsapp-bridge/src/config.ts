export interface BridgeConfig {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  miaAppUrl: string
  bridgeSecret: string
  port: number
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function loadConfig(): BridgeConfig {
  return {
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    miaAppUrl: process.env.MIA_APP_URL ?? 'http://localhost:3000',
    bridgeSecret: requireEnv('WHATSAPP_BRIDGE_SECRET'),
    port: Number(process.env.BRIDGE_PORT ?? 8787),
  }
}

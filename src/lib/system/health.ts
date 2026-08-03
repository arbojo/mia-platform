import type { SupabaseClient } from '@supabase/supabase-js'

export type HealthStatus = 'passed' | 'warning' | 'failed'

export type HealthScope = 'system' | 'dashboard' | 'precommit'

export interface HealthCheckResult {
  id: string
  label: string
  status: HealthStatus
  latencyMs: number | null
  origin: string
  message: string
  remediation: string
}

export interface HealthReport {
  id?: string
  businessId: string | null
  scope: HealthScope
  status: HealthStatus
  checks: HealthCheckResult[]
  latencyMs: number
  summary: string
  createdAt?: string
}

export interface HealthRunnerOptions {
  businessId?: string | null
  scope?: HealthScope
  supabase?: SupabaseClient
  admin: SupabaseClient
}

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

function fail(
  id: string,
  label: string,
  message: string,
  origin: string,
  remediation: string,
  latencyMs: number | null = null,
): HealthCheckResult {
  return { id, label, status: 'failed', latencyMs, origin, message, remediation }
}

function pass(
  id: string,
  label: string,
  message: string,
  origin: string,
  latencyMs: number | null,
): HealthCheckResult {
  return { id, label, status: 'passed', latencyMs, origin, message, remediation: '' }
}

function warn(
  id: string,
  label: string,
  message: string,
  origin: string,
  remediation: string,
  latencyMs: number | null = null,
): HealthCheckResult {
  return { id, label, status: 'warning', latencyMs, origin, message, remediation }
}

export async function resolveBusinessId(
  admin: SupabaseClient,
  businessId?: string | null,
): Promise<string | null> {
  if (businessId) return businessId

  const { data: byName } = await admin
    .from('businesses')
    .select('id')
    .eq('name', 'Vitanova')
    .maybeSingle()
  if (byName) return byName.id

  const { data: first } = await admin.from('businesses').select('id').limit(1).maybeSingle()
  return first?.id ?? null
}

async function checkSupabaseConnectivity(
  admin: SupabaseClient,
): Promise<HealthCheckResult> {
  const origin = 'src/lib/supabase/admin.ts'
  const remediation =
    'Verifica que NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY existan en .env.local ' +
    '(git-crypt) y que el proyecto Supabase "Mia Lab" esté activo en https://supabase.com/dashboard.'

  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    return fail(
      'supabase_connectivity',
      'Conectividad Supabase',
      `Faltan variables de entorno: ${missing.join(', ')}.`,
      origin,
      `Copia .env.example a .env.local y completa: ${missing.join(', ')}.`,
    )
  }

  try {
    const started = performance.now()
    const { data, error } = await admin.from('businesses').select('id').limit(1)
    const latencyMs = Math.round(performance.now() - started)
    if (error) {
      return fail(
        'supabase_connectivity',
        'Conectividad Supabase',
        `No se pudo consultar la base de datos: ${error.message}`,
        origin,
        remediation,
        latencyMs,
      )
    }
    if (!Array.isArray(data)) {
      return fail(
        'supabase_connectivity',
        'Conectividad Supabase',
        'La respuesta de la base de datos no es una lista de negocios.',
        origin,
        remediation,
        latencyMs,
      )
    }
    return pass(
      'supabase_connectivity',
      'Conectividad Supabase',
      `Conexión exitosa en ${latencyMs} ms.`,
      origin,
      latencyMs,
    )
  } catch (err) {
    return fail(
      'supabase_connectivity',
      'Conectividad Supabase',
      `Excepción al conectar: ${err instanceof Error ? err.message : 'desconocida'}`,
      origin,
      remediation,
    )
  }
}

async function checkGoogleAuth(): Promise<HealthCheckResult> {
  const origin = 'src/app/(auth)/login/page.tsx'
  const remediation =
    'Activa el proveedor Google en Supabase (Authentication → Providers) y setea ' +
    'NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true en las env vars de Vercel (Production).'

  const enabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true'
  if (!enabled) {
    return warn(
      'google_auth',
      'Tokens Google Auth',
      'El flag NEXT_PUBLIC_ENABLE_GOOGLE_AUTH no está en true; el botón de Google está oculto.',
      origin,
      'Setea NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true en Vercel (Production) y en .env.local.',
    )
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return fail(
      'google_auth',
      'Tokens Google Auth',
      'Falta NEXT_PUBLIC_SUPABASE_URL necesario para el flujo OAuth.',
      origin,
      remediation,
    )
  }

  return pass(
    'google_auth',
    'Tokens Google Auth',
    'Configuración de Google Auth presente (flag activo y URL de proyecto configurada).',
    origin,
    null,
  )
}

async function checkChatPersistence(
  admin: SupabaseClient,
  businessId: string | null,
): Promise<HealthCheckResult> {
  const origin = 'src/lib/runtime/runtime.ts (processStreaming)'
  const remediation =
    'Corre supabase migration list; si 001 no está aplicada aplica todas con "supabase db push". ' +
    'Verifica que la tabla conversations y messages existan y que RLS permita inserts del admin.'

  if (!businessId) {
    return warn(
      'chat_persistence',
      'Persistencia de chat',
      'Sin businessId no se puede validar la persistencia con round-trip.',
      origin,
      'Corre el check desde el dashboard autenticado o con un businessId explícito.',
    )
  }

  const { data: assistant } = await admin
    .from('assistants')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!assistant) {
    return warn(
      'chat_persistence',
      'Persistencia de chat',
      'No hay asistentes activos para el round-trip; se omite la verificación de escritura.',
      origin,
      'Crea un asistente o ejecuta scripts/seed-vitanova.ts.',
    )
  }

  const conversationId = crypto.randomUUID()
  let latencyMs: number | null = null
  try {
    const started = performance.now()
    const { error: convError } = await admin.from('conversations').insert({
      id: conversationId,
      assistant_id: assistant.id,
      type: 'training',
      status: 'active',
    })
    if (convError) {
      return fail(
        'chat_persistence',
        'Persistencia de chat',
        `No se pudo crear la conversación de prueba: ${convError.message}`,
        origin,
        remediation,
      )
    }

    const { error: msgError } = await admin.from('messages').insert({
      conversation_id: conversationId,
      role: 'system',
      content: '__health_check_roundtrip__',
    })
    if (msgError) {
      await admin.from('conversations').delete().eq('id', conversationId)
      return fail(
        'chat_persistence',
        'Persistencia de chat',
        `No se pudo insertar el mensaje de prueba: ${msgError.message}`,
        origin,
        remediation,
      )
    }

    const { data: read, error: readError } = await admin
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .maybeSingle()

    latencyMs = Math.round(performance.now() - started)

    await admin.from('conversations').delete().eq('id', conversationId)

    if (readError || read?.content !== '__health_check_roundtrip__') {
      return fail(
        'chat_persistence',
        'Persistencia de chat',
        'El round-trip write/read falló: el mensaje no se leyó de vuelta.',
        origin,
        remediation,
        latencyMs,
      )
    }

    return pass(
      'chat_persistence',
      'Persistencia de chat',
      `Round-trip write/read OK en ${latencyMs} ms.`,
      origin,
      latencyMs,
    )
  } catch (err) {
    try {
      await admin.from('conversations').delete().eq('id', conversationId)
    } catch {
      /* best-effort cleanup */
    }
    return fail(
      'chat_persistence',
      'Persistencia de chat',
      `Excepción en el round-trip: ${err instanceof Error ? err.message : 'desconocida'}`,
      origin,
      remediation,
      latencyMs,
    )
  }
}

async function checkVitanovaIndexing(
  admin: SupabaseClient,
  businessId: string | null,
): Promise<HealthCheckResult> {
  const origin = 'scripts/seed-vitanova.ts'
  const remediation =
    'Corre "npx tsx scripts/seed-vitanova.ts" para poblar el catálogo, reglas, conocimiento e instrucciones de Vitanova.'

  if (!businessId) {
    return fail(
      'vitanova_indexing',
      'Indexación Vitanova',
      'No existe business Vitanova para validar la indexación.',
      origin,
      remediation,
    )
  }

  const counts = await Promise.all([
    admin.from('products').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    admin.from('sales_rules').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    admin.from('knowledge_items').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    admin.from('ai_instructions').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
  ])

  const [products, rules, knowledge, instructions] = counts
  const failed = counts.filter((r) => r.error)

  if (failed.length > 0) {
    return fail(
      'vitanova_indexing',
      'Indexación Vitanova',
      `Falló la consulta de conteo: ${failed.map((r) => r.error?.message).join('; ')}`,
      origin,
      'Verifica que la migración 001 esté aplicada y que el business tenga datos.',
    )
  }

  const allPopulated =
    (products.count ?? 0) > 0 &&
    (rules.count ?? 0) > 0 &&
    (knowledge.count ?? 0) > 0 &&
    (instructions.count ?? 0) > 0

  if (!allPopulated) {
    return fail(
      'vitanova_indexing',
      'Indexación Vitanova',
      `Catálogo incompleto: ${products.count} productos, ${rules.count} reglas, ` +
        `${knowledge.count} conocimientos, ${instructions.count} instrucciones.`,
      origin,
      remediation,
    )
  }

  return pass(
    'vitanova_indexing',
    'Indexación Vitanova',
    `Catálogo completo: ${products.count} productos, ${rules.count} reglas, ` +
      `${knowledge.count} conocimientos, ${instructions.count} instrucciones.`,
    origin,
    null,
  )
}

function aggregate(checks: HealthCheckResult[]): HealthStatus {
  if (checks.some((c) => c.status === 'failed')) return 'failed'
  if (checks.some((c) => c.status === 'warning')) return 'warning'
  return 'passed'
}

export async function runHealthChecks(
  options: HealthRunnerOptions,
): Promise<HealthReport> {
  const { admin, scope = 'system' } = options
  const businessId = await resolveBusinessId(admin, options.businessId ?? null)

  const started = performance.now()
  const checks = await Promise.all([
    checkSupabaseConnectivity(admin),
    checkGoogleAuth(),
    checkChatPersistence(admin, businessId),
    checkVitanovaIndexing(admin, businessId),
  ])

  const status = aggregate(checks)
  const latencyMs = Math.round(performance.now() - started)
  const failedCount = checks.filter((c) => c.status === 'failed').length
  const summary =
    status === 'passed'
      ? `${checks.length}/${checks.length} checks pasaron.`
      : `${failedCount} de ${checks.length} checks fallaron.`

  const { data } = await admin
    .from('health_checks')
    .insert({
      business_id: businessId,
      scope,
      status,
      checks,
      summary,
      latency_ms: latencyMs,
      source: scope,
    })
    .select('id, created_at')
    .single()

  return {
    id: data?.id,
    businessId,
    scope,
    status,
    checks,
    latencyMs,
    summary,
    createdAt: data?.created_at,
  }
}

export async function getLatestHealthReport(
  supabase: SupabaseClient,
  businessId: string | null,
): Promise<HealthReport | null> {
  const query = supabase
    .from('health_checks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
  if (businessId) query.eq('business_id', businessId)
  const { data } = await query.maybeSingle()
  if (!data) return null

  return {
    id: data.id,
    businessId: data.business_id,
    scope: data.scope,
    status: data.status,
    checks: Array.isArray(data.checks) ? data.checks : [],
    latencyMs: data.latency_ms ?? 0,
    summary: data.summary,
    createdAt: data.created_at,
  }
}

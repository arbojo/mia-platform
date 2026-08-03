import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  getAccessibilityPreferences,
  normalizeAccessibilityPreferences,
  saveAccessibilityPreferences,
  type AccessibilityPreferences,
} from '@/lib/system/accessibility'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const preferences = await getAccessibilityPreferences(user.id)
    return NextResponse.json({ preferences })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireAuth()

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const patch: Partial<AccessibilityPreferences> = {}
    const keys: (keyof AccessibilityPreferences)[] = [
      'mirror_layout',
      'optical_mode',
      'font_weight',
      'color_temperature',
    ]
    for (const key of keys) {
      if (body[key] !== undefined) patch[key] = body[key] as never
    }

    const current = await getAccessibilityPreferences(user.id)
    const next = normalizeAccessibilityPreferences({ ...current, ...patch })
    const preferences = await saveAccessibilityPreferences(user.id, next)
    return NextResponse.json({ preferences })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

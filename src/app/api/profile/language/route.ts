import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { normalizeLocale } from '@/lib/i18n/config'
import { getProfileLanguage, saveProfileLanguage } from '@/lib/system/language'

export async function GET() {
  try {
    const { user } = await requireAuth()
    const language = await getProfileLanguage(user.id)
    return NextResponse.json({ language })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load language'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireAuth()
    const body = (await request.json().catch(() => null)) as { language?: unknown } | null
    const language = normalizeLocale(typeof body?.language === 'string' ? body.language : null)
    const saved = await saveProfileLanguage(user.id, language)
    return NextResponse.json({ language: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save language'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

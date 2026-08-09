import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { InventoryError } from '@/lib/inventory/errors'
import { requireInventoryAdmin } from '@/lib/inventory/admin-api'
import { assertInventoryHubEnabled } from '@/lib/inventory/licensing'
import { listSuggestions, generateSuggestions, setSuggestionStatus } from '@/lib/inventory/suggestions'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId!)

    const suggestions = await listSuggestions(businessId!)

    return NextResponse.json({ suggestions })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory suggestions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId!)

    const result = await generateSuggestions(businessId!)

    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory suggestions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const patchSchema = z.object({
  suggestion_id: z.string().min(1),
  status: z.enum(['dismissed', 'done']),
})

export async function PATCH(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId!)

    const body = await req.json()
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    await setSuggestionStatus(businessId!, parsed.data.suggestion_id, parsed.data.status)

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory suggestions PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

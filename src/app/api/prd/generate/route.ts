import { NextResponse } from 'next/server'
import { buildPrd, computePrdCost } from '@/lib/prd/builder'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, context } = body as {
      title?: string
      description?: string
      context?: string
    }

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description' },
        { status: 400 }
      )
    }

    const result = await buildPrd({ title, description, context })

    return NextResponse.json({
      prd: result.markdown,
      parsed: result.prd,
      tokensUsed: result.tokensUsed,
      cost: computePrdCost(result.tokensUsed),
    })
  } catch (error) {
    console.error('PRD generation error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getBusinessContext } from '@/lib/ai/knowledge'
import { buildMasterPrompt } from '@/lib/ai/prompts'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const assistantId = searchParams.get('assistantId')

  if (!assistantId) {
    return NextResponse.json({ error: 'assistantId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*, businesses(*)')
    .eq('id', assistantId)
    .single()

  if (!assistant) {
    return NextResponse.json({ error: 'Assistant not found' }, { status: 404 })
  }

  const context = await getBusinessContext(assistant.business_id)

  const systemPrompt = buildMasterPrompt({
    business: assistant.businesses,
    brand: context.brand,
    assistant,
    products: context.products,
    rules: context.rules,
    instructions: context.instructions,
    knowledge: context.knowledge,
  })

  return NextResponse.json({
    assistant: {
      id: assistant.id,
      name: assistant.name,
      personality: assistant.personality,
      communication_style: assistant.communication_style,
    },
    brand: context.brand,
    products: context.products,
    rules: context.rules,
    instructions: context.instructions,
    knowledge: context.knowledge,
    systemPrompt,
  })
}

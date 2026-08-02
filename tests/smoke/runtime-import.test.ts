import { describe, it, expect } from 'vitest'
import { FAKE_UUIDS, mockAssistant } from '../fixtures'

describe('smoke: runtime imports and mocks', () => {
  it('fixtures export valid UUIDs', () => {
    expect(FAKE_UUIDS.assistant).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(FAKE_UUIDS.business).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it('fixtures have consistent references', () => {
    expect(mockAssistant.business_id).toBe(FAKE_UUIDS.business)
    expect(mockAssistant.id).toBe(FAKE_UUIDS.assistant)
  })

  it('runtime module can be imported', async () => {
    const mod = await import('@/lib/runtime/runtime')
    expect(mod.processStreaming).toBeDefined()
    expect(mod.processIncomingMessage).toBeDefined()
    expect(mod.RuntimeError).toBeDefined()
  })

  it('loadConversationContext can be imported', async () => {
    const mod = await import('@/lib/conversation/context')
    expect(mod.loadConversationContext).toBeDefined()
    expect(mod.ContextError).toBeDefined()
  })

  it('identity module can be imported', async () => {
    const mod = await import('@/lib/channels/identity')
    expect(mod.resolveCustomer).toBeDefined()
  })

  it('cost module can be imported', async () => {
    const mod = await import('@/lib/ai/cost')
    expect(mod.trackAiUsage).toBeDefined()
    expect(mod.calculateCost).toBeDefined()
  })

  it('prompts module can be imported', async () => {
    const mod = await import('@/lib/ai/prompts')
    expect(mod.buildMasterPrompt).toBeDefined()
  })

  it('knowledge module can be imported', async () => {
    const mod = await import('@/lib/ai/knowledge')
    expect(mod.getBusinessContext).toBeDefined()
    expect(mod.getRecentLessons).toBeDefined()
    expect(mod.recordAiUsage).toBeDefined()
  })

  it('gateway module can be imported', async () => {
    const mod = await import('@/lib/channels/gateway')
    expect(mod.getAdapter).toBeDefined()
  })

  it('WidgetAdapter can be imported', async () => {
    const mod = await import('@/lib/channels/adapters/widget')
    expect(mod.WidgetAdapter).toBeDefined()
  })

  it('supabase mock factory creates chainable client', async () => {
    const { createMockSupabase } = await import('../mocks/supabase')
    const { supabase } = createMockSupabase()

    expect(supabase.from).toBeDefined()
    expect(supabase.from('assistants').select).toBeDefined()
    expect(supabase.from('assistants').select('*').eq).toBeDefined()
    expect(supabase.from('assistants').select('*').eq('id', '123').single).toBeDefined()
  })

  it('OpenAI mock creates controllable client', async () => {
    const { createMockOpenAIClient } = await import('../mocks/openai')
    const client = createMockOpenAIClient()

    expect(client.chat.completions.create).toBeDefined()
    const result = await client.chat.completions.create()
    expect(result.choices[0].message.content).toBeTruthy()
  })

  it('stream mock creates controllable stream', async () => {
    const { createMockStreamText } = await import('../mocks/stream')
    const { streamText } = createMockStreamText()

    expect(streamText).toBeDefined()
    const result = streamText({
      model: 'test-model',
      system: 'test prompt',
      messages: [{ role: 'user', content: 'test' }],
    })
    expect(result.toTextStreamResponse).toBeDefined()
  })
})

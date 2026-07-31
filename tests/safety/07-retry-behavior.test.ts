import { run, priceContext } from './test-utils'

async function main() {
  console.log('\n# Retry Behavior')

  await run('retryWithSafety exists and has correct interface', async () => {
    const mod = await import('@/lib/safety')
    const { retryWithSafety } = mod
    const result = await retryWithSafety(
      'Test response',
      [{ role: 'user', content: 'test' }],
      priceContext,
      'business-id',
      'assistant-id'
    )

    const validOutcomes =
      result.passed === true &&
      typeof result.finalResponse === 'string' &&
      typeof result.retriesAttempted === 'number'

    if (!validOutcomes) {
      throw new Error(`Invalid retry result shape: ${JSON.stringify(result)}`)
    }
  })

  await run('validateAIResponse rejects hallucinated price before retry', async () => {
    const { validateAIResponse } = await import('@/lib/safety')
    const result = await validateAIResponse('Neurofeet cuesta $899', priceContext)
    if (result.passed !== false || result.blocked !== true) {
      throw new Error(`Expected blocked but got passed: ${JSON.stringify(result)}`)
    }
  })

  const apiKey = process.env.OPENAI_API_KEY
  const hasRealKey = Boolean(apiKey && apiKey.length > 10 && apiKey.startsWith('sk-'))

  if (hasRealKey) {
    await run('retry corrects hallucinated price (requires API key)', async () => {
      const { validateAIResponse, retryWithSafety } = await import('@/lib/safety')

      const originalResponse = 'Neurofeet cuesta $899'
      const initialResult = await validateAIResponse(originalResponse, priceContext)

      if (initialResult.passed) {
        console.log('    Skipping: price $899 unexpectedly passes')
        return
      }

      const retryResult = await retryWithSafety(
        originalResponse,
        [
          { role: 'system', content: 'test context' },
          { role: 'user', content: '¿Cuánto cuesta Neurofeet?' },
        ],
        priceContext,
        'business-id',
        'assistant-id'
      )

      if (retryResult.passed !== true) {
        throw new Error(`Retry should pass. Got: ${JSON.stringify(retryResult)}`)
      }

      if (retryResult.retriesAttempted !== 1) {
        throw new Error(`Expected exactly 1 retry, got ${retryResult.retriesAttempted}`)
      }
    })
  } else {
    console.log('  (skipping AI-dependent retry tests — set OPENAI_API_KEY to run)')
  }
}

main()

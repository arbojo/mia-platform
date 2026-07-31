import { run, priceContext } from './test-utils'

async function main() {
  console.log('\n# Failure Fallback — Safety Layer must never kill conversation')

  await run('retryWithSafety returns original response when AI is unavailable', async () => {
    const originalResponse = 'Neurofeet cuesta $899'
    const originalKey = process.env.OPENAI_API_KEY

    const prevKey = originalKey
    process.env.OPENAI_API_KEY = ''

    try {
      const { retryWithSafety } = await import('@/lib/safety')

      const result = await retryWithSafety(
        originalResponse,
        [{ role: 'user', content: 'test' }],
        priceContext,
        'business-id',
        'assistant-id'
      )

      if (result.passed !== true) {
        throw new Error(`Expected passed=true on AI failure. Got: ${JSON.stringify(result)}`)
      }

      if (result.finalResponse !== originalResponse) {
        throw new Error(
          `Expected original response on AI failure. Got: "${result.finalResponse}"`
        )
      }

      if (result.retriesAttempted !== 1) {
        throw new Error(`Expected retriesAttempted=1. Got: ${result.retriesAttempted}`)
      }
    } finally {
      process.env.OPENAI_API_KEY = prevKey
    }
  })

  await run('validateAIResponse never throws on malformed input', async () => {
    const { validateAIResponse } = await import('@/lib/safety')

    const inputs = ['', '   ', null as unknown as string, undefined as unknown as string]

    for (const input of inputs) {
      try {
        const result = await validateAIResponse(input, priceContext)
        if (typeof result.passed !== 'boolean') {
          throw new Error(`Expected result.passed to be boolean for input: "${input}"`)
        }
      } catch (err) {
        throw new Error(`validateAIResponse threw on input "${input}": ${err}`)
      }
    }
  })

  await run('safety module loads even with invalid environment', async () => {
    const originalKey = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = ''

    try {
      const safety = await import('@/lib/safety')
      if (typeof safety.validateAIResponse !== 'function') {
        throw new Error('Safety module should export validateAIResponse')
      }
      if (typeof safety.retryWithSafety !== 'function') {
        throw new Error('Safety module should export retryWithSafety')
      }
    } finally {
      process.env.OPENAI_API_KEY = originalKey
    }
  })
}

main()

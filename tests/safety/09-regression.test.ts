import assert from 'node:assert/strict'
import { validateAIResponse } from '@/lib/safety'
import { run, emptyContext } from './test-utils'

async function main() {
  console.log('\n# Regression Tests')

  await run('REGRESSION: "Siempre atendemos" no longer triggers immutable', async () => {
    const result = await validateAIResponse('Siempre atendemos con gusto 😊', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('REGRESSION: "cambio" no longer triggers guarantee', async () => {
    const result = await validateAIResponse('Te cambio el producto por otro modelo', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.every((t) => t.type !== 'guarantee'), true)
  })

  await run('REGRESSION: standalone "día" no longer triggers delivery', async () => {
    const result = await validateAIResponse('Es un buen día para comprar', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.every((t) => t.type !== 'delivery'), true)
  })
}

main()

import assert from 'node:assert/strict'
import { validateAIResponse } from '@/lib/safety'
import { run, guaranteeContext, noReturnContext } from './test-utils'

async function main() {
  console.log('\n# Guarantee Validation')

  await run('passes valid guarantee mention', async () => {
    const result = await validateAIResponse('El producto tiene garantía', guaranteeContext)
    assert.equal(result.passed, true)
  })

  await run('blocks return claim when returns not allowed', async () => {
    const result = await validateAIResponse('Tenemos devolución garantizada', noReturnContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('does NOT trigger on "cambio" for exchange context', async () => {
    const result = await validateAIResponse('Te cambio el producto por otro color', guaranteeContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes guarantee within allowed period', async () => {
    const result = await validateAIResponse('Tienes 10 días para devolverlo', guaranteeContext)
    assert.equal(result.passed, true)
  })

  await run('blocks guarantee exceeding allowed period', async () => {
    const result = await validateAIResponse('Tienes 30 días para devolverlo', guaranteeContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('does NOT trigger on "cambio de opinión"', async () => {
    const result = await validateAIResponse('Si cambias de opinión, avísame', guaranteeContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes when no restriction rule exists', async () => {
    const result = await validateAIResponse('Tiene garantía', { products: [], rules: [], memory: [] })
    assert.equal(result.passed, true)
  })
}

main()

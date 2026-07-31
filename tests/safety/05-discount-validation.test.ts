import assert from 'node:assert/strict'
import { validateAIResponse } from '@/lib/safety'
import { run, discountContext } from './test-utils'

async function main() {
  console.log('\n# Discount Validation')

  await run('passes valid discount within limit', async () => {
    const result = await validateAIResponse('Tenemos 20% de descuento', discountContext)
    assert.equal(result.passed, true)
  })

  await run('blocks discount exceeding maximum', async () => {
    const result = await validateAIResponse('Hoy tienes 50% de descuento', discountContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('passes discount at exact maximum', async () => {
    const result = await validateAIResponse('Aprovecha el 30% de descuento', discountContext)
    assert.equal(result.passed, true)
  })

  await run('passes when no promotion rule exists', async () => {
    const result = await validateAIResponse('Tenemos 20% de descuento', { products: [], rules: [], memory: [] })
    assert.equal(result.passed, true)
  })

  await run('does not trigger on unrelated "oferta" context', async () => {
    const result = await validateAIResponse('Te ofrezco ayuda con lo que necesites', discountContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })
}

main()

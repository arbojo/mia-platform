import assert from 'node:assert/strict'
import { validateAIResponse } from '@/lib/safety'
import { run, priceContext, noProductContext } from './test-utils'

async function main() {
  console.log('\n# Price Validation')

  await run('passes correct price: Neurofeet $499', async () => {
    const result = await validateAIResponse('Neurofeet cuesta $499 😊', priceContext)
    assert.equal(result.passed, true)
  })

  await run('passes correct price: Neurotin $399', async () => {
    const result = await validateAIResponse('Neurotin tiene un precio de $399', priceContext)
    assert.equal(result.passed, true)
  })

  await run('blocks hallucinated price: $899', async () => {
    const result = await validateAIResponse('Neurofeet cuesta $899', priceContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
    assert.ok(result.triggers.some((t) => t.type === 'price'))
  })

  await run('passes same price as another product (Option A behavior)', async () => {
    const result = await validateAIResponse('Neurofeet cuesta $399', priceContext)
    assert.equal(result.passed, true)
  })

  await run('blocks price with no products in context', async () => {
    const result = await validateAIResponse('Este producto cuesta $299', noProductContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('passes text with dollar sign in non-price context', async () => {
    const result = await validateAIResponse('Ahorras dinero con nosotros', priceContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('blocks price containing comma: $1,499', async () => {
    const result = await validateAIResponse('Neurofeet cuesta $1,499', priceContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('blocks price in "precio" format', async () => {
    const result = await validateAIResponse('El precio del producto es $599', priceContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('passes zero price mention (no product data)', async () => {
    const result = await validateAIResponse('No tenemos costo de envío', priceContext)
    assert.equal(result.passed, true)
  })
}

main()

import assert from 'node:assert/strict'
import { validateAIResponse } from '@/lib/safety'
import { run, deliveryContext, slowDeliveryContext } from './test-utils'

async function main() {
  console.log('\n# Delivery Validation')

  await run('blocks "mañana" when delivery takes 3-5 days', async () => {
    const result = await validateAIResponse('Te llega mañana 😊', slowDeliveryContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('blocks "hoy" when delivery takes multiple days', async () => {
    const result = await validateAIResponse('Te lo enviamos hoy', slowDeliveryContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('blocks "llega mañana" when rule says 3-5 days', async () => {
    const result = await validateAIResponse('Te llega mañana', deliveryContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('passes reasonable delivery estimate', async () => {
    const result = await validateAIResponse('Nuestro envío tarda de 3 a 5 días', deliveryContext)
    assert.equal(result.passed, true)
  })

  await run('passes "trabajamos todos los días"', async () => {
    const result = await validateAIResponse('Trabajamos todos los días', deliveryContext)
    assert.equal(result.passed, true)
  })

  await run('passes "hoy tenemos promociones"', async () => {
    const result = await validateAIResponse('Hoy tenemos promociones', deliveryContext)
    assert.equal(result.passed, true)
  })

  await run('does not trigger on "excelente día"', async () => {
    const result = await validateAIResponse('Que tengas un excelente día', deliveryContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('does not trigger on standalone "día" in context', async () => {
    const result = await validateAIResponse('Es un buen día para comprar', deliveryContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('blocks undersized delivery: "llega en 1 día" when rule says 5', async () => {
    const result = await validateAIResponse('Te llega en 1 día', slowDeliveryContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('passes when no delivery rule exists', async () => {
    const result = await validateAIResponse('Te llega mañana', { products: [], rules: [], memory: [] })
    assert.equal(result.passed, true)
  })
}

main()

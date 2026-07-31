import assert from 'node:assert/strict'
import { validateAIResponse } from '@/lib/safety'
import { run, immutableContext, emptyContext } from './test-utils'

async function main() {
  console.log('\n# Immutable Memory Validation')

  await run('blocks response contradicting immutable rule', async () => {
    const result = await validateAIResponse('Estamos abiertos todos los domingos', immutableContext)
    assert.equal(result.passed, false)
    assert.equal(result.blocked, true)
  })

  await run('passes when nothing contradicts immutable rule', async () => {
    const result = await validateAIResponse('Estamos abiertos de lunes a sábado', immutableContext)
    assert.equal(result.passed, true)
  })

  await run('passes generic "siempre" without immutable context', async () => {
    const result = await validateAIResponse('Siempre atendemos con gusto 😊', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes generic "nunca" without immutable context', async () => {
    const result = await validateAIResponse('Nunca dudes en preguntar', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes generic "todos" without immutable context', async () => {
    const result = await validateAIResponse('Todos nuestros productos tienen beneficios', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('does not create immutable trigger from common words', async () => {
    const result = await validateAIResponse('Siempre atendemos con gusto 😊', emptyContext)
    assert.equal(result.triggers.length, 0, 'No triggers should fire')
  })

  await run('passes when no immutable memories exist', async () => {
    const result = await validateAIResponse('Estamos abiertos los domingos', emptyContext)
    assert.equal(result.passed, true)
  })
}

main()

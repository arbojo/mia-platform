import assert from 'node:assert/strict'
import { validateAIResponse } from '@/lib/safety'
import { run, emptyContext } from './test-utils'

async function main() {
  console.log('\n# Fast Path — Normal conversations must not enter validation')

  await run('passes normal greeting', async () => {
    const result = await validateAIResponse('Hola 😊 tenemos varios productos disponibles', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.blocked, false)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes friendly offer', async () => {
    const result = await validateAIResponse('Claro que sí, con gusto te ayudo', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.blocked, false)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes product description', async () => {
    const result = await validateAIResponse(
      'Nuestro producto ayuda con molestias relacionadas con neuropatía',
      emptyContext
    )
    assert.equal(result.passed, true)
    assert.equal(result.blocked, false)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes recommendation', async () => {
    const result = await validateAIResponse(
      'Te recomiendo esta opción porque puede adaptarse mejor a tu caso',
      emptyContext
    )
    assert.equal(result.passed, true)
    assert.equal(result.blocked, false)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes warmth and personality', async () => {
    const result = await validateAIResponse('Siempre atendemos con gusto 😊', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes general knowledge', async () => {
    const result = await validateAIResponse('Nuestros productos ayudan a mejorar la comodidad', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })

  await run('passes product name without price', async () => {
    const result = await validateAIResponse('Neurofeet es un producto excelente para tus pies', emptyContext)
    assert.equal(result.passed, true)
    assert.equal(result.triggers.length, 0)
  })
}

main()

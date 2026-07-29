import { config } from 'dotenv'
config({ path: '.env.local' })
import { getSupabase, getOpenAI, classifyWithLLM } from './utils'
import { generateDocuments } from './config'

async function main() {
  const doc = generateDocuments()[0]
  const openai = getOpenAI()
  const result = await classifyWithLLM(doc, openai)

  console.log('Document:', doc.title)
  console.log('Category:', result.category)
  console.log('Entities count:', result.entities.length)
  for (const e of result.entities) {
    console.log(`  Table: ${e.table}, Data:`, JSON.stringify(e.data, null, 2))
  }
  console.log('Conflicts:', result.conflicts.length)
  for (const c of result.conflicts) {
    console.log(`  ${c.description} (${c.severity})`)
  }

  // Now test with a knowledge doc
  const doc2 = generateDocuments().find(d => d.type === 'knowledge')!
  console.log('\n\nDocument 2:', doc2.title)
  const result2 = await classifyWithLLM(doc2, openai)
  console.log('Category:', result2.category)
  console.log('Entities count:', result2.entities.length)
  for (const e of result2.entities) {
    console.log(`  Table: ${e.table}, Data:`, JSON.stringify(e.data))
  }

  // Test with a policy doc
  const doc3 = generateDocuments().find(d => d.type === 'policy' && !d.isConflict)!
  console.log('\n\nDocument 3:', doc3.title)
  const result3 = await classifyWithLLM(doc3, openai)
  console.log('Category:', result3.category)
  console.log('Entities count:', result3.entities.length)
  for (const e of result3.entities) {
    console.log(`  Table: ${e.table}, Data:`, JSON.stringify(e.data))
  }
}

main().catch(console.error)

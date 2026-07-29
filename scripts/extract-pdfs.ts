import fs from 'fs'
import path from 'path'
import pdfParse from 'pdf-parse'

const DOCS_DIR = 'C:\\Users\\david\\OneDrive\\Escritorio\\DOCUMENTACION MIA'
const OUT_DIR = 'C:\\Users\\david\\mia\\scripts\\extracted-docs'

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.pdf')).sort()
  console.log(`Found ${files.length} PDFs`)

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file)
    const buffer = fs.readFileSync(filePath)
    
    try {
      const data = await (pdfParse as any)(buffer)
      const outPath = path.join(OUT_DIR, file.replace('.pdf', '.txt'))
      fs.writeFileSync(outPath, data.text, 'utf8')
      console.log(`✅ ${file} → ${data.text.length} chars`)
    } catch (err: any) {
      console.error(`❌ ${file}: ${err.message}`)
    }
  }
  
  console.log(`\nDone. Files saved to ${OUT_DIR}`)
}

main().catch(console.error)

import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

async function main() {
  const data = new Uint8Array(fs.readFileSync('C:\\Users\\david\\OneDrive\\Escritorio\\DOCUMENTACION MIA\\00_MIA_Guia_General_Vitanova_v1.pdf'))
  const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true })
  const pdf = await loadingTask.promise
  console.log('Pages:', pdf.numPages)

  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(' ')
    fullText += pageText + '\n\n'
  }

  const outPath = 'C:\\Users\\david\\mia\\scripts\\extracted-docs\\00_MIA_Guia_General_Vitanova_v1.txt'
  fs.writeFileSync(outPath, fullText, 'utf8')
  console.log('Done:', fullText.length, 'chars extracted')
}

main().catch(console.error)

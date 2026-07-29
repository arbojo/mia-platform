declare module 'pdf-parse' {
  interface PDFData {
    text: string
    numpages: number
    info: Record<string, unknown>
    metadata: Record<string, unknown>
    version: string
  }
  interface PDFParseConstructor {
    new(options: { data: Buffer }): { getText(): Promise<PDFData> }
  }
  const PDFParse: PDFParseConstructor
  export { PDFParse }
  export default PDFParse
}

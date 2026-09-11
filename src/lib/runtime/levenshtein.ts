/**
 * Damerau–Levenshtein restringido (optimal string alignment).
 *
 * Distancia de edición que, además de inserción/sustitución/eliminación,
 * cuenta una transposición de caracteres adyacentes como 1 operación.
 * Se usa en el matcher de producto (product-matcher.ts) para recuperar
 * typos determinísticamente, sin recurrir a la clasificación del LLM.
 *
 * Implementación propia (AGENTS: reuse/simplicity): el repo no tiene
 * dependencias fuzzy y una función pura y testeada es más mantenible que
 * traer una librería externa para este único uso. Inputs cortos -> la
 * matriz completa es legible y suficiente.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }

  return d[m][n]
}
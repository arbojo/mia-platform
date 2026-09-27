/**
 * Models asked for JSON routinely answer wrapped in a markdown fence
 * (```json ... ```) or with a sentence of prose in front, even when told to
 * reply with JSON only. Parsing the raw string then throws on the first
 * backtick.
 *
 * That is not cosmetic: in the scheduled learning pipeline it meant a tenant
 * with real conversation history failed every single night with
 * "Unexpected token '`'" while every empty tenant reported a clean run, so the
 * failure looked like data rather than a bug.
 */
export function parseAiJson<T>(content: string, context: string): T {
  const cleaned = stripFence(content)
  const candidate = sliceJson(cleaned) ?? cleaned

  try {
    return JSON.parse(candidate) as T
  } catch {
    throw new Error(`Failed to parse ${context} JSON: ${candidate.slice(0, 200)}`)
  }
}

function stripFence(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json|JSON)?[ \t]*\r?\n?/, '')
    .replace(/\r?\n?```[ \t]*$/, '')
    .trim()
}

/**
 * Falls back to the outermost braces or brackets so a stray sentence around the
 * payload does not turn into a parse failure. Only reached when the content is
 * not already bare JSON.
 */
function sliceJson(text: string): string | null {
  const start = text.search(/[[{]/)
  if (start === -1) return null

  const closing = text[start] === '{' ? '}' : ']'
  const end = text.lastIndexOf(closing)
  if (end <= start) return null

  return text.slice(start, end + 1)
}

/**
 * Human takeover command matching.
 *
 * A business-side human sends a short token (default `#e`) from the business
 * phone to make MIA take the conversation back (resume). The token counts when
 * it is the WHOLE message or the LAST token of a message (so the salesperson can
 * append it to her real reply: `bla bla #e`). A token appearing mid-sentence
 * never triggers, so an innocent `#e` inside normal text is ignored.
 *
 * The token is deliberately terse so it reads as a typo to the customer. The
 * bridge no longer deletes the message; it strips the token from the forwarded
 * content so MIA's transcript stays clean.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface HumanTakeoverMatch {
  matched: boolean
  /** Content with the trailing token (and trailing punctuation) removed. */
  stripped: string
}

export function matchHumanTakeoverCommand(content: string, token: string): HumanTakeoverMatch {
  const normalizedToken = token.trim()
  if (!normalizedToken) return { matched: false, stripped: content }

  const escaped = escapeRegExp(normalizedToken)
  const trailing = new RegExp(`(?:^|\\s)${escaped}[\\s.,!?;:…]*$`, 'i')
  const trimmed = content.trim()

  if (!trailing.test(trimmed)) return { matched: false, stripped: content }

  return { matched: true, stripped: trimmed.replace(trailing, '').trim() }
}

export function isHumanTakeoverCommand(content: string, token: string): boolean {
  return matchHumanTakeoverCommand(content, token).matched
}

export function stripHumanTakeoverToken(content: string, token: string): string {
  return matchHumanTakeoverCommand(content, token).stripped
}

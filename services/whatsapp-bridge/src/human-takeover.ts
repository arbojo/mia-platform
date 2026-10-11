/**
 * Human takeover command matching.
 *
 * A business-side human sends a short token (default `#e`) from the business
 * phone to toggle MIA on/off for the current conversation. The token must be the
 * WHOLE message (trimmed, case-insensitive) so a token appearing inside a normal
 * sentence never triggers a toggle.
 */
export function isHumanTakeoverCommand(content: string, token: string): boolean {
  const normalizedToken = token.trim().toLowerCase()
  if (!normalizedToken) return false
  return content.trim().toLowerCase() === normalizedToken
}

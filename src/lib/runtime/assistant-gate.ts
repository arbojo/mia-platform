/**
 * Canonical runtime gate for assistant traffic.
 *
 * An assistant can serve traffic if and only if:
 *   - is_active = true  (hard kill switch)
 *   - status ∈ {ready, active}  (published lifecycle states)
 *
 * draft/training/null/undefined are never allowed to serve traffic.
 *
 * This is the SINGLE source of truth for runtime permission.
 * All runtime entry points (widget, resolver, demo) must use this.
 */
const SERVE_STATUSES: ReadonlySet<string> = new Set(['ready', 'active'])

export function canServeTraffic(isActive: boolean, status: string | null | undefined): boolean {
  if (!isActive) return false
  if (status === null || status === undefined) return false
  return SERVE_STATUSES.has(status)
}

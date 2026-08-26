/**
 * Canonical runtime gate for assistant traffic.
 *
 * An assistant can serve traffic if and only if:
 *   - is_active = true  (hard kill switch)
 *   - status != 'inactive'  (lifecycle deactivation)
 *
 * This is the SINGLE source of truth for runtime permission.
 * All runtime entry points (widget, resolver, demo) must use this.
 */
export function canServeTraffic(isActive: boolean, status: string | null | undefined): boolean {
  if (!isActive) return false
  if (status === 'inactive') return false
  return true
}

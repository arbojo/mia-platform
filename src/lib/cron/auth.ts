import { timingSafeEqual } from 'node:crypto'

/**
 * Auth for scheduled endpoints (`/api/cron/*`).
 *
 * Two callers, two mechanisms:
 *
 *  - **Vercel Cron** issues a GET carrying `Authorization: Bearer <CRON_SECRET>`
 *    whenever `CRON_SECRET` is set on the project. It never sends a custom
 *    header, so a route that only reads `x-mia-cron-secret` can never be
 *    triggered by the scheduler.
 *  - **Manual / headless runs** (curl, the deploy runbook, an operator) send
 *    `x-mia-cron-secret: <MIA_CRON_SECRET>`.
 *
 * Fails closed. With neither variable set, nothing authenticates: these routes
 * reach data through the service-role client, which bypasses RLS, so "no secret
 * configured" must never degrade into "everybody is authorized".
 */
export function verifyCronAuth(request: Request): boolean {
  const schedulerSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (schedulerSecret && authorization === `Bearer ${schedulerSecret}`) {
    return true
  }

  const presented = request.headers.get('x-mia-cron-secret')
  const expected = process.env.MIA_CRON_SECRET
  return Boolean(presented && expected && safeEqual(presented, expected))
}

/**
 * Constant-time compare. Length is still observable, which is fine for
 * high-entropy generated secrets; the point is not to let a caller recover the
 * secret one byte at a time through response timing.
 */
function safeEqual(presented: string, expected: string): boolean {
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

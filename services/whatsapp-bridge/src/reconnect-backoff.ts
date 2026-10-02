/**
 * Consecutive-failure tracking for socket reconnects, per business.
 *
 * Kept out of `SessionManager` on purpose. The failure count has to outlive the
 * session object it belongs to, and `SessionManager` builds a fresh session on
 * every `doConnect`, so storing the count on the session silently restarts it
 * at 1 forever. Owning it here makes that impossible and keeps the backoff
 * arithmetic testable without a socket.
 */
export class ReconnectBackoff {
  private readonly attempts = new Map<string, number>()

  constructor(
    private readonly baseDelayMs: number,
    private readonly maxDelayMs: number,
    private readonly maxAttempts: number
  ) {}

  /** Records a failure and returns its 1-based attempt number. */
  fail(businessId: string): number {
    const attempt = (this.attempts.get(businessId) ?? 0) + 1
    this.attempts.set(businessId, attempt)
    return attempt
  }

  /**
   * Delay before the given attempt. Doubles per attempt and saturates at
   * `maxDelayMs`.
   */
  delayFor(attempt: number): number {
    return Math.min(this.baseDelayMs * 2 ** (attempt - 1), this.maxDelayMs)
  }

  /**
   * True once the attempt exceeds the ceiling. The caller must stop retrying
   * and surface the failure instead of looping at the maximum delay.
   */
  exceeded(attempt: number): boolean {
    return attempt > this.maxAttempts
  }

  /**
   * Marks a connection as recovered. Called only when a socket actually held
   * for long enough — a connection that opens and immediately dies is not a
   * recovery and must keep escalating.
   */
  recover(businessId: string): void {
    this.attempts.delete(businessId)
  }

  /** Current consecutive failure count, 0 when healthy. */
  current(businessId: string): number {
    return this.attempts.get(businessId) ?? 0
  }

  /** Human-readable reason for the give-up, or null while retries remain. */
  giveUpReason(attempt: number): string | null {
    if (!this.exceeded(attempt)) return null
    return (
      `giving up after ${this.maxAttempts} reconnect attempts ` +
      `(last delay ${this.maxDelayMs}ms)`
    )
  }
}
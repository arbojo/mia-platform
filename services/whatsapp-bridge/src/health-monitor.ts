import type { SessionManager, SessionHealth } from './session-manager.js'

export interface HealthConfig {
  /** How often the monitor inspects every active session. */
  checkIntervalMs: number
  /** Min time a session must be connected before a protocol timeout triggers a restart. */
  restartGracePeriodMs: number
  /** Number of protocol timeout signals that justify a preventive restart. */
  zombieSignalThreshold: number
  /** Base delay for exponential reconnect backoff. */
  baseReconnectDelayMs: number
  /** Upper bound for exponential reconnect backoff. */
  maxReconnectDelayMs: number
}

const DEFAULT_HEALTH_CONFIG: HealthConfig = {
  checkIntervalMs: 30_000,
  restartGracePeriodMs: 90_000,
  zombieSignalThreshold: 3,
  baseReconnectDelayMs: 5_000,
  maxReconnectDelayMs: 300_000,
}

export function loadHealthConfig(env: NodeJS.ProcessEnv = process.env): HealthConfig {
  const num = (name: string, fallback: number): number => {
    const raw = env[name]
    if (!raw) return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }
  return {
    checkIntervalMs: num('HEALTH_CHECK_INTERVAL_MS', DEFAULT_HEALTH_CONFIG.checkIntervalMs),
    restartGracePeriodMs: num('HEALTH_RESTART_GRACE_MS', DEFAULT_HEALTH_CONFIG.restartGracePeriodMs),
    zombieSignalThreshold: num('HEALTH_ZOMBIE_THRESHOLD', DEFAULT_HEALTH_CONFIG.zombieSignalThreshold),
    baseReconnectDelayMs: num('HEALTH_BASE_RECONNECT_MS', DEFAULT_HEALTH_CONFIG.baseReconnectDelayMs),
    maxReconnectDelayMs: num('HEALTH_MAX_RECONNECT_MS', DEFAULT_HEALTH_CONFIG.maxReconnectDelayMs),
  }
}

/**
 * Baileys Agent — dedicated session health watcher.
 *
 * Detects "zombie" sockets (Baileys reports `connected` but init queries /
 * handshakes keep timing out with 408-style errors) and orders a preventive
 * restart before the customer notices the assistant went silent.
 */
export class HealthMonitor {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly manager: SessionManager,
    private readonly config: HealthConfig
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.checkAll().catch((err) => {
        console.error('[health-monitor] check failed:', err)
      })
    }, this.config.checkIntervalMs)
    console.log(`[health-monitor] started (every ${this.config.checkIntervalMs}ms)`)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async checkAll(): Promise<void> {
    for (const health of this.manager.listHealth()) {
      await this.checkSession(health)
    }
  }

  private async checkSession(health: SessionHealth): Promise<void> {
    if (health.status !== 'connected') return

    const now = Date.now()

    // Restart grace: give a freshly connected session time to finish init
    // queries before acting on timeout signals.
    if (health.connectedAt && now - health.connectedAt < this.config.restartGracePeriodMs) {
      return
    }

    const zombieSignals = health.zombieSignalCount ?? 0
    if (zombieSignals >= this.config.zombieSignalThreshold) {
      console.warn(
        `[health-monitor] zombie socket detected for ${health.businessId} ` +
          `(${zombieSignals} protocol timeout signals). Restarting session.`
      )
      await this.manager.restart(health.businessId)
      return
    }

    // The socket claims to be connected but never produced a usable identity.
    if (!health.hasIdentity) {
      console.warn(
        `[health-monitor] ${health.businessId} reports connected without a ` +
          `resolved device identity. Restarting session.`
      )
      await this.manager.restart(health.businessId)
    }
  }
}

import { loadConfig } from './config.js'
import { SessionManager } from './session-manager.js'
import { startBridgeServer } from './server.js'
import { HealthMonitor } from './health-monitor.js'
import { FollowUpMonitor } from './follow-up-monitor.js'

function main(): void {
  const config = loadConfig()
  const manager = new SessionManager(config)
  const healthMonitor = new HealthMonitor(manager, config.health)
  healthMonitor.start()
  const followUpMonitor = new FollowUpMonitor(manager, config, config.followUp)
  followUpMonitor.start()
  startBridgeServer(config, manager)

  void manager.restoreAllSessions().catch((err) => {
    console.error('[mia-bridge] session restoration failed:', err instanceof Error ? err.message : err)
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.log(`[mia-bridge] received ${signal}, shutting down`)
      healthMonitor.stop()
      followUpMonitor.stop()

      const active = manager.listHealth().filter((h) => h.status === 'connected')
      if (active.length === 0) {
        process.exit(0)
        return
      }

      console.log(`[mia-bridge] closing ${active.length} active session(s) gracefully (preserving credentials)`)
      const deadline = setTimeout(() => {
        console.warn('[mia-bridge] shutdown deadline exceeded, forcing exit')
        process.exit(1)
      }, 8_000)

      manager.gracefulShutdown().then(() => {
        clearTimeout(deadline)
        process.exit(0)
      })
    })
  }
}

main()

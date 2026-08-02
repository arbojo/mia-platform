import { loadConfig } from './config.js'
import { SessionManager } from './session-manager.js'
import { startBridgeServer } from './server.js'

function main(): void {
  const config = loadConfig()
  const manager = new SessionManager(config)
  startBridgeServer(config, manager)

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      console.log(`[mia-bridge] received ${signal}, shutting down`)
      process.exit(0)
    })
  }
}

main()

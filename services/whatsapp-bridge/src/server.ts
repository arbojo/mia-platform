import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { SessionManager } from './session-manager.js'
import type { SessionEvent, InteractiveComponent } from './session-manager.js'
import type { BridgeConfig } from './config.js'
import { verifyHttpAuth, verifyWsAuth } from './jwt.js'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function normalizeHeaders(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>
}

export function startBridgeServer(
  config: BridgeConfig,
  manager: SessionManager
): ReturnType<typeof createServer> {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

      if (req.method === 'GET' && url.pathname === '/healthz') {
        json(res, 200, { status: 'ok' })
        return
      }

      const match = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/([a-z]+)$/)
      const matchSend = url.pathname.match(/^\/v1\/sessions\/([^/]+)\/send$/)

      const businessId = match?.[1] ?? matchSend?.[1]
      if (!businessId) {
        json(res, 404, { error: 'Not found' })
        return
      }

      const authorized = await verifyHttpAuth(normalizeHeaders(req), config.bridgeSecret, businessId)
      if (!authorized) {
        json(res, 401, { error: 'Unauthorized' })
        return
      }

      if (req.method === 'POST' && match && match[2] === 'start') {
        await manager.connect(businessId)
        const status = manager.getStatus(businessId)
        json(res, 200, { success: true, ...status })
        return
      }

      if (req.method === 'GET' && match && match[2] === 'status') {
        const status = manager.getStatus(businessId)
        json(res, 200, { success: true, ...status })
        return
      }

      if (req.method === 'POST' && match && match[2] === 'reconnect') {
        await manager.reconnect(businessId)
        const status = manager.getStatus(businessId)
        json(res, 200, { success: true, ...status })
        return
      }

      if (req.method === 'GET' && match && match[2] === 'health') {
        const health = manager.getHealth(businessId)
        json(res, 200, { success: true, health })
        return
      }

      if (req.method === 'DELETE' && match && match[2] === 'logout') {
        await manager.disconnect(businessId)
        json(res, 200, { success: true, status: 'disconnected' })
        return
      }

      if (req.method === 'POST' && matchSend) {
        const body = JSON.parse(await readBody(req)) as {
          to?: string
          content?: string
          imageUrl?: string
          interactive?: InteractiveComponent
        }
        if (!body.to || !body.content) {
          json(res, 400, { error: 'Missing to or content' })
          return
        }
        const result = await manager.sendMessage(
          businessId,
          body.to,
          body.content,
          body.imageUrl,
          body.interactive
        )
        json(res, result.success ? 200 : 400, result)
        return
      }

      json(res, 404, { error: 'Not found' })
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : 'Internal error' })
    }
  })

  const wss = new WebSocketServer({ server, path: '/v1/ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      const businessId = url.searchParams.get('businessId')
      const token = url.searchParams.get('token')

      if (!businessId || !token) {
        ws.close(4401, 'Unauthorized')
        return
      }

      const ok = await verifyWsAuth(token, config.bridgeSecret, businessId)
      if (!ok) {
        ws.close(4401, 'Unauthorized')
        return
      }

      const unsubscribe = manager.subscribe(businessId, (event: SessionEvent) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(event))
        }
      })

      const initial = manager.getStatus(businessId)
      ws.send(JSON.stringify({ type: 'status', status: initial.status, phone: initial.phone ?? undefined }))

      ws.on('close', unsubscribe)
    })()
  })

  server.listen(config.port, () => {
    console.log(`[mia-bridge] listening on :${config.port}`)
  })

  return server
}

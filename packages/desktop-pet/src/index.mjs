// Desktop pet Node half: SSE events + static assets + presence.
// Registers HTTP endpoints with the DSH webServer.
import { readFileSync, mkdirSync, renameSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { registerSettings, NAMESPACE, DEFAULTS } from './settings.mjs'

export const name = 'desktop-pet'
export const inject = ['jobs', 'agents', 'sessions', 'settings', 'webServer']

export function apply(ctx) {
  const webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  const settings = typeof ctx.get === 'function' ? ctx.get('settings') : undefined
  const jobs = typeof ctx.get === 'function' ? ctx.get('jobs') : undefined
  const sessions = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined

  // Config
  let configRef = { ...DEFAULTS }
  const configScope = registerSettings(settings)
  if (configScope) {
    configRef = { ...DEFAULTS, ...configScope.get() }
    configScope.watch((next) => { configRef = { ...DEFAULTS, ...next } })
  }

  // SSE clients
  const sseClients = new Set()
  const broadcast = (data) => {
    const line = `data: ${JSON.stringify(data)}\n\n`
    for (const res of sseClients) {
      try { res.write(line) } catch { sseClients.delete(res) }
    }
  }

  // Presence
  let companionUntil = 0
  const PRESENCE_TTL_MS = 45000
  const pokePresence = (online) => {
    companionUntil = online ? Date.now() + PRESENCE_TTL_MS : 0
    return companionOnline()
  }
  const companionOnline = () => Date.now() < companionUntil

  // Event broadcasting from DSH events
  const disposers = []

  if (jobs && typeof jobs.onJobDone === 'function') {
    disposers.push(jobs.onJobDone((snapshot) => {
      const now = Date.now()
      if (snapshot.status === 'completed') {
        broadcast({ type: 'task-done', label: snapshot.label, sessionId: snapshot.sessionId, timestamp: now })
      } else if (snapshot.status === 'failed') {
        broadcast({ type: 'task-failed', label: snapshot.label, sessionId: snapshot.sessionId, timestamp: now })
      }
    }))
  }

  if (typeof ctx.on === 'function') {
    disposers.push(ctx.on('agent/session-start', (payload) => {
      broadcast({ type: 'welcome', source: payload?.source, sessionId: payload?.sessionId, timestamp: Date.now() })
    }))
    disposers.push(ctx.on('agent/request-error', () => {
      broadcast({ type: 'error', timestamp: Date.now() })
    }))
  }

  if (sessions && typeof sessions.list === 'function') {
    disposers.push(ctx.on('session/event', (session, event) => {
      const id = typeof session?.id === 'string' ? session.id : null
      if (id && event?.type === 'turn/end') {
        broadcast({ type: 'celebrate', sessionId: id, timestamp: Date.now() })
      }
    }))
  }

  // Register HTTP routes
  if (webServer !== undefined) {
    const ASSETS_DIR = join(import.meta.dirname, 'assets')

    // SSE events endpoint
    disposers.push(webServer.register({
      kind: 'prefix',
      path: '/desktop-pet',
      handler: async (req, res) => {
        const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname

        // SSE endpoint
        if (urlPath === '/desktop-pet/events' && req.method === 'GET') {
          res.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
            'x-accel-buffering': 'no',
          })
          res.flushHeaders?.()
          res.write('retry: 3000\n\n')
          sseClients.add(res)

          const heartbeat = setInterval(() => {
            try { res.write(': ping\n\n') } catch {}
          }, 25000)

          req.on('close', () => {
            clearInterval(heartbeat)
            sseClients.delete(res)
          })
          return
        }

        // Presence endpoint
        if (urlPath === '/desktop-pet/presence' && req.method === 'POST') {
          let body = ''
          for await (const chunk of req) body += chunk
          let data = {}
          try { data = JSON.parse(body || '{}') } catch {}
          const online = data.online !== false
          const result = pokePresence(online)
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ online: result }))
          return
        }

        // Static assets
        if (urlPath.startsWith('/desktop-pet/assets/') && req.method === 'GET') {
          const rel = urlPath.slice('/desktop-pet/assets/'.length)
          if (rel.includes('..') || rel.includes('\\')) {
            res.writeHead(403); res.end(); return
          }
          try {
            const data = readFileSync(join(ASSETS_DIR, rel))
            const ext = rel.lastIndexOf('.') > -1 ? rel.slice(rel.lastIndexOf('.')).toLowerCase() : ''
            const mime = { '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream'
            res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-cache, must-revalidate' })
            res.end(data)
          } catch {
            res.writeHead(404); res.end()
          }
          return
        }

        res.writeHead(404); res.end()
      },
    }))

    // Web GUI injection: inject pet client into the main HTML page
    disposers.push(webServer.tapIndex((html) => {
      if (!configRef.enabled) return html
      return html.replace(
        '</body>',
        `<script type="module" src="/desktop-pet/assets/client.js"></script></body>`
      )
    }))
  }

  return () => {
    for (const d of disposers) d()
    for (const res of sseClients) {
      try { res.end() } catch {}
    }
  }
}

/**
 * HTTP application — router + middleware.
 *
 * Composes route modules and handles CORS / error wrapping.
 * To add a new route group, import its handler and add to `routeHandlers`.
 */
import http from 'node:http'
import { json } from './lib/http.mjs'
import { handleTaskRoutes } from './routes/tasks.mjs'
import { handleRunRoutes } from './routes/runs.mjs'

// Ordered list of route handlers. Each receives (req, res, pathname) and
// returns `true` (or a truthy value) if it handled the request, or `false`
// to pass to the next handler.
const routeHandlers = [handleTaskRoutes, handleRunRoutes]

export function createApp() {
  return http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      return res.end()
    }

    const url = new URL(req.url, 'http://localhost')
    const { pathname } = url

    try {
      for (const handler of routeHandlers) {
        const handled = await handler(req, res, pathname)
        if (handled !== false) return
      }
      // No handler matched
      json(res, 404, { error: 'not found' })
    } catch (e) {
      console.error(e)
      json(res, 500, { error: String(e.message || e) })
    }
  })
}

/**
 * HTTP application — router + middleware.
 *
 * Composes route modules and handles CORS / error wrapping.
 * To add a new route group, import its handler and add to `routeHandlers`.
 *
 * In production mode (when a dist/ build exists), also serves static
 * assets and SSR — everything on a single port.
 */
import http from 'node:http'
import { json } from '../infrastructure/http/http.mjs'
import {
  handleSSR,
  hasProductionBuild,
  serveStaticFile,
} from '../infrastructure/static/static-server.mjs'
import { routeHandlers } from './router.mjs'

export function createApp() {
  const isProduction = hasProductionBuild()

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
      // API routes first
      for (const handler of routeHandlers) {
        const handled = await handler(req, res, pathname)
        if (handled !== false) return
      }

      // In production, serve static assets then fall through to SSR
      if (isProduction) {
        if (serveStaticFile(req, res, pathname)) return
        return await handleSSR(req, res)
      }

      json(res, 404, { error: 'not found' })
    } catch (e) {
      console.error(e)
      json(res, 500, { error: String(e.message || e) })
    }
  })
}

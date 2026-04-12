/**
 * Static file serving for production mode.
 *
 * Serves pre-built Vite assets from dist/client/ and delegates
 * non-API, non-static requests to the TanStack Start SSR handler.
 */

import { createReadStream, existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST_DIR = resolve(__dirname, '../../../../client/dist')
const CLIENT_DIR = join(DIST_DIR, 'client')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
}

/**
 * Check whether a production build exists.
 */
export function hasProductionBuild() {
  return existsSync(CLIENT_DIR) && existsSync(join(DIST_DIR, 'server', 'server.js'))
}

/**
 * Try to serve a static file from dist/client/.
 * Returns true if handled, false otherwise.
 */
export function serveStaticFile(_req, res, pathname) {
  // Prevent directory traversal — normalize first, then verify containment.
  const filePath = resolve(CLIENT_DIR, pathname.slice(1))
  if (!filePath.startsWith(CLIENT_DIR)) return false
  if (!existsSync(filePath)) return false

  const ext = extname(filePath)
  // Don't serve directories
  if (!ext) return false

  const mime = MIME_TYPES[ext] || 'application/octet-stream'
  const cacheControl = pathname.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable' // hashed filenames
    : 'public, max-age=3600'

  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': cacheControl,
  })
  createReadStream(filePath).pipe(res)
  return true
}

/**
 * Load the TanStack Start SSR handler and return a function that
 * converts a node:http request into a Web Response via the SSR entry.
 */
let ssrHandler = null

export async function loadSSRHandler() {
  if (ssrHandler) return ssrHandler
  const serverEntry = join(DIST_DIR, 'server', 'server.js')
  const mod = await import(serverEntry)
  const entry = mod.default || mod
  ssrHandler = entry.fetch || entry
  return ssrHandler
}

/**
 * Handle a request through SSR.
 * Converts node IncomingMessage → Web Request → SSR → pipe Web Response back.
 */
export async function handleSSR(req, res) {
  const handler = await loadSSRHandler()
  const protocol = req.socket.encrypted ? 'https' : 'http'
  const host = req.headers.host || 'localhost'
  const url = new URL(req.url, `${protocol}://${host}`)

  const webRequest = new Request(url.href, {
    method: req.method,
    headers: Object.fromEntries(Object.entries(req.headers).filter(([, v]) => v != null)),
    body: req.method !== 'GET' && req.method !== 'HEAD' ? Readable.toWeb(req) : undefined,
    duplex: 'half',
  })

  const webResponse = await handler(webRequest)

  res.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))

  if (webResponse.body) {
    const nodeStream = Readable.fromWeb(webResponse.body)
    nodeStream.pipe(res)
  } else {
    res.end()
  }
}

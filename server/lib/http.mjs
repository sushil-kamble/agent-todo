/**
 * Shared HTTP utilities for the API server.
 * Pure functions — no state, no side-effects beyond writing to `res`.
 */

/**
 * Send a JSON response with CORS headers.
 */
export function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(body))
}

const MAX_BODY_BYTES = 1024 * 1024 // 1 MB

/**
 * Read and parse the JSON body from a request.
 * Returns `{}` for empty bodies. Rejects if the body exceeds 1 MB.
 */
export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    req.on('data', c => {
      bytes += c.length
      if (bytes > MAX_BODY_BYTES) {
        req.destroy()
        return reject(new Error('request body too large'))
      }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

/**
 * Write SSE response headers.
 */
export function sseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
}

/**
 * Send a single SSE data frame.
 */
export function sseSend(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

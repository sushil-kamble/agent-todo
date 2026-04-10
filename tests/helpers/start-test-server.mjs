import { once } from 'node:events'
import { createApp } from '../../server/app.mjs'

export async function startTestServer() {
  const app = createApp()
  app.listen(0, '127.0.0.1')
  await once(app, 'listening')

  const address = app.address()
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine test server address')
  }

  const baseUrl = `http://127.0.0.1:${address.port}`

  return {
    app,
    baseUrl,
    request(path, init) {
      return fetch(`${baseUrl}${path}`, init)
    },
    async json(path, init) {
      const response = await fetch(`${baseUrl}${path}`, init)
      const body = await response.json()
      return { response, status: response.status, body }
    },
    close() {
      return new Promise((resolve, reject) => {
        app.close(err => {
          if (err) reject(err)
          else resolve()
        })
      })
    },
  }
}

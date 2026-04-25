#!/usr/bin/env node

/**
 * CLI entry point for agentodo.
 *
 * Usage:
 *   npx agentodo [--port 3737] [--no-open]
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function parseArgs(argv) {
  const args = { port: 3737, open: true }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) {
      args.port = Number(argv[++i])
    } else if (argv[i] === '--no-open') {
      args.open = false
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(`
  agentodo — AI-powered task board

  Usage:
    npx agentodo [options]

  Options:
    --port <number>   Port to listen on (default: 3737)
    --no-open         Don't open the browser automatically
    -h, --help        Show this help message
`)
      process.exit(0)
    }
  }
  return args
}

function openBrowser(url) {
  const cmds = {
    darwin: ['open'],
    win32: ['cmd', '/c', 'start'],
    linux: ['xdg-open'],
  }
  const parts = cmds[process.platform]
  if (!parts) return
  try {
    execFileSync(parts[0], [...parts.slice(1), url], { stdio: 'ignore' })
  } catch {
    // Non-fatal — user can open manually
  }
}

const args = parseArgs(process.argv)

const clientDir = resolve(ROOT, 'packages', 'client', 'dist', 'client')
if (!existsSync(clientDir)) {
  console.error('\n  Build not found. Run `npm run build` first, then try again.\n')
  process.exit(1)
}

process.env.PORT = String(args.port)

const { createApp } = await import(
  resolve(ROOT, 'packages', 'server', 'src', 'app', 'http-server.mjs')
)
const { seedIfEmpty } = await import(
  resolve(ROOT, 'packages', 'server', 'src', 'domains', 'tasks', 'task.repository.mjs')
)

seedIfEmpty()

const app = createApp()
app.listen(args.port, () => {
  const url = `http://localhost:${args.port}`
  console.log()
  console.log(`  agentodo is running at ${url}`)
  console.log()

  if (args.open) openBrowser(url)
})

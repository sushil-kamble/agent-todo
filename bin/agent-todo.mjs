#!/usr/bin/env node

/**
 * CLI entry point for agent-todo.
 *
 * Usage:
 *   npx agent-todo [--port 3737] [--no-open]
 */

import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Arg parsing (zero deps) ────────────────────────────────────────

function parseArgs(argv) {
  const args = { port: 3737, open: true }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) {
      args.port = Number(argv[++i])
    } else if (argv[i] === '--no-open') {
      args.open = false
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(`
  agent-todo — AI-powered task board

  Usage:
    npx agent-todo [options]

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

// ── Browser open (cross-platform, zero deps) ───────────────────────

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

// ── Boot ────────────────────────────────────────────────────────────

const args = parseArgs(process.argv)

// Verify the build exists
const clientDir = resolve(ROOT, 'dist', 'client')
if (!existsSync(clientDir)) {
  console.error(
    '\n  Build not found. Run `npm run build` first, then try again.\n'
  )
  process.exit(1)
}

// Set port before importing server (modules may read process.env)
process.env.PORT = String(args.port)

const { createApp } = await import(resolve(ROOT, 'server', 'app.mjs'))
const { seedIfEmpty } = await import(resolve(ROOT, 'server', 'db', 'tasks.mjs'))

seedIfEmpty()

const app = createApp()
app.listen(args.port, () => {
  const url = `http://localhost:${args.port}`
  console.log()
  console.log(`  agent-todo is running at ${url}`)
  console.log()

  if (args.open) openBrowser(url)
})

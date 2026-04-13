/**
 * Editor API routes.
 *
 * GET  /api/editors            — list available (installed) editors
 * POST /api/editors/open       — open a path in a specific editor (new window)
 */
import { spawn } from 'node:child_process'
import { json, readBody } from '#infra/http/http.mjs'

/**
 * Editor definitions: id, display label, CLI commands to try, and args
 * for opening a directory in a new window.
 */
const EDITORS = [
  { id: 'vscode', label: 'VS Code', commands: ['code'], newWindowFlag: '--new-window' },
  { id: 'cursor', label: 'Cursor', commands: ['cursor'], newWindowFlag: '--new-window' },
  { id: 'antigravity', label: 'AntiGravity', commands: ['agy'], newWindowFlag: '--new-window' },
]

/**
 * Check if a CLI command is available on the system PATH.
 */
function isCommandAvailable(command) {
  const whichCmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    const result = spawn(whichCmd, [command], { stdio: 'pipe', timeout: 3000 })
    return new Promise(resolve => {
      result.on('close', code => resolve(code === 0))
      result.on('error', () => resolve(false))
    })
  } catch {
    return Promise.resolve(false)
  }
}

/**
 * Resolve which editors are installed on this system.
 */
async function resolveAvailableEditors() {
  const results = await Promise.all(
    EDITORS.map(async editor => {
      for (const cmd of editor.commands) {
        if (await isCommandAvailable(cmd)) {
          return { id: editor.id, label: editor.label, command: cmd }
        }
      }
      return null
    })
  )
  return results.filter(Boolean)
}

/**
 * Launch an editor as a detached process so the server isn't blocked.
 */
function launchEditor(command, args) {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32',
      })
      child.once('spawn', () => {
        child.unref()
        resolve()
      })
      child.once('error', cause => reject(new Error(`Failed to launch: ${cause.message}`)))
    } catch (e) {
      reject(e)
    }
  })
}

// Cache available editors (resolved once on first request)
let _cachedEditors = null

export async function handleEditorRoutes(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/editors') {
    if (!_cachedEditors) _cachedEditors = await resolveAvailableEditors()
    return json(res, 200, { editors: _cachedEditors })
  }

  if (req.method === 'POST' && pathname === '/api/editors/open') {
    const body = await readBody(req)
    const editorId = String(body.editor || '').trim()
    const cwd = String(body.cwd || '').trim()

    if (!editorId || !cwd) {
      return json(res, 400, { error: 'editor and cwd are required' })
    }

    const editorDef = EDITORS.find(e => e.id === editorId)
    if (!editorDef) {
      return json(res, 400, { error: `Unknown editor: ${editorId}` })
    }

    // Find the first available command for this editor
    let resolvedCommand = null
    for (const cmd of editorDef.commands) {
      if (await isCommandAvailable(cmd)) {
        resolvedCommand = cmd
        break
      }
    }

    if (!resolvedCommand) {
      return json(res, 404, { error: `Editor not installed: ${editorDef.label}` })
    }

    try {
      await launchEditor(resolvedCommand, [editorDef.newWindowFlag, cwd])
      return json(res, 200, { ok: true })
    } catch (e) {
      return json(res, 500, { error: e.message })
    }
  }

  return false
}

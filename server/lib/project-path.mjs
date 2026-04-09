import { statSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function unique(values) {
  return [...new Set(values)]
}

function candidateRoots() {
  const cwd = process.cwd()
  const parent = dirname(cwd)
  const grandparent = dirname(parent)
  return unique([cwd, parent, grandparent, join(homedir(), 'Projects')])
}

function findNamedDirectory(root, targetName, maxDepth) {
  if (!isDirectory(root) || maxDepth < 0) return null

  let entries = []
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const fullPath = join(root, entry.name)
    if (entry.name === targetName) return fullPath
  }

  if (maxDepth === 0) return null

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const nested = findNamedDirectory(join(root, entry.name), targetName, maxDepth - 1)
    if (nested) return nested
  }

  return null
}

export function normalizeProjectPath(input) {
  const value = String(input ?? '').trim()
  if (!value) return value

  if (isAbsolute(value)) return resolve(value)

  const roots = candidateRoots()

  for (const root of roots) {
    const direct = resolve(root, value)
    if (isDirectory(direct)) return direct
  }

  if (!value.includes('/') && !value.includes('\\')) {
    for (const root of roots) {
      const found = findNamedDirectory(root, value, 3)
      if (found) return found
    }
  }

  return value
}

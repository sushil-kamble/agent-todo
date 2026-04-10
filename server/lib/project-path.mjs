import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

const resolvedPathCache = new Map();
const pendingResolutions = new Map();

export function __resetProjectPathCacheForTests() {
  resolvedPathCache.clear();
  pendingResolutions.clear();
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function unique(values) {
  return [...new Set(values)];
}

function candidateRoots() {
  const cwd = process.cwd();
  const parent = dirname(cwd);
  const grandparent = dirname(parent);
  return unique([cwd, parent, grandparent, join(homedir(), "Projects")]);
}

async function findNamedDirectory(root, targetName, maxDepth) {
  if (!(await isDirectory(root)) || maxDepth < 0) return null;

  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === targetName) return join(root, entry.name);
  }

  if (maxDepth === 0) return null;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = await findNamedDirectory(
      join(root, entry.name),
      targetName,
      maxDepth - 1,
    );
    if (nested) return nested;
  }

  return null;
}

export async function normalizeProjectPath(input) {
  const value = String(input ?? "").trim();
  if (!value) return value;

  if (resolvedPathCache.has(value)) return resolvedPathCache.get(value);
  if (pendingResolutions.has(value)) return pendingResolutions.get(value);

  const resolution = (async () => {
    if (isAbsolute(value)) {
      const resolved = resolve(value);
      resolvedPathCache.set(value, resolved);
      return resolved;
    }

    const roots = candidateRoots();

    for (const root of roots) {
      const direct = resolve(root, value);
      if (await isDirectory(direct)) {
        resolvedPathCache.set(value, direct);
        return direct;
      }
    }

    if (!value.includes("/") && !value.includes("\\")) {
      for (const root of roots) {
        const found = await findNamedDirectory(root, value, 3);
        if (found) {
          resolvedPathCache.set(value, found);
          return found;
        }
      }
    }

    resolvedPathCache.set(value, value);
    return value;
  })();

  pendingResolutions.set(value, resolution);
  try {
    return await resolution;
  } finally {
    pendingResolutions.delete(value);
  }
}

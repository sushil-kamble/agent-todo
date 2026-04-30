export function dedupeProjectsByPath(projects) {
  const seenPaths = new Set()
  return projects.filter(project => {
    if (seenPaths.has(project.path)) return false
    seenPaths.add(project.path)
    return true
  })
}

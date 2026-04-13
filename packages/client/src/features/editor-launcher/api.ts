export type EditorInfo = {
  id: string
  label: string
  command: string
}

export async function fetchAvailableEditors(): Promise<EditorInfo[]> {
  const response = await fetch('/api/editors')
  const body = (await response.json()) as { editors: EditorInfo[] }
  return body.editors
}

export async function openInEditor(editor: string, cwd: string): Promise<void> {
  const response = await fetch('/api/editors/open', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ editor, cwd }),
  })
  if (!response.ok) {
    const body = (await response.json()) as { error: string }
    throw new Error(body.error)
  }
}

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatProjectPathLabel(path: string) {
  const trimmed = path.trim()
  if (!trimmed) return 'Untitled'
  if (trimmed === 'untitled') return 'Untitled'

  const lastSegment = trimmed.split(/[\\/]/).filter(Boolean).at(-1) ?? trimmed
  const normalized = lastSegment
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()

  if (!normalized) return 'Untitled'

  return normalized
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

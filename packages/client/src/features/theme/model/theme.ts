import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'agentodo-theme'
const LIGHT_BACKGROUND = '#f2f1ed'
const LIGHT_FOREGROUND = '#26251e'
const DARK_BACKGROUND = '#26251e'
const DARK_FOREGROUND = '#f2f1ed'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeSurface(theme: Theme) {
  const background = theme === 'dark' ? DARK_BACKGROUND : LIGHT_BACKGROUND
  const foreground = theme === 'dark' ? DARK_FOREGROUND : LIGHT_FOREGROUND
  const root = document.documentElement

  root.style.backgroundColor = background
  root.style.color = foreground

  if (document.body) {
    document.body.style.backgroundColor = background
    document.body.style.color = foreground
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
  root.style.colorScheme = theme
  applyThemeSurface(theme)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const initial = readStoredTheme()
    setTheme(initial)
    applyTheme(initial)
  }, [])

  function toggleTheme() {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem(STORAGE_KEY, next)
      applyTheme(next)
      return next
    })
  }

  return { theme, toggleTheme }
}

export const themeCriticalStyle = `html,body{background:${LIGHT_BACKGROUND};color:${LIGHT_FOREGROUND}}@media (prefers-color-scheme: dark){html,body{background:${DARK_BACKGROUND};color:${DARK_FOREGROUND};color-scheme:dark}}html.light,html.light body{background:${LIGHT_BACKGROUND};color:${LIGHT_FOREGROUND}}html.dark,html.dark body{background:${DARK_BACKGROUND};color:${DARK_FOREGROUND}}`

export const themeInitScript = `(function(){try{var k='${STORAGE_KEY}';var s=localStorage.getItem(k);var t=(s==='light'||s==='dark')?s:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var r=document.documentElement;var bg=t==='dark'?'${DARK_BACKGROUND}':'${LIGHT_BACKGROUND}';var fg=t==='dark'?'${DARK_FOREGROUND}':'${LIGHT_FOREGROUND}';r.classList.remove('light','dark');r.classList.add(t);r.style.colorScheme=t;r.style.backgroundColor=bg;r.style.color=fg;if(document.body){document.body.style.backgroundColor=bg;document.body.style.color=fg;}}catch(e){}})();`

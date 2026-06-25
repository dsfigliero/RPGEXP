import { useState, useEffect } from 'react'

const THEMES = [
  { id: 'dark',        label: '🌑 Escuro' },
  { id: 'light',       label: '☀️ Claro' },
  { id: 'pathfinder',  label: '⚔️ Pathfinder' },
]

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('rpg-theme')
    return saved || 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('rpg-theme', theme)
  }, [theme])

  // Apply on first render (before any effect fires)
  useEffect(() => { applyTheme(theme) }, [])

  return { theme, setTheme, themes: THEMES }
}

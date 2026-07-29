'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const init = useRef(false)

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  useEffect(() => {
    if (init.current) return
    init.current = true
    const stored = localStorage.getItem('mia-theme') as Theme | null
    if (stored === 'light' || stored === 'dark') {
      queueMicrotask(() => setTheme(stored))
    }
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    localStorage.setItem('mia-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

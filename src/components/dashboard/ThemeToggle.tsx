'use client'

import { useEffect, useState, useRef } from 'react'
import { useTheme } from './ThemeProvider'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const [mounted, setMounted] = useState(false)
  const init = useRef(false)

  useEffect(() => {
    if (init.current) return
    init.current = true
    queueMicrotask(() => setMounted(true))
  }, [])

  if (!mounted) {
    return <div className="h-7 w-7" />
  }

  return (
    <button
      onClick={toggle}
      className="flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200"
      style={{
        color: 'var(--atmosphere-text-secondary)',
        backgroundColor: 'transparent',
      }}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  )
}

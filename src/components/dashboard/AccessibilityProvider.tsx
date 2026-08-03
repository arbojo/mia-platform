'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  normalizeAccessibilityPreferences,
  type AccessibilityPreferences,
} from '@/lib/system/accessibility'

const AccessibilityContext = createContext<{
  preferences: AccessibilityPreferences
  loaded: boolean
  update: (patch: Partial<AccessibilityPreferences>) => Promise<void>
}>({
  preferences: DEFAULT_ACCESSIBILITY_PREFERENCES,
  loaded: false,
  update: async () => {},
})

function applyToDocument(preferences: AccessibilityPreferences) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-mirror-layout', preferences.mirror_layout ? 'true' : 'false')
  root.setAttribute('data-optical', preferences.optical_mode ? 'true' : 'false')
  root.setAttribute('data-font-weight', preferences.font_weight)
  root.setAttribute('data-color-temp', preferences.color_temperature)
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    DEFAULT_ACCESSIBILITY_PREFERENCES,
  )
  const [loaded, setLoaded] = useState(false)
  const latestRef = useRef<AccessibilityPreferences>(DEFAULT_ACCESSIBILITY_PREFERENCES)

  useEffect(() => {
    latestRef.current = preferences
  }, [preferences])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/accessibility', { cache: 'no-store' })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? 'Error al cargar preferencias')
        }
        const data = (await res.json()) as { preferences?: unknown }
        const next = normalizeAccessibilityPreferences(data?.preferences)
        if (!cancelled) {
          latestRef.current = next
          setPreferences(next)
          applyToDocument(next)
        }
      } catch {
        if (!cancelled) applyToDocument(DEFAULT_ACCESSIBILITY_PREFERENCES)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const update = useCallback(async (patch: Partial<AccessibilityPreferences>) => {
    const optimistic = normalizeAccessibilityPreferences({ ...latestRef.current, ...patch })
    latestRef.current = optimistic
    applyToDocument(optimistic)

    try {
      const res = await fetch('/api/accessibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimistic),
        cache: 'no-store',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Error al guardar preferencias')
      }
      const data = (await res.json()) as { preferences?: unknown }
      const saved = normalizeAccessibilityPreferences(data?.preferences)
      latestRef.current = saved
      setPreferences(saved)
      applyToDocument(saved)
    } catch {
      // Reintenta cargando el estado persistido.
      const res = await fetch('/api/accessibility', { cache: 'no-store' }).catch(() => null)
      if (!res) return
      const data = (await res.json()) as { preferences?: unknown }
      const server = normalizeAccessibilityPreferences(data?.preferences)
      latestRef.current = server
      setPreferences(server)
      applyToDocument(server)
    }
  }, [])

  return (
    <AccessibilityContext.Provider value={{ preferences, loaded, update }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  return useContext(AccessibilityContext)
}

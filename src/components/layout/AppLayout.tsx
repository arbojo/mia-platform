'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/dashboard/ThemeProvider'
import { Package, ShoppingBag, Truck, type LucideIcon } from 'lucide-react'

export type ModuleKey = 'sales' | 'inventory' | 'logistics'

interface ModuleMeta {
  label: string
  description: string
  icon: LucideIcon
}

export const MODULES: Record<ModuleKey, ModuleMeta> = {
  sales: { label: 'Ventas', description: 'Comercial, catálogo y cierre', icon: ShoppingBag },
  inventory: { label: 'Inventario', description: 'Stock y existencias', icon: Package },
  logistics: { label: 'Logística', description: 'Delivery y envíos', icon: Truck },
}

const MODULE_KEYS: ModuleKey[] = ['sales', 'inventory', 'logistics']

const ModuleContext = createContext<{
  activeModule: ModuleKey
  setModule: (m: ModuleKey) => void
}>({ activeModule: 'sales', setModule: () => {} })

export function useModule() {
  return useContext(ModuleContext)
}

function detectModule(pathname: string): ModuleKey {
  if (pathname.startsWith('/dashboard/delivery')) return 'logistics'
  if (pathname.startsWith('/dashboard/inventory')) return 'inventory'
  return 'sales'
}

function isModuleKey(value: string | null): value is ModuleKey {
  return value === 'sales' || value === 'inventory' || value === 'logistics'
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  const pathname = usePathname()
  const [manual, setManual] = useState<ModuleKey | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = localStorage.getItem('mia-module')
    return isModuleKey(stored) ? stored : null
  })

  const activeModule: ModuleKey = manual ?? detectModule(pathname)

  const selectModule = useCallback((m: ModuleKey) => {
    setManual(m)
    localStorage.setItem('mia-module', m)
  }, [])

  return (
    <ModuleContext.Provider value={{ activeModule, setModule: selectModule }}>
      <div
        data-layout-root
        data-theme={theme}
        data-module={activeModule}
        className="flex min-h-screen"
        style={{
          backgroundColor: 'var(--atmosphere-bg)',
          backgroundImage: 'var(--atmosphere-gradient)',
          color: 'var(--atmosphere-text)',
          transition: 'background-color 0.6s ease, background-image 0.6s ease',
        }}
      >
        {children}
      </div>
    </ModuleContext.Provider>
  )
}

export function ModuleSelector() {
  const { activeModule, setModule } = useModule()

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border p-0.5"
      style={{
        borderColor: 'var(--atmosphere-border)',
        backgroundColor: 'var(--elevation-1)',
      }}
      role="group"
      aria-label="Contexto por módulo"
    >
      {MODULE_KEYS.map((key) => {
        const meta = MODULES[key]
        const active = key === activeModule
        const Icon = meta.icon
        return (
          <button
            key={key}
            type="button"
            onClick={() => setModule(key)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200"
            style={{
              color: active ? 'var(--module-accent-strong)' : 'var(--atmosphere-text-secondary)',
              backgroundColor: active ? 'var(--module-accent-soft)' : 'transparent',
              boxShadow: active ? '0 0 12px var(--module-glow-soft)' : 'none',
            }}
            title={meta.description}
            aria-pressed={active}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{meta.label}</span>
          </button>
        )
      })}
    </div>
  )
}

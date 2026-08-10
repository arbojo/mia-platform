'use client'

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from 'react'
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

const moduleListeners = new Set<() => void>()

function subscribe(callback: () => void): () => void {
  moduleListeners.add(callback)
  return () => {
    moduleListeners.delete(callback)
  }
}

function getModuleSnapshot(): ModuleKey | null {
  const stored = localStorage.getItem('mia-module')
  return isModuleKey(stored) ? stored : null
}

function getServerSnapshot(): ModuleKey | null {
  return null
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  const pathname = usePathname()
  const manual = useSyncExternalStore(
    subscribe,
    getModuleSnapshot,
    getServerSnapshot
  )

  const activeModule: ModuleKey = manual ?? detectModule(pathname)

  const selectModule = useCallback((m: ModuleKey) => {
    localStorage.setItem('mia-module', m)
    moduleListeners.forEach((listener) => listener())
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

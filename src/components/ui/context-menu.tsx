'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ContextMenuItemDef {
  label: string
  icon?: LucideIcon
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  heading?: boolean
  checked?: boolean
  onSelect?: () => void
}

export type ContextMenuItems = Array<ContextMenuItemDef | 'separator'>

interface MenuState {
  x: number
  y: number
  items: ContextMenuItems
}

interface ContextMenuContextValue {
  openMenu: (event: ReactMouseEvent, items: ContextMenuItems) => void
  closeMenu: () => void
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null)

const MENU_PADDING = 8
const SEPARATOR = 'separator'

function isSeparator(item: ContextMenuItemDef | 'separator'): item is 'separator' {
  return item === SEPARATOR
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const panelRef = useRef<HTMLDivElement>(null)

  const items = menu?.items

  const closeMenu = useCallback(() => setMenu(null), [])

  const openMenu = useCallback((event: ReactMouseEvent, nextItems: ContextMenuItems) => {
    event.preventDefault()
    event.stopPropagation()
    setActiveIndex(-1)
    setMenu({ x: event.clientX, y: event.clientY, items: nextItems })
  }, [])

  useLayoutEffect(() => {
    if (!menu) return
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const { innerWidth, innerHeight } = window
    let x = menu.x
    let y = menu.y
    if (x + rect.width > innerWidth - MENU_PADDING) {
      x = Math.max(MENU_PADDING, innerWidth - rect.width - MENU_PADDING)
    }
    if (y + rect.height > innerHeight - MENU_PADDING) {
      y = Math.max(MENU_PADDING, innerHeight - rect.height - MENU_PADDING)
    }
    if (x !== menu.x || y !== menu.y) {
      setMenu((m) => (m ? { ...m, x, y } : m))
    }
  }, [menu])

  useEffect(() => {
    if (!items) return
    panelRef.current?.focus()
  }, [items])

  useEffect(() => {
    if (!menu) return
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('blur', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('blur', closeMenu)
    }
  }, [menu, closeMenu])

  const enabledIndexes = useMemo(() => {
    if (!items) return []
    return items
      .map((item, index) =>
        isSeparator(item) || item.heading || item.disabled ? -1 : index
      )
      .filter((index) => index !== -1)
  }, [items])

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const indexes = enabledIndexes
    if (indexes.length === 0) return
    const current = activeIndex
    let next = current
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const pos = indexes.indexOf(current)
      next = indexes[(pos + 1) % indexes.length]
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const pos = indexes.indexOf(current)
      next = indexes[(pos - 1 + indexes.length) % indexes.length]
    } else if (e.key === 'Home') {
      e.preventDefault()
      next = indexes[0]
    } else if (e.key === 'End') {
      e.preventDefault()
      next = indexes[indexes.length - 1]
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const item = current >= 0 && items ? items[current] : null
      if (item && !isSeparator(item)) {
        item.onSelect?.()
        closeMenu()
      }
      return
    } else {
      return
    }
    setActiveIndex(next)
  }

  const value = useMemo<ContextMenuContextValue>(
    () => ({ openMenu, closeMenu }),
    [openMenu, closeMenu]
  )

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      {menu && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              className="outline-none"
              style={{
                position: 'fixed',
                left: menu.x,
                top: menu.y,
                zIndex: 999,
                minWidth: '14rem',
                padding: 6,
                borderRadius: 'var(--mod-radius-md)',
                backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 88%, transparent)',
                border: '1px solid var(--atmosphere-border)',
                boxShadow:
                  '0 0 0 1px var(--module-accent-border), 0 8px 32px rgba(0,0,0,0.35), 0 0 24px var(--module-glow-soft)',
                backdropFilter: 'blur(20px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                animation: 'fade-lift-in var(--duration-fast, 150ms) var(--ease-premium)',
                transformOrigin: 'top left',
              }}
            >
              {menu.items.map((item, index) => {
                if (isSeparator(item)) {
                  return (
                    <div
                      key={`sep-${index}`}
                      className="my-1 h-px"
                      style={{ backgroundColor: 'var(--atmosphere-border)' }}
                    />
                  )
                }
                if (item.heading) {
                  return (
                    <div
                      key={`heading-${index}`}
                      className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
                    >
                      {item.label}
                    </div>
                  )
                }
                const Icon = item.icon
                const active = activeIndex === index
                return (
                  <button
                    key={`item-${index}`}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onPointerEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      if (item.disabled) return
                      item.onSelect?.()
                      closeMenu()
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium outline-none transition-colors duration-100',
                      item.disabled && 'cursor-not-allowed opacity-40'
                    )}
                    style={{
                      color: item.danger
                        ? 'var(--mia-orange)'
                        : active
                          ? 'var(--module-accent-strong)'
                          : 'var(--atmosphere-text)',
                      backgroundColor: active ? 'var(--module-accent-soft)' : 'transparent',
                    }}
                  >
                    {Icon && (
                      <Icon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{
                          color: item.danger
                            ? 'var(--mia-orange)'
                            : active
                              ? 'var(--module-accent)'
                              : 'var(--atmosphere-text-secondary)',
                        }}
                      />
                    )}
                    <span className="flex-1">{item.label}</span>
                    {item.checked && (
                      <Check className="h-3.5 w-3.5" style={{ color: 'var(--module-accent)' }} />
                    )}
                    {item.shortcut && (
                      <kbd
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: 'var(--elevation-1)',
                          color: 'var(--atmosphere-text-secondary)',
                        }}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>,
            document.body
          )
        : null}
    </ContextMenuContext.Provider>
  )
}

export function useContextMenu(): ContextMenuContextValue {
  const ctx = useContext(ContextMenuContext)
  if (!ctx) {
    throw new Error('useContextMenu debe usarse dentro de <ContextMenuProvider>')
  }
  return ctx
}

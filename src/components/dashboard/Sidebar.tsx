'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  HeartHandshake,
  BookOpen,
  Brain,
  FlaskConical,
  Settings,
  Users,
  ChevronDown,
  Cable,
  HeartPulse,
  Accessibility,
} from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '@/components/dashboard/I18nProvider'

export function Sidebar() {
  const pathname = usePathname()
  const { t } = useI18n()
  const [configOpen, setConfigOpen] = useState(false)

  const mainGroups = [
    {
      name: t.nav.today,
      items: [
        { href: '/dashboard', label: t.nav.commandCenter, question: t.nav.commandCenterQuestion, icon: LayoutDashboard, atmosphere: 'home' },
        { href: '/dashboard/conversations', label: t.nav.relations, question: t.nav.relationsQuestion, icon: HeartHandshake, atmosphere: 'conversations' },
      ],
    },
    {
      name: t.nav.learn,
      items: [
        { href: '/dashboard/knowledge', label: t.nav.memory, question: t.nav.memoryQuestion, icon: BookOpen, atmosphere: 'memory' },
        { href: '/dashboard/knowledge-studio', label: t.nav.thinking, question: t.nav.thinkingQuestion, icon: Brain, atmosphere: 'heuristic' },
      ],
    },
    {
      name: t.nav.grow,
      items: [
        { href: '/dashboard/laboratorio', label: t.nav.lab, question: t.nav.labQuestion, icon: FlaskConical, atmosphere: 'lab' },
      ],
    },
  ]

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="sidebar-panel flex h-screen w-64 flex-col border-r"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 98%, transparent)',
        borderColor: 'var(--atmosphere-border)',
      }}
    >
      <div className="flex flex-col items-start gap-1.5 px-5 pb-6 pt-8">
        <div className="flex items-center gap-3">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: 'var(--atmosphere-accent)',
              boxShadow: '0 0 8px var(--atmosphere-glow)',
              animation: 'pulse-mia 4s ease-in-out infinite',
            }}
          />
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            MIA
          </h1>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        {mainGroups.map((group) => (
          <div key={group.name}>
            <p
              className="mb-2 px-2 text-xs font-medium tracking-[0.1em]"
              style={{ color: 'var(--atmosphere-text)', opacity: 0.4 }}
            >
              {group.name}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} title={item.question}>
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      )}
                      style={{
                        color: active ? 'var(--atmosphere-accent)' : 'var(--atmosphere-text-secondary)',
                        backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                        boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{item.label}</span>
                        {active && (
                          <span
                            className="text-[10px] font-normal opacity-60"
                            style={{ color: 'var(--atmosphere-accent)' }}
                          >
                            {item.question}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        <div>
          <p
            className="mb-2 px-2 text-xs font-medium tracking-[0.1em]"
            style={{ color: 'var(--atmosphere-text)', opacity: 0.4 }}
          >
            {t.nav.settings}
          </p>
          <div className="space-y-0.5">
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200"
              style={{
                color: 'var(--atmosphere-text-secondary)',
              }}
            >
              <Settings className="h-4 w-4" />
              <span>{t.nav.adjustments}</span>
              <ChevronDown
                className="ml-auto h-3.5 w-3.5 transition-transform duration-200"
                style={{
                  transform: configOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>
            {configOpen && (
              <div className="ml-7 space-y-0.5 border-l pl-2"
                style={{ borderColor: 'var(--atmosphere-border)' }}>
                <Link href="/dashboard/connections" title={t.nav.connectionsTitle}>
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                    )}
                    style={{
                      color: isActive('/dashboard/connections') ? 'var(--atmosphere-accent)' : 'var(--atmosphere-text-secondary)',
                    }}
                  >
                    <Cable className="h-4 w-4" />
                    <span>{t.nav.connections}</span>
                  </div>
                </Link>
                <div className="pt-2">
                  <p
                    className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.12em]"
                    style={{ color: 'var(--atmosphere-text)', opacity: 0.3 }}
                  >
                    {t.nav.advanced}
                  </p>
                  <Link href="/dashboard/assistants" title={t.nav.councilTitle}>
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      )}
                      style={{
                        color: isActive('/dashboard/assistants') ? 'var(--atmosphere-accent)' : 'var(--atmosphere-text-secondary)',
                      }}
                    >
                      <Users className="h-4 w-4" />
                      <span>{t.nav.council}</span>
                    </div>
                  </Link>
                </div>
                <div className="pt-2">
                  <Link href="/dashboard/health" title={t.nav.healthTitle}>
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      )}
                      style={{
                        color: isActive('/dashboard/health') ? 'var(--atmosphere-accent)' : 'var(--atmosphere-text-secondary)',
                      }}
                    >
                      <HeartPulse className="h-4 w-4" />
                      <span>{t.nav.health}</span>
                    </div>
                  </Link>
                </div>
                <div className="pt-2">
                  <Link href="/dashboard/accessibility" title={t.nav.accessibilityTitle}>
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      )}
                      style={{
                        color: isActive('/dashboard/accessibility') ? 'var(--atmosphere-accent)' : 'var(--atmosphere-text-secondary)',
                      }}
                    >
                      <Accessibility className="h-4 w-4" />
                      <span>{t.nav.accessibility}</span>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </aside>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  HeartHandshake,
  BookOpen,
  Brain,
  FlaskConical,
  Users,
  Cable,
  HeartPulse,
  Accessibility,
  ShoppingBag,
  Truck,
  Package,
  Sparkles,
  CircleHelp,
  SlidersHorizontal,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@/components/dashboard/I18nProvider'
import { useModule, MODULES, type ModuleKey } from '@/components/layout/AppLayout'
import { useContextMenu, type ContextMenuItemDef, type ContextMenuItems } from '@/components/ui/context-menu'
import { useTour } from '@/components/tour/TourProvider'

const RAIL_WIDTH = 260

interface NavItem {
  href: string
  label: string
  question: string
  icon: LucideIcon
}

interface NavGroup {
  name: string
  items: NavItem[]
  tutorial?: boolean
}

export function ActivityRail() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()
  const { activeModule, setModule } = useModule()
  const { openMenu } = useContextMenu()
  const { startForPath } = useTour()

  const nav: Array<NavGroup> = [
    {
      name: t.nav.today,
      items: [
        {
          href: '/dashboard',
          label: t.nav.commandCenter,
          question: t.nav.commandCenterQuestion,
          icon: LayoutDashboard,
        },
        {
          href: '/dashboard/conversations',
          label: t.nav.relations,
          question: t.nav.relationsQuestion,
          icon: HeartHandshake,
        },
      ],
    },
    {
      name: t.nav.learn,
      items: [
        {
          href: '/dashboard/knowledge',
          label: t.nav.memory,
          question: t.nav.memoryQuestion,
          icon: BookOpen,
        },
        {
          href: '/dashboard/knowledge-studio',
          label: t.nav.thinking,
          question: t.nav.thinkingQuestion,
          icon: Brain,
        },
        {
          href: '/dashboard/catalog',
          label: t.nav.catalog,
          question: t.nav.catalogQuestion,
          icon: ShoppingBag,
        },
      ],
    },
    {
      name: t.nav.grow,
      items: [
        {
          href: '/dashboard/laboratorio',
          label: t.nav.lab,
          question: t.nav.labQuestion,
          icon: FlaskConical,
        },
        {
          href: '/dashboard/delivery',
          label: t.nav.delivery,
          question: t.nav.deliveryQuestion,
          icon: Truck,
        },
        {
          href: '/dashboard/inventory',
          label: t.nav.inventory,
          question: t.nav.inventoryQuestion,
          icon: Package,
        },
        {
          href: '/dashboard/analytics',
          label: t.nav.analytics,
          question: t.nav.analyticsQuestion,
          icon: BarChart3,
        },
      ],
    },
    {
      name: t.nav.settings,
      items: [
        {
          href: '/dashboard/settings',
          label: t.nav.salesSettings,
          question: t.nav.salesSettingsQuestion,
          icon: SlidersHorizontal,
        },
        {
          href: '/dashboard/connections',
          label: t.nav.connections,
          question: t.nav.connectionsTitle,
          icon: Cable,
        },
        {
          href: '/dashboard/assistants',
          label: t.nav.council,
          question: t.nav.councilTitle,
          icon: Users,
        },
        {
          href: '/dashboard/health',
          label: t.nav.health,
          question: t.nav.healthTitle,
          icon: HeartPulse,
        },
        {
          href: '/dashboard/accessibility',
          label: t.nav.accessibility,
          question: t.nav.accessibilityTitle,
          icon: Accessibility,
        },
      ],
      tutorial: true,
    },
  ]

  const moduleKeys = Object.keys(MODULES) as ModuleKey[]

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const moduleMenu: ContextMenuItems = moduleKeys.map((key) => ({
    label: MODULES[key].label,
    icon: MODULES[key].icon,
    checked: key === activeModule,
    onSelect: () => setModule(key),
  }))

  const powerMenu: ContextMenuItems = [
    ...nav.flatMap((group) => [
      { label: group.name, heading: true } as ContextMenuItemDef,
      ...group.items.map((item) => ({
        label: item.label,
        icon: item.icon,
        checked: isActive(item.href),
        onSelect: () => router.push(item.href),
      })),
    ]),
    'separator',
    { label: MODULES[activeModule].label, heading: true },
    ...moduleMenu,
  ]

  return (
    <aside
      onContextMenu={(e) => openMenu(e, powerMenu)}
      aria-label="Navegación"
      className="relative flex h-screen shrink-0 flex-col overflow-hidden border-r"
      style={{
        width: RAIL_WIDTH,
        borderColor: 'var(--atmosphere-border)',
        backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
        backdropFilter: 'blur(24px) saturate(1.4)',
      }}
    >
      <div
        className="flex shrink-0 items-center justify-center pt-6 pb-2"
        onContextMenu={(e) => openMenu(e, moduleMenu)}
      >
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors duration-200"
          title="MIA"
          style={{ color: 'var(--atmosphere-text)' }}
        >
          <Sparkles
            className="h-4 w-4"
            style={{ color: 'var(--module-accent)', filter: 'drop-shadow(0 0 6px var(--module-glow-soft))' }}
          />
          <span className="text-sm font-semibold tracking-tight">MIA</span>
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-2">
        {nav.map((group) => (
          <div key={group.name}>
            <p
              className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.5 }}
            >
              {group.name}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.question}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150'
                    )}
                    style={{
                      color: active
                        ? 'var(--module-accent-strong)'
                        : 'var(--atmosphere-text-secondary)',
                      backgroundColor: active ? 'var(--module-accent-soft)' : 'transparent',
                    }}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
                        style={{
                          backgroundColor: 'var(--module-accent)',
                          boxShadow: '0 0 8px var(--module-glow)',
                        }}
                      />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                )
              })}
              {group.tutorial && (
                <button
                  type="button"
                  data-tour="tutorial-button"
                  onClick={() => startForPath(pathname)}
                  className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                >
                  <CircleHelp className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{t.tour.tutorialButton}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

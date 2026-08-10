'use client'

import { useEffect, useRef } from 'react'
import { MessageSquare, UserPlus, BellRing, Sparkles, ArrowUpRight, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useContextMenu, type ContextMenuItems } from '@/components/ui/context-menu'

const iconMap: Record<string, LucideIcon> = {
  MessageSquare,
  UserPlus,
  BellRing,
  Sparkles,
}

interface VitalPresenceProps {
  value: number
  action: string
  meaning: string
  context: string
  trend?: { value: number; positive: boolean }
  color?: string
  icon?: string
  href?: string
}

export function VitalPresence({
  value,
  action,
  meaning,
  context,
  trend,
  color = 'var(--atmosphere-accent)',
  icon: iconName,
  href,
}: VitalPresenceProps) {
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { openMenu } = useContextMenu()
  const Icon = iconName ? iconMap[iconName] : null

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const intensity = Math.min(value / 30, 1)
    el.style.setProperty('--presence-intensity', String(intensity))
  }, [value])

  const openCardMenu = (e: React.MouseEvent) => {
    const items: ContextMenuItems = [
      { label: action, heading: true },
      href
        ? {
            label: 'Abrir',
            icon: ArrowUpRight,
            onSelect: () => router.push(href),
          }
        : null,
    ].filter((item) => item !== null) as ContextMenuItems
    openMenu(e, items)
  }

  return (
    <div
      ref={ref}
      onContextMenu={href ? openCardMenu : undefined}
      className={`group relative overflow-hidden transition-all duration-700 hover:lift ${href ? 'cursor-context-menu' : ''}`}
      style={{
        borderRadius: 'var(--mod-radius-lg)',
        border: '1px solid var(--atmosphere-border)',
        backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        boxShadow:
          '0 0 0 1px var(--module-accent-border), 0 0 24px var(--module-glow-soft)',
        transition: 'box-shadow var(--mod-duration-medium) var(--mod-ease-premium)',
        cursor: href ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          '0 0 0 1px var(--module-accent-border), 0 0 40px var(--module-glow)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow =
          '0 0 0 1px var(--module-accent-border), 0 0 24px var(--module-glow-soft)'
      }}
    >
      {href ? (
        <Link href={href} className="block p-6">
          <CardContent color={color} value={value} action={action} meaning={meaning} Icon={Icon} trend={trend} context={context} />
        </Link>
      ) : (
        <div className="p-6">
          <CardContent color={color} value={value} action={action} meaning={meaning} Icon={Icon} trend={trend} context={context} />
        </div>
      )}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 transition-all duration-1000"
        style={{
          backgroundColor: color,
          opacity: 0.15 + Math.min(value / 30, 1) * 0.35,
          transform: `scaleX(${Math.min(value / 30, 1)})`,
          transformOrigin: 'left',
        }}
      />
    </div>
  )
}

function CardContent({ color, value, action, meaning, Icon, trend, context }: {
  color: string
  value: number
  action: string
  meaning: string
  Icon: LucideIcon | null
  trend?: { value: number; positive: boolean }
  context: string
}) {
  return (
    <>
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse at 30% 40%, ${color}10 0%, transparent 70%)`,
          opacity: 0.3 + Math.min(value / 30, 1) * 0.7,
        }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p
              className="text-sm font-medium leading-relaxed"
              style={{ color: 'var(--atmosphere-text)' }}
            >
              {action}
            </p>
            <p
              className="mt-0.5 text-xs leading-relaxed"
              style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.7 }}
            >
              {meaning}
            </p>
          </div>
          {Icon && (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `${color}12`,
                color,
                opacity: 0.5 + Math.min(value / 30, 1) * 0.5,
              }}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="mt-4 flex items-baseline gap-3">
          <span
            className="text-4xl font-light tracking-tight transition-all duration-1000"
            style={{
              color,
              opacity: 0.5 + Math.min(value / 30, 1) * 0.5,
              textShadow: `0 0 ${10 + Math.min(value / 20, 1) * 30}px ${color}30`,
            }}
          >
            {value}
          </span>
          {trend && (
            <span
              className="text-xs font-medium"
              style={{ color: trend.positive ? 'var(--mia-green)' : 'var(--mia-orange)', opacity: 0.7 }}
            >
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)} respecto a ayer
            </span>
          )}
        </div>

        <p
          className="mt-2 text-[11px] leading-relaxed"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.5 }}
        >
          {context}
        </p>
      </div>
    </>
  )
}

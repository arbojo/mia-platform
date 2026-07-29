'use client'

import { useEffect, useRef } from 'react'
import { MessageSquare, UserPlus, BellRing, Sparkles, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

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
  const Icon = iconName ? iconMap[iconName] : null

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const intensity = Math.min(value / 30, 1)
    el.style.setProperty('--presence-intensity', String(intensity))
  }, [value])

  return (
    <div
      ref={ref}
      className="group relative overflow-hidden rounded-2xl border p-6 transition-all duration-700"
      style={{
        backgroundColor: 'var(--elevation-1)',
        borderColor: 'var(--atmosphere-border)',
        cursor: href ? 'pointer' : 'default',
      }}
    >
      {href ? (
        <Link href={href} className="block">
          <CardContent color={color} value={value} action={action} meaning={meaning} Icon={Icon} trend={trend} context={context} />
        </Link>
      ) : (
        <CardContent color={color} value={value} action={action} meaning={meaning} Icon={Icon} trend={trend} context={context} />
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
              className={`text-xs font-medium ${trend.positive ? 'text-green-400' : 'text-orange-400'}`}
              style={{ opacity: 0.7 }}
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

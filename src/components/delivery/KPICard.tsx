'use client'

import { type LucideIcon } from 'lucide-react'

interface KPICardProps {
  label: string
  value: string
  subtitle?: string
  icon: LucideIcon
  color?: string
  progress?: number
  progressLabel?: string
  alert?: {
    count: number
    message: string
  }
}

export function KPICard({
  label,
  value,
  subtitle,
  icon: Icon,
  color = 'var(--atmosphere-accent)',
  progress,
  progressLabel,
  alert,
}: KPICardProps) {
  return (
    <div
      className="group relative overflow-hidden transition-all duration-300"
      style={{
        borderRadius: 'var(--mod-radius-lg)',
        border: '1px solid var(--atmosphere-border)',
        backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        boxShadow: '0 0 0 1px var(--module-accent-border), 0 0 24px var(--module-glow-soft)',
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
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse at 30% 40%, ${color}10 0%, transparent 70%)`,
          opacity: 0.3,
        }}
      />
      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.7 }}
            >
              {label}
            </p>
            <p
              className="mt-1.5 text-3xl font-light tracking-tight"
              style={{ color }}
            >
              {value}
            </p>
            {subtitle && (
              <p
                className="mt-0.5 text-xs"
                style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
              >
                {subtitle}
              </p>
            )}
          </div>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}12`, color, opacity: 0.6 }}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        {progress !== undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full"
                style={{ backgroundColor: `${color}15` }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(progress * 100, 100)}%`,
                    backgroundColor: progress >= 1 ? 'var(--mia-green)' : color,
                  }}
                />
              </div>
              {progressLabel && (
                <span
                  className="ml-2 text-xs font-medium"
                  style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
                >
                  {progressLabel}
                </span>
              )}
            </div>
          </div>
        )}

        {alert && alert.count > 0 && (
          <div
            className="mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--mia-orange) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--mia-orange) 20%, transparent)',
            }}
          >
            <span className="text-xs" style={{ color: 'var(--mia-orange)' }}>
              ⚠ {alert.count}
            </span>
            <span
              className="text-[11px]"
              style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.7 }}
            >
              {alert.message}
            </span>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{
          backgroundColor: color,
          opacity: 0.2,
          transform: `scaleX(${Math.min((progress ?? 0.5), 1)})`,
          transformOrigin: 'left',
        }}
      />
    </div>
  )
}

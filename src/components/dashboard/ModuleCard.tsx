import Link from 'next/link'

interface ModuleCardProps {
  title: string
  description: string
  href: string
  status: string
  statusColor: string
  accentColor: string
  icon: React.ElementType
}

export function ModuleCard({ title, description, href, status, statusColor, accentColor, icon: Icon }: ModuleCardProps) {
  return (
    <Link href={href} className="group block">
      <div
        className="relative overflow-hidden rounded-2xl border p-5 transition-all duration-500 hover:lift"
        style={{
          backgroundColor: 'var(--elevation-1)',
          borderColor: 'var(--atmosphere-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(ellipse at 30% 50%, ${accentColor}10 0%, transparent 70%)`,
          }}
        />
        <div className="relative z-10 flex items-start gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${accentColor}15`,
              color: accentColor,
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="text-sm font-semibold tracking-tight"
              style={{ color: 'var(--atmosphere-text)' }}
            >
              {title}
            </h3>
            <p
              className="mt-0.5 text-xs leading-relaxed"
              style={{ color: 'var(--atmosphere-text-secondary)' }}
            >
              {description}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: statusColor,
                boxShadow: `0 0 4px ${statusColor}60`,
              }}
            />
            <span
              className="text-[10px] font-medium tracking-wide uppercase"
              style={{ color: 'var(--atmosphere-text-secondary)' }}
            >
              {status}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

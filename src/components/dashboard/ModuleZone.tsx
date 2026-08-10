import Link from 'next/link'

interface ModuleZoneProps {
  title: string
  description: string
  href: string
  status: string
  statusColor: string
  accentColor: string
  icon: React.ElementType
}

export function ModuleZone({
  title,
  description,
  href,
  status,
  statusColor,
  accentColor,
  icon: Icon,
}: ModuleZoneProps) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 px-3 py-2.5 transition-colors duration-200"
      style={{ color: 'var(--atmosphere-text)' }}
    >
      <span
        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}70` }}
      />
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
        style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium tracking-tight"
          style={{ color: 'var(--atmosphere-text)' }}
        >
          {title}
        </p>
        <p
          className="truncate text-xs"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}70` }}
        />
        <span
          className="text-[10px] font-medium uppercase tracking-wide"
          style={{ color: 'var(--atmosphere-text-secondary)' }}
        >
          {status}
        </span>
      </div>
    </Link>
  )
}

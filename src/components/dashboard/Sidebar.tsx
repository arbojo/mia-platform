'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getEdition } from '@/lib/system/edition'

const navItems = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/dashboard/assistants', label: 'Asistentes' },
  { href: '/dashboard/knowledge', label: 'Centro de Conocimiento' },
  { href: '/dashboard/knowledge-studio', label: 'Estudio de Conocimiento' },
  { href: '/dashboard/laboratorio', label: 'Simulador de Ventas' },
  { href: '/dashboard/connections', label: 'Conexiones de MIA' },
]

export function Sidebar() {
  const pathname = usePathname()
  const edition = getEdition()

  return (
    <aside className="w-64 border-r bg-card min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-violet-900">MIA</h1>
        <p className="text-sm text-muted-foreground">Asistente de Ventas</p>
        <div className="mt-2 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
          {edition.label}
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start',
                pathname === item.href && 'bg-violet-100 text-violet-900'
              )}
            >
              {item.label}
            </Button>
          </Link>
        ))}
      </nav>
    </aside>
  )
}

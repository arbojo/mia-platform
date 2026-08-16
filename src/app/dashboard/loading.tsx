'use client'

import { useEffect, useRef } from 'react'

import { MiaSpinner } from '@/components/ui/mia-spinner'

type ModuleKey = 'sales' | 'inventory' | 'logistics'

function detectModule(pathname: string): ModuleKey {
  if (pathname.startsWith('/dashboard/delivery')) return 'logistics'
  if (pathname.startsWith('/dashboard/inventory')) return 'inventory'
  return 'sales'
}

export default function DashboardLoading() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.setAttribute('data-module', detectModule(window.location.pathname))
  }, [])

  return (
    <div
      ref={ref}
      data-module="sales"
      className="flex min-h-[60vh] flex-col items-center justify-center"
    >
      <MiaSpinner className="h-10 w-10" label="Cargando… un momento" />
    </div>
  )
}

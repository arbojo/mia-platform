import type { Metadata, Viewport } from 'next'
import { SwRegister } from '@/components/driver/SwRegister'

export const metadata: Metadata = {
  title: 'MIA Delivery — Portal del Repartidor',
  description: 'Portal del repartidor de MIA Delivery',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MIA Delivery',
  },
}

export const viewport: Viewport = {
  themeColor: '#047857',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <SwRegister />
      <header className="sticky top-0 z-10 bg-emerald-700 px-4 py-3 text-white shadow">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="text-lg font-bold tracking-tight">MIA Delivery</span>
          <span className="text-xs font-medium text-emerald-100">Portal del Repartidor</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg p-4 pb-24">{children}</main>
    </div>
  )
}

'use client'

export function AtmosphereProvider({ children }: { children: React.ReactNode }) {
  return <div data-atmosphere="home" className="relative min-h-screen">{children}</div>
}

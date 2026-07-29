import type { GreetingContext } from '@/lib/dashboard/queries'

export function MorningGreeting({ context }: { context: GreetingContext }) {
  return (
    <div>
      <h1
        className="text-2xl font-semibold tracking-tight"
        style={{ color: 'var(--atmosphere-text)' }}
      >
        {context.greeting}
      </h1>
      <p
        className="mt-1.5 text-sm leading-relaxed"
        style={{ color: 'var(--atmosphere-text-secondary)' }}
      >
        {context.subtitle}
      </p>
    </div>
  )
}

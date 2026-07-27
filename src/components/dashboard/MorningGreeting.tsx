import type { GreetingContext } from '@/lib/dashboard/queries'

export function MorningGreeting({ context }: { context: GreetingContext }) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-6 text-white shadow-lg">
      <h1 className="text-2xl font-bold">{context.greeting}</h1>
      <p className="mt-1 text-violet-100">{context.subtitle}</p>
    </div>
  )
}

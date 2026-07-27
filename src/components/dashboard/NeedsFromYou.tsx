import Link from 'next/link'
import type { NeedsFromYou as NeedsFromYouType } from '@/lib/dashboard/queries'

export function NeedsFromYou({ data }: { data: NeedsFromYouType }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900">What I need from you</h3>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-xl bg-emerald-50 p-4 text-center">
          <p className="text-sm text-emerald-700">
            All set! I don't need anything right now.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-500">I still don't know:</p>
          <div className="space-y-2">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-100 p-3"
              >
                <span className="text-zinc-400">•</span>
                <p className="flex-1 text-sm text-zinc-700">{item.description}</p>
                <Link
                  href="/dashboard/knowledge"
                  className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
                >
                  Teach Me
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              href="/dashboard/knowledge"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Review
            </Link>
            <Link
              href="/dashboard/knowledge"
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Add Knowledge
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

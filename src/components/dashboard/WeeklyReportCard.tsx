'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WeeklyReportData } from '@/lib/ai/weekly-report'
import { useI18n } from '@/components/dashboard/I18nProvider'

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}

export function WeeklyReportCard({ report }: { report: WeeklyReportData | null }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/business/weekly-report', { method: 'POST' })
      if (!res.ok) throw new Error('generate_failed')
      router.refresh()
    } catch {
      setError(t.weeklyReport.generateFailed)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-6"
        style={{ backgroundColor: 'var(--elevation-1)', borderColor: 'var(--atmosphere-border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'var(--atmosphere-accent)', borderTopColor: 'transparent' }}
          />
          <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            {t.weeklyReport.generating}
          </p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div
        className="rounded-2xl border p-6 text-center"
        style={{ backgroundColor: 'var(--elevation-1)', borderColor: 'var(--atmosphere-border)' }}
      >
        <p style={{ color: 'var(--atmosphere-text)' }}>{t.weeklyReport.noReport}</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          {t.weeklyReport.autoMonday}
        </p>
        {error && (
          <p className="mt-2 text-sm" style={{ color: 'var(--mia-gold)' }}>
            {error}
          </p>
        )}
        <button
          onClick={handleGenerate}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-200"
          style={{ backgroundColor: 'var(--atmosphere-accent)' }}
        >
          {t.weeklyReport.generate}
        </button>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border p-6"
      style={{ backgroundColor: 'var(--elevation-1)', borderColor: 'var(--atmosphere-border)' }}
    >
      <div className="flex items-center justify-between">
        <h3 style={{ color: 'var(--atmosphere-text)' }}>{t.weeklyReport.title}</h3>
        <span className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          {formatDate(report.week_start, locale)} — {formatDate(report.week_end, locale)}
        </span>
      </div>

      {report.narrative && (
        <div
          className="mt-4 rounded-xl p-5"
          style={{ backgroundColor: 'var(--atmosphere-surface)' }}
        >
          <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: 'var(--atmosphere-text)' }}>
            {report.narrative}
          </p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--atmosphere-text)' }}>
            {report.conversations_attended}
          </p>
          <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            {t.weeklyReport.conversations}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--mia-green)' }}>
            {report.new_facts_learned}
          </p>
          <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            {t.weeklyReport.newFacts}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--mia-cyan)' }}>
            {report.products_reviewed}
          </p>
          <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            {t.weeklyReport.products}
          </p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="text-lg font-bold" style={{ color: 'var(--atmosphere-text)' }}>
              {report.preparation_before}%
            </span>
            <span className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>→</span>
            <span className="text-lg font-bold" style={{ color: 'var(--mia-green)' }}>
              {report.preparation_after}%
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            {t.weeklyReport.preparation}
          </p>
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-medium" style={{ color: 'var(--atmosphere-text)' }}>
            {t.weeklyReport.recommendations}
          </h4>
          <div className="mt-3 space-y-2">
            {report.recommendations.map((rec, i) => (
              <div
                key={i}
                className="rounded-lg border p-3"
                style={{ borderColor: 'var(--atmosphere-border)' }}
              >
                <p className="text-sm" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {rec.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

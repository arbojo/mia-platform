'use client'

import { useState, useEffect } from 'react'

interface Lesson {
  id: string
  original_response: string
  corrected_response: string | null
  correction_type: string
  created_at: string
  entity_preview: { question: string; answer: string } | null
}

function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora mismo'
  if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'rule': return '📏'
    case 'instruction': return '⚙️'
    default: return '🧠'
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'rule': return 'regla'
    case 'instruction': return 'instrucción'
    default: return 'conocimiento'
  }
}

export function MemoryTimeline({ assistantId }: { assistantId: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchLessons() {
      try {
        const res = await fetch(`/api/training/lessons?assistant_id=${assistantId}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setLessons(data.lessons ?? [])
        }
      } catch (err) {
        console.error('Failed to fetch lessons:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLessons()
  }, [assistantId])

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Lo que ya aprendí</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-8 h-8 bg-zinc-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-zinc-200 rounded w-3/4" />
                <div className="h-3 bg-zinc-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (lessons.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">Lo que ya aprendí</h3>
        <div className="text-center py-6">
          <p className="text-zinc-600">Todavía no me has enseñado nada.</p>
          <p className="text-sm text-zinc-500 mt-1">
            Cuando me corrijas en entrenamiento, lo recordaré para siempre.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900 mb-4">Lo que ya aprendí</h3>
      <div className="space-y-4">
        {lessons.map((lesson) => (
          <div key={lesson.id} className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-sm">
              {getTypeIcon(lesson.correction_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-900">
                <span className="font-medium">Aprendí</span>{' '}
                {lesson.corrected_response ?? lesson.original_response}
              </p>
              {lesson.entity_preview && (
                <p className="text-xs text-zinc-500 mt-1 truncate">
                  {lesson.entity_preview.question} → {lesson.entity_preview.answer}
                </p>
              )}
              <p className="text-xs text-zinc-400 mt-1">
                {getTimeAgo(lesson.created_at)} · {getTypeLabel(lesson.correction_type)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

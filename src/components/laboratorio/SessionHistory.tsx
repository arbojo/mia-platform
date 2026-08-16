'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface LabSession {
  id: string
  mode: string
  title: string | null
  score: number | null
  status: string
  created_at: string
}

interface SessionHistoryProps {
  sessions: LabSession[]
  onDelete?: (id: string) => void
  onClear?: () => void
}

const modeIcons: Record<string, string> = {
  normal: '🟢',
  indecisive: '🟡',
  difficult: '🔴',
  critical: '💀',
}

const modeLabels: Record<string, string> = {
  normal: 'Normal',
  indecisive: 'Indeciso',
  difficult: 'Complicado',
  critical: 'Exigente',
}

export function SessionHistory({ sessions, onDelete, onClear }: SessionHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        Aún no hay pruebas. ¡Comienza una!
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {onClear && sessions.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-gray-500 w-full border"
          onClick={onClear}
        >
          Limpiar historial
        </Button>
      )}
      {sessions.map((session) => (
        <div
          key={session.id}
          className="p-3 border rounded-lg hover:border-brand-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{modeIcons[session.mode] ?? '🟢'}</span>
              <span className="text-sm font-medium text-gray-900">
                {session.title ?? modeLabels[session.mode] ?? session.mode}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {session.score && (
                <Badge
                  variant={session.score >= 8 ? 'default' : session.score >= 6 ? 'secondary' : 'destructive'}
                  className="text-xs"
                >
                  {session.score}/10
                </Badge>
              )}
              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                  onClick={() => onDelete(session.id)}
                  aria-label={`Eliminar sesión ${session.title ?? modeLabels[session.mode] ?? session.mode}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(session.created_at).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      ))}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Gap {
  field: string
  description: string
  severity: string
}

interface Conflict {
  description: string
  items: string[]
  severity: string
}

interface ReadinessIssue {
  question: string
  reason: string
  severity: string
}

interface AnalysisReportProps {
  gaps: Gap[]
  conflicts: Conflict[]
  readinessIssues: ReadinessIssue[]
}

function getSeverityBadge(severity: string) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  }
  return styles[severity] ?? 'bg-gray-100 text-gray-700'
}

export function AnalysisReport({ gaps, conflicts, readinessIssues }: AnalysisReportProps) {
  const [activeTab, setActiveTab] = useState<'gaps' | 'conflicts' | 'readiness'>('gaps')
  const total = gaps.length + conflicts.length + readinessIssues.length

  if (total === 0) {
    return (
      <div className="text-center py-8 border rounded-xl bg-green-50">
        <p className="text-green-700 font-medium">No se detectaron problemas</p>
        <p className="text-sm text-green-600 mt-1">Tu conocimiento está bien estructurado</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Problemas Detectados ({total})
      </h2>

      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'gaps' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('gaps')}
        >
          Información Faltante ({gaps.length})
        </Button>
        <Button
          variant={activeTab === 'conflicts' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('conflicts')}
        >
          Conflictos ({conflicts.length})
        </Button>
        <Button
          variant={activeTab === 'readiness' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('readiness')}
        >
          Preparación ({readinessIssues.length})
        </Button>
      </div>

      <div className="space-y-2">
        {activeTab === 'gaps' && gaps.map((gap, i) => (
          <div key={i} className="p-3 border rounded-lg flex items-start gap-3">
            <Badge className={getSeverityBadge(gap.severity)}>{gap.severity}</Badge>
            <div>
              <p className="font-medium text-gray-900">{gap.field}</p>
              <p className="text-sm text-gray-600">{gap.description}</p>
            </div>
          </div>
        ))}

        {activeTab === 'conflicts' && conflicts.map((conflict, i) => (
          <div key={i} className="p-3 border rounded-lg flex items-start gap-3">
            <Badge className={getSeverityBadge(conflict.severity)}>{conflict.severity}</Badge>
            <div>
              <p className="font-medium text-gray-900">{conflict.description}</p>
              <p className="text-sm text-gray-600 mt-1">
                Items involucrados: {conflict.items.join(', ')}
              </p>
            </div>
          </div>
        ))}

        {activeTab === 'readiness' && readinessIssues.map((issue, i) => (
          <div key={i} className="p-3 border rounded-lg flex items-start gap-3">
            <Badge className={getSeverityBadge(issue.severity)}>{issue.severity}</Badge>
            <div>
              <p className="font-medium text-gray-900">&quot;{issue.question}&quot;</p>
              <p className="text-sm text-gray-600">{issue.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

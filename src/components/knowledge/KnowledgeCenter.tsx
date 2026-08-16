'use client'

import { useState, useCallback } from 'react'
import { KnowledgeManager } from '@/components/knowledge/KnowledgeManager'
import { InstructionsManager } from '@/components/knowledge/InstructionsManager'
import { FileUpload } from '@/components/knowledge/FileUpload'
import { LearningReport } from '@/components/knowledge/LearningReport'
import { MediaLibrary } from '@/components/knowledge/MediaLibrary'
import { cn } from '@/lib/utils'
import type { Database } from '@/lib/types'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']
type AiInstruction = Database['public']['Tables']['ai_instructions']['Row']

interface LearningReportData {
  id: string
  status: string
  products_found: number
  knowledge_found: number
  rules_found: number
  prices_found: number
  benefits_found: number
  faqs_found: number
  promotions_found: number
  missing_fields: Array<{ field: string; reason: string; importance: string }>
  extracted_products: Array<{
    name: string
    price: number | null
    description: string | null
    benefits: string | null
    faq: Array<{ question: string; answer: string }>
    restrictions: string | null
    confidence: number
    _status?: 'approved' | 'rejected'
  }>
  extracted_knowledge: Array<{
    category: string
    question: string
    answer: string
    confidence: number
    _status?: 'approved' | 'rejected'
  }>
  extracted_rules: Array<{
    category: string
    content: string
    confidence: number
    _status?: 'approved' | 'rejected'
  }>
  preparation_before: number | null
  preparation_after: number | null
}

interface KnowledgeCenterProps {
  businessId: string
  initialKnowledge: KnowledgeItem[]
  initialInstructions: AiInstruction[]
}

const tabs = [
  { id: 'knowledge', label: 'Base de Conocimiento', description: 'Hechos y información del negocio que MIA debe conocer' },
  { id: 'media', label: 'Biblioteca Multimedia', description: 'Imágenes y testimonios que MIA envía según el contexto' },
  { id: 'instructions', label: 'Instrucciones IA', description: 'Reglas de comportamiento y personalidad de MIA' },
  { id: 'files', label: 'Archivos', description: 'Enseña a MIA con tus archivos' },
]

export function KnowledgeCenter({ businessId, initialKnowledge, initialInstructions }: KnowledgeCenterProps) {
  const [activeTab, setActiveTab] = useState('knowledge')
  const [report, setReport] = useState<LearningReportData | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  const handleReportCreated = useCallback(async (reportId: string) => {
    setLoadingReport(true)
    try {
      const res = await fetch(`/api/knowledge/learn/${reportId}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data.report)
      }
    } finally {
      setLoadingReport(false)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Centro de Conocimiento</h1>
        <p className="text-gray-600">
          Administra la información que MIA usa para atender a tus clientes
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tour={`knowledge-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="text-sm text-gray-500">
        {tabs.find((t) => t.id === activeTab)?.description}
      </div>

      {activeTab === 'knowledge' && (
        <KnowledgeManager businessId={businessId} initialItems={initialKnowledge} />
      )}

      {activeTab === 'media' && (
        <MediaLibrary businessId={businessId} />
      )}

      {activeTab === 'instructions' && (
        <InstructionsManager businessId={businessId} initialItems={initialInstructions} />
      )}

      {activeTab === 'files' && (
        <div className="space-y-6">
          {!report && !loadingReport && (
            <FileUpload businessId={businessId} onReportCreated={handleReportCreated} />
          )}

          {loadingReport && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl animate-pulse">
                📚
              </div>
              <p className="text-lg font-medium text-brand-900">
                Estoy revisando lo que aprendí...
              </p>
            </div>
          )}

          {report && (
            <LearningReport report={report} />
          )}

          {report && (
            <div className="text-center">
              <button
                onClick={() => setReport(null)}
                className="text-sm text-brand-600 hover:text-brand-700"
              >
                📚 Enseñarme con más archivos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

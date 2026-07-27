'use client'

import { useState } from 'react'
import { KnowledgeManager } from '@/components/knowledge/KnowledgeManager'
import { InstructionsManager } from '@/components/knowledge/InstructionsManager'
import { cn } from '@/lib/utils'
import type { Database } from '@/lib/types'

type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']
type AiInstruction = Database['public']['Tables']['ai_instructions']['Row']

interface KnowledgeCenterProps {
  businessId: string
  initialKnowledge: KnowledgeItem[]
  initialInstructions: AiInstruction[]
}

const tabs = [
  { id: 'knowledge', label: 'Base de Conocimiento', description: 'Hechos y información del negocio que MIA debe conocer' },
  { id: 'instructions', label: 'Instrucciones IA', description: 'Reglas de comportamiento y personalidad de MIA' },
]

export function KnowledgeCenter({ businessId, initialKnowledge, initialInstructions }: KnowledgeCenterProps) {
  const [activeTab, setActiveTab] = useState('knowledge')

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
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-violet-600 text-violet-600'
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

      {activeTab === 'instructions' && (
        <InstructionsManager businessId={businessId} initialItems={initialInstructions} />
      )}
    </div>
  )
}

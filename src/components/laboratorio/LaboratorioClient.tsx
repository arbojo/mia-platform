'use client'

import { useState, useEffect } from 'react'
import { SimulationModes, type SimulationMode } from '@/components/laboratorio/SimulationModes'
import { ContextPanel } from '@/components/laboratorio/ContextPanel'
import { SessionEvaluation } from '@/components/laboratorio/SessionEvaluation'
import { SessionHistory } from '@/components/laboratorio/SessionHistory'
import { TeachModal } from '@/components/laboratorio/TeachModal'
import { UsageBar } from '@/components/laboratorio/UsageBar'
import { LabChatWindow } from '@/components/laboratorio/LabChatWindow'
import { ScenariosPanel, type Scenario } from '@/components/laboratorio/ScenariosPanel'
import { CoachingFeedback } from '@/components/laboratorio/CoachingFeedback'

interface LaboratorioClientProps {
  businesses: Array<{
    id: string
    name: string
    assistants: Array<{
      id: string
      name: string
      personality: Record<string, number>
      communication_style: string
    }>
  }>
}

interface LabContext {
  assistant: { id: string; name: string; personality: Record<string, number>; communication_style: string }
  brand: { business_name: string; elevator_pitch?: string; target_customers?: string; differentiators?: string } | null
  products: Array<{ id: string; name: string; price: number | null }>
  rules: Array<{ id: string; category: string; content: string }>
  knowledge: Array<{ id: string; question: string; answer: string }>
  instructions: Array<{ id: string; instruction: string }>
  systemPrompt: string
}

interface LabSession {
  id: string
  mode: string
  title: string | null
  score: number | null
  status: string
  created_at: string
}

export function LaboratorioClient({ businesses }: LaboratorioClientProps) {
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? '')
  const [assistantId, setAssistantId] = useState(businesses[0]?.assistants[0]?.id ?? '')
  const [mode, setMode] = useState<SimulationMode>('normal')
  const [context, setContext] = useState<LabContext | null>(null)
  const [sessions, setSessions] = useState<LabSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [teachSuggestions, setTeachSuggestions] = useState<string[] | null>(null)
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0, cost: 0 })
  const [messageCount, setMessageCount] = useState(0)
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null)
  const [coachingFeedback, setCoachingFeedback] = useState<string[]>([])
  const [coachingScore, setCoachingScore] = useState<number | null>(null)
  const [chatKey, setChatKey] = useState(0)

  const selectedBusiness = businesses.find((b) => b.id === businessId)
  const assistants = selectedBusiness?.assistants ?? []

  useEffect(() => {
    if (assistantId) {
      fetch(`/api/laboratorio/context?assistantId=${assistantId}`)
        .then((res) => res.json())
        .then(setContext)
        .catch(console.error)
    }
  }, [assistantId])

  useEffect(() => {
    if (businessId) {
      fetch(`/api/laboratorio/sessions?businessId=${businessId}`)
        .then((res) => res.json())
        .then((data) => setSessions(data.sessions ?? []))
        .catch(console.error)
    }
  }, [businessId])

  const handleStartSession = () => {
    setCurrentSessionId(null)
    setCurrentConversationId(null)
    setTokenUsage({ input: 0, output: 0, cost: 0 })
    setMessageCount(0)
    setCoachingFeedback([])
    setCoachingScore(null)
    setChatKey((k) => k + 1)
  }

  const handleTeach = (suggestions: string[]) => {
    setTeachSuggestions(suggestions)
  }

  const handleTeachClose = () => {
    setTeachSuggestions(null)
    if (businessId) {
      fetch(`/api/laboratorio/sessions?businessId=${businessId}`)
        .then((res) => res.json())
        .then((data) => setSessions(data.sessions ?? []))
        .catch(console.error)
    }
  }

  const handleExport = () => {
    const text = `Laboratorio MIA - Export\nBusiness: ${selectedBusiness?.name}\nAssistant: ${context?.assistant?.name}\nMode: ${mode}\nDate: ${new Date().toISOString()}\n\nTokens: ${tokenUsage.input} in / ${tokenUsage.output} out\nCost: $${tokenUsage.cost.toFixed(4)}`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laboratorio-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (businesses.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Necesitas crear un negocio primero
        </h2>
        <p className="text-gray-500">
          Ve al dashboard y completa el onboarding para usar el laboratorio.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">🎭 Simulador de Ventas</h1>
          <p className="text-sm text-gray-500">Entrena a tu asistente como si fuera un empleado nuevo</p>
        </div>
        <select
          className="p-2 border rounded-lg text-sm"
          value={businessId}
          onChange={(e) => {
            setBusinessId(e.target.value)
            const biz = businesses.find((b) => b.id === e.target.value)
            if (biz?.assistants[0]) {
              setAssistantId(biz.assistants[0].id)
            }
          }}
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          className="p-2 border rounded-lg text-sm"
          value={assistantId}
          onChange={(e) => setAssistantId(e.target.value)}
        >
          {assistants.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="w-48 flex flex-col gap-4">
          <SimulationModes selected={mode} onSelect={setMode} />
          <ScenariosPanel
            onSelect={(scenario) => {
              setActiveScenario(scenario)
              handleStartSession()
            }}
            activeScenarioId={activeScenario?.id}
          />
          <SessionHistory sessions={sessions} />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <LabChatWindow
            key={chatKey}
            assistantName={context?.assistant?.name ?? 'MIA'}
            assistantId={assistantId}
            businessId={businessId}
            conversationId={currentConversationId ?? undefined}
            mode={mode}
            simulationSystemMessage={activeScenario?.customerMessage}
            sessionTitle={activeScenario ? `Escenario: ${activeScenario.name}` : undefined}
            onConversationCreated={(conversationId, sessionId) => {
              setCurrentConversationId(conversationId)
              if (sessionId) setCurrentSessionId(sessionId)
            }}
            onTokensUsed={(tokens) => {
              setTokenUsage((prev) => ({
                input: prev.input + tokens.input,
                output: prev.output + tokens.output,
                cost: prev.cost + (tokens.input * 0.00015 + tokens.output * 0.0006) / 1000,
              }))
            }}
            onMessageCount={(count) => setMessageCount(count)}
            onCoaching={(feedback) => {
              setCoachingFeedback(feedback.tips)
              setCoachingScore(feedback.score)
            }}
          />
        </div>

        <div className="w-80 flex flex-col gap-4 overflow-y-auto">
          {coachingFeedback.length > 0 || coachingScore !== null ? (
            <CoachingFeedback feedback={coachingFeedback} score={coachingScore} />
          ) : context ? (
            <ContextPanel
              brand={context.brand}
              products={context.products}
              rules={context.rules}
              knowledge={context.knowledge}
              instructions={context.instructions}
              assistantName={context.assistant.name}
              personality={context.assistant.personality}
              communicationStyle={context.assistant.communication_style}
              systemPrompt={context.systemPrompt}
            />
          ) : null}

          {currentSessionId && currentConversationId && (
            <SessionEvaluation
              conversationId={currentConversationId}
              assistantId={assistantId}
              sessionId={currentSessionId}
              onTeach={handleTeach}
            />
          )}
        </div>
      </div>

      <UsageBar
        tokensInput={tokenUsage.input}
        tokensOutput={tokenUsage.output}
        cost={tokenUsage.cost}
        messageCount={messageCount}
        model="gpt-4o-mini"
        onExport={handleExport}
      />

      {teachSuggestions && businessId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
              <TeachModal
                suggestions={teachSuggestions}
                businessId={businessId}
                assistantId={assistantId}
                conversationId={currentConversationId ?? undefined}
                onClose={() => setTeachSuggestions(null)}
                onTaught={handleTeachClose}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

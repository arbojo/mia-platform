'use client'

import { useState, useCallback } from 'react'
import { ChatWindow } from '@/components/chat/ChatWindow'

interface TrainingChatProps {
  assistantName: string
  assistantId: string
  conversationId?: string
}

export function TrainingChat({ assistantName, assistantId, conversationId }: TrainingChatProps) {
  const [correctionType, setCorrectionType] = useState<'knowledge' | 'rule' | 'instruction'>('knowledge')
  const [lastCorrection, setLastCorrection] = useState<string | null>(null)

  const handleCorrection = async (
    messageId: string,
    correction: string,
    originalContent: string,
    userQuestion: string
  ) => {
    const action = correction === 'approve' ? 'approve' : 'correct'

    try {
      const res = await fetch('/api/training/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          conversation_id: conversationId,
          assistant_id: assistantId,
          user_question: userQuestion,
          original_response: originalContent,
          corrected_response: action === 'correct' ? correction : undefined,
          action,
          correction_type: correctionType,
        }),
      })

      if (res.ok && action === 'correct') {
        setLastCorrection(correction)
        setTimeout(() => setLastCorrection(null), 3000)
      }
    } catch (err) {
      console.error('Failed to save correction:', err)
    }
  }

  const handleTestAgain = useCallback((question: string) => {
    const form = document.querySelector<HTMLFormElement>('form')
    if (form) {
      const input = form.querySelector<HTMLInputElement>('input')
      if (input) {
        input.value = question
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set
        nativeInputValueSetter?.call(input, question)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
      }
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-violet-50 flex gap-2">
        <button
          onClick={() => setCorrectionType('knowledge')}
          className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
            correctionType === 'knowledge'
              ? 'bg-violet-600 text-white'
              : 'bg-white text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          🧠 Conocimiento
        </button>
        <button
          onClick={() => setCorrectionType('rule')}
          className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
            correctionType === 'rule'
              ? 'bg-violet-600 text-white'
              : 'bg-white text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          📏 Regla
        </button>
        <button
          onClick={() => setCorrectionType('instruction')}
          className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
            correctionType === 'instruction'
              ? 'bg-violet-600 text-white'
              : 'bg-white text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          ⚙️ Instrucción
        </button>
      </div>

      <div className="flex-1">
        <ChatWindow
          assistantName={assistantName}
          assistantId={assistantId}
          conversationId={conversationId}
          onCorrection={handleCorrection}
          onTestAgain={handleTestAgain}
        />
      </div>

      {lastCorrection && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <p className="text-sm font-medium">✨ MIA aprendió esto</p>
          <p className="text-xs opacity-90 mt-0.5">&ldquo;{lastCorrection}&rdquo;</p>
        </div>
      )}
    </div>
  )
}

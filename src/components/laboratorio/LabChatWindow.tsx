'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ResponseAnalysis } from '@/components/laboratorio/ResponseAnalysis'
import { cn } from '@/lib/utils'
import { createSseParser } from '@/lib/chat/sse'
import { useTypingIndicator } from '@/lib/chat/useTypingIndicator'
import { TypingIndicator } from '@/components/chat/TypingIndicator'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface LabChatWindowProps {
  assistantName: string
  assistantId: string
  businessId: string
  conversationId?: string
  mode?: string
  simulationSystemMessage?: string
  sessionTitle?: string
  onTokensUsed?: (tokens: { input: number; output: number }) => void
  onMessageCount?: (count: number) => void
  onCoaching?: (feedback: { tips: string[]; score: number | null }) => void
  onConversationCreated?: (conversationId: string, sessionId?: string) => void
}

export function LabChatWindow({
  assistantName,
  assistantId,
  businessId,
  conversationId,
  mode,
  simulationSystemMessage,
  sessionTitle,
  onTokensUsed,
  onMessageCount,
  onCoaching,
  onConversationCreated,
}: LabChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { isTyping, startTyping, stopTyping } = useTypingIndicator()
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(conversationId)
  const [prevConversationId, setPrevConversationId] = useState<string | undefined>(conversationId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  if (conversationId !== prevConversationId) {
    setPrevConversationId(conversationId)
    if (conversationId) {
      setActiveConversationId(conversationId)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus()
    }
  }, [isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    startTyping()

    try {
      let conversation = activeConversationId
      if (!conversation) {
        const sessionRes = await fetch('/api/laboratorio/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_id: businessId,
            assistant_id: assistantId,
            mode: mode ?? 'normal',
            title: sessionTitle ?? 'chat directo',
          }),
        })
        const sessionData = await sessionRes.json()
        conversation = sessionData.conversationId ?? sessionData.session?.conversation_id
        if (!conversation) {
          throw new Error('No se pudo iniciar una sesión de laboratorio')
        }
        setActiveConversationId(conversation)
        onConversationCreated?.(conversation, sessionData.session?.id)
      }

      const chatMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      if (simulationSystemMessage && messages.length === 0) {
        chatMessages.unshift({
          role: 'user',
          content: simulationSystemMessage,
        })
      } else if (mode && messages.length === 0) {
        const modeMessages: Record<string, string> = {
          normal: 'Actúa como un cliente interesado en comprar. Haz preguntas directas sobre productos, precios y disponibilidad.',
          indecisive: 'Actúa como un cliente que no está seguro. Duda, compara precios, pregunta "¿y si no me gusta?", pide descuento, se va y vuelve.',
          difficult: 'Actúa como un cliente difícil. Cuestiona la calidad, compara con la competencia, pide cosas que no existen, se queja del precio.',
          critical: 'Actúa como un cliente muy exigente y crítico. Busca cada detalle, cuestiona todo, presiona para obtener más de lo que se ofrece.',
        }
        chatMessages.unshift({
          role: 'user',
          content: modeMessages[mode] ?? modeMessages.normal,
        })
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          assistantId,
          conversationId: conversation,
          requestType: 'simulation',
        }),
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const reader = response.body?.getReader()
      let assistantContent = ''

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (reader) {
        const parser = createSseParser((event) => {
          if (event.type !== 'text-delta') return
          assistantContent += event.delta
          stopTyping()
          setMessages((prev) => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg.role === 'assistant') {
              lastMsg.content = assistantContent
            }
            return [...updated]
          })
        })

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          parser.push(value)
        }
        parser.flush()
      }

      if (onTokensUsed && assistantContent) {
        onTokensUsed({
          input: Math.ceil(userMessage.content.length / 4),
          output: Math.ceil(assistantContent.length / 4),
        })
      }

      if (onCoaching && assistantContent) {
        try {
          const coachingRes = await fetch('/api/laboratorio/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              assistantId,
              conversationId: activeConversationId,
              mode,
            }),
          })
          if (coachingRes.ok) {
            const coachingData = await coachingRes.json()
            onCoaching({
              tips: coachingData.tips ?? [],
              score: coachingData.score ?? null,
            })
          }
        } catch {
          // Coaching is optional, don't break the flow
        }
      }

      onMessageCount?.(
        [...messages, userMessage].filter((m) => m.role === 'user').length
      )
    } catch (error) {
      console.error('Chat error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Lo siento, hubo un error. Por favor intenta de nuevo.',
        },
      ])
    } finally {
      setIsLoading(false)
      stopTyping()
    }
  }

  return (
    <div className="flex flex-col h-full border rounded-xl overflow-hidden bg-white">
      <div className="p-4 border-b bg-olive-50">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-olive-200 text-olive-700">
              {assistantName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-gray-900">{assistantName}</h3>
            <p className="text-sm text-gray-500">
              {simulationSystemMessage ? 'Escenario activo' : mode ? `Modo: ${mode}` : 'Chat de prueba'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>Escribe un mensaje para comenzar la prueba.</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2',
                message.role === 'user'
                  ? 'bg-olive-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.role === 'assistant' && (
                <ResponseAnalysis
                  messageId={message.id}
                  assistantId={assistantId}
                  conversationId={activeConversationId}
                />
              )}
            </div>
          </div>
        ))}

        {isTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe como cliente..."
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-olive-600 hover:bg-olive-700"
          >
            {isLoading ? '...' : 'Enviar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ResponseAnalysis } from '@/components/laboratorio/ResponseAnalysis'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface LabChatWindowProps {
  assistantName: string
  assistantId: string
  conversationId?: string
  mode?: string
  simulationSystemMessage?: string
  onTokensUsed?: (tokens: { input: number; output: number }) => void
  onMessageCount?: (count: number) => void
  onCoaching?: (feedback: { tips: string[]; score: number | null }) => void
}

export function LabChatWindow({
  assistantName,
  assistantId,
  conversationId,
  mode,
  simulationSystemMessage,
  onTokensUsed,
  onMessageCount,
  onCoaching,
}: LabChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
    setIsTyping(true)

    try {
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
          conversationId,
          requestType: 'simulation',
        }),
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          assistantContent += chunk
          setMessages((prev) => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg.role === 'assistant') {
              lastMsg.content = assistantContent
            }
            return [...updated]
          })
        }
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
              conversationId,
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
      setIsTyping(false)
    }
  }

  return (
    <div className="flex flex-col h-full border rounded-xl overflow-hidden bg-white">
      <div className="p-4 border-b bg-violet-50">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-violet-200 text-violet-700">
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
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.role === 'assistant' && (
                <ResponseAnalysis
                  messageId={message.id}
                  assistantId={assistantId}
                  conversationId={conversationId}
                />
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

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
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isLoading ? '...' : 'Enviar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

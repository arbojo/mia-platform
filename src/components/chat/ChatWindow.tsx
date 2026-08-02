'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatWindowProps {
  assistantName: string
  assistantId: string
  conversationId?: string
  onCorrection?: (
    messageId: string,
    correction: string,
    originalContent: string,
    userQuestion: string
  ) => void
  mode?: string
  simulationSystemMessage?: string
  onTestAgain?: (question: string) => void
  apiEndpoint?: string
  customerExternalId?: string
}

function getRequestType(mode?: string): 'live_customer' | 'simulation' | 'training' {
  if (mode === 'training') return 'training'
  if (mode) return 'simulation'
  return 'live_customer'
}

export function ChatWindow({
  assistantName,
  assistantId,
  conversationId,
  onCorrection,
  mode,
  simulationSystemMessage,
  onTestAgain,
  apiEndpoint = '/api/chat',
  customerExternalId,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [correctionId, setCorrectionId] = useState<string | null>(null)
  const [correctionText, setCorrectionText] = useState('')
  const [savedQuestion, setSavedQuestion] = useState<string | null>(null)
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
        chatMessages.unshift({ role: 'user', content: simulationSystemMessage })
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          assistantId,
          conversationId,
          requestType: getRequestType(mode),
          ...(customerExternalId ? { customerExternalId } : {}),
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
          setMessages((prev) =>
            prev.map((msg, i) =>
              i === prev.length - 1 && msg.role === 'assistant'
                ? { ...msg, content: assistantContent }
                : msg
            )
          )
        }
      }
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

  const handleCorrectionSubmit = () => {
    if (correctionId && correctionText.trim()) {
      const assistantMsgIdx = messages.findIndex((m) => m.id === correctionId)
      const userQuestion = assistantMsgIdx > 0 ? messages[assistantMsgIdx - 1].content : ''
      const originalMessage = messages[assistantMsgIdx]
      onCorrection?.(correctionId, correctionText.trim(), originalMessage?.content ?? '', userQuestion)
      setSavedQuestion(userQuestion)
      setCorrectionId(null)
      setCorrectionText('')
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
            <p className="text-sm text-gray-500">Asistente de ventas</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>Hola, soy {assistantName}.</p>
            <p>¿En qué puedo ayudarte hoy?</p>
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
              {message.role === 'assistant' && onCorrection && (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => {
                      const msgIdx = messages.findIndex((m) => m.id === message.id)
                      const userQuestion = msgIdx > 0 ? messages[msgIdx - 1].content : ''
                      onCorrection(message.id, 'approve', message.content, userQuestion)
                    }}
                  >
                    Correcto
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs text-red-600"
                    onClick={() => {
                      setCorrectionId(message.id)
                      setCorrectionText('')
                    }}
                  >
                    Corregir
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {correctionId && (
          <div className="flex justify-end">
            <div className="max-w-[80%] p-3 bg-amber-50 border border-amber-200 rounded-2xl">
              <p className="text-xs text-amber-700 mb-2">
                Escribe la respuesta correcta:
              </p>
              <div className="flex gap-2">
                <Input
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="Respuesta correcta..."
                  className="text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCorrectionSubmit()
                    if (e.key === 'Escape') setCorrectionId(null)
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleCorrectionSubmit}
                  disabled={!correctionText.trim()}
                >
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCorrectionId(null)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {savedQuestion && (
          <div className="flex justify-start">
            <div className="max-w-[80%] p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">MIA aprendió</span>
              </div>
              <p className="text-xs text-emerald-600 mb-2">
                La corrección se guardó correctamente.
              </p>
              {onTestAgain && savedQuestion && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => {
                    setSavedQuestion(null)
                    onTestAgain(savedQuestion)
                  }}
                >
                  Probar de nuevo
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-emerald-600 ml-1"
                onClick={() => setSavedQuestion(null)}
              >
                <XCircle className="w-3 h-3 mr-1" />
                Cerrar
              </Button>
            </div>
          </div>
        )}

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
            placeholder="Escribe tu mensaje..."
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

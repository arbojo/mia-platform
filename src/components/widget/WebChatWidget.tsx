'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageCircle, X, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface WebChatWidgetProps {
  businessId: string
  assistantName?: string
  welcome?: string
  accent?: string
  accentSoft?: string
}

function getOrCreateCustomerId(businessId: string): string {
  if (typeof window === 'undefined') return ''
  const key = `mia:widget:customer:${businessId}`
  let customerId = localStorage.getItem(key)
  if (!customerId) {
    customerId = crypto.randomUUID()
    localStorage.setItem(key, customerId)
  }
  return customerId
}

export function WebChatWidget({
  businessId,
  assistantName = 'MIA',
  welcome = 'Hola, soy MIA 👋 Pregúntame sobre Clean Nails, precios o envíos.',
  accent = 'bg-rose-600 hover:bg-rose-700',
  accentSoft = 'bg-rose-50',
}: WebChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [customerId] = useState(() => getOrCreateCustomerId(businessId))
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isOpen])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    const onOpen = () => setIsOpen(true)
    window.addEventListener('mia:open-widget', onOpen)
    return () => window.removeEventListener('mia:open-widget', onOpen)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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

      try {
        const res = await fetch('/api/channels/webhook/web', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            customerId,
            businessId,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error ?? 'Request failed')
        }

        if (!data.duplicate && data.response) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.response,
            },
          ])
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Lo siento, no estoy disponible ahora. Por favor intenta más tarde.',
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, customerId, businessId]
  )

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 flex flex-col w-[calc(100vw-2rem)] max-w-sm h-[28rem] border rounded-2xl shadow-2xl bg-white overflow-hidden">
          <div className={cn('p-4 border-b flex items-center justify-between', accentSoft)}>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold',
                  accent
                )}
              >
                {assistantName[0]}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{assistantName}</h3>
                <p className="text-sm text-gray-500">Asistente de ventas</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar chat"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p>{welcome}</p>
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
                      ? accent
                      : 'bg-gray-100 text-gray-900'
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
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

          <form onSubmit={handleSubmit} className="p-3 border-t">
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
                size="icon"
                disabled={isLoading || !input.trim()}
                className={cn('shrink-0', accent)}
                aria-label="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center',
          accent
        )}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  )
}

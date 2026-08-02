'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import DemoPaywall from '@/components/demo/DemoPaywall'
import type { User } from '@supabase/supabase-js'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function generateSessionId() {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [limitExceeded, setLimitExceeded] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [sessionId] = useState(generateSessionId)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [supabase])

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

    try {
      const chatMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatMessages, sessionId }),
      })

      if (!res.ok) {
        let limitExceeded = false
        try {
          const body = await res.json()
          limitExceeded = body.limitExceeded === true
        } catch {
          // fall through to generic error
        }
        if (limitExceeded) {
          setLimitExceeded(true)
          return
        }
        throw new Error('Failed')
      }

      const reader = res.body?.getReader()
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
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Lo siento, el demo no está disponible ahora. Por favor intenta más tarde.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-violet-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-violet-900">MIA Demo</h1>
          <div className="flex gap-4">
            {user ? (
              <Link href="/dashboard">
                <Button variant="ghost">Ir a mi cuenta</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Iniciar sesión</Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-violet-600 hover:bg-violet-700">Crear cuenta</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-500">
            Habla con <strong>Luna</strong>, una asistente de ventas de demostración
          </p>
        </div>

        <div className="flex-1 flex flex-col border rounded-xl overflow-hidden bg-white shadow-sm min-h-0">
          <div className="p-4 border-b bg-violet-50">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-violet-200 text-violet-700">L</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-gray-900">Luna</h3>
                <p className="text-sm text-gray-500">Asistente de ventas — Demo</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p className="text-lg mb-2">Hola, soy Luna 👋</p>
                <p>Soy una asistente de ventas de ejemplo.</p>
                <p className="mt-2">Pregúntame sobre productos, precios o envíos.</p>
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

          <div className="p-4 border-t">
            {limitExceeded ? (
              <DemoPaywall isAuthenticated={!!user} />
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
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
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-500 mb-2">
            ¿Te gusta lo que ves? Crea tu propia asistente.
          </p>
          <Link href={user ? '/dashboard/onboarding' : '/signup'}>
            <Button className="bg-violet-600 hover:bg-violet-700">
              {user ? 'Comenzar mi asistente' : 'Crear mi asistente'}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}

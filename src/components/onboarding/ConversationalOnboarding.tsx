'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ExtractedData {
  step_complete?: string
  business_name?: string
  business_description?: string
  target_customers?: string
  differentiators?: string
  products?: Array<{ name: string; price?: number; description?: string; benefits?: string }>
  rules?: Array<{ category: string; content: string }>
  assistant_name?: string
  all_complete?: boolean
}

interface ConversationalOnboardingProps {
  userId: string
  businessId: string | null
}

export function ConversationalOnboarding({ userId, businessId: initialBusinessId }: ConversationalOnboardingProps) {
  const router = useRouter()
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [businessId, setBusinessId] = useState(initialBusinessId)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
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
      const chatHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, userId, businessId }),
      })

      if (!res.ok) throw new Error('Failed')

      const data = await res.json()

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (data.extractedData) {
        if (data.extractedData.step_complete) {
          setCompletedSteps((prev) => new Set([...prev, data.extractedData.step_complete]))
        }

        if (data.extractedData.all_complete) {
          await createBusiness(data.extractedData)
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Tuvimos un pequeño problema. Intentemos de nuevo, por favor.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const createBusiness = async (data: ExtractedData) => {
    setIsCreating(true)

    try {
      let activeBusinessId = businessId

      if (!activeBusinessId) {
        const { data: newBiz, error: bizError } = await supabase
          .from('businesses')
          .insert({ owner_id: userId, name: data.business_name ?? 'Mi negocio' })
          .select()
          .single()

        if (bizError || !newBiz) {
          console.error('Error creating business:', bizError)
          return
        }
        activeBusinessId = newBiz.id
        setBusinessId(newBiz.id)
      }

      if (data.business_name || data.target_customers || data.differentiators) {
        await supabase.from('brand_identities').insert({
          business_id: activeBusinessId,
          business_name: data.business_name ?? 'Mi negocio',
          tagline: data.business_description?.split('.')[0] ?? data.business_name ?? '',
          elevator_pitch: data.business_description ?? '',
          tone_of_voice: 'Profesional y cálido',
          target_customers: data.target_customers,
          differentiators: data.differentiators,
        })
      }

      if (data.products && data.products.length > 0) {
        for (const product of data.products) {
          await supabase.from('products').insert({
            business_id: activeBusinessId,
            name: product.name,
            price: product.price ?? null,
            description: product.description ?? null,
            benefits: product.benefits ?? null,
          })
        }
      }

      if (data.rules && data.rules.length > 0) {
        for (const rule of data.rules) {
          await supabase.from('sales_rules').insert({
            business_id: activeBusinessId,
            category: rule.category as 'zones' | 'payment' | 'schedule' | 'promotions' | 'restrictions',
            content: rule.content,
          })
        }
      }

      const assistantName = data.assistant_name ?? 'MIA'
      const { data: assistant } = await supabase
        .from('assistants')
        .insert({
          business_id: activeBusinessId,
          name: assistantName,
          personality: { warmth: 80, formality: 40, humor: 50, sales_aggressiveness: 50 },
          communication_style: 'warm',
        })
        .select()
        .single()

      if (assistant) {
        await supabase.from('assistant_channels').insert({
          assistant_id: assistant.id,
          channel: 'web',
        })
      }

      await supabase
        .from('businesses')
        .update({ onboarding_status: 'ready' })
        .eq('id', activeBusinessId)

      const completionMessage = `Gracias por enseñarme todo esto. Ya conozco lo esencial sobre ${data.business_name ?? 'tu negocio'}.

Todavía me falta aprender los productos, promociones y algunos detalles, pero ya tengo una buena base para empezar.

Estoy lista para seguir aprendiendo. Vamos al dashboard para que me enseñes más.`

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: completionMessage,
        },
      ])

      setTimeout(() => {
        router.push('/dashboard')
      }, 4000)
    } catch (error) {
      console.error('Error creating business:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const stepLabels: Record<string, string> = {
    business_info: 'Negocio',
    products: 'Productos',
    rules: 'Reglas',
    personality: 'Asistente',
  }

  const stepIcons: Record<string, string> = {
    business_info: '🏢',
    products: '📦',
    rules: '📋',
    personality: '🤖',
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          {Object.entries(stepLabels).map(([key, label]) => (
            <div
              key={key}
              className={cn(
                'flex-1 text-center py-2 rounded-lg text-sm font-medium transition-all',
                completedSteps.has(key)
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-zinc-100 text-zinc-400 border border-zinc-100'
              )}
            >
              {completedSteps.has(key) ? '✅' : stepIcons[key]} {label}
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 text-center">
          {completedSteps.size === 0
            ? "Estoy conociéndote"
            : completedSteps.size < 4
              ? `Ya sé ${completedSteps.size} de 4 cosas sobre tu negocio`
              : "Estoy lista para empezar a trabajar"}
        </p>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="p-4 border-b bg-gradient-to-r from-violet-50 to-fuchsia-50">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">M</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-gray-900">MIA</h3>
              <p className="text-sm text-gray-500">Tu nueva asistente de ventas</p>
            </div>
          </div>
        </div>

        <div className="h-96 overflow-y-auto p-4 space-y-4">
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
                    : 'bg-zinc-100 text-zinc-900'
                )}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 rounded-2xl px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 border-t bg-zinc-50">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cuéntame sobre tu negocio..."
              disabled={isLoading || isCreating}
              className="bg-white"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim() || isCreating}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isCreating ? 'Creando...' : isLoading ? '...' : 'Enviar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

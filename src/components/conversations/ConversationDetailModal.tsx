'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { User, Bot, Brain, Plus, X, MessageSquare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MemoryPanel } from '@/components/customers/MemoryPanel'

interface Message {
  id: string
  role: string
  content: string
  created_at: string
}

interface ConversationDetailModalProps {
  open: boolean
  onClose: () => void
  conversationId: string
  customerName: string
  customerPhone: string | null
  assistantName: string
  status: string
  customerId: string | null
  assistantId: string
  businessId: string
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof User; align: 'left' | 'right'; bg: string }> = {
  user: { label: 'Cliente', icon: User, align: 'left', bg: 'var(--elevation-3)' },
  assistant: { label: 'MIA', icon: Bot, align: 'right', bg: 'var(--atmosphere-accent)' },
  system: { label: 'Sistema', icon: MessageSquare, align: 'left', bg: 'var(--elevation-2)' },
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-emerald-500/10 text-emerald-600' },
  waiting: { label: 'Espera', className: 'bg-amber-500/10 text-amber-600' },
  completed: { label: 'Completada', className: 'bg-blue-500/10 text-blue-600' },
  abandoned: { label: 'Abandonada', className: 'bg-red-500/10 text-red-600' },
  archived: { label: 'Archivada', className: 'bg-gray-500/10 text-gray-500' },
}

const CATEGORIES = [
  { value: 'faq', label: 'Pregunta frecuente' },
  { value: 'objection', label: 'Manejo de objeciones' },
  { value: 'tip', label: 'Consejo / Tip' },
  { value: 'process', label: 'Proceso / Procedimiento' },
  { value: 'policy', label: 'Política' },
  { value: 'product', label: 'Producto' },
  { value: 'other', label: 'Otro' },
]

export function ConversationDetailModal({
  open,
  onClose,
  conversationId,
  customerName,
  customerPhone,
  assistantName,
  status,
  customerId,
  assistantId,
  businessId,
}: ConversationDetailModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addKnowledgeFor, setAddKnowledgeFor] = useState<string | null>(null)
  const [knowledgeForm, setKnowledgeForm] = useState({ question: '', answer: '', category: 'faq' })
  const [savingKnowledge, setSavingKnowledge] = useState(false)
  const [knowledgeSaved, setKnowledgeSaved] = useState(false)

  const prevOpen = useRef(false)

  useEffect(() => {
    if (open && !prevOpen.current) {
      setMessages([])
      setLoading(true)
      setError(null)
      setAddKnowledgeFor(null)
      setKnowledgeSaved(false)
    }
    prevOpen.current = open
  }, [open])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const controller = new AbortController()

    fetch(`/api/conversations/${conversationId}/messages`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const allMessages = (data.messages ?? []) as Message[]
        setMessages(allMessages.slice(-5))
        setLoading(false)
        setAddKnowledgeFor(null)
        setKnowledgeSaved(false)
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return
        setError('No se pudieron cargar los mensajes')
        setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open, conversationId])

  function handleStartAddKnowledge(msg: Message) {
    const pairMessages = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    const idx = pairMessages.findIndex((m) => m.id === msg.id)
    const question = msg.role === 'user'
      ? msg.content
      : (pairMessages[idx - 1]?.content ?? msg.content)
    const answer = msg.role === 'assistant'
      ? msg.content
      : (pairMessages[idx + 1]?.content ?? '')

    setAddKnowledgeFor(msg.id)
    setKnowledgeForm({ question, answer, category: 'faq' })
    setKnowledgeSaved(false)
  }

  async function saveKnowledge() {
    setSavingKnowledge(true)
    try {
      const res = await fetch('/api/knowledge/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          category: knowledgeForm.category,
          question: knowledgeForm.question,
          answer: knowledgeForm.answer,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setKnowledgeSaved(true)
      setTimeout(() => {
        setAddKnowledgeFor(null)
        setKnowledgeSaved(false)
      }, 1500)
    } catch {
      // error handled silently
    } finally {
      setSavingKnowledge(false)
    }
  }

  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.archived

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Popup className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border shadow-xl overflow-hidden" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--elevation-3)' }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--elevation-3)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--atmosphere-accent)', color: '#fff' }}>
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DialogPrimitive.Title className="text-sm font-semibold truncate" style={{ color: 'var(--atmosphere-text)' }}>
                    {customerName}
                  </DialogPrimitive.Title>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusConfig.className}`}>
                    {statusConfig.label}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                  {assistantName}
                </p>
                {customerPhone && (
                  <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.7 }}>
                    {customerPhone}
                  </p>
                )}
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1.5 transition-colors hover:bg-black/5">
              <X className="h-4 w-4" style={{ color: 'var(--atmosphere-text-secondary)' }} />
            </DialogPrimitive.Close>
          </div>

          {/* Messages */}
          <div className="max-h-[50vh] overflow-y-auto px-5 py-4 space-y-3">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--atmosphere-text-secondary)' }} />
              </div>
            )}

            {error && (
              <div className="text-center text-sm py-8" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                {error}
              </div>
            )}

            {!loading && !error && messages.length === 0 && (
              <div className="text-center text-sm py-8" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                Sin mensajes en esta conversación
              </div>
            )}

            {!loading && !error && messages.map((msg) => {
              const config = ROLE_CONFIG[msg.role] ?? ROLE_CONFIG.system
              const isRight = config.align === 'right'
              const isAdding = addKnowledgeFor === msg.id

              return (
                <div key={msg.id}>
                  <div className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${isRight ? 'order-1' : 'order-1'}`}>
                      <div className={`flex items-start gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5" style={{ backgroundColor: isRight ? 'var(--atmosphere-accent)' : 'var(--elevation-3)', color: isRight ? '#fff' : 'var(--atmosphere-text-secondary)' }}>
                          <config.icon className="h-3 w-3" />
                        </div>
                        <div>
                          <div
                            className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                            style={{
                              backgroundColor: isRight ? 'var(--atmosphere-accent)' : config.bg,
                              color: isRight ? '#fff' : 'var(--atmosphere-text)',
                            }}
                          >
                            {msg.content}
                          </div>
                          <div className={`mt-0.5 flex items-center gap-2 ${isRight ? 'justify-end' : ''}`}>
                            <span className="text-[10px]" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                              {config.label}
                            </span>
                            <span className="text-[10px]" style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}>
                              {new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {(msg.role === 'user' || msg.role === 'assistant') && (
                              <button
                                onClick={() => handleStartAddKnowledge(msg)}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors hover:bg-black/5"
                                style={{ color: 'var(--atmosphere-accent)' }}
                              >
                                <Plus className="h-2.5 w-2.5" />
                                MIA
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isAdding && (
                    <div className="mt-2 ml-8 rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--elevation-3)', backgroundColor: 'var(--elevation-2)' }}>
                      {knowledgeSaved ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
                          <Brain className="h-3.5 w-3.5" />
                          Guardado en la base de conocimiento
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>
                              Agregar a conocimiento MIA
                            </span>
                            <button onClick={() => setAddKnowledgeFor(null)} className="rounded p-0.5 hover:bg-black/5">
                              <X className="h-3 w-3" style={{ color: 'var(--atmosphere-text-secondary)' }} />
                            </button>
                          </div>

                          <select
                            value={knowledgeForm.category}
                            onChange={(e) => setKnowledgeForm((f) => ({ ...f, category: e.target.value }))}
                            className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
                            style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>

                          <input
                            value={knowledgeForm.question}
                            onChange={(e) => setKnowledgeForm((f) => ({ ...f, question: e.target.value }))}
                            placeholder="Pregunta / triggers..."
                            className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
                            style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
                          />

                          <textarea
                            value={knowledgeForm.answer}
                            onChange={(e) => setKnowledgeForm((f) => ({ ...f, answer: e.target.value }))}
                            placeholder="Respuesta / conocimiento..."
                            rows={3}
                            className="w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
                            style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
                          />

                          <Button
                            size="sm"
                            onClick={saveKnowledge}
                            disabled={savingKnowledge || !knowledgeForm.question || !knowledgeForm.answer}
                          >
                            {savingKnowledge ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Brain className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Guardar conocimiento
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Memory Section */}
          {customerId && (
            <div className="border-t px-5 py-4" style={{ borderColor: 'var(--elevation-3)' }}>
              <MemoryPanel customerId={customerId} assistantId={assistantId} />
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { Brain, Check, ChevronDown, ChevronUp, Edit3, Plus, Trash2, Loader2, User, Phone, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CustomerMemory {
  interests: string[]
  objections: string[]
  questions: string[]
  preferences: string[]
  summary: string
  lastInteraction: string | null
}

interface MemoryDiff {
  newInterests: string[]
  newObjections: string[]
  newPreferences: string[]
  newQuestions: string[]
  summaryChanged: boolean
}

interface MemorySuggestion {
  customerId: string
  customerName: string | null
  phone: string | null
  existingMemory: CustomerMemory | null
  proposedMemory: CustomerMemory
  diff: MemoryDiff
  conversationCount: number
  messageCount: number
}

interface CustomerListItem {
  id: string
  name: string | null
  phone: string | null
  hasMemory: boolean
  assistantId: string
}

export function MemorySuggestionsPanel() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [suggestions, setSuggestions] = useState<MemorySuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<CustomerMemory>>({})
  const [manualForm, setManualForm] = useState({ customerId: '', interests: '', objections: '', preferences: '', summary: '' })
  const [showManual, setShowManual] = useState(false)
  const [collapsed, setCollapsed] = useState(true)

  const withMemory = customers.filter((c) => c.hasMemory).length
  const withoutMemory = customers.filter((c) => !c.hasMemory).length

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customers/memory/batch')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCustomers(data.customers ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const extractMissing = useCallback(async () => {
    setLoading(true)
    try {
      const res1 = await fetch('/api/customers/memory/batch')
      if (!res1.ok) throw new Error('Failed')
      const data1 = await res1.json()
      const allCustomers: CustomerListItem[] = data1.customers ?? []
      setCustomers(allCustomers)

      const missing = allCustomers.filter((c) => !c.hasMemory)
      if (missing.length === 0) return

      const res2 = await fetch('/api/customers/memory/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: missing.map((c) => ({ customerId: c.id, assistantId: c.assistantId })),
        }),
      })
      if (!res2.ok) throw new Error('Failed')
      const data2 = await res2.json()
      setSuggestions(data2.suggestions ?? [])
      setCollapsed(false)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const extractAll = useCallback(async () => {
    setLoading(true)
    try {
      const res1 = await fetch('/api/customers/memory/batch')
      if (!res1.ok) throw new Error('Failed')
      const data1 = await res1.json()
      const allCustomers: CustomerListItem[] = data1.customers ?? []
      setCustomers(allCustomers)

      if (allCustomers.length === 0) return

      const res2 = await fetch('/api/customers/memory/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: allCustomers.map((c) => ({ customerId: c.id, assistantId: c.assistantId })),
        }),
      })
      if (!res2.ok) throw new Error('Failed')
      const data2 = await res2.json()
      setSuggestions(data2.suggestions ?? [])
      setCollapsed(false)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const approveOne = useCallback(async (suggestion: MemorySuggestion) => {
    const memoryToSave = editingId === suggestion.customerId
      ? { ...suggestion.proposedMemory, ...editForm }
      : suggestion.proposedMemory

    setApproving(suggestion.customerId)
    try {
      const res = await fetch('/api/customers/memory/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: suggestion.customerId, memory: memoryToSave }),
      })
      if (!res.ok) throw new Error('Failed')
      setSuggestions((prev) => prev.filter((s) => s.customerId !== suggestion.customerId))
      setCustomers((prev) => prev.map((c) => c.id === suggestion.customerId ? { ...c, hasMemory: true } : c))
      setEditingId(null)
      setEditForm({})
    } catch {
      // silent
    } finally {
      setApproving(null)
    }
  }, [editingId, editForm])

  const approveAll = useCallback(async () => {
    setApproving('all')
    try {
      for (const s of suggestions) {
        await fetch('/api/customers/memory/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId: s.customerId, memory: s.proposedMemory }),
        })
      }
      setSuggestions([])
      setCustomers((prev) => prev.map((c) => ({ ...c, hasMemory: true })))
    } catch {
      // silent
    } finally {
      setApproving(null)
    }
  }, [suggestions])

  const addManual = useCallback(async () => {
    if (!manualForm.customerId) return
    const memory: CustomerMemory = {
      interests: manualForm.interests ? manualForm.interests.split(',').map((s) => s.trim()).filter(Boolean) : [],
      objections: manualForm.objections ? manualForm.objections.split(',').map((s) => s.trim()).filter(Boolean) : [],
      questions: [],
      preferences: manualForm.preferences ? manualForm.preferences.split(',').map((s) => s.trim()).filter(Boolean) : [],
      summary: manualForm.summary,
      lastInteraction: null,
    }
    setApproving(manualForm.customerId)
    try {
      const res = await fetch('/api/customers/memory/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: manualForm.customerId, memory }),
      })
      if (!res.ok) throw new Error('Failed')
      setCustomers((prev) => prev.map((c) => c.id === manualForm.customerId ? { ...c, hasMemory: true } : c))
      setManualForm({ customerId: '', interests: '', objections: '', preferences: '', summary: '' })
      setShowManual(false)
    } catch {
      // silent
    } finally {
      setApproving(null)
    }
  }, [manualForm])

  const diffCount = (diff: MemoryDiff) =>
    diff.newInterests.length + diff.newObjections.length +
    diff.newPreferences.length + diff.newQuestions.length +
    (diff.summaryChanged ? 1 : 0)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--elevation-3)', backgroundColor: 'var(--card)' }}>
      <button
        onClick={() => { setCollapsed(!collapsed); if (customers.length === 0) fetchCustomers() }}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: 'var(--atmosphere-accent)', color: '#fff' }}>
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--atmosphere-text)' }}>Memoria de Clientes</span>
            {customers.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                {withMemory} con memoria · {withoutMemory} sin memoria
              </p>
            )}
          </div>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--atmosphere-text-secondary)' }} /> : <ChevronUp className="h-4 w-4" style={{ color: 'var(--atmosphere-text-secondary)' }} />}
      </button>

      {!collapsed && (
        <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: 'var(--elevation-3)' }}>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={extractMissing} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Brain className="h-3.5 w-3.5 mr-1.5" />}
              Extraer faltantes
            </Button>
            <Button size="sm" variant="outline" onClick={extractAll} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5 mr-1.5" />}
              Extraer todas
            </Button>
            {suggestions.length > 0 && (
              <Button size="sm" onClick={approveAll} disabled={approving === 'all'}>
                {approving === 'all' ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                Aprobar todas ({suggestions.length})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowManual(!showManual)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Agregar manual
            </Button>
          </div>

          {showManual && (
            <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--elevation-3)', backgroundColor: 'var(--elevation-2)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: 'var(--atmosphere-text)' }}>Agregar memoria manual</span>
                <button onClick={() => setShowManual(false)} className="rounded p-0.5 hover:bg-black/5">
                  <Trash2 className="h-3 w-3" style={{ color: 'var(--atmosphere-text-secondary)' }} />
                </button>
              </div>
              <select
                value={manualForm.customerId}
                onChange={(e) => setManualForm((f) => ({ ...f, customerId: e.target.value }))}
                className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
              >
                <option value="">Seleccionar cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name ?? c.phone ?? c.id.slice(0, 8)}</option>
                ))}
              </select>
              <input
                value={manualForm.interests}
                onChange={(e) => setManualForm((f) => ({ ...f, interests: e.target.value }))}
                placeholder="Intereses (separados por coma)"
                className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
              />
              <input
                value={manualForm.objections}
                onChange={(e) => setManualForm((f) => ({ ...f, objections: e.target.value }))}
                placeholder="Objeciones (separadas por coma)"
                className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
              />
              <input
                value={manualForm.preferences}
                onChange={(e) => setManualForm((f) => ({ ...f, preferences: e.target.value }))}
                placeholder="Preferencias (separadas por coma)"
                className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
              />
              <textarea
                value={manualForm.summary}
                onChange={(e) => setManualForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Resumen del cliente"
                rows={2}
                className="w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
              />
              <Button size="sm" onClick={addManual} disabled={!manualForm.customerId || approving === manualForm.customerId}>
                {approving === manualForm.customerId ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                Guardar
              </Button>
            </div>
          )}

          {suggestions.length === 0 && !loading && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--atmosphere-text-secondary)' }}>
              {customers.length === 0
                ? 'Cargando clientes...'
                : 'No hay sugerencias pendientes. Usa "Extraer faltantes" o "Extraer todas" para generar sugerencias.'}
            </p>
          )}

          {suggestions.map((s) => {
            const expanded = expandedId === s.customerId
            const editing = editingId === s.customerId
            const diff = s.diff
            const diffItems = diffCount(diff)

            return (
              <div key={s.customerId} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--elevation-3)' }}>
                <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer" onClick={() => setExpandedId(expanded ? null : s.customerId)}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--elevation-3)', color: 'var(--atmosphere-text-secondary)' }}>
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--atmosphere-text)' }}>
                          {s.customerName ?? 'Sin nombre'}
                        </span>
                        {s.phone && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                            <Phone className="h-2.5 w-2.5" />
                            {s.phone}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px]" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                        {s.conversationCount} conversaciones · {s.messageCount} mensajes
                        {diffItems > 0 && ` · ${diffItems} cambios`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!s.existingMemory && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        Nueva
                      </span>
                    )}
                    {s.existingMemory && diffItems > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        +{diffItems}
                      </span>
                    )}
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" style={{ color: 'var(--atmosphere-text-secondary)' }} /> : <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--atmosphere-text-secondary)' }} />}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: 'var(--elevation-3)' }}>
                    {s.existingMemory && (
                      <div>
                        <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--atmosphere-text-secondary)' }}>Memoria actual</p>
                        <MemoryDisplay memory={s.existingMemory} dimmed />
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--atmosphere-text-secondary)' }}>
                        {s.existingMemory ? 'Propuesta de actualización' : 'Memoria propuesta'}
                      </p>
                      {editing ? (
                        <EditForm form={editForm} setForm={setEditForm} />
                      ) : (
                        <MemoryDisplay memory={s.proposedMemory} diff={diff} />
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => approveOne(s)}
                        disabled={approving === s.customerId}
                      >
                        {approving === s.customerId ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                        {s.existingMemory && diffItems > 0 ? 'Aprobar cambios' : 'Aprobar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (editing) {
                            setEditingId(null)
                            setEditForm({})
                          } else {
                            setEditingId(s.customerId)
                            setEditForm({
                              interests: s.proposedMemory.interests,
                              objections: s.proposedMemory.objections,
                              preferences: s.proposedMemory.preferences,
                              summary: s.proposedMemory.summary,
                            })
                          }
                        }}
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                        {editing ? 'Cancelar' : 'Editar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSuggestions((prev) => prev.filter((p) => p.customerId !== s.customerId))}
                      >
                        Rechazar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MemoryDisplay({ memory, diff, dimmed }: { memory: CustomerMemory; diff?: MemoryDiff; dimmed?: boolean }) {
  const opacity = dimmed ? 'opacity-50' : ''
  const tagColors: Record<string, string> = {
    interests: 'bg-emerald-100 text-emerald-700',
    objections: 'bg-amber-100 text-amber-700',
    preferences: 'bg-blue-100 text-blue-700',
    questions: 'bg-purple-100 text-purple-700',
  }
  const diffTagColors: Record<string, string> = {
    newInterests: 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400',
    newObjections: 'bg-amber-200 text-amber-800 ring-1 ring-amber-400',
    newPreferences: 'bg-blue-200 text-blue-800 ring-1 ring-blue-400',
    newQuestions: 'bg-purple-200 text-purple-800 ring-1 ring-purple-400',
  }

  const sections: Array<{ label: string; items: string[]; key: keyof CustomerMemory; diffKey?: keyof MemoryDiff }> = [
    { label: 'Intereses', items: memory.interests, key: 'interests', diffKey: 'newInterests' },
    { label: 'Objeciones', items: memory.objections, key: 'objections', diffKey: 'newObjections' },
    { label: 'Preferencias', items: memory.preferences, key: 'preferences', diffKey: 'newPreferences' },
    { label: 'Preguntas', items: memory.questions, key: 'questions', diffKey: 'newQuestions' },
  ]

  return (
    <div className={`space-y-1.5 ${opacity}`}>
      {memory.summary && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--atmosphere-text)' }}>{memory.summary}</p>
      )}
      {sections.map((sec) => {
        if (sec.items.length === 0) return null
        const newItems = diff && sec.diffKey && sec.diffKey !== 'summaryChanged' ? diff[sec.diffKey] as string[] : []
        const newSet = new Set(newItems)
        return (
          <div key={sec.key} className="flex flex-wrap gap-1">
            <span className="text-[10px] font-medium" style={{ color: 'var(--atmosphere-text-secondary)' }}>{sec.label}:</span>
            {sec.items.map((item) => {
              const isNew = newSet.has(item)
              return (
                <span
                  key={item}
                  className={`rounded-full px-2 py-0.5 text-[10px] ${isNew ? diffTagColors[sec.diffKey ?? ''] : tagColors[sec.key]}`}
                >
                  {isNew && '+ '}{item}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function EditForm({ form, setForm }: { form: Partial<CustomerMemory>; setForm: (f: Partial<CustomerMemory>) => void }) {
  return (
    <div className="space-y-2">
      <input
        value={form.interests?.join(', ') ?? ''}
        onChange={(e) => setForm({ ...form, interests: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        placeholder="Intereses (separados por coma)"
        className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
        style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
      />
      <input
        value={form.objections?.join(', ') ?? ''}
        onChange={(e) => setForm({ ...form, objections: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        placeholder="Objeciones (separadas por coma)"
        className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
        style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
      />
      <input
        value={form.preferences?.join(', ') ?? ''}
        onChange={(e) => setForm({ ...form, preferences: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        placeholder="Preferencias (separadas por coma)"
        className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
        style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
      />
      <textarea
        value={form.summary ?? ''}
        onChange={(e) => setForm({ ...form, summary: e.target.value })}
        placeholder="Resumen del cliente"
        rows={2}
        className="w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none"
        style={{ borderColor: 'var(--elevation-3)', color: 'var(--atmosphere-text)' }}
      />
    </div>
  )
}

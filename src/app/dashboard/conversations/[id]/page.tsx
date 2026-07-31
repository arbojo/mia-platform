import { requireAuth } from '@/lib/auth'
import { getConversationDetail } from '@/lib/dashboard/conversations'
import { TranscriptView } from '@/components/conversations/TranscriptView'
import { CustomerInfoCard } from '@/components/conversations/CustomerInfoCard'
import { AssistantMemories } from '@/components/conversations/AssistantMemories'
import { ConversationOutcomeSelector } from '@/components/conversations/ConversationOutcomeSelector'
import Link from 'next/link'
import { ArrowLeft, Archive, Play, Tag } from 'lucide-react'
import { notFound } from 'next/navigation'

const typeLabels: Record<string, string> = {
  live: 'En vivo',
  training: 'Entrenamiento',
  simulation: 'Simulación',
}

const typeColors: Record<string, string> = {
  live: 'var(--mia-green)',
  training: 'var(--mia-blue)',
  simulation: 'var(--mia-violet)',
}

const outcomeLabels: Record<string, string> = {
  pending: 'Pendiente',
  interested: 'Interesado',
  not_interested: 'No interesado',
  sold: 'Vendido',
  needs_follow_up: 'Seguimiento',
}

const outcomeColors: Record<string, string> = {
  pending: 'var(--atmosphere-text-secondary)',
  interested: 'var(--mia-blue)',
  not_interested: 'var(--mia-platinum)',
  sold: 'var(--mia-green)',
  needs_follow_up: 'var(--mia-gold)',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .single()

  if (!business) notFound()

  const detail = await getConversationDetail(supabase, business.id, id)

  if (!detail) notFound()

  const { conversation, customer, messages, memories } = detail
  const typeColor = typeColors[conversation.type] ?? 'var(--atmosphere-text-secondary)'

  return (
    <div className="animate-appear-up space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/conversations"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200"
          style={{
            backgroundColor: 'var(--elevation-2)',
            color: 'var(--atmosphere-text)',
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1
              className="text-lg font-semibold"
              style={{ color: 'var(--atmosphere-text)' }}
            >
              {customer?.name ?? 'Conversación'}
            </h1>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: `${typeColor}15`, color: typeColor }}
            >
              {typeLabels[conversation.type] ?? conversation.type}
            </span>
            {conversation.status === 'archived' && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: 'var(--atmosphere-text-secondary)',
                }}
              >
                Archivada
              </span>
            )}
          </div>
          <p
            className="mt-0.5 text-sm"
            style={{ color: 'var(--atmosphere-text-secondary)' }}
          >
            {formatDate(conversation.created_at)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div
            className="rounded-xl border"
            style={{
              backgroundColor: 'var(--elevation-1)',
              borderColor: 'var(--atmosphere-border)',
            }}
          >
            <div
              className="flex items-center gap-2 border-b px-5 py-3"
              style={{ borderColor: 'var(--atmosphere-border)' }}
            >
              <Play className="h-4 w-4" style={{ color: 'var(--atmosphere-accent)' }} />
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--atmosphere-text)' }}
              >
                Transcripción
              </span>
              <span
                className="ml-auto text-xs"
                style={{ color: 'var(--atmosphere-text-secondary)' }}
              >
                {messages.length} mensajes
              </span>
            </div>
            <div className="p-5">
              <TranscriptView messages={messages} />
            </div>
          </div>

          {memories.length > 0 && (
            <AssistantMemories memories={memories} />
          )}
        </div>

        <div className="space-y-4">
          {customer && <CustomerInfoCard customer={customer} />}

          <div
            className="rounded-xl border p-5"
            style={{
              backgroundColor: 'var(--elevation-1)',
              borderColor: 'var(--atmosphere-border)',
            }}
          >
            <h3
              className="mb-3 text-sm font-semibold tracking-tight"
              style={{ color: 'var(--atmosphere-text)' }}
            >
              Resultado
            </h3>

            {conversation.outcome && (
              <div className="mb-4 flex items-center gap-2">
                <Tag className="h-4 w-4" style={{ color: outcomeColors[conversation.outcome] ?? 'var(--atmosphere-text-secondary)' }} />
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${outcomeColors[conversation.outcome] ?? 'var(--atmosphere-text-secondary)'}20`,
                    color: outcomeColors[conversation.outcome] ?? 'var(--atmosphere-text-secondary)',
                  }}
                >
                  {outcomeLabels[conversation.outcome] ?? conversation.outcome}
                </span>
                {conversation.deal_value && (
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: 'var(--mia-green)' }}
                  >
                    ${conversation.deal_value.toLocaleString()}
                  </span>
                )}
                {conversation.potential_value && (
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: 'var(--mia-gold)' }}
                  >
                    ${conversation.potential_value.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            <ConversationOutcomeSelector
              conversationId={conversation.id}
              currentOutcome={conversation.outcome}
              currentDealValue={conversation.deal_value}
              currentPotentialValue={conversation.potential_value}
            />
          </div>

          <div
            className="rounded-xl border p-5"
            style={{
              backgroundColor: 'var(--elevation-1)',
              borderColor: 'var(--atmosphere-border)',
            }}
          >
            <h3
              className="mb-3 text-sm font-semibold tracking-tight"
              style={{ color: 'var(--atmosphere-text)' }}
            >
              Detalles
            </h3>
            <div className="space-y-2 text-sm">
              <div
                className="flex items-center justify-between"
                style={{ color: 'var(--atmosphere-text-secondary)' }}
              >
                <span style={{ opacity: 0.6 }}>Estado</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                  style={{
                    backgroundColor:
                      conversation.status === 'active'
                        ? 'rgba(76, 175, 80, 0.15)'
                        : 'rgba(255,255,255,0.06)',
                    color:
                      conversation.status === 'active'
                        ? 'var(--mia-green)'
                        : 'var(--atmosphere-text-secondary)',
                  }}
                >
                  {conversation.status === 'active' ? 'Activa' : 'Archivada'}
                </span>
              </div>
              {conversation.assigned_to && (
                <div
                  className="flex items-center justify-between"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                >
                  <span style={{ opacity: 0.6 }}>Asignada a</span>
                  <span style={{ color: 'var(--atmosphere-text)' }}>
                    {conversation.assigned_to}
                  </span>
                </div>
              )}
              {conversation.handover_reason && (
                <div>
                  <span
                    className="mb-1 block text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
                  >
                    Motivo de transferencia
                  </span>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--atmosphere-text-secondary)' }}
                  >
                    {conversation.handover_reason}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 space-y-2">
              {conversation.status === 'active' && (
                <form
                  action={`/api/conversations/${conversation.id}/archive`}
                  method="POST"
                >
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--elevation-2)',
                      color: 'var(--atmosphere-text)',
                    }}
                  >
                    <Archive className="h-4 w-4" />
                    Archivar conversación
                  </button>
                </form>
              )}
              <Link
                href="/dashboard/conversations"
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200"
                style={{
                  backgroundColor: 'var(--elevation-2)',
                  color: 'var(--atmosphere-text-secondary)',
                }}
              >
                Volver a conversaciones
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

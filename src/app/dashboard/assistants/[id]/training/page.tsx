import { requirePageAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { TrainingChat } from '@/components/chat/TrainingChat'
import { MemoryTimeline } from '@/components/training/MemoryTimeline'

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requirePageAuth()

  const { data: assistant } = await supabase
    .from('assistants')
    .select('*')
    .eq('id', id)
    .single()

  if (!assistant) {
    notFound()
  }

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('assistant_id', id)
    .eq('type', 'training')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let conversationId = conversation?.id

  if (!conversationId) {
    const admin = createAdminClient()
    const { data: newConversation } = await admin
      .from('conversations')
      .insert({
        assistant_id: id,
        type: 'training',
      })
      .select('id')
      .single()

    conversationId = newConversation?.id
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
      <div className="lg:col-span-2">
        <TrainingChat
          assistantName={assistant.name}
          assistantId={id}
          conversationId={conversationId}
        />
      </div>
      <div className="overflow-y-auto">
        <MemoryTimeline assistantId={id} />
      </div>
    </div>
  )
}

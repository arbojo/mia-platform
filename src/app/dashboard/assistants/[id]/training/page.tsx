import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { TrainingChat } from '@/components/chat/TrainingChat'

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireAuth()

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
    .single()

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
    <div className="h-[calc(100vh-8rem)]">
      <TrainingChat
        assistantName={assistant.name}
        assistantId={id}
        conversationId={conversationId}
      />
    </div>
  )
}

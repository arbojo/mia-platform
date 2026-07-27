'use client'

import { ChatWindow } from '@/components/chat/ChatWindow'

interface TrainingChatProps {
  assistantName: string
  assistantId: string
  conversationId?: string
}

export function TrainingChat({ assistantName, assistantId, conversationId }: TrainingChatProps) {
  const handleCorrection = async (messageId: string, correction: string, originalContent: string) => {
    const action = correction === 'approve' ? 'approve' : 'correct'

    await fetch('/api/training/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: messageId,
        assistant_id: assistantId,
        original_response: originalContent,
        corrected_response: action === 'correct' ? correction : undefined,
        action,
      }),
    })
  }

  return (
    <ChatWindow
      assistantName={assistantName}
      assistantId={assistantId}
      conversationId={conversationId}
      onCorrection={handleCorrection}
    />
  )
}

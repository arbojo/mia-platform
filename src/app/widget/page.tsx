'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { ChatWindow } from '@/components/chat/ChatWindow'

function getVisitorId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID()
  const key = 'mia_widget_visitor'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

export default function WidgetPage() {
  const [assistantName] = useState(() => {
    if (typeof window === 'undefined') return 'MIA'
    return new URLSearchParams(window.location.search).get('name') || 'MIA'
  })
  const [assistantId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('assistantId')
  })
  const [greeting] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    return new URLSearchParams(window.location.search).get('greeting') || undefined
  })
  const [landingContext] = useState(() => {
    if (typeof window === 'undefined') return undefined
    const params = new URLSearchParams(window.location.search)
    const landingId = params.get('landingId')
    if (!landingId) return undefined
    return {
      landingId,
      brand: params.get('brand') || undefined,
      product: params.get('product') || undefined,
    }
  })
  const [visitorId] = useState(getVisitorId)

  if (!assistantId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500 text-sm">Widget no configurado</p>
      </div>
    )
  }

  return (
    <div className="relative h-screen w-screen">
      <button
        aria-label="Cerrar chat"
        onClick={() => window.parent.postMessage({ type: 'mia-widget-close' }, '*')}
        className="absolute top-3 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-md hover:opacity-80 transition-opacity"
      >
        <X className="w-5 h-5 text-gray-600" />
      </button>
      <ChatWindow
        assistantName={assistantName}
        assistantId={assistantId}
        apiEndpoint="/api/widget/chat"
        customerExternalId={visitorId}
        greeting={greeting}
        landingContext={landingContext}
      />
    </div>
  )
}

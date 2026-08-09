'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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

function WidgetContent() {
  const searchParams = useSearchParams()
  const [visitorId] = useState(getVisitorId)

  const assistantName = searchParams.get('name') || 'MIA'
  const assistantId = searchParams.get('assistantId')
  const greeting = searchParams.get('greeting') || undefined
  const landingId = searchParams.get('landingId')
  const landingContext = landingId
    ? {
        landingId,
        brand: searchParams.get('brand') || undefined,
        product: searchParams.get('product') || undefined,
        productId: searchParams.get('productId') || undefined,
      }
    : undefined

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
        widgetCloseEndpoint="/api/widget/close"
        greeting={greeting}
        landingContext={landingContext}
      />
    </div>
  )
}

export default function WidgetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-gray-50">
          <p className="text-gray-500 text-sm">Cargando…</p>
        </div>
      }
    >
      <WidgetContent />
    </Suspense>
  )
}

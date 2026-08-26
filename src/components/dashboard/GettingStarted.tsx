'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, Check, ArrowRight, MessageSquare, BookOpen, Settings } from 'lucide-react'

interface GettingStartedProps {
  assistantId: string
  assistantName: string
}

const steps = [
  {
    icon: Settings,
    title: 'Configura tu asistente',
    description: 'Ajusta la personalidad y nombre de tu asistente.',
    href: '/dashboard/assistants',
    done: false,
  },
  {
    icon: BookOpen,
    title: 'Agrega conocimiento',
    description: 'Enseña a MIA sobre tus productos, precios y políticas.',
    href: '/dashboard/knowledge',
    done: false,
  },
  {
    icon: MessageSquare,
    title: 'Prueba en entrenamiento',
    description: 'Simula conversaciones para verificar que MIA responde bien.',
    href: '/dashboard/laboratorio',
    done: false,
  },
]

export function GettingStarted({ assistantId, assistantName }: GettingStartedProps) {
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const embedCode = `<script\n  src="https://TU-DOMINIO/widget.js"\n  data-assistant-id="${assistantId}"\n  data-name="${assistantName}"\n  data-color="#7c3aed"\n  data-label="Habla con ${assistantName}"\n></script>`

  return (
    <div className="rounded-2xl border-2 border-dashed p-6 space-y-5" style={{ borderColor: 'var(--brand-primary, #7c3aed)', backgroundColor: 'var(--elevation-1)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
          Primeros pasos con {assistantName}
        </h3>
        <button onClick={() => setDismissed(true)} className="text-xs opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Ocultar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step) => (
          <Link
            key={step.title}
            href={step.href}
            className="group rounded-xl p-4 border transition-all hover:border-[var(--brand-primary, #7c3aed)] hover:shadow-sm"
            style={{ borderColor: 'var(--elevation-3, rgba(0,0,0,0.08))', backgroundColor: 'var(--elevation-2)' }}
          >
            <step.icon className="h-5 w-5 mb-2 opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--brand-primary, #7c3aed)' }} />
            <div className="text-sm font-medium" style={{ color: 'var(--atmosphere-text)' }}>{step.title}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--atmosphere-text-secondary)' }}>{step.description}</div>
          </Link>
        ))}
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--elevation-2)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            Pega este código en tu sitio web para activar el chat:
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(embedCode)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-black/5 transition-colors"
            style={{ color: 'var(--brand-primary, #7c3aed)' }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          {embedCode}
        </pre>
      </div>

      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--atmosphere-text-secondary)' }}>
        <ArrowRight className="h-3 w-3" />
        Una vez pegado, tus clientes verán el botón de chat en tu sitio y podrán hablar con {assistantName}.
      </div>
    </div>
  )
}

'use client'

interface UsageBarProps {
  tokensInput: number
  tokensOutput: number
  cost: number
  messageCount: number
  model: string
  onExport?: () => void
}

export function UsageBar({
  tokensInput,
  tokensOutput,
  cost,
  messageCount,
  model,
  onExport,
}: UsageBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t text-xs text-gray-600">
      <div className="flex gap-4">
        <span>
          Tokens: <strong>{tokensInput.toLocaleString('es-MX')}</strong> entrada /{' '}
          <strong>{tokensOutput.toLocaleString('es-MX')}</strong> salida
        </span>
        <span>
          Costo: <strong>${cost.toFixed(4)}</strong>
        </span>
        <span>
          Mensajes: <strong>{messageCount}</strong>
        </span>
        <span>Modelo: {model}</span>
      </div>
      {onExport && (
        <button
          onClick={onExport}
          className="text-brand-600 hover:text-brand-700 font-medium"
        >
          📥 Exportar
        </button>
      )}
    </div>
  )
}

import type { CustomerMemory } from '@/lib/ai/customer-memory'

interface CustomerDataSectionProps {
  memory: CustomerMemory
}

function joinDefined(values: Array<string | null | undefined>): string {
  const defined = values.filter(
    (v): v is string => typeof v === 'string' && v.trim() !== ''
  )
  return defined.length > 0 ? defined.join(' · ') : '—'
}

export function CustomerDataSection({ memory }: CustomerDataSectionProps) {
  return (
    <div className="mb-2 space-y-0.5 border-t border-brand-100 pt-2">
      <p className="text-[10px] leading-relaxed text-gray-600">
        <span className="font-medium text-gray-500">Contacto:</span>{' '}
        {joinDefined([memory.name, memory.phone, memory.email])}
      </p>
      <p className="text-[10px] leading-relaxed text-gray-600">
        <span className="font-medium text-gray-500">Entrega:</span>{' '}
        {joinDefined([memory.city, memory.address])}
      </p>
      <p className="text-[10px] leading-relaxed text-gray-600">
        <span className="font-medium text-gray-500">Estado:</span>{' '}
        {memory.status?.trim() || '—'}
        {memory.tags && memory.tags.length > 0 && (
          <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
            {memory.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-700"
              >
                {tag}
              </span>
            ))}
          </span>
        )}
      </p>
    </div>
  )
}

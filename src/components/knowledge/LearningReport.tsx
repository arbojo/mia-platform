'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/knowledge/ProductCard'

interface LearningReportProps {
  report: {
    id: string
    status: string
    products_found: number
    knowledge_found: number
    rules_found: number
    prices_found: number
    benefits_found: number
    faqs_found: number
    promotions_found: number
    missing_fields: Array<{ field: string; reason: string; importance: string }>
    extracted_products: Array<{
      name: string
      price: number | null
      description: string | null
      benefits: string | null
      faq: Array<{ question: string; answer: string }>
      restrictions: string | null
      confidence: number
      _status?: 'approved' | 'rejected'
    }>
    extracted_knowledge: Array<{
      category: string
      question: string
      answer: string
      confidence: number
      _status?: 'approved' | 'rejected'
    }>
    extracted_rules: Array<{
      category: string
      content: string
      confidence: number
      _status?: 'approved' | 'rejected'
    }>
    preparation_before: number | null
    preparation_after: number | null
  }
}

function ProgressBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-zinc-300'

  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  )
}

function StatCard({ icon, count, label }: { icon: string; count: number; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
      <span className="text-2xl">{icon}</span>
      <p className="mt-1 text-2xl font-bold text-zinc-900">{count}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}

export function LearningReport({ report }: LearningReportProps) {
  const [showFull, setShowFull] = useState(false)
  const [productStatuses, setProductStatuses] = useState<Record<number, 'approved' | 'rejected'>>({})
  const [knowledgeStatuses, setKnowledgeStatuses] = useState<Record<number, 'approved' | 'rejected'>>({})
  const [ruleStatuses, setRuleStatuses] = useState<Record<number, 'approved' | 'rejected'>>({})
  const [loading, setLoading] = useState(false)

  const handleApprove = async (itemType: 'product' | 'knowledge' | 'rule', index: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/knowledge/learn/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', itemType, itemIndex: index }),
      })
      if (res.ok) {
        if (itemType === 'product') setProductStatuses((prev) => ({ ...prev, [index]: 'approved' }))
        else if (itemType === 'knowledge') setKnowledgeStatuses((prev) => ({ ...prev, [index]: 'approved' }))
        else setRuleStatuses((prev) => ({ ...prev, [index]: 'approved' }))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async (itemType: 'product' | 'knowledge' | 'rule', index: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/knowledge/learn/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', itemType, itemIndex: index }),
      })
      if (res.ok) {
        if (itemType === 'product') setProductStatuses((prev) => ({ ...prev, [index]: 'rejected' }))
        else if (itemType === 'knowledge') setKnowledgeStatuses((prev) => ({ ...prev, [index]: 'rejected' }))
        else setRuleStatuses((prev) => ({ ...prev, [index]: 'rejected' }))
      }
    } finally {
      setLoading(false)
    }
  }

  const approvedProducts = Object.values(productStatuses).filter((s) => s === 'approved').length
  const approvedKnowledge = Object.values(knowledgeStatuses).filter((s) => s === 'approved').length
  const approvedRules = Object.values(ruleStatuses).filter((s) => s === 'approved').length
  const totalApproved = approvedProducts + approvedKnowledge + approvedRules
  const totalItems = report.extracted_products.length + report.extracted_knowledge.length + report.extracted_rules.length

  if (report.status === 'processing') {
    return (
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 text-3xl animate-pulse">
          📚
        </div>
        <p className="text-lg font-medium text-violet-900">
          Estoy estudiando tus archivos...
        </p>
        <p className="mt-2 text-sm text-violet-700">
          Dame un momento para entender todo lo que me estás enseñando.
        </p>
      </div>
    )
  }

  if (report.status === 'failed') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-lg font-medium text-red-900">
          No pude leer los archivos correctamente.
        </p>
        <p className="mt-2 text-sm text-red-700">
          Asegúrate de que los archivos contengan texto visible. Intenta de nuevo.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* MIA speaks — the "I Understand You" moment */}
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6">
        <p className="text-lg text-violet-900">
          Ya terminé de estudiar tus archivos.
        </p>
        <p className="mt-2 text-violet-800">
          Creo que ya entiendo bastante bien cómo funciona tu negocio.
        </p>
        <p className="mt-2 text-violet-800">
          Ahora quiero enseñarte lo que aprendí para que juntos revisemos que todo esté correcto.
        </p>
        {!showFull && (
          <Button
            onClick={() => setShowFull(true)}
            className="mt-4 bg-violet-600 hover:bg-violet-700"
          >
            📖 Ver lo que aprendí
          </Button>
        )}
      </div>

      {showFull && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon="📦" count={report.products_found} label="productos" />
            <StatCard icon="💰" count={report.prices_found} label="con precio" />
            <StatCard icon="✅" count={report.benefits_found} label="con beneficios" />
            <StatCard icon="❓" count={report.faqs_found} label="preguntas que sé responder" />
          </div>

          {/* Preparation progress */}
          {report.preparation_before !== null && report.preparation_after !== null && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-sm text-emerald-700">
                Mi preparación: {report.preparation_before}% →{' '}
                <span className="font-bold text-emerald-900">{report.preparation_after}%</span>
              </p>
              <div className="mt-2">
                <ProgressBar score={report.preparation_after} />
              </div>
              <p className="mt-3 text-sm text-emerald-800 italic">
                {report.preparation_after > (report.preparation_before ?? 0)
                  ? 'Aprendí mucho de esos archivos. Ahora me siento mucho más preparada.'
                  : 'Ya tenía esa información, pero revisarla me ayuda a recordarla mejor.'}
              </p>
            </div>
          )}

          {/* Products section */}
          {report.extracted_products.length > 0 && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-zinc-900">
                Productos que encontré ({report.extracted_products.length})
              </h3>
              <div className="space-y-3">
                {report.extracted_products.map((product, i) => (
                  <ProductCard
                    key={`${product.name}-${i}`}
                    product={product}
                    index={i}
                    onApprove={() => handleApprove('product', i)}
                    onReject={() => handleReject('product', i)}
                    status={productStatuses[i]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Knowledge section */}
          {report.extracted_knowledge.length > 0 && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-zinc-900">
                Conocimiento que aprendí ({report.extracted_knowledge.length})
              </h3>
              <div className="space-y-3">
                {report.extracted_knowledge.map((item, i) => (
                  <div
                    key={`${item.question}-${i}`}
                    className="rounded-xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-900">{item.question}</p>
                        <p className="mt-1 text-sm text-zinc-600">{item.answer}</p>
                        {item.confidence < 70 && (
                          <p className="mt-2 text-xs text-amber-600 italic">
                            No estoy completamente segura de esto. ¿Me lo puedes confirmar?
                          </p>
                        )}
                      </div>
                      <div className="ml-3 flex gap-2">
                        {knowledgeStatuses[i] ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            knowledgeStatuses[i] === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {knowledgeStatuses[i] === 'approved' ? '✓ Aprendido' : 'Omitido'}
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => handleApprove('knowledge', i)}
                              disabled={loading}
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject('knowledge', i)}
                              disabled={loading}
                            >
                              ✕
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules section */}
          {report.extracted_rules.length > 0 && (
            <div>
              <h3 className="mb-4 text-lg font-semibold text-zinc-900">
                Reglas que aprendí ({report.extracted_rules.length})
              </h3>
              <div className="space-y-3">
                {report.extracted_rules.map((rule, i) => (
                  <div
                    key={`${rule.category}-${i}`}
                    className="rounded-xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                          {rule.category}
                        </p>
                        <p className="mt-1 text-sm text-zinc-700">{rule.content}</p>
                        {rule.confidence < 70 && (
                          <p className="mt-2 text-xs text-amber-600 italic">
                            No estoy completamente segura de esto. ¿Me lo puedes confirmar?
                          </p>
                        )}
                      </div>
                      <div className="ml-3 flex gap-2">
                        {ruleStatuses[i] ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            ruleStatuses[i] === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {ruleStatuses[i] === 'approved' ? '✓ Aprendido' : 'Omitido'}
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => handleApprove('rule', i)}
                              disabled={loading}
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject('rule', i)}
                              disabled={loading}
                            >
                              ✕
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing fields section */}
          {report.missing_fields.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="text-lg font-semibold text-amber-900">
                ⏱ Lo que nos falta
              </h3>
              <div className="mt-4 space-y-4">
                {report.missing_fields.map((field, i) => (
                  <div key={i}>
                    <p className="text-sm text-amber-800">{field.importance}</p>
                    <p className="mt-1 text-xs text-amber-600 italic">
                      Si quieres, puedo ayudarte a agregarlo. No toma mucho tiempo.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {totalItems > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
              <p className="text-sm text-zinc-600">
                {totalApproved === totalItems
                  ? '¡Ya aprendí todo lo que me enseñaste! Estoy lista para usarlo.'
                  : totalApproved > 0
                    ? `Llevas ${totalApproved} de ${totalItems} elementos aprendidos. ¡Buen progreso!`
                    : `Tienes ${totalItems} elementos por revisar. Cuando quieras, empezamos.`}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

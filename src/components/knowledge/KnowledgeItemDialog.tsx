'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SuccessPop } from '@/components/ui/success-pop'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const KNOWLEDGE_CATEGORIES = [
  { id: 'business_info', label: 'Info del Negocio' },
  { id: 'faq', label: 'Preguntas Frecuentes' },
  { id: 'objection', label: 'Manejo de Objeciones' },
  { id: 'process', label: 'Procesos' },
  { id: 'tip', label: 'Consejos' },
]

const RULE_CATEGORIES = [
  { id: 'restrictions', label: 'Restricciones' },
  { id: 'payment', label: 'Pagos' },
  { id: 'schedule', label: 'Horarios' },
  { id: 'zones', label: 'Zonas' },
  { id: 'promotions', label: 'Promociones' },
  { id: 'escalation', label: 'Escalamiento' },
]

export interface KnowledgeItemFormValues {
  category: string
  question: string
  answer: string
  ruleContent: string
}

interface KnowledgeItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: 'knowledge' | 'rule'
  initial?: Partial<KnowledgeItemFormValues>
  title?: string
  submitLabel?: string
  submitting?: boolean
  success?: boolean
  successMessage?: string
  onSubmit: (values: KnowledgeItemFormValues) => Promise<void>
}

export function KnowledgeItemDialog({
  open,
  onOpenChange,
  kind,
  initial,
  title = 'Editar conocimiento',
  submitLabel = 'Guardar',
  submitting = false,
  success = false,
  successMessage = 'Guardado',
  onSubmit,
}: KnowledgeItemDialogProps) {
  const [category, setCategory] = useState(initial?.category ?? 'faq')
  const [question, setQuestion] = useState(initial?.question ?? '')
  const [answer, setAnswer] = useState(initial?.answer ?? '')
  const [ruleContent, setRuleContent] = useState(initial?.ruleContent ?? '')

  const handleSubmit = async () => {
    await onSubmit({
      category,
      question,
      answer,
      ruleContent,
    })
  }

  const categories = kind === 'rule' ? RULE_CATEGORIES : KNOWLEDGE_CATEGORIES
  const canSubmit =
    kind === 'rule'
      ? ruleContent.trim().length > 0
      : question.trim().length > 0 && answer.trim().length > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={category === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>

          {kind === 'knowledge' ? (
            <>
              <div className="space-y-2">
                <Label>Pregunta / Tema</Label>
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="¿Qué pregunta responde esta información?"
                />
              </div>
              <div className="space-y-2">
                <Label>Respuesta / Información</Label>
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="La información que MIA debe conocer..."
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>Contenido de la regla</Label>
              <Textarea
                value={ruleContent}
                onChange={(e) => setRuleContent(e.target.value)}
                placeholder="Regla de ventas que MIA debe cumplir..."
                rows={4}
              />
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Guardando...' : submitLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
        {success && <SuccessPop message={successMessage} />}
      </AlertDialogContent>
    </AlertDialog>
  )
}

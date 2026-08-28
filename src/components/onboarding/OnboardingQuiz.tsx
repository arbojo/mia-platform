'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup } from '@/components/ui/radio-group'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2, Check, ArrowLeft, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OnboardingStep, QuizAnswer, BusinessProfile, CapabilityIntent } from '@/lib/onboarding/types'
import { QUIZ_QUESTIONS, getNextStep, isStepSkipped, buildConfirmationData } from '@/lib/onboarding/quiz'

interface OnboardingQuizProps {
  userId: string
  businessId: string | null
}

const STEP_ORDER: OnboardingStep[] = [
  'identity',
  'industry',
  'sales_ambition',
  'followup',
  'product_complexity',
  'modules',
  'channels',
  'assistant_name',
  'confirmation',
  'complete',
]

const STEP_LABELS: Record<OnboardingStep, string> = {
  identity: 'Identidad',
  industry: 'Rubro',
  sales_ambition: 'Ventas',
  followup: 'Seguimiento',
  product_complexity: 'Productos',
  modules: 'Módulos',
  channels: 'Canales',
  assistant_name: 'Asistente',
  confirmation: 'Confirmar',
  complete: 'Listo',
}

const STEP_ICONS: Record<OnboardingStep, string> = {
  identity: '🏢',
  industry: '🏷️',
  sales_ambition: '💼',
  followup: '🔄',
  product_complexity: '📦',
  modules: '⚙️',
  channels: '📱',
  assistant_name: '🤖',
  confirmation: '✅',
  complete: '🎉',
}

function TextStep({ question, value, onChange, onSubmit, isLoading }: {
  question: typeof QUIZ_QUESTIONS[0]
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-4">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder}
        className="text-lg"
        autoFocus
        disabled={isLoading}
      />
      <Button
        onClick={onSubmit}
        disabled={isLoading || !value.trim()}
        className="w-full"
      >
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Continuar'}
      </Button>
    </div>
  )
}

function SelectStep({ question, value, onChange, onSubmit, isLoading }: {
  question: typeof QUIZ_QUESTIONS[0]
  value: string
  onChange: (v: string | null) => void
  onSubmit: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-4">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={question.placeholder ?? 'Selecciona una opción'} />
        </SelectTrigger>
        <SelectContent>
          {question.options?.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={onSubmit}
        disabled={isLoading || !value}
        className="w-full"
      >
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Continuar'}
      </Button>
    </div>
  )
}

function RadioStep({ question, value, onChange, onSubmit, isLoading }: {
  question: typeof QUIZ_QUESTIONS[0]
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-3">
      <RadioGroup value={value} onValueChange={onChange} className="space-y-3">
        {question.options?.map((opt) => (
          <div key={opt.value} className="relative">
            <RadioGroup.Item value={opt.value} className="peer" />
            <label
              htmlFor={opt.value}
              className={cn(
                'block p-4 rounded-xl border-2 cursor-pointer transition-all',
                value === opt.value
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-1" />
                <span className="flex-1 text-left font-medium">{opt.label}</span>
              </div>
            </label>
          </div>
        ))}
      </RadioGroup>
      <Button
        onClick={onSubmit}
        disabled={isLoading || !value}
        className="w-full"
      >
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Continuar'}
      </Button>
    </div>
  )
}

function MultiselectStep({ question, values, onToggle, onSubmit, isLoading }: {
  question: typeof QUIZ_QUESTIONS[0]
  values: string[]
  onToggle: (v: string) => void
  onSubmit: () => void
  isLoading: boolean
}) {
  const allSelected = values.length === (question.options?.length ?? 0)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onToggle('__all__')
    } else {
      onToggle('__none__')
    }
  }

  return (
    <div className="space-y-3">
      <Checkbox
        id="select-all"
        checked={allSelected}
        onCheckedChange={handleSelectAll}
      >
        Seleccionar todos
      </Checkbox>
      <div className="space-y-2">
        {question.options?.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
              values.includes(opt.value)
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <Checkbox
              checked={values.includes(opt.value)}
              onCheckedChange={() => onToggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      <Button
        onClick={onSubmit}
        disabled={isLoading || values.length === 0}
        className="w-full"
      >
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Continuar'}
      </Button>
    </div>
  )
}

function ConfirmationStep({ confirmationData, onBack, onConfirm, isLoading }: {
  confirmationData: ReturnType<typeof buildConfirmationData>
  onBack: () => void
  onConfirm: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-left">
        <h3 className="font-semibold text-brand-900 mb-3 flex items-center gap-2">
          <Info className="w-5 h-5" />
          Esto es lo que entendí de tu negocio
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Tipo de negocio</dt>
            <dd className="font-medium">{confirmationData.businessType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Qué vendes</dt>
            <dd className="font-medium">{confirmationData.whatYouSell}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Cómo vendes</dt>
            <dd className="font-medium">{confirmationData.howYouSell}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Canales</dt>
            <dd className="font-medium">{confirmationData.channels}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Módulos operativos</dt>
            <dd className="font-medium">{confirmationData.modules}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Capacidades que se activarán:</p>
          <div className="flex flex-wrap gap-1.5">
            {confirmationData.capabilities.map((c) => (
              <span
                key={c.id}
                className="px-2 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-700"
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-gray-600">
        ¿Está todo correcto? Podemos cambiar lo que necesites.
      </p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" /> Cambiar algo
        </Button>
        <Button onClick={onConfirm} disabled={isLoading} className="flex-1">
          {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Confirmar y crear'}
        </Button>
      </div>
    </div>
  )
}

export function OnboardingQuiz({ userId, businessId: initialBusinessId }: OnboardingQuizProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('identity')
  const [profile, setProfile] = useState<Partial<BusinessProfile>>({})
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [capabilityIntent, setCapabilityIntent] = useState<CapabilityIntent | null>(null)
  const [confirmationData, setConfirmationData] = useState<ReturnType<typeof buildConfirmationData> | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(initialBusinessId)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skippedSteps, setSkippedSteps] = useState<OnboardingStep[]>([])
  const [showConfirmation, setShowConfirmation] = useState(false)

  const [textValue, setTextValue] = useState('')
  const [selectValue, setSelectValue] = useState('')
  const [radioValue, setRadioValue] = useState('')
  const [multiValues, setMultiValues] = useState<string[]>([])

  const question = QUIZ_QUESTIONS.find((q) => q.step === currentStep)
  const currentIndex = STEP_ORDER.indexOf(currentStep)
  const progress = Math.max(0, (currentIndex / (STEP_ORDER.length - 1)) * 100)

  const handleAnswer = useCallback(async (value: unknown) => {
    if (!question) return

    setIsLoading(true)
    setError(null)

    try {
      const chatHistory = [
        { role: 'assistant' as const, content: question.label },
        { role: 'user' as const, content: typeof value === 'string' ? value : JSON.stringify(value) },
      ]

      const res = await fetch('/api/onboarding/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          businessId,
          step: currentStep,
          profile,
          answers,
          capabilityIntent,
        }),
      })

      if (!res.ok) throw new Error('Failed to process answer')

      const data = await res.json()

      if (data.step) {
        setCurrentStep(data.step)
        setProfile(data.profile)
        setAnswers(data.answers)
        setCapabilityIntent(data.capabilityIntent)
        setSkippedSteps(
          STEP_ORDER.filter((s) => isStepSkipped(s, data.profile)).slice(0, STEP_ORDER.indexOf(data.step))
        )

        if (data.confirmationData) {
          setConfirmationData(data.confirmationData)
          setShowConfirmation(true)
        }

        if (data.allComplete) {
          await new Promise((r) => setTimeout(r, 3000))
          router.push('/dashboard')
        }
      }
    } catch {
      setError('Tuvimos un problema. Intentemos de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }, [question, businessId, currentStep, profile, answers, capabilityIntent, router])

  const loadResumeState = useCallback(async () => {
    if (!businessId) return
    try {
      const res = await fetch(`/api/onboarding/state?businessId=${businessId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.canResume && data.currentStep !== 'complete') {
          setCurrentStep(data.currentStep)
          setProfile(data.profile)
          setAnswers(data.answers)
          setCapabilityIntent(data.capabilityIntent)
          setConfirmationData(data.confirmationData)
          setSkippedSteps(data.skippedSteps)
          if (data.currentStep === 'confirmation') {
            setShowConfirmation(true)
          }
        }
      }
    } catch (err) {
      console.error('Error loading resume state:', err)
    }
  }, [businessId])

  useEffect(() => {
    if (initialBusinessId) {
      const timer = setTimeout(() => {
        loadResumeState()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [initialBusinessId, loadResumeState])

  const handleSubmit = useCallback(() => {
    if (!question) return

    let value: unknown
    switch (question.type) {
      case 'text':
        value = textValue.trim()
        if (!value) return
        setTextValue('')
        break
      case 'select':
        value = selectValue
        if (!value) return
        setSelectValue('')
        break
      case 'radio':
        value = radioValue
        if (!value) return
        setRadioValue('')
        break
      case 'multiselect':
        value = multiValues
        if ((value as string[]).length === 0) return
        setMultiValues([])
        break
      default:
        return
    }

    handleAnswer(value)
  }, [question, textValue, selectValue, radioValue, multiValues, handleAnswer])

  const handleBack = () => {
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      const prevStep = STEP_ORDER[prevIndex]
      if (!isStepSkipped(prevStep, profile)) {
        setCurrentStep(prevStep)
        setShowConfirmation(false)
      } else {
        const actualPrev = STEP_ORDER.slice(0, prevIndex).reverse().find((s) => !isStepSkipped(s, profile))
        if (actualPrev) setCurrentStep(actualPrev)
      }
    }
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          profile,
          answers,
          capabilityIntent,
        }),
      })

      if (!res.ok) throw new Error('Failed to complete onboarding')

      await new Promise((r) => setTimeout(r, 2000))
      router.push('/dashboard')
    } catch (err) {
      setError('Error al finalizar. Intenta de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMultiToggle = (v: string) => {
    if (v === '__all__') {
      setMultiValues(question?.options?.map((o) => o.value) ?? [])
    } else if (v === '__none__') {
      setMultiValues([])
    } else {
      setMultiValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
    }
  }

  if (currentStep === 'complete') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Todo listo!</h1>
        <p className="text-gray-600 mb-8">
          MIA ya conoce tu negocio y está configurada para empezar a trabajar.
        </p>
        <Button onClick={() => router.push('/dashboard')} className="w-full">
          Ir al Dashboard
        </Button>
      </div>
    )
  }

  const renderStepContent = () => {
    if (!question) return null

    if (currentStep === 'confirmation' && confirmationData) {
      return (
        <ConfirmationStep
          confirmationData={confirmationData}
          onBack={handleBack}
          onConfirm={handleConfirm}
          isLoading={isLoading}
        />
      )
    }

    switch (question.type) {
      case 'text':
        return (
          <TextStep
            question={question}
            value={textValue}
            onChange={setTextValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )

      case 'select':
        return (
          <SelectStep
            question={question}
            value={selectValue}
            onChange={(v) => setSelectValue(v ?? '')}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )

      case 'radio':
        return (
          <RadioStep
            question={question}
            value={radioValue}
            onChange={setRadioValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )

      case 'multiselect':
        return (
          <MultiselectStep
            question={question}
            values={multiValues}
            onToggle={handleMultiToggle}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )

      case 'confirmation':
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 space-y-3">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {STEP_ORDER.slice(0, -1).map((step) => {
            const isCompleted = STEP_ORDER.indexOf(step) < currentIndex
            const isCurrent = step === currentStep
            const isSkipped = skippedSteps.includes(step)
            return (
              <div
                key={step}
                className={cn(
                  'flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : isCurrent
                    ? 'bg-brand-100 text-brand-700 border border-brand-200 shadow-sm'
                    : isSkipped
                    ? 'bg-gray-100 text-gray-400 border border-gray-200'
                    : 'bg-gray-50 text-gray-400 border border-gray-100'
                )}
              >
                <span className="flex items-center gap-1">
                  {isCompleted ? (
                    <Check className="w-3 h-3" />
                  ) : isSkipped ? (
                    <span className="text-xs">⏭</span>
                  ) : (
                    STEP_ICONS[step]
                  )}
                  {STEP_LABELS[step]}
                </span>
              </div>
            )
          })}
        </div>
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-center">
          {currentIndex === 0
            ? 'Estoy conociendo tu negocio'
            : currentIndex < STEP_ORDER.length - 1
            ? `Paso ${currentIndex} de ${STEP_ORDER.length - 1}`
            : 'Estoy lista para empezar'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="p-4 border-b bg-gradient-to-r from-brand-50 to-brand-50">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-gradient-to-br from-brand-500 to-brand-400 text-white">M</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-gray-900">MIA</h3>
              <p className="text-sm text-gray-500">Tu asistente de ventas aprendiendo</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 min-h-[400px]">
          {question && (
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>{question.label}</p>
            </div>
          )}
          {renderStepContent()}
        </div>

        <div className="px-4 py-4 border-t bg-gray-50 flex items-center justify-between">
          {currentIndex > 0 && !showConfirmation && (
            <Button variant="ghost" onClick={handleBack} disabled={isLoading}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Atrás
            </Button>
          )}
          {currentIndex > 0 && !showConfirmation && isStepSkipped(STEP_ORDER[currentIndex - 1], profile) && (
            <span className="text-xs text-gray-400">Paso saltado automáticamente</span>
          )}
        </div>
      </div>
    </div>
  )
}
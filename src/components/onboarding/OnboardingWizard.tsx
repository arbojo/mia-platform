'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const personalities = [
  {
    id: 'friendly',
    name: 'Amable y cercana',
    description: 'Cálida, empática, hace sentir al cliente cómodo',
    warmth: 90,
    formality: 30,
    humor: 50,
    sales_aggressiveness: 40,
  },
  {
    id: 'professional',
    name: 'Profesional',
    description: 'Seria, confiable, enfocada en hechos',
    warmth: 50,
    formality: 80,
    humor: 20,
    sales_aggressiveness: 50,
  },
  {
    id: 'enthusiastic',
    name: 'Entusiasta vendedora',
    description: 'Energética, proactiva, genera urgencia',
    warmth: 70,
    formality: 40,
    humor: 60,
    sales_aggressiveness: 80,
  },
  {
    id: 'expert',
    name: 'Asesora experta',
    description: 'Conocedora, consultiva, guía al cliente',
    warmth: 60,
    formality: 60,
    humor: 30,
    sales_aggressiveness: 60,
  },
]

const communicationStyles = [
  { id: 'formal', label: 'Formal', example: '¿En qué puedo servirle?' },
  { id: 'casual', label: 'Casual', example: '¿Qué onda? ¿Cómo te puedo ayudar?' },
  { id: 'warm', label: 'Cálida', example: '¡Hola! Qué gusto saludarte. ¿Cómo estás?' },
  { id: 'direct', label: 'Directa', example: 'Hola. ¿Qué necesitas?' },
]

interface OnboardingWizardProps {
  userId: string
  businessId: string | null
  initialStep?: number
}

export function OnboardingWizard({ userId, businessId: initialBusinessId, initialStep = 0 }: OnboardingWizardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [businessId, setBusinessId] = useState(initialBusinessId)
  const [step, setStep] = useState(initialStep === -1 ? 0 : initialStep)
  const [loading, setLoading] = useState(false)

  const [assistantName, setAssistantName] = useState('MIA')
  const [selectedPersonality, setSelectedPersonality] = useState(personalities[0])
  const [selectedStyle, setSelectedStyle] = useState(communicationStyles[0])

  const [businessName, setBusinessName] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [targetCustomers, setTargetCustomers] = useState('')
  const [differentiators, setDifferentiators] = useState('')
  const [elevatorPitch, setElevatorPitch] = useState('')

  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [productBenefits, setProductBenefits] = useState('')
  const [products, setProducts] = useState<Array<{ name: string; price: string; description: string; benefits: string }>>([])

  const [ruleCategory, setRuleCategory] = useState<string>('zones')
  const [ruleContent, setRuleContent] = useState('')
  const [rules, setRules] = useState<Array<{ category: string; content: string }>>([])
  const [error, setError] = useState<string | null>(null)

  const handleCreateAssistant = async () => {
    setLoading(true)
    setError(null)

    let activeBusinessId = businessId

    if (!activeBusinessId) {
      const { data: newBiz, error: bizError } = await supabase
        .from('businesses')
        .insert({ owner_id: userId, name: 'Mi negocio' })
        .select()
        .single()

      if (bizError || !newBiz) {
        console.error('Error creating business:', bizError)
        setError(`Error al crear negocio: ${bizError?.message ?? 'unknown'}`)
        setLoading(false)
        return
      }
      activeBusinessId = newBiz.id
      setBusinessId(newBiz.id)
    }

    const { data: assistant, error: assistantError } = await supabase
      .from('assistants')
      .insert({
        business_id: activeBusinessId,
        name: assistantName,
        personality: selectedPersonality,
        communication_style: selectedStyle.id as 'formal' | 'casual' | 'warm' | 'direct',
      })
      .select()
      .single()

    if (assistantError) {
      console.error('Error creating assistant:', assistantError)
      setError(`Error al crear asistente: ${assistantError.message}`)
      setLoading(false)
      return
    }

    await supabase
      .from('assistant_channels')
      .insert({
        assistant_id: assistant.id,
        channel: 'web',
      })

    await supabase
      .from('businesses')
      .update({ onboarding_status: 'identity_completed' })
      .eq('id', activeBusinessId)

    setStep(1)
    setLoading(false)
  }

  const handleSaveBusiness = async () => {
    setLoading(true)
    setError(null)

    const { error } = await supabase
      .from('brand_identities')
      .insert({
        business_id: businessId,
        business_name: businessName,
        target_customers: targetCustomers,
        differentiators,
        elevator_pitch: elevatorPitch,
      })

    if (error) {
      console.error('Error saving brand:', error)
      setError(`Error al guardar: ${error.message}`)
      setLoading(false)
      return
    }

    await supabase
      .from('businesses')
      .update({ onboarding_status: 'business_completed' })
      .eq('id', businessId)

    setStep(2)
    setLoading(false)
  }

  const handleAddProduct = () => {
    if (!productName.trim()) return
    setProducts((prev) => [
      ...prev,
      {
        name: productName,
        price: productPrice,
        description: productDescription,
        benefits: productBenefits,
      },
    ])
    setProductName('')
    setProductPrice('')
    setProductDescription('')
    setProductBenefits('')
  }

  const handleSaveProducts = async () => {
    setLoading(true)
    setError(null)

    for (const product of products) {
      const { error } = await supabase.from('products').insert({
        business_id: businessId,
        name: product.name,
        price: product.price ? parseFloat(product.price) : null,
        description: product.description || null,
        benefits: product.benefits || null,
      })
      if (error) {
        console.error('Error saving product:', error)
        setError(`Error al guardar producto: ${error.message}`)
        setLoading(false)
        return
      }
    }

    await supabase
      .from('businesses')
      .update({ onboarding_status: 'products_completed' })
      .eq('id', businessId)

    setStep(3)
    setLoading(false)
  }

  const handleAddRule = () => {
    if (!ruleContent.trim()) return
    setRules((prev) => [
      ...prev,
      { category: ruleCategory, content: ruleContent },
    ])
    setRuleContent('')
  }

  const handleSaveRules = async () => {
    setLoading(true)
    setError(null)

    for (const rule of rules) {
      const { error } = await supabase.from('sales_rules').insert({
        business_id: businessId,
        category: rule.category as 'zones' | 'payment' | 'schedule' | 'promotions' | 'restrictions' | 'escalation',
        content: rule.content,
      })
      if (error) {
        console.error('Error saving rule:', error)
        setError(`Error al guardar regla: ${error.message}`)
        setLoading(false)
        return
      }
    }

    await supabase
      .from('businesses')
      .update({ onboarding_status: 'ready' })
      .eq('id', businessId)

    router.push('/dashboard/assistants')
    setLoading(false)
  }

  const steps = [
    { title: 'Personalidad', description: 'Presenta a tu nueva asistente' },
    { title: 'Tu Negocio', description: 'Cuéntale sobre tu negocio' },
    { title: 'Tus Productos', description: 'Enseña lo que vendes' },
    { title: 'Reglas', description: 'Reglas importantes' },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <div className="mb-8">
        <div className="flex justify-between mb-4">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className={cn(
                'flex-1 text-center pb-4 border-b-2 transition-colors',
                i <= step ? 'border-violet-600 text-violet-600' : 'border-gray-200 text-gray-400'
              )}
            >
              <p className="text-sm font-medium">{s.title}</p>
            </div>
          ))}
        </div>
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Presenta a tu nueva asistente</CardTitle>
            <CardDescription>
              ¿Cómo quieres llamarla? Elige su personalidad y estilo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">¿Cómo quieres llamarla?</Label>
              <Input
                id="name"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                placeholder="MIA"
              />
            </div>

            <div className="space-y-2">
              <Label>Personalidad</Label>
              <div className="grid grid-cols-2 gap-3">
                {personalities.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPersonality(p)}
                    className={cn(
                      'p-4 border rounded-lg text-left transition-all',
                      selectedPersonality.id === p.id
                        ? 'border-violet-600 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estilo de comunicación</Label>
              <div className="grid grid-cols-2 gap-3">
                {communicationStyles.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStyle(s)}
                    className={cn(
                      'p-4 border rounded-lg text-left transition-all',
                      selectedStyle.id === s.id
                        ? 'border-violet-600 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <p className="font-medium">{s.label}</p>
                    <p className="text-sm text-gray-500 italic">&ldquo;{s.example}&rdquo;</p>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleCreateAssistant}
              disabled={loading || !assistantName.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {loading ? 'Creando...' : 'Continuar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Cuéntale sobre tu negocio</CardTitle>
            <CardDescription>
              {assistantName} quiere conocerte. Cuéntale sobre lo que haces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bizName">¿Cómo se llama tu negocio?</Label>
              <Input
                id="bizName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Mi negocio"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bizDesc">¿Qué vendes?</Label>
              <Textarea
                id="bizDesc"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="Productos, servicios, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target">¿Quiénes son tus clientes?</Label>
              <Textarea
                id="target"
                value={targetCustomers}
                onChange={(e) => setTargetCustomers(e.target.value)}
                placeholder="Describe a tu cliente ideal"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diff">¿Qué te diferencia de la competencia?</Label>
              <Textarea
                id="diff"
                value={differentiators}
                onChange={(e) => setDifferentiators(e.target.value)}
                placeholder="Tu propuesta de valor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pitch">¿Cómo explicas tu negocio a alguien nuevo?</Label>
              <Textarea
                id="pitch"
                value={elevatorPitch}
                onChange={(e) => setElevatorPitch(e.target.value)}
                placeholder="Tu elevator pitch"
              />
            </div>

            <Button
              onClick={handleSaveBusiness}
              disabled={loading || !businessName.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {loading ? 'Guardando...' : 'Continuar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Enseña lo que vendes</CardTitle>
            <CardDescription>
              Agrega tus productos para que {assistantName} pueda recomendarlos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prodName">Nombre del producto</Label>
                <Input
                  id="prodName"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Mi producto"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodPrice">Precio</Label>
                <Input
                  id="prodPrice"
                  type="number"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prodDesc">Descripción</Label>
              <Textarea
                id="prodDesc"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="¿Qué es este producto?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prodBen">Beneficios</Label>
              <Textarea
                id="prodBen"
                value={productBenefits}
                onChange={(e) => setProductBenefits(e.target.value)}
                placeholder="¿Por qué lo comprarían?"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleAddProduct}
              disabled={!productName.trim()}
            >
              Agregar producto
            </Button>

            {products.length > 0 && (
              <div className="space-y-2">
                <Label>Productos agregados</Label>
                <div className="space-y-2">
                  {products.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-gray-500">
                          {p.price ? `$${p.price}` : 'Sin precio'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setProducts((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        Quitar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveProducts}
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {loading ? 'Guardando...' : products.length > 0 ? 'Continuar' : 'Saltar por ahora'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Reglas importantes</CardTitle>
            <CardDescription>
              Enseña a {assistantName} las reglas que debe seguir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'zones', label: 'Zonas de envío' },
                  { id: 'payment', label: 'Métodos de pago' },
                  { id: 'schedule', label: 'Horarios' },
                  { id: 'promotions', label: 'Promociones' },
                  { id: 'restrictions', label: 'Restricciones' },
                  { id: 'escalation', label: 'Cuándo pasar a humano' },
                ].map((cat) => (
                  <Button
                    key={cat.id}
                    variant={ruleCategory === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRuleCategory(cat.id)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule">Regla</Label>
              <Textarea
                id="rule"
                value={ruleContent}
                onChange={(e) => setRuleContent(e.target.value)}
                placeholder="Ej: Solo hacemos envíos a León y Silao"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleAddRule}
              disabled={!ruleContent.trim()}
            >
              Agregar regla
            </Button>

            {rules.length > 0 && (
              <div className="space-y-2">
                <Label>Reglas agregadas</Label>
                <div className="space-y-2">
                  {rules.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-xs text-gray-500 uppercase">{r.category}</p>
                        <p className="font-medium">{r.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRules((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        Quitar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handleSaveRules}
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700"
            >
              {loading ? 'Guardando...' : rules.length > 0 ? '¡Listo!' : 'Saltar por ahora'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

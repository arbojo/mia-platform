export interface SafetyContext {
  products: Array<{ id: string; name: string; price: number | null }>
  rules: Array<{ id: string; category: string; content: string }>
  memory: Array<{ id: string; content: string; is_immutable: boolean | null }>
}

export interface SafetyTrigger {
  type: 'price' | 'delivery' | 'guarantee' | 'discount' | 'immutable'
  text: string
  confidence: 'high' | 'medium' | 'low'
}

export interface SafetyResult {
  passed: boolean
  triggers: SafetyTrigger[]
  blocked: boolean
  retriesAttempted: number
  finalResponse: string
}

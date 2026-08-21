export interface PlatformTenant {
  id: string
  name: string
  createdAt: string
  edition: string | null
  maturityStage: string
  salesWon: number
  salesLost: number
}

export interface PlatformBridgeSession {
  businessId: string
  businessName: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  phone: string | null
  errorMessage: string | null
  updatedAt: string
}

export interface PlatformUsageBilling {
  businessId: string
  businessName: string
  requestsCount: number
  totalTokens: number
  calculatedCostUsd: number
  lastActive: string | null
}

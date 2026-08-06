import { SupabaseClient } from '@supabase/supabase-js'
import {
  type ReadinessScore,
  type ReadinessIndicatorDetail,
  type SubcategoryScore,
  type GuidanceItem,
  calculateReadiness,
} from '@/lib/ai/readiness'
import { getSkillsSnapshot, type SkillsSnapshot } from '@/lib/ai/skills'
import { getProductIntelligence, type ProductIntelligenceSummary } from '@/lib/ai/product-intelligence'
import { getLatestWeeklyReport, type WeeklyReportData } from '@/lib/ai/weekly-report'
import { getBusinessMemory, getVelocityHistory, type BusinessMemoryItem, type LearningVelocitySnapshot } from '@/lib/ai/memory'

export type { ReadinessScore, ReadinessIndicatorDetail, SubcategoryScore, GuidanceItem }

export interface EmployeeStatus {
  name: string
  status: 'online' | 'offline' | 'idle'
  channels: string[]
  knowledgeReadiness: number
  lastActivity: string | null
  readyToSell: boolean
}

export interface TodaysMetrics {
  conversations: number
  newCustomers: number
  returningCustomers: number
  tokensConsumed: number
  costToday: number
  messagesHandled: number
  avgResponseTime: number | null
}

export interface DailyReportItem {
  icon: string
  text: string
}

export interface DailyReport {
  greeting: string
  items: DailyReportItem[]
}

export interface NeedItem {
  id: string
  type: 'knowledge' | 'product' | 'rule' | 'instruction'
  description: string
  priority: 'high' | 'medium' | 'low'
}

export interface NeedsFromYou {
  items: NeedItem[]
  totalPending: number
}

export interface ConversationEntry {
  id: string
  time: string
  customerName: string
  lastMessage: string
  channel: string
  outcome: 'interested' | 'answered' | 'sold' | 'pending'
}

export interface ConversationTimeline {
  entries: ConversationEntry[]
}

export interface HealthScore {
  label: string
  score: number
  maxScore: number
  status: 'excellent' | 'good' | 'needs-attention' | 'critical'
}

export interface BusinessHealth {
  overall: number
  scores: HealthScore[]
}

export interface ProactiveSuggestion {
  id: string
  icon: string
  message: string
  actionLabel: string
  actionHref: string
}

export interface Milestone {
  id: string
  icon: string
  message: string
}

export interface GreetingContext {
  greeting: string
  subtitle: string
}

export type MIAReadiness = ReadinessScore

export type ModuleCardStatus =
  | { kind: 'no_news' }
  | { kind: 'new_today'; count: number }
  | { kind: 'analyzing' }
  | { kind: 'hypotheses'; count: number }
  | { kind: 'no_simulations' }
  | { kind: 'score'; score: number }

export interface ModuleCardData {
  memoriaStatus: ModuleCardStatus
  pensamientoStatus: ModuleCardStatus
  laboratorioStatus: ModuleCardStatus
}

export interface DashboardData {
  greetingContext: GreetingContext
  employeeStatus: EmployeeStatus
  miaReadiness: MIAReadiness
  todaysActivity: TodaysMetrics
  dailyReport: DailyReport
  needsFromYou: NeedsFromYou
  conversationTimeline: ConversationTimeline
  businessHealth: BusinessHealth
  proactiveSuggestions: ProactiveSuggestion[]
  milestones: Milestone[]
  moduleCards: ModuleCardData
  conversationTrend: { value: number; positive: boolean }
  readinessTrend: { value: number; positive: boolean }
  skillsSnapshot: SkillsSnapshot | null
  productIntelligence: ProductIntelligenceSummary | null
  weeklyReport: WeeklyReportData | null
  businessMemory: BusinessMemoryItem[]
  velocityHistory: LearningVelocitySnapshot[]
  salesMetrics: SalesMetrics
}

export async function getEmployeeStatus(
  supabase: SupabaseClient,
  businessId: string
): Promise<EmployeeStatus> {
  const defaultStatus: EmployeeStatus = {
    name: 'MIA',
    status: 'offline',
    channels: [],
    knowledgeReadiness: 0,
    lastActivity: null,
    readyToSell: false,
  }

  try {
    const [assistantsResult, connectionsResult, knowledgeResult, lastMessageResult] =
      await Promise.all([
        supabase
          .from('assistants')
          .select('name, is_active')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .limit(1)
          .single(),
        supabase
          .from('channel_connections')
          .select('channel, status')
          .eq('business_id', businessId),
        supabase
          .from('knowledge_items')
          .select('confidence, is_active')
          .eq('business_id', businessId)
          .eq('is_active', true),
        supabase
          .from('messages')
          .select('created_at, conversations!inner(type, assistants!inner(business_id))')
          .eq('conversations.type', 'live')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ])

    const assistant = assistantsResult.data
    if (!assistant) return defaultStatus

    const connections = connectionsResult.data ?? []
    const activeChannels = connections
      .filter((c) => c.status === 'connected')
      .map((c) => c.channel)

    const knowledgeItems = knowledgeResult.data ?? []
    const knowledgeReadiness =
      knowledgeItems.length > 0
        ? Math.round(
            (knowledgeItems.reduce((sum, k) => sum + (k.confidence ?? 0.5), 0) /
              knowledgeItems.length) *
              100
          )
        : 0

    const lastMessage = lastMessageResult.data
    const lastActivity = lastMessage?.created_at ?? null

    const isRecent = lastActivity
      ? Date.now() - new Date(lastActivity).getTime() < 24 * 60 * 60 * 1000
      : false

    return {
      name: assistant.name ?? 'MIA',
      status: isRecent ? 'online' : lastActivity ? 'idle' : 'offline',
      channels: activeChannels,
      knowledgeReadiness,
      lastActivity,
      readyToSell: knowledgeReadiness >= 60 && activeChannels.length > 0,
    }
  } catch {
    return defaultStatus
  }
}

export async function getTodaysActivity(
  supabase: SupabaseClient,
  businessId: string
): Promise<TodaysMetrics> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const defaultMetrics: TodaysMetrics = {
    conversations: 0,
    newCustomers: 0,
    returningCustomers: 0,
    tokensConsumed: 0,
    costToday: 0,
    messagesHandled: 0,
    avgResponseTime: null,
  }

  try {
    const [conversationsResult, customersTodayResult, customersBeforeTodayResult, aiUsageResult, messagesResult] =
      await Promise.all([
        supabase
          .from('conversations')
          .select('id, type', { count: 'exact', head: true })
          .eq('type', 'live')
          .gte('created_at', todayISO),
        supabase
          .from('customers')
          .select('id')
          .eq('business_id', businessId)
          .gte('created_at', todayISO),
        supabase
          .from('customers')
          .select('id')
          .eq('business_id', businessId)
          .lt('created_at', todayISO),
        supabase
          .from('ai_usage')
          .select('tokens_input, tokens_output, cost')
          .eq('business_id', businessId)
          .gte('created_at', todayISO),
        supabase
          .from('messages')
          .select('id, role, created_at', { count: 'exact', head: true })
          .gte('created_at', todayISO),
      ])

    const customersToday = customersTodayResult.data ?? []
    const customersBefore = customersBeforeTodayResult.data ?? []
    const aiUsage = aiUsageResult.data ?? []

    const newCustomerCount = customersToday.length
    const existingCustomerIds = new Set(customersBefore.map((c: { id: string }) => c.id))
    const returningCount = customersToday.filter((c: { id: string }) => existingCustomerIds.has(c.id)).length

    return {
      conversations: conversationsResult.count ?? 0,
      newCustomers: newCustomerCount - returningCount,
      returningCustomers: returningCount,
      tokensConsumed: aiUsage.reduce(
        (sum, u) => sum + (u.tokens_input ?? 0) + (u.tokens_output ?? 0),
        0
      ),
      costToday: aiUsage.reduce((sum, u) => sum + (u.cost ?? 0), 0),
      messagesHandled: messagesResult.count ?? 0,
      avgResponseTime: null,
    }
  } catch {
    return defaultMetrics
  }
}

export async function getDailyReport(
  supabase: SupabaseClient,
  businessId: string
): Promise<DailyReport> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const yesterdayISO = yesterday.toISOString()

  const report: DailyReport = {
    greeting: "Esto es lo que hice ayer:",
    items: [],
  }

  try {
    const [messagesResult, learningResult, customersResult] = await Promise.all([
      supabase
        .from('messages')
        .select('id, role, conversations!inner(type, assistants!inner(business_id))')
        .eq('conversations.type', 'live')
        .gte('created_at', yesterdayISO),
      supabase
        .from('learning_events')
        .select('id, status')
        .gte('created_at', yesterdayISO),
      supabase
        .from('customers')
        .select('id')
        .eq('business_id', businessId)
        .gte('created_at', yesterdayISO),
    ])

    const messages = messagesResult.data ?? []
    const assistantMessages = messages.filter((m) => m.role === 'assistant')
    const learningEvents = learningResult.data ?? []
    const newCustomers = customersResult.data ?? []

    if (assistantMessages.length > 0) {
      report.items.push({
        icon: '✓',
        text: `Atendí a ${assistantMessages.length} clientes`,
      })
    }

    if (newCustomers.length > 0) {
      report.items.push({
        icon: '✓',
        text: `Ayudé a ${newCustomers.length} personas nuevas a encontrar lo que necesitaban`,
      })
    }

    const approved = learningEvents.filter((e) => e.status === 'approved').length
    if (approved > 0) {
      report.items.push({
        icon: '✓',
        text: `Aprendí ${approved} reglas nuevas del negocio`,
      })
    }

    if (report.items.length === 0) {
      report.items.push({
        icon: '💤',
        text: "Fue un día tranquilo. Estoy lista para los clientes de hoy.",
      })
    }
  } catch {
    report.items.push({
      icon: '🔄',
      text: 'Armando mi reporte...',
    })
  }

  return report
}

export async function getNeedsFromYou(
  supabase: SupabaseClient,
  businessId: string
): Promise<NeedsFromYou> {
  const result: NeedsFromYou = { items: [], totalPending: 0 }

  try {
    const [knowledgeResult, productsResult, learningResult, suggestionsResult] =
      await Promise.all([
        supabase
          .from('knowledge_items')
          .select('id, question, confidence')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .lt('confidence', 0.5),
        supabase
          .from('products')
          .select('id, name, description')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .or('description.is.null,description.eq.'),
        supabase
          .from('learning_events')
          .select('id')
          .eq('status', 'pending'),
        supabase
          .from('knowledge_suggestions')
          .select('id, title, severity')
          .eq('status', 'pending'),
      ])

    const lowConfidence = knowledgeResult.data ?? []
    for (const item of lowConfidence.slice(0, 3)) {
      result.items.push({
        id: item.id,
        type: 'knowledge',
        description: item.question ?? 'Conocimiento con baja confianza',
        priority: 'high',
      })
    }

    const incompleteProducts = productsResult.data ?? []
    for (const product of incompleteProducts.slice(0, 2)) {
      result.items.push({
        id: product.id,
        type: 'product',
        description: `Producto "${product.name}" sin descripcion completa`,
        priority: 'medium',
      })
    }

    const pendingCorrections = learningResult.data ?? []
    if (pendingCorrections.length > 0) {
      result.items.push({
        id: 'pending-corrections',
        type: 'knowledge',
        description: `${pendingCorrections.length} correcciones pendientes de revision`,
        priority: 'high',
      })
    }

    const pendingSuggestions = suggestionsResult.data ?? []
    for (const suggestion of pendingSuggestions.slice(0, 3)) {
      result.items.push({
        id: suggestion.id,
        type: 'knowledge',
        description: suggestion.title ?? 'Sugerencia pendiente',
        priority: suggestion.severity === 'high' ? 'high' : 'medium',
      })
    }

    result.totalPending = result.items.length
  } catch {
    // Graceful degradation
  }

  return result
}

export async function getConversationTimeline(
  supabase: SupabaseClient,
  businessId: string
): Promise<ConversationTimeline> {
  const entries: ConversationEntry[] = []

  try {
    const { data: conversations } = await supabase
      .from('conversations')
      .select(
        'id, created_at, status, channel, customers(name), assistants!inner(business_id), messages(role, content, created_at)'
      )
      .eq('assistants.business_id', businessId)
      .eq('type', 'live')
      .order('created_at', { ascending: false })
      .limit(10)

    if (!conversations) return { entries }

    for (const conv of conversations) {
      const msgs = (conv.messages ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

      const lastUserMsg = msgs.find((m) => m.role === 'user')
      const lastAssistantMsg = msgs.find((m) => m.role === 'assistant')

      if (lastUserMsg) {
        const time = new Date(lastUserMsg.created_at)
        entries.push({
          id: conv.id,
          time: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
          customerName: Array.isArray(conv.customers)
            ? (conv.customers[0] as { name: string } | undefined)?.name ?? 'Cliente'
            : (conv.customers as { name: string } | null)?.name ?? 'Cliente',
          lastMessage: lastUserMsg.content?.slice(0, 80) ?? '',
          channel: conv.channel ?? 'web',
          outcome: lastAssistantMsg ? 'answered' : 'pending',
        })
      }
    }
  } catch {
    // Graceful degradation
  }

  return { entries }
}

export async function getBusinessHealth(
  supabase: SupabaseClient,
  businessId: string
): Promise<BusinessHealth> {
  const scores: HealthScore[] = []

  try {
    const [knowledgeResult, productsResult, rulesResult, instructionsResult, reportsResult] =
      await Promise.all([
        supabase
          .from('knowledge_items')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('is_active', true),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('is_active', true),
        supabase
          .from('sales_rules')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('is_active', true),
        supabase
          .from('ai_instructions')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('is_active', true),
        supabase
          .from('knowledge_analysis_reports')
          .select('overall_score, readiness_score')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ])

    const knowledgeCount = knowledgeResult.count ?? 0
    const productCount = productsResult.count ?? 0
    const rulesCount = rulesResult.count ?? 0
    const instructionsCount = instructionsResult.count ?? 0
    const latestReport = reportsResult.data

    const knowledgeScore = Math.min(10, Math.round(knowledgeCount / 3))
    scores.push({
      label: 'Conocimiento',
      score: knowledgeScore,
      maxScore: 10,
      status:
        knowledgeScore >= 8 ? 'excellent' : knowledgeScore >= 5 ? 'good' : 'needs-attention',
    })

    const productScore = Math.min(10, productCount * 2)
    scores.push({
      label: 'Catalogo',
      score: productScore,
      maxScore: 10,
      status: productScore >= 8 ? 'excellent' : productScore >= 4 ? 'good' : 'needs-attention',
    })

    const rulesScore = Math.min(10, rulesCount)
    scores.push({
      label: 'Reglas de Venta',
      score: rulesScore,
      maxScore: 10,
      status: rulesScore >= 8 ? 'excellent' : rulesScore >= 4 ? 'good' : 'needs-attention',
    })

    const instructionScore = Math.min(10, instructionsCount * 2)
    scores.push({
      label: 'Instrucciones IA',
      score: instructionScore,
      maxScore: 10,
      status:
        instructionScore >= 8 ? 'excellent' : instructionScore >= 4 ? 'good' : 'needs-attention',
    })

    if (latestReport?.readiness_score != null) {
      scores.push({
        label: 'Studio Score',
        score: Math.round(latestReport.readiness_score),
        maxScore: 10,
        status:
          latestReport.readiness_score >= 8
            ? 'excellent'
            : latestReport.readiness_score >= 5
              ? 'good'
              : 'needs-attention',
      })
    }
  } catch {
    // Graceful degradation
  }

  const overall =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
      : 0

  return { overall, scores }
}

export async function getGreetingContext(
  supabase: SupabaseClient,
  businessId: string,
  userName: string
): Promise<GreetingContext> {
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 12 ? 'Buenos dias' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  try {
    const { data: lastLogin } = await supabase
      .from('businesses')
      .select('updated_at')
      .eq('id', businessId)
      .single()

    const { count: activeConversations } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('type', 'live')

    const hasActiveConversations = (activeConversations ?? 0) > 0
    const isReturning = lastLogin?.updated_at
      ? Date.now() - new Date(lastLogin.updated_at).getTime() > 4 * 60 * 60 * 1000
      : false

    if (hasActiveConversations) {
      return {
        greeting: `${timeGreeting}, ${userName}`,
        subtitle: 'Tengo conversaciones activas atendiendo a tus clientes.',
      }
    }

    if (isReturning) {
      return {
        greeting: `Bienvenido de vuelta, ${userName}`,
        subtitle: 'Mira lo que paso mientras estuviste fuera.',
      }
    }

    return {
      greeting: `${timeGreeting}, ${userName}`,
      subtitle: 'Estoy lista para ayudar a tus clientes hoy.',
    }
  } catch {
    return {
      greeting: `${timeGreeting}, ${userName}`,
      subtitle: 'Estoy lista para ayudar a tus clientes hoy.',
    }
  }
}

export async function getProactiveSuggestions(
  supabase: SupabaseClient,
  businessId: string
): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = []

  try {
    const [productsResult, pendingLearningResult] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, description')
        .eq('business_id', businessId)
        .eq('is_active', true),
      supabase
        .from('learning_events')
        .select('id')
        .eq('status', 'pending'),
    ])

    const products = productsResult.data ?? []
    const incompleteProducts = products.filter(
      (p) => !p.description || p.description.trim().length < 10
    )

    if (incompleteProducts.length > 0) {
      suggestions.push({
        id: 'incomplete-products',
        icon: '📦',
        message: `${incompleteProducts.length === 1 ? 'Un producto' : `${incompleteProducts.length} productos`} ${incompleteProducts.length === 1 ? 'tiene' : 'tienen'} descripciones incompletas. Enséñame más sobre ellos para mejorar mis respuestas.`,
        actionLabel: 'Enseñame',
        actionHref: '/dashboard/knowledge',
      })
    }

    const pendingCount = pendingLearningResult.data?.length ?? 0
    if (pendingCount > 0) {
      suggestions.push({
        id: 'pending-learning',
        icon: '🎓',
        message: `Tengo ${pendingCount} correcciones esperando tu revisión. Tu retroalimentación me ayuda a aprender más rápido.`,
        actionLabel: 'Revisar',
        actionHref: '/dashboard/knowledge-studio',
      })
    }
  } catch {
    // Graceful degradation
  }

  return suggestions
}

export async function getMilestones(
  supabase: SupabaseClient,
  businessId: string
): Promise<Milestone[]> {
  const milestones: Milestone[] = []

  try {
    const [conversationsResult, knowledgeResult, connectionsResult] = await Promise.all([
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'live'),
      supabase
        .from('knowledge_items')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true),
      supabase
        .from('channel_connections')
        .select('id, status')
        .eq('business_id', businessId)
        .eq('status', 'connected'),
    ])

    const totalConversations = conversationsResult.count ?? 0
    const knowledgeCount = knowledgeResult.count ?? 0
    const connectedChannels = connectionsResult.data?.length ?? 0

    if (totalConversations === 1) {
      milestones.push({
        id: 'first-conversation',
        icon: '🎉',
        message: '¡Hoy atendí a mi primer cliente!',
      })
    } else if (totalConversations === 100) {
      milestones.push({
        id: 'hundred-conversations',
        icon: '🎉',
        message: '¡Llegamos a 100 conversaciones juntos!',
      })
    } else if (totalConversations === 1000) {
      milestones.push({
        id: 'thousand-conversations',
        icon: '🎉',
        message: '¡Llegamos a 1,000 conversaciones juntos!',
      })
    }

    if (connectedChannels === 1) {
      milestones.push({
        id: 'first-channel',
        icon: '🎉',
        message: 'Mi primer canal está conectado. ¡Ahora puedo hablar con tus clientes!',
      })
    }

    if (knowledgeCount >= 20) {
      const { data: latestReport } = await supabase
        .from('knowledge_analysis_reports')
        .select('readiness_score')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestReport?.readiness_score && latestReport.readiness_score >= 90) {
        milestones.push({
          id: 'high-readiness',
          icon: '🎉',
          message: "¡Estoy lista para responder casi todo sobre tu negocio!",
        })
      }
    }
  } catch {
    // Graceful degradation
  }

  return milestones
}

export async function getMIAReadiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<MIAReadiness> {
  try {
    return await calculateReadiness(supabase, businessId)
  } catch {
    return {
      preparation: 0,
      confidence: 0,
      performance: null,
      overall: 0,
      preparationDetail: {
        score: 0,
        subcategories: [],
        message: 'No pude calcular mi preparación.',
        guidance: null,
      },
      confidenceDetail: {
        score: 0,
        subcategories: [],
        message: 'No pude calcular mi confianza.',
        guidance: null,
      },
      performanceDetail: null,
      deltas: { preparation: 0, confidence: 0, performance: null, overall: 0 },
      trend: [],
    }
  }
}

export async function getModuleCardData(
  supabase: SupabaseClient,
  businessId: string
): Promise<ModuleCardData> {
  const defaultCards: ModuleCardData = {
    memoriaStatus: { kind: 'no_news' },
    pensamientoStatus: { kind: 'analyzing' },
    laboratorioStatus: { kind: 'no_simulations' },
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [learningResult, knowledgeResult, suggestionsResult, memoryResult, labResult] =
      await Promise.all([
        supabase
          .from('learning_events')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('status', 'approved')
          .gte('created_at', todayISO),
        supabase
          .from('knowledge_items')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('is_active', true)
          .gte('created_at', todayISO),
        supabase
          .from('knowledge_suggestions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('business_memory')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('memory_type', 'pattern'),
        supabase
          .from('lab_sessions')
          .select('score')
          .eq('business_id', businessId)
          .eq('status', 'completed')
          .gte('created_at', weekAgo),
      ])

    const approvedToday = learningResult.count ?? 0
    const newKnowledgeToday = knowledgeResult.count ?? 0
    const totalToday = approvedToday + newKnowledgeToday

    if (totalToday > 0) {
      defaultCards.memoriaStatus = { kind: 'new_today', count: totalToday }
    }

    const pendingSuggestions = suggestionsResult.count ?? 0
    const activePatterns = memoryResult.count ?? 0
    const totalAnalyses = pendingSuggestions + activePatterns

    if (totalAnalyses > 0) {
      defaultCards.pensamientoStatus = { kind: 'hypotheses', count: totalAnalyses }
    }

    const labSessions = labResult.data ?? []
    if (labSessions.length > 0) {
      const avgScore = labSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / labSessions.length
      defaultCards.laboratorioStatus = { kind: 'score', score: avgScore }
    }
  } catch {
    // Graceful degradation — use defaults
  }

  return defaultCards
}

export async function getConversationTrend(
  supabase: SupabaseClient
): Promise<{ value: number; positive: boolean }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const yesterdayISO = yesterday.toISOString()

  try {
    const [todayCount, yesterdayCount] = await Promise.all([
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'live')
        .eq('status', 'active')
        .gte('created_at', todayISO),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'live')
        .eq('status', 'active')
        .gte('created_at', yesterdayISO)
        .lt('created_at', todayISO),
    ])

    const tod = todayCount.count ?? 0
    const yest = yesterdayCount.count ?? 0
    const diff = tod - yest

    return { value: Math.abs(diff), positive: diff >= 0 }
  } catch {
    return { value: 0, positive: true }
  }
}

export interface SalesMetrics {
  todaySales: number
  todayRevenue: number
  weekSales: number
  weekRevenue: number
  conversionRate: number
  topProducts: Array<{ name: string; count: number }>
}

export async function getSalesMetrics(
  supabase: SupabaseClient,
  businessId: string
): Promise<SalesMetrics> {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())

  const [{ data: today }, { data: week }, { data: topProducts }, { data: conversations }] =
    await Promise.all([
      supabase
        .from('sales_events')
        .select('event_type, amount')
        .eq('business_id', businessId)
        .gte('created_at', startOfToday.toISOString()),
      supabase
        .from('sales_events')
        .select('event_type, amount')
        .eq('business_id', businessId)
        .gte('created_at', startOfWeek.toISOString()),
      supabase
        .from('sales_events')
        .select('metadata')
        .eq('business_id', businessId)
        .eq('event_type', 'SALE_WON')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('conversations')
        .select('outcome')
        .eq('type', 'live')
        .eq('business_id', businessId),
    ])

  const summarize = (rows: Array<{ event_type: string; amount: number | null }> | null) => {
    const sales = (rows ?? []).filter((r) => r.event_type === 'SALE_WON')
    const revenue = sales.reduce((sum, r) => sum + (r.amount ?? 0), 0)
    return { sales: sales.length, revenue }
  }

  const todaySum = summarize(today)
  const weekSum = summarize(week)

  const productCounts = new Map<string, number>()
  for (const row of topProducts ?? []) {
    const name = (row.metadata as Record<string, unknown> | null)?.product_name
    if (typeof name === 'string' && name) {
      productCounts.set(name, (productCounts.get(name) ?? 0) + 1)
    }
  }
  const topProductList = [...productCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  const total = conversations?.length ?? 0
  const sold = (conversations ?? []).filter((c) => c.outcome === 'sold').length
  const conversionRate = total > 0 ? Number(((sold / total) * 100).toFixed(1)) : 0

  return {
    todaySales: todaySum.sales,
    todayRevenue: todaySum.revenue,
    weekSales: weekSum.sales,
    weekRevenue: weekSum.revenue,
    conversionRate,
    topProducts: topProductList,
  }
}

export async function getDashboardData(
  supabase: SupabaseClient,
  businessId: string,
  userName: string
): Promise<DashboardData> {
  const [
    greetingContext,
    employeeStatus,
    miaReadiness,
    todaysActivity,
    dailyReport,
    needsFromYou,
    conversationTimeline,
    businessHealth,
    proactiveSuggestions,
    milestones,
    moduleCards,
    conversationTrend,
  ] = await Promise.all([
    getGreetingContext(supabase, businessId, userName),
    getEmployeeStatus(supabase, businessId),
    getMIAReadiness(supabase, businessId),
    getTodaysActivity(supabase, businessId),
    getDailyReport(supabase, businessId),
    getNeedsFromYou(supabase, businessId),
    getConversationTimeline(supabase, businessId),
    getBusinessHealth(supabase, businessId),
    getProactiveSuggestions(supabase, businessId),
    getMilestones(supabase, businessId),
    getModuleCardData(supabase, businessId),
    getConversationTrend(supabase),
  ])

  const [skillsSnapshot, productIntelligence, weeklyReport, businessMemory, velocityHistory] =
    await Promise.all([
      getSkillsSnapshot(businessId).catch(() => null),
      getProductIntelligence(businessId).catch(() => null),
      getLatestWeeklyReport(businessId).catch(() => null),
      getBusinessMemory(businessId).catch(() => []),
      getVelocityHistory(businessId).catch(() => []),
    ])

  const salesMetrics = await getSalesMetrics(supabase, businessId).catch(() => ({
    todaySales: 0,
    todayRevenue: 0,
    weekSales: 0,
    weekRevenue: 0,
    conversionRate: 0,
    topProducts: [],
  }))

  const readinessTrend: { value: number; positive: boolean } = {
    value: Math.abs(miaReadiness.deltas?.overall ?? 0),
    positive: (miaReadiness.deltas?.overall ?? 0) >= 0,
  }

  return {
    greetingContext,
    employeeStatus,
    miaReadiness,
    todaysActivity,
    dailyReport,
    needsFromYou,
    conversationTimeline,
    businessHealth,
    proactiveSuggestions,
    milestones,
    moduleCards,
    conversationTrend,
    readinessTrend,
    skillsSnapshot,
    productIntelligence,
    weeklyReport,
    businessMemory,
    velocityHistory,
    salesMetrics,
  }
}

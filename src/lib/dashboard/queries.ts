import { SupabaseClient } from '@supabase/supabase-js'

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

export interface ReadinessCategory {
  id: string
  label: string
  icon: string
  status: 'learned' | 'learning' | 'pending'
  description: string
}

export interface EmployeeReadiness {
  categories: ReadinessCategory[]
  overall: number
  message: string
  nextStep: { label: string; href: string } | null
}

export interface DashboardData {
  greetingContext: GreetingContext
  employeeStatus: EmployeeStatus
  employeeReadiness: EmployeeReadiness
  todaysActivity: TodaysMetrics
  dailyReport: DailyReport
  needsFromYou: NeedsFromYou
  conversationTimeline: ConversationTimeline
  businessHealth: BusinessHealth
  proactiveSuggestions: ProactiveSuggestion[]
  milestones: Milestone[]
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
    const [conversationsResult, customersResult, aiUsageResult, messagesResult] =
      await Promise.all([
        supabase
          .from('conversations')
          .select('id, type', { count: 'exact', head: true })
          .eq('type', 'live')
          .gte('created_at', todayISO),
        supabase
          .from('customers')
          .select('id, created_at')
          .eq('business_id', businessId)
          .gte('created_at', todayISO),
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

    const customers = customersResult.data ?? []
    const aiUsage = aiUsageResult.data ?? []

    return {
      conversations: conversationsResult.count ?? 0,
      newCustomers: customers.filter((c) => {
        const created = new Date(c.created_at)
        return created >= today
      }).length,
      returningCustomers: customers.filter((c) => {
        const created = new Date(c.created_at)
        return created < today
      }).length,
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
    greeting: "Here's what I did yesterday:",
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
        text: `Answered ${assistantMessages.length} customers`,
      })
    }

    if (newCustomers.length > 0) {
      report.items.push({
        icon: '✓',
        text: `Helped ${newCustomers.length} new people find what they needed`,
      })
    }

    const approved = learningEvents.filter((e) => e.status === 'approved').length
    if (approved > 0) {
      report.items.push({
        icon: '✓',
        text: `Learned ${approved} new business rules`,
      })
    }

    if (report.items.length === 0) {
      report.items.push({
        icon: '💤',
        text: "It was a quiet day. I'm ready for today's customers.",
      })
    }
  } catch {
    report.items.push({
      icon: '🔄',
      text: 'Putting together my report...',
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
        'id, created_at, status, customers(name), assistants!inner(business_id), messages(role, content, created_at)'
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
          channel: 'web',
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
        message: `Not ${incompleteProducts.length === 1 ? 'one' : incompleteProducts.length} products ${incompleteProducts.length === 1 ? 'has' : 'have'} incomplete descriptions. Teaching me more about them would improve my answers.`,
        actionLabel: 'Teach Me',
        actionHref: '/dashboard/knowledge',
      })
    }

    const pendingCount = pendingLearningResult.data?.length ?? 0
    if (pendingCount > 0) {
      suggestions.push({
        id: 'pending-learning',
        icon: '🎓',
        message: `I have ${pendingCount} corrections waiting for your review. Your feedback helps me learn faster.`,
        actionLabel: 'Review',
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
        message: 'Today I answered my first customer!',
      })
    } else if (totalConversations === 100) {
      milestones.push({
        id: 'hundred-conversations',
        icon: '🎉',
        message: 'We reached 100 conversations together!',
      })
    } else if (totalConversations === 1000) {
      milestones.push({
        id: 'thousand-conversations',
        icon: '🎉',
        message: 'We reached 1,000 conversations together!',
      })
    }

    if (connectedChannels === 1) {
      milestones.push({
        id: 'first-channel',
        icon: '🎉',
        message: 'My first channel is connected. I can now talk to your customers!',
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
          message: "I'm now ready to answer almost everything about your business!",
        })
      }
    }
  } catch {
    // Graceful degradation
  }

  return milestones
}

export async function getEmployeeReadiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<EmployeeReadiness> {
  const categories: ReadinessCategory[] = []

  try {
    const [brandResult, productsResult, rulesResult, knowledgeResult, instructionsResult, channelsResult] =
      await Promise.all([
        supabase
          .from('brand_identities')
          .select('id')
          .eq('business_id', businessId)
          .limit(1),
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
          .from('knowledge_items')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('is_active', true),
        supabase
          .from('ai_instructions')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('is_active', true),
        supabase
          .from('channel_connections')
          .select('id, status')
          .eq('business_id', businessId)
          .eq('status', 'connected'),
      ])

    const hasBrand = (brandResult.data?.length ?? 0) > 0
    const productCount = productsResult.count ?? 0
    const rulesCount = rulesResult.count ?? 0
    const knowledgeCount = knowledgeResult.count ?? 0
    const instructionsCount = instructionsResult.count ?? 0
    const connectedChannels = channelsResult.data?.length ?? 0

    categories.push({
      id: 'business',
      label: 'Business',
      icon: '🏢',
      status: hasBrand ? 'learned' : 'pending',
      description: hasBrand ? 'I know about your business' : "I don't know about your business yet",
    })

    categories.push({
      id: 'products',
      label: 'Products',
      icon: '📦',
      status: productCount > 0 ? 'learned' : hasBrand ? 'learning' : 'pending',
      description: productCount > 0
        ? `I know ${productCount} product${productCount > 1 ? 's' : ''}`
        : 'I need to learn what you sell',
    })

    categories.push({
      id: 'rules',
      label: 'Rules',
      icon: '📋',
      status: rulesCount > 0 ? 'learned' : productCount > 0 ? 'learning' : 'pending',
      description: rulesCount > 0
        ? `I know ${rulesCount} business rule${rulesCount > 1 ? 's' : ''}`
        : "I need to learn how your business works",
    })

    categories.push({
      id: 'knowledge',
      label: 'Knowledge',
      icon: '📚',
      status: knowledgeCount > 0 ? 'learned' : rulesCount > 0 ? 'learning' : 'pending',
      description: knowledgeCount > 0
        ? `I know ${knowledgeCount} thing${knowledgeCount > 1 ? 's' : ''} about your business`
        : "I need to learn more about your business",
    })

    categories.push({
      id: 'personality',
      label: 'Personality',
      icon: '🤖',
      status: instructionsCount > 0 ? 'learned' : 'pending',
      description: instructionsCount > 0
        ? 'I know how to speak with your customers'
        : "I don't know how you want me to speak yet",
    })

    categories.push({
      id: 'connections',
      label: 'Connections',
      icon: '📱',
      status: connectedChannels > 0 ? 'learned' : 'pending',
      description: connectedChannels > 0
        ? `I'm connected to ${connectedChannels} channel${connectedChannels > 1 ? 's' : ''}`
        : "I don't have any channels to talk to customers yet",
    })
  } catch {
    // Graceful degradation
  }

  const learned = categories.filter((c) => c.status === 'learned').length
  const overall = Math.round((learned / categories.length) * 100)

  let message: string
  let nextStep: { label: string; href: string } | null = null

  if (overall === 100) {
    message = "I'm ready to start working."
  } else if (overall >= 80) {
    message = "I'm almost ready to start working."
    const pending = categories.find((c) => c.status === 'pending')
    if (pending) {
      nextStep = getNextStep(pending.id)
    }
  } else if (overall >= 50) {
    message = "I'm getting there. Let me keep learning."
    const learning = categories.find((c) => c.status === 'learning') ?? categories.find((c) => c.status === 'pending')
    if (learning) {
      nextStep = getNextStep(learning.id)
    }
  } else if (overall > 0) {
    message = "I'm just getting started. I need to learn more."
    const next = categories.find((c) => c.status === 'pending')
    if (next) {
      nextStep = getNextStep(next.id)
    }
  } else {
    message = "I don't know anything yet. Let's start with your business."
    nextStep = { label: 'Tell MIA about your business', href: '/dashboard/onboarding' }
  }

  return { categories, overall, message, nextStep }
}

function getNextStep(categoryId: string): { label: string; href: string } {
  const steps: Record<string, { label: string; href: string }> = {
    business: { label: 'Tell MIA about your business', href: '/dashboard/onboarding' },
    products: { label: 'Teach MIA your products', href: '/dashboard/knowledge' },
    rules: { label: 'Teach MIA your rules', href: '/dashboard/knowledge' },
    knowledge: { label: 'Teach MIA more about your business', href: '/dashboard/knowledge' },
    personality: { label: 'Teach MIA how to speak', href: '/dashboard/knowledge' },
    connections: { label: 'Connect a channel', href: '/dashboard/connections' },
  }
  return steps[categoryId] ?? { label: 'Continue training', href: '/dashboard/knowledge' }
}

export async function getDashboardData(
  supabase: SupabaseClient,
  businessId: string,
  userName: string
): Promise<DashboardData> {
  const [
    greetingContext,
    employeeStatus,
    employeeReadiness,
    todaysActivity,
    dailyReport,
    needsFromYou,
    conversationTimeline,
    businessHealth,
    proactiveSuggestions,
    milestones,
  ] = await Promise.all([
    getGreetingContext(supabase, businessId, userName),
    getEmployeeStatus(supabase, businessId),
    getEmployeeReadiness(supabase, businessId),
    getTodaysActivity(supabase, businessId),
    getDailyReport(supabase, businessId),
    getNeedsFromYou(supabase, businessId),
    getConversationTimeline(supabase, businessId),
    getBusinessHealth(supabase, businessId),
    getProactiveSuggestions(supabase, businessId),
    getMilestones(supabase, businessId),
  ])

  return {
    greetingContext,
    employeeStatus,
    employeeReadiness,
    todaysActivity,
    dailyReport,
    needsFromYou,
    conversationTimeline,
    businessHealth,
    proactiveSuggestions,
    milestones,
  }
}

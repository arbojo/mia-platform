import { SupabaseClient } from '@supabase/supabase-js'

export interface SubcategoryScore {
  label: string
  score: number
  weight: number
  description: string
}

export interface GuidanceItem {
  message: string
  actionLabel: string
  actionHref: string
}

export interface ReadinessIndicatorDetail {
  score: number
  subcategories: SubcategoryScore[]
  message: string
  guidance: GuidanceItem | null
}

export interface ReadinessSnapshot {
  preparation: number
  confidence: number
  performance: number | null
  overall: number
  calculated_at: string
}

export interface ReadinessScore {
  preparation: number
  confidence: number
  performance: number | null
  overall: number
  preparationDetail: ReadinessIndicatorDetail
  confidenceDetail: ReadinessIndicatorDetail
  performanceDetail: ReadinessIndicatorDetail | null
  deltas: {
    preparation: number
    confidence: number
    performance: number | null
    overall: number
  }
  trend: Array<{
    date: string
    preparation: number
    confidence: number
    performance: number | null
  }>
}

const WEIGHTS = {
  preparation: {
    businessIdentity: 0.15,
    products: 0.20,
    rules: 0.15,
    knowledge: 0.15,
    personality: 0.10,
    salesPractice: 0.15,
    channels: 0.10,
    learningActivity: 0.10,
  },
  confidenceWeight: 0.35,
  performanceWeight: 0.30,
  preparationWeight: 0.35,
}

export async function calculateReadiness(
  supabase: SupabaseClient,
  businessId: string
): Promise<ReadinessScore> {
  const [preparationDetail, confidenceDetail, performanceDetail, lastSnapshot, trendData] =
    await Promise.all([
      calculatePreparation(supabase, businessId),
      calculateConfidence(supabase, businessId),
      calculatePerformance(supabase, businessId),
      getLastSnapshot(supabase, businessId),
      getTrend(supabase, businessId, 30),
    ])

  const performanceScore = performanceDetail?.score ?? null

  const overall = calculateOverall(
    preparationDetail.score,
    confidenceDetail.score,
    performanceScore
  )

  const deltas = lastSnapshot
    ? {
        preparation: preparationDetail.score - lastSnapshot.preparation,
        confidence: confidenceDetail.score - lastSnapshot.confidence,
        performance:
          performanceScore !== null && lastSnapshot.performance !== null
            ? performanceScore - lastSnapshot.performance
            : null,
        overall: overall - lastSnapshot.overall,
      }
    : { preparation: 0, confidence: 0, performance: null, overall: 0 }

  await storeSnapshot(supabase, businessId, {
    preparation: preparationDetail.score,
    confidence: confidenceDetail.score,
    performance: performanceScore,
    overall,
  })

  return {
    preparation: preparationDetail.score,
    confidence: confidenceDetail.score,
    performance: performanceScore,
    overall,
    preparationDetail,
    confidenceDetail,
    performanceDetail,
    deltas,
    trend: trendData,
  }
}

function calculateOverall(
  preparation: number,
  confidence: number,
  performance: number | null
): number {
  if (performance === null) {
    return Math.round(
      preparation * WEIGHTS.preparationWeight +
        confidence * WEIGHTS.confidenceWeight
    )
  }
  return Math.round(
    preparation * WEIGHTS.preparationWeight +
      confidence * WEIGHTS.confidenceWeight +
      performance * WEIGHTS.performanceWeight
  )
}

// =============================================
// PREPARATION
// =============================================

async function calculatePreparation(
  supabase: SupabaseClient,
  businessId: string
): Promise<ReadinessIndicatorDetail> {
  const [
    brandResult,
    productsResult,
    rulesResult,
    knowledgeResult,
    channelsResult,
    learningResult,
    labResult,
    assistantsResult,
  ] = await Promise.all([
    supabase
      .from('brand_identities')
      .select('business_name, tagline, target_customers, differentiators, elevator_pitch, tone_of_voice')
      .eq('business_id', businessId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('products')
      .select('id, description, benefits, faq')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('sales_rules')
      .select('id, category')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('knowledge_items')
      .select('id, confidence')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('channel_connections')
      .select('id, status')
      .eq('business_id', businessId)
      .eq('status', 'connected'),
    supabase
      .from('learning_events')
      .select('id, status, created_at')
      .eq('business_id', businessId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('lab_sessions')
      .select('id, score')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .not('score', 'is', null),
    supabase
      .from('assistants')
      .select('personality, communication_style')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
  ])

  const brand = brandResult.data
  const products = productsResult.data ?? []
  const rules = rulesResult.data ?? []
  const knowledge = knowledgeResult.data ?? []
  const channels = channelsResult.data ?? []
  const learningEvents = learningResult.data ?? []
  const labSessions = labResult.data ?? []
  const assistant = assistantsResult.data

  const subcategories: SubcategoryScore[] = []

  // Business Identity: completeness of brand fields
  const brandFields = brand
    ? [
        brand.business_name,
        brand.tagline,
        brand.target_customers,
        brand.differentiators,
        brand.elevator_pitch,
        brand.tone_of_voice,
      ].filter((f) => f && f.trim().length > 0).length
    : 0
  subcategories.push({
    label: 'Identidad del negocio',
    score: Math.round((brandFields / 6) * 100),
    weight: WEIGHTS.preparation.businessIdentity,
    description:
      brandFields === 6
        ? 'Conozco tu negocio completamente'
        : brandFields > 0
          ? `Conozco ${brandFields} de 6 aspectos de tu negocio`
          : 'Todavía no conozco tu negocio',
  })

  // Products: count + quality
  const productCount = products.length
  const quantityScore = productCount >= 5 ? 70 : productCount >= 2 ? 50 : productCount >= 1 ? 40 : 0
  const qualityScore =
    productCount > 0
      ? Math.round(
          products.reduce((sum, p) => {
            let q = 0
            if (p.description && p.description.trim().length > 10) q += 0.4
            if (p.benefits && p.benefits.trim().length > 10) q += 0.3
            if (p.faq && Array.isArray(p.faq) && p.faq.length > 0) q += 0.3
            return sum + q
          }, 0) / productCount * 30
        )
      : 0
  subcategories.push({
    label: 'Productos',
    score: Math.min(100, quantityScore + qualityScore),
    weight: WEIGHTS.preparation.products,
    description:
      productCount > 0
        ? `Conozco ${productCount} producto${productCount > 1 ? 's' : ''}`
        : 'Necesito aprender qué vendes',
  })

  // Rules: category coverage
  const ruleCategories = new Set(rules.map((r) => r.category))
  const totalRuleCategories = 6
  subcategories.push({
    label: 'Reglas del negocio',
    score: Math.round((ruleCategories.size / totalRuleCategories) * 100),
    weight: WEIGHTS.preparation.rules,
    description:
      ruleCategories.size > 0
        ? `Conozco ${ruleCategories.size} de ${totalRuleCategories} tipos de reglas`
        : 'Necesito aprender cómo funciona tu negocio',
  })

  // Knowledge: count + confidence
  const knowledgeCount = knowledge.length
  let knowledgeScore = 0
  if (knowledgeCount > 0) {
    const countScore = Math.min(100, knowledgeCount * 5)
    const confidenceMultiplier =
      knowledge.reduce((sum, k) => {
        if (k.confidence === 'high') return sum + 1
        if (k.confidence === 'medium') return sum + 0.6
        return sum + 0.3
      }, 0) / knowledgeCount
    knowledgeScore = Math.round(countScore * confidenceMultiplier)
  }
  subcategories.push({
    label: 'Conocimiento',
    score: knowledgeScore,
    weight: WEIGHTS.preparation.knowledge,
    description:
      knowledgeCount > 0
        ? `Sé ${knowledgeCount} cosa${knowledgeCount > 1 ? 's' : ''} sobre tu negocio`
        : 'Necesito aprender más sobre tu negocio',
  })

  // Personality: assistant personality fields
  const personalityFields = assistant?.personality
    ? Object.values(assistant.personality).filter(
        (v) => v !== null && v !== undefined
      ).length
    : 0
  subcategories.push({
    label: 'Personalidad',
    score: Math.round((personalityFields / 4) * 100),
    weight: WEIGHTS.preparation.personality,
    description:
      personalityFields === 4
        ? 'Sé cómo hablar con tus clientes'
        : personalityFields > 0
          ? 'Estoy desarrollando mi personalidad'
          : 'Todavía no sé cómo quieres que hable',
  })

  // Sales Practice: lab session scores
  const avgLabScore =
    labSessions.length > 0
      ? labSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / labSessions.length
      : 0
  subcategories.push({
    label: 'Práctica de ventas',
    score: Math.round(avgLabScore * 10),
    weight: WEIGHTS.preparation.salesPractice,
    description:
      labSessions.length > 0
        ? `He practicado ${labSessions.length} vez${labSessions.length > 1 ? 'es' : ''}`
        : 'Todavía no he practicado',
  })

  // Channels: connected count
  const connectedCount = channels.length
  subcategories.push({
    label: 'Canales conectados',
    score: Math.min(100, connectedCount * 35),
    weight: WEIGHTS.preparation.channels,
    description:
      connectedCount > 0
        ? `Estoy conectada a ${connectedCount} canal${connectedCount > 1 ? 'es' : ''}`
        : 'Todavía no tengo canales para hablar con clientes',
  })

  // Learning Activity: recent events + approval rate
  const recentEvents = learningEvents.length
  const approvedEvents = learningEvents.filter((e) => e.status === 'approved').length
  const activityScore = Math.min(100, recentEvents * 10)
  const approvalRate = recentEvents > 0 ? approvedEvents / recentEvents : 0
  const learningScore = Math.round(activityScore * (recentEvents > 0 ? Math.max(0.3, approvalRate) : 1))
  subcategories.push({
    label: 'Actividad reciente',
    score: learningScore,
    weight: WEIGHTS.preparation.learningActivity,
    description:
      recentEvents > 0
        ? `${recentEvents} evento${recentEvents > 1 ? 's' : ''} de aprendizaje esta semana`
        : 'Sin actividad reciente',
  })

  const score = Math.round(
    subcategories.reduce((sum, s) => sum + s.score * s.weight, 0)
  )

  const weakest = subcategories.reduce((min, s) => (s.score < min.score ? s : min), subcategories[0])
  const guidance = getGuidance('preparation', score, weakest.score < 50 ? weakest.label : null)

  return {
    score,
    subcategories,
    message: getPreparationMessage(score),
    guidance,
  }
}

// =============================================
// CONFIDENCE
// =============================================

async function calculateConfidence(
  supabase: SupabaseClient,
  businessId: string
): Promise<ReadinessIndicatorDetail> {
  const [knowledgeResult, learningResult, labResult, conversationsResult] = await Promise.all([
    supabase
      .from('knowledge_items')
      .select('id, category, confidence')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('learning_events')
      .select('id, status, created_at')
      .eq('business_id', businessId)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from('lab_sessions')
      .select('id, score, criteria')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .not('score', 'is', null),
    supabase
      .from('conversations')
      .select('id, type')
      .eq('assistant_id', (
        await supabase
          .from('assistants')
          .select('id')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
      )?.data?.id ?? '')
      .eq('type', 'live'),
  ])

  const knowledge = knowledgeResult.data ?? []
  const learningEvents = learningResult.data ?? []
  const labSessions = labResult.data ?? []
  const liveConversations = conversationsResult.data ?? []

  const subcategories: SubcategoryScore[] = []

  // Knowledge breadth: categories covered
  const knowledgeCategories = new Set(knowledge.map((k) => k.category))
  const totalKnowledgeCategories = 5
  subcategories.push({
    label: 'Amplitud del conocimiento',
    score: Math.round((knowledgeCategories.size / totalKnowledgeCategories) * 100),
    weight: 0.25,
    description:
      knowledgeCategories.size === totalKnowledgeCategories
        ? 'Conozco todos los aspectos de tu negocio'
        : `Conozco ${knowledgeCategories.size} de ${totalKnowledgeCategories} áreas`,
  })

  // Training volume: approval rate
  const approved = learningEvents.filter((e) => e.status === 'approved').length
  const rejected = learningEvents.filter((e) => e.status === 'rejected').length
  const totalDecisions = approved + rejected
  const approvalRate = totalDecisions > 0 ? approved / totalDecisions : 0.5
  subcategories.push({
    label: 'Calidad del entrenamiento',
    score: Math.round(approvalRate * 100),
    weight: 0.25,
    description:
      totalDecisions > 0
        ? `${approved} de ${totalDecisions} correcciones aprobadas`
        : 'Sin entrenamiento reciente',
  })

  // Learning velocity: recent trend
  const week1 = learningEvents.filter(
    (e) => new Date(e.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  ).length
  const week2 = learningEvents.filter(
    (e) =>
      new Date(e.created_at).getTime() <= Date.now() - 7 * 24 * 60 * 60 * 1000 &&
      new Date(e.created_at).getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000
  ).length
  const velocityScore =
    week1 + week2 === 0
      ? 50
      : Math.min(100, Math.round(((week1 * 2 + week2) / (week1 + week2 + 1)) * 50))
  subcategories.push({
    label: 'Velocidad de aprendizaje',
    score: velocityScore,
    weight: 0.20,
    description:
      week1 > week2
        ? 'Estoy aprendiendo más rápido que la semana pasada'
        : week1 > 0
          ? 'Mantengo mi ritmo de aprendizaje'
          : 'Necesito practicar más',
  })

  // Simulation performance
  const avgScore =
    labSessions.length > 0
      ? labSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / labSessions.length
      : 0
  const simScore = Math.round(avgScore * 10)
  subcategories.push({
    label: 'Desempeño en simulaciones',
    score: simScore,
    weight: 0.20,
    description:
      labSessions.length > 0
        ? `Promedio de ${avgScore.toFixed(1)} en ${labSessions.length} simulación${labSessions.length > 1 ? 'es' : ''}`
        : 'Sin simulaciones todavía',
  })

  // Conversation quality (proxy: conversation count)
  const conversationScore = Math.min(100, liveConversations.length * 20)
  subcategories.push({
    label: 'Experiencia con clientes',
    score: conversationScore,
    weight: 0.10,
    description:
      liveConversations.length > 0
        ? `${liveConversations.length} conversación${liveConversations.length > 1 ? 'es' : ''} con clientes`
        : 'Aún no tengo experiencia con clientes reales',
  })

  const score = Math.round(
    subcategories.reduce((sum, s) => sum + s.score * s.weight, 0)
  )

  const weakest = subcategories.reduce((min, s) => (s.score < min.score ? s : min), subcategories[0])
  const guidance = getGuidance('confidence', score, weakest.score < 50 ? weakest.label : null)

  return {
    score,
    subcategories,
    message: getConfidenceMessage(score),
    guidance,
  }
}

// =============================================
// PERFORMANCE
// =============================================

async function calculatePerformance(
  supabase: SupabaseClient,
  businessId: string
): Promise<ReadinessIndicatorDetail | null> {
  const { count: liveConversationCount } = await supabase
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'live')
    .eq('assistant_id', (
      await supabase
        .from('assistants')
        .select('id')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
    )?.data?.id ?? '')

  if ((liveConversationCount ?? 0) === 0) return null

  const [conversationsResult, customersResult, messagesResult] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, status, created_at')
      .eq('type', 'live')
      .eq('assistant_id', (
        await supabase
          .from('assistants')
          .select('id')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle()
      )?.data?.id ?? ''),
    supabase
      .from('customers')
      .select('id, created_at')
      .eq('business_id', businessId),
    supabase
      .from('messages')
      .select('id, role, created_at, conversations!inner(type, assistants!inner(business_id))')
      .eq('conversations.type', 'live')
      .eq('conversations.assistants.business_id', businessId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const conversations = conversationsResult.data ?? []
  const customers = customersResult.data ?? []
  const messages = messagesResult.data ?? []

  const subcategories: SubcategoryScore[] = []

  // Resolution rate
  const archived = conversations.filter((c) => c.status === 'archived').length
  const resolutionRate = conversations.length > 0 ? archived / conversations.length : 0
  subcategories.push({
    label: 'Tasa de resolución',
    score: Math.round(resolutionRate * 100),
    weight: 0.35,
    description:
      conversations.length > 0
        ? `${archived} de ${conversations.length} conversaciones resueltas`
        : 'Sin conversaciones aún',
  })

  // Activity level
  const recentMessages = messages.length
  const activityScore = Math.min(100, recentMessages * 5)
  subcategories.push({
    label: 'Actividad reciente',
    score: activityScore,
    weight: 0.30,
    description:
      recentMessages > 0
        ? `${recentMessages} mensajes esta semana`
        : 'Sin actividad esta semana',
  })

  // Customer engagement
  const recentCustomers = customers.filter(
    (c) => new Date(c.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
  ).length
  const engagementScore = Math.min(100, recentCustomers * 25)
  subcategories.push({
    label: 'Interacción con clientes',
    score: engagementScore,
    weight: 0.35,
    description:
      recentCustomers > 0
        ? `${recentCustomers} cliente${recentCustomers > 1 ? 's' : ''} nuevo${recentCustomers > 1 ? 's' : ''} esta semana`
        : 'Sin clientes nuevos esta semana',
  })

  const score = Math.round(
    subcategories.reduce((sum, s) => sum + s.score * s.weight, 0)
  )

  const weakest = subcategories.reduce((min, s) => (s.score < min.score ? s : min), subcategories[0])
  const guidance = getGuidance('performance', score, weakest.score < 50 ? weakest.label : null)

  return {
    score,
    subcategories,
    message: getPerformanceMessage(score),
    guidance,
  }
}

// =============================================
// MESSAGES (natural Spanish)
// =============================================

function getPreparationMessage(score: number): string {
  if (score >= 90) return 'Conozco tu negocio muy bien.'
  if (score >= 70) return 'Estoy bien preparada para representar tu negocio.'
  if (score >= 50) return 'Voy aprendiendo, pero me falta conocerte más.'
  if (score >= 30) return 'Estoy empezando a conocerte. Déjame seguir aprendiendo.'
  return 'Todavía no conozco mucho sobre tu negocio.'
}

function getConfidenceMessage(score: number): string {
  if (score >= 90) return 'Me siento muy segura respondiendo preguntas.'
  if (score >= 70) return 'Tengo buena confianza para atender clientes.'
  if (score >= 50) return 'Estoy ganando confianza poco a poco.'
  if (score >= 30) return 'Necesito practicar más para sentirme segura.'
  return 'Todavía no me siento lista para responder.'
}

function getPerformanceMessage(score: number): string {
  if (score >= 90) return 'Me está yendo muy bien con los clientes.'
  if (score >= 70) return 'Estoy teniendo buenas interacciones.'
  if (score >= 50) return 'Voy mejorando con cada conversación.'
  if (score >= 30) return 'Necesito mejorar en algunos aspectos.'
  return 'Estoy aprendiendo de mis primeras conversaciones.'
}

// =============================================
// GUIDANCE
// =============================================

function getGuidance(
  indicator: 'preparation' | 'confidence' | 'performance',
  score: number,
  weakestSubcategory: string | null
): GuidanceItem | null {
  if (score >= 80 || !weakestSubcategory) return null

  const guidanceMap: Record<string, Record<string, GuidanceItem>> = {
    preparation: {
      'Identidad del negocio': {
        message: 'Cuéntame más sobre tu negocio para conocerlo mejor.',
        actionLabel: 'Completar mi negocio',
        actionHref: '/dashboard/onboarding',
      },
      Productos: {
        message: 'Necesito conocer mejor tus productos.',
        actionLabel: 'Enseñarme productos',
        actionHref: '/dashboard/knowledge',
      },
      'Reglas del negocio': {
        message: 'Déjame aprender las reglas de tu negocio.',
        actionLabel: 'Enseñarme reglas',
        actionHref: '/dashboard/knowledge',
      },
      Conocimiento: {
        message: 'Necesito saber más cosas sobre tu negocio.',
        actionLabel: 'Enseñarme más',
        actionHref: '/dashboard/knowledge',
      },
      Personalidad: {
        message: 'Necesito definir cómo hablar con tus clientes.',
        actionLabel: 'Definir mi personalidad',
        actionHref: '/dashboard/knowledge',
      },
      'Práctica de ventas': {
        message: 'Me falta practicar situaciones de venta.',
        actionLabel: 'Practicar en el Laboratorio',
        actionHref: '/dashboard/laboratorio',
      },
      'Canales conectados': {
        message: 'Necesito un canal para hablar con tus clientes.',
        actionLabel: 'Conectar un canal',
        actionHref: '/dashboard/connections',
      },
      'Actividad reciente': {
        message: 'Estoy un poco quieta. Enséñame algo nuevo.',
        actionLabel: 'Enseñarme algo',
        actionHref: '/dashboard/knowledge',
      },
    },
    confidence: {
      'Amplitud del conocimiento': {
        message: 'Mi conocimiento es limitado en algunas áreas.',
        actionLabel: 'Ampliar mi conocimiento',
        actionHref: '/dashboard/knowledge',
      },
      'Calidad del entrenamiento': {
        message: 'Mis correcciones recientes no me están ayudando mucho.',
        actionLabel: 'Revisar mis correcciones',
        actionHref: '/dashboard/knowledge',
      },
      'Velocidad de aprendizaje': {
        message: 'Necesito practicar más seguido.',
        actionLabel: 'Practicar ahora',
        actionHref: '/dashboard/laboratorio',
      },
      'Desempeño en simulaciones': {
        message: 'Me cuesta en las simulaciones. Necesito mejorar.',
        actionLabel: 'Practicar en el Laboratorio',
        actionHref: '/dashboard/laboratorio',
      },
      'Experiencia con clientes': {
        message: 'Me falta experiencia real con clientes.',
        actionLabel: 'Conectar un canal',
        actionHref: '/dashboard/connections',
      },
    },
    performance: {
      'Tasa de resolución': {
        message: 'Algunas conversaciones quedan sin resolver.',
        actionLabel: 'Revisar conversaciones',
        actionHref: '/dashboard/knowledge',
      },
      'Actividad reciente': {
        message: 'He estado quieta últimamente.',
        actionLabel: 'Practicar en el Laboratorio',
        actionHref: '/dashboard/laboratorio',
      },
      'Interacción con clientes': {
        message: 'Necesito interactuar con más clientes.',
        actionLabel: 'Conectar un canal',
        actionHref: '/dashboard/connections',
      },
    },
  }

  return guidanceMap[indicator]?.[weakestSubcategory] ?? null
}

// =============================================
// SNAPSHOTS
// =============================================

async function getLastSnapshot(
  supabase: SupabaseClient,
  businessId: string
): Promise<ReadinessSnapshot | null> {
  const { data } = await supabase
    .from('readiness_snapshots')
    .select('preparation, confidence, performance, overall, calculated_at')
    .eq('business_id', businessId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

async function getTrend(
  supabase: SupabaseClient,
  businessId: string,
  days: number
): Promise<Array<{ date: string; preparation: number; confidence: number; performance: number | null }>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('readiness_snapshots')
    .select('preparation, confidence, performance, calculated_at')
    .eq('business_id', businessId)
    .gte('calculated_at', since)
    .order('calculated_at', { ascending: true })

  return (data ?? []).map((s) => ({
    date: s.calculated_at,
    preparation: s.preparation,
    confidence: s.confidence,
    performance: s.performance,
  }))
}

async function storeSnapshot(
  supabase: SupabaseClient,
  businessId: string,
  snapshot: {
    preparation: number
    confidence: number
    performance: number | null
    overall: number
  }
): Promise<void> {
  await supabase.from('readiness_snapshots').insert({
    business_id: businessId,
    preparation: snapshot.preparation,
    confidence: snapshot.confidence,
    performance: snapshot.performance,
    overall: snapshot.overall,
  })
}

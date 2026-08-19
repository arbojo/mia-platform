import { MODEL, TOKEN_COSTS } from '@/lib/ai/client'
import OpenAI from 'openai'
import { renderPrd, type PrdDocument, type BusinessDomain } from './template'

function getPrdClient(): OpenAI {
  const apiKey = process.env.OPENAI_PRD_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_PRD_API_KEY')
  return new OpenAI({ apiKey })
}

const SYSTEM_PROMPT = `You are the PRD Generator for MIA Platform — a multi-domain AI platform.

Your job: transform an informal feature idea into a structured PRD (Product Requirements Document).

## MIA Platform Architecture (5 domains)

MIA Platform has independent domains, each with own schema, API, UI:

### Platform/Core (public schema — shared infrastructure)
- Businesses, Brand Identity, AI Instructions, Assistants, Channels
- Boundary test: "Does this serve the platform infrastructure?"

### Sales (public schema — conversation + sales intelligence)
- Products, Knowledge, Customers, Conversations, Messages, Sales Events
- Boundary test: "Does this help converse with or sell to customers?"
- ALWAYS enabled (core entry point)

### Inventory (inventory schema — optional)
- Stock Items, Assets, Predictions, Suppliers, Purchase Orders
- Boundary test: "Does this manage stock, catalog, purchasing, or suppliers?"
- Optional module, gated by edition + enabled

### Delivery (delivery schema — optional)
- Drivers, Routes, Orders, Visits, Closures
- Boundary test: "Does this fulfill orders, manage drivers, or plan routes?"
- Optional module, gated by edition + enabled

### Analytics (analytics schema — optional, FUTURE)
- Cross-domain insights, business intelligence
- Boundary test: "Does this generate cross-domain business insights?"
- Read-only observer of all enabled modules

## Sales Intelligence Events
SALE_STARTED, PRODUCT_SELECTED, OBJECTION_DETECTED, OBJECTION_RESOLVED,
UPSELL_ACCEPTED, CROSSSELL_ACCEPTED, FOLLOWUP_REQUIRED, SALE_WON, SALE_LOST,
CUSTOMER_HESITATION, PRICE_ACCEPTED, PRICE_REJECTED, SALE_CONFIRMED, SALE_CANCELLED

## Tech Stack
Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4,
shadcn/ui, Supabase (PostgreSQL + RLS), OpenAI gpt-4o-mini, Playwright

## Output Format
Return a JSON object with exactly these fields (no markdown, no code fences):
{
  "title": "string",
  "problemStatement": "string (2-4 sentences describing the problem)",
  "proposedSolution": "string (2-4 sentences describing the solution)",
  "domainAlignment": {
    "primaryDomain": "sales | inventory | delivery | analytics | platform",
    "affectedDomains": ["sales", "inventory", ...],
    "explanation": "string",
    "salesEvents": ["string"] or [],
    "moduleEvents": ["string"] or []
  },
  "scope": {
    "categories": ["feature", "bugfix", "refactor", "schema_change", "ai_behaviour", "ui_change", "api_change", "security", "documentation", "infrastructure"],
    "filesAffected": number,
    "hasSchemaChanges": boolean,
    "schemaDescription": "string",
    "hasAIChanges": boolean,
    "aiChangesDescription": "string",
    "hasSecurityImplications": boolean,
    "securityDescription": "string",
    "technicalDomains": ["frontend", "backend", "database", "ai", "infrastructure"]
  },
  "impactAnalysis": "string (2-4 sentences on dependencies and blast radius)",
  "acceptanceCriteria": ["string", "string"],
  "outOfScope": "string (what we explicitly NOT building)",
  "successMetrics": "string (how we measure value)",
  "openQuestions": "string (decisions needed from council)"
}

Rules:
- Classify the feature into the correct primary domain using the boundary tests
- If the feature spans multiple domains, list ALL affected domains
- Acceptance criteria must be testable and specific (no vague criteria)
- categories must be from the allowed list
- technicalDomains must be from the allowed list
- filesAffected is an estimate (use your best judgment based on scope)
- Return ONLY the JSON object, no additional text`

interface BuildPrdParams {
  title: string
  description: string
  context?: string
}

interface BuildPrdResult {
  prd: PrdDocument
  markdown: string
  tokensUsed: { input: number; output: number }
}

export async function buildPrd(params: BuildPrdParams): Promise<BuildPrdResult> {
  const openai = getPrdClient()

  const userMessage = `Feature idea:
Title: ${params.title}
Description: ${params.description}
${params.context ? `Additional context: ${params.context}` : ''}`

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      })

      const content = completion.choices[0]?.message?.content
      if (!content) throw new Error('Empty response from OpenAI')

      const tokensUsed = {
        input: completion.usage?.prompt_tokens ?? 0,
        output: completion.usage?.completion_tokens ?? 0,
      }

      const raw = parseJsonResponse(content)
      const prd = coercePrd(raw)
      validatePrd(prd)

      const markdown = renderPrd(prd)
      return { prd, markdown, tokensUsed }
    } catch (err) {
      lastError = err as Error
      if (attempt === 0) continue
    }
  }

  throw lastError
}

function parseJsonResponse(content: string): Record<string, unknown> {
  let cleaned = content.trim()

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    throw new Error(`Failed to parse PRD JSON: ${cleaned.slice(0, 200)}`)
  }
}

function coercePrd(raw: Record<string, unknown>): PrdDocument {
  if (typeof raw.acceptanceCriteria === 'string') {
    raw.acceptanceCriteria = (raw.acceptanceCriteria as string)
      .split('\n')
      .map((l) => l.replace(/^[-*]\s*\[[ x]\]\s*/, '').trim())
      .filter((l) => l.length > 0)
  }

  if (Array.isArray(raw.acceptanceCriteria) && raw.acceptanceCriteria.length === 0) {
    raw.acceptanceCriteria = [
      `${raw.title} está disponible y funcionando`,
      `El usuario puede interactuar con la funcionalidad principal`,
      `La interfaz es responsive y accesible`,
    ]
  }

  if (!raw.scope || typeof raw.scope !== 'object' || Array.isArray(raw.scope)) {
    raw.scope = {
      categories: ['feature'],
      filesAffected: 3,
      hasSchemaChanges: false,
      schemaDescription: '',
      hasAIChanges: false,
      aiChangesDescription: '',
      hasSecurityImplications: false,
      securityDescription: '',
      technicalDomains: ['backend'],
    }
  }

  const scope = raw.scope as Record<string, unknown>

  if (Array.isArray(scope.domains) && !Array.isArray(scope.technicalDomains)) {
    scope.technicalDomains = scope.domains
  }
  delete scope.domains

  if (Array.isArray(scope.technicalDomains)) {
    scope.technicalDomains = scope.technicalDomains.map((d: unknown) => String(d).toLowerCase())
  }
  if (!Array.isArray(scope.technicalDomains) || scope.technicalDomains.length === 0) {
    scope.technicalDomains = ['backend']
  }
  if (Array.isArray(scope.categories)) {
    scope.categories = scope.categories.map((c: unknown) => String(c).toLowerCase())
  }
  if (!Array.isArray(scope.categories) || scope.categories.length === 0) {
    scope.categories = ['feature']
  }
  const filesNum = Number(scope.filesAffected)
  scope.filesAffected = filesNum >= 1 ? filesNum : 3
  if (typeof scope.hasSchemaChanges !== 'boolean') scope.hasSchemaChanges = false
  if (typeof scope.hasAIChanges !== 'boolean') scope.hasAIChanges = false
  if (typeof scope.hasSecurityImplications !== 'boolean') scope.hasSecurityImplications = false
  if (typeof scope.schemaDescription !== 'string') scope.schemaDescription = ''
  if (typeof scope.aiChangesDescription !== 'string') scope.aiChangesDescription = ''
  if (typeof scope.securityDescription !== 'string') scope.securityDescription = ''

  const VALID_DOMAINS: BusinessDomain[] = ['sales', 'inventory', 'delivery', 'analytics', 'platform']

  if (!raw.domainAlignment || typeof raw.domainAlignment !== 'object' || Array.isArray(raw.domainAlignment)) {
    raw.domainAlignment = {}
  }

  const da = raw.domainAlignment as Record<string, unknown>

  if (typeof da.inDomain === 'boolean' && typeof da.primaryDomain !== 'string') {
    da.primaryDomain = da.inDomain ? 'sales' : 'platform'
  }
  if (!VALID_DOMAINS.includes(da.primaryDomain as BusinessDomain)) {
    da.primaryDomain = 'sales'
  }

  if (typeof da.helpsSellBetter === 'boolean' && !Array.isArray(da.affectedDomains)) {
    da.affectedDomains = da.helpsSellBetter ? ['sales'] : ['platform']
  }
  if (!Array.isArray(da.affectedDomains)) {
    da.affectedDomains = []
  }
  if ((da.affectedDomains as unknown[]).length === 0) {
    da.affectedDomains = [da.primaryDomain]
  }
  da.affectedDomains = (da.affectedDomains as unknown[]).filter((d: unknown) =>
    VALID_DOMAINS.includes(d as BusinessDomain),
  )

  delete da.helpsSellBetter
  delete da.inDomain

  if (!Array.isArray(da.salesEvents)) da.salesEvents = []
  if (!Array.isArray(da.moduleEvents)) da.moduleEvents = []

  return raw as unknown as PrdDocument
}

function validatePrd(prd: PrdDocument): void {
  const requiredFields: Array<keyof PrdDocument> = [
    'title', 'problemStatement', 'proposedSolution',
    'domainAlignment', 'scope', 'impactAnalysis',
    'acceptanceCriteria', 'outOfScope', 'successMetrics', 'openQuestions',
  ]

  for (const field of requiredFields) {
    if (!prd[field]) {
      throw new Error(`PRD missing required field: ${field}`)
    }
  }

  if (prd.acceptanceCriteria.length === 0) {
    throw new Error('PRD must have at least one acceptance criterion')
  }

  if (typeof prd.scope.filesAffected !== 'number' || prd.scope.filesAffected < 1) {
    prd.scope.filesAffected = 3
  }

  const validCategories = [
    'bugfix', 'feature', 'refactor', 'schema_change', 'ai_behaviour',
    'ui_change', 'api_change', 'security', 'documentation', 'infrastructure',
  ]
  for (const cat of prd.scope.categories) {
    if (!validCategories.includes(cat)) {
      throw new Error(`Invalid category: ${cat}`)
    }
  }

  const validTechDomains = ['frontend', 'backend', 'database', 'ai', 'infrastructure']
  for (const dom of prd.scope.technicalDomains) {
    if (!validTechDomains.includes(dom)) {
      throw new Error(`Invalid technical domain: ${dom}`)
    }
  }

  const VALID_DOMAINS: BusinessDomain[] = ['sales', 'inventory', 'delivery', 'analytics', 'platform']
  if (!VALID_DOMAINS.includes(prd.domainAlignment.primaryDomain)) {
    throw new Error(`Invalid primaryDomain: ${prd.domainAlignment.primaryDomain}`)
  }
  for (const dom of prd.domainAlignment.affectedDomains) {
    if (!VALID_DOMAINS.includes(dom)) {
      throw new Error(`Invalid affectedDomain: ${dom}`)
    }
  }
}

export function computePrdCost(tokensUsed: { input: number; output: number }): number {
  const costs = TOKEN_COSTS[MODEL]
  if (!costs) return 0
  return tokensUsed.input * costs.input + tokensUsed.output * costs.output
}

import { getOpenAIClient, MODEL, TOKEN_COSTS } from '@/lib/ai/client'
import { renderPrd, type PrdDocument } from './template'

const SYSTEM_PROMPT = `You are the PRD Generator for MIA Platform — an AI sales assistant platform.

Your job: transform an informal feature idea into a structured PRD (Product Requirements Document).

## MIA Domain Model (15 entities)
Business, BrandIdentity, KnowledgeBase, KnowledgeVersions, AiInstructions,
Assistants, Products, SalesRules, Customers, AssistantMemory, Conversations,
Messages, LearningEvents, AiUsage, LabSessions

## ADR-010 Domain Boundary
MIA is a Conversational Sales Intelligence platform. Its responsibility:
- Conversation, Rapport, Need Discovery, Product Presentation
- Objection Handling, Closing, Customer Recovery
- Intelligent Follow-up, Consultative Selling, Upselling/Cross-selling
- Data Capture, Sales Events

MIA does NOT: ERP, inventory, routing, delivery, payments, billing, invoicing.

## Sales Intelligence Events
SALE_STARTED, PRODUCT_SELECTED, OBJECTION_DETECTED, OBJECTION_RESOLVED,
UPSELL_ACCEPTED, CROSSSELL_ACCEPTED, FOLLOWUP_REQUIRED, SALE_WON, SALE_LOST,
CUSTOMER_HESITATION, PRICE_ACCEPTED, PRICE_REJECTED

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
    "helpsSellBetter": boolean,
    "explanation": "string",
    "inDomain": boolean,
    "salesEvents": ["string"] or []
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
    "domains": ["frontend", "backend", "database", "ai", "infrastructure"]
  },
  "impactAnalysis": "string (2-4 sentences on dependencies and blast radius)",
  "acceptanceCriteria": ["string", "string"],
  "outOfScope": "string (what we explicitly NOT building)",
  "successMetrics": "string (how we measure value)",
  "openQuestions": "string (decisions needed from council)"
}

Rules:
- If the idea does NOT help MIA sell better, set inDomain=false and explain why in explanation
- Acceptance criteria must be testable and specific (no vague criteria)
- categories must be from the allowed list
- domains must be from the allowed list
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
  const openai = getOpenAIClient()

  const userMessage = `Feature idea:
Title: ${params.title}
Description: ${params.description}
${params.context ? `Additional context: ${params.context}` : ''}`

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

  const parsed = parseJsonResponse(content)
  validatePrd(parsed)

  const markdown = renderPrd(parsed)

  return { prd: parsed, markdown, tokensUsed }
}

function parseJsonResponse(content: string): PrdDocument {
  let cleaned = content.trim()

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    return JSON.parse(cleaned) as PrdDocument
  } catch {
    throw new Error(`Failed to parse PRD JSON: ${cleaned.slice(0, 200)}`)
  }
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

  if (prd.scope.filesAffected < 1) {
    throw new Error('PRD scope.filesAffected must be >= 1')
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

  const validDomains = ['frontend', 'backend', 'database', 'ai', 'infrastructure']
  for (const dom of prd.scope.domains) {
    if (!validDomains.includes(dom)) {
      throw new Error(`Invalid domain: ${dom}`)
    }
  }
}

export function computePrdCost(tokensUsed: { input: number; output: number }): number {
  const costs = TOKEN_COSTS[MODEL]
  if (!costs) return 0
  return tokensUsed.input * costs.input + tokensUsed.output * costs.output
}

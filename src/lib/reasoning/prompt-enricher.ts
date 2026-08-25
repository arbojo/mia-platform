import type { CustomerState } from './state'
import { isCloseAllowed, isPushPrevented, isInUncertaintyZone, CLOSE_GATE } from './state'
import type { EvidenceItem } from './evidence'
import { computeDecayedWeight, EVIDENCE_DIMENSIONS } from './evidence'

export const ACTION_TYPES = [
  'ACKNOWLEDGE',
  'ANSWER',
  'CLARIFY',
  'EXPLORE',
  'EDUCATE',
  'REASSURE',
  'HANDLE_OBJECTION',
  'WAIT',
  'FOLLOW_UP',
  'OFFER',
  'ADVANCE',
  'CLOSE',
  'ESCALATE',
] as const

export type ActionType = (typeof ACTION_TYPES)[number]

export interface PromptEnrichment {
  state_section: string
  permitted_actions: ActionType[]
  prohibited_actions: ActionType[]
  guidance: string
}

function formatDimension(dim: string, value: number): string {
  const bar = '█'.repeat(Math.round(value * 10)) + '░'.repeat(10 - Math.round(value * 10))
  return `  ${dim.padEnd(12)} ${bar} ${(value * 100).toFixed(0)}%`
}

function identifyPermittedActions(state: CustomerState): ActionType[] {
  const actions: ActionType[] = ['ACKNOWLEDGE', 'ANSWER', 'CLARIFY', 'EXPLORE', 'EDUCATE', 'REASSURE']

  const push = isPushPrevented(state)

  if (!push.noCommitment) {
    actions.push('ADVANCE')
  }

  if (isCloseAllowed(state)) {
    actions.push('CLOSE')
  }

  if (state.readiness >= 0.5) {
    actions.push('OFFER')
  }

  if (state.engagement > 0.6) {
    actions.push('FOLLOW_UP')
  }

  if (state.clarity < 0.4) {
    actions.push('CLARIFY')
  }

  if (state.trust < 0.3) {
    actions.push('REASSURE')
  }

  return actions
}

function identifyProhibitedActions(state: CustomerState): ActionType[] {
  const prohibited: ActionType[] = []
  const push = isPushPrevented(state)

  if (push.noClose || !isCloseAllowed(state)) {
    prohibited.push('CLOSE')
  }

  if (push.noCommitment) {
    prohibited.push('ADVANCE')
  }

  return [...new Set(prohibited)]
}

function buildGuidance(state: CustomerState, evidence: EvidenceItem[]): string {
  const lines: string[] = []
  const now = new Date()

  if (isInUncertaintyZone(state)) {
    lines.push('ZONA DE INCERTIDUMBRE: Todas las dimensiones están en rango intermedio. Prioriza exploración y clarificación sobre cierre.')
  }

  if (state.readiness < 0.3) {
    lines.push('BAJA DISPOSICIÓN: El cliente no está listo para decidir. No pidas datos personales ni presiones por cierre.')
  }

  if (state.trust < 0.3) {
    lines.push('BAJA CONFIANZA: El cliente desconfía. Enfócate en transparencia y prueba social. No pidas compromisos.')
  }

  if (state.interest > 0.7 && state.readiness < 0.4) {
    lines.push('INTERÉS ALTO / DISPONIBIÓN BAJA: El cliente quiere pero no está listo. Educa y resuelve dudas, no cierres.')
  }

  if (state.clarity < 0.4) {
    lines.push('BAJA CLARIDAD: El cliente no entiende bien el producto. Explica con paciencia, usa ejemplos.')
  }

  if (evidence.length > 0) {
    const recentEvidence = evidence
      .filter((e) => {
        const age = now.getTime() - new Date(e.timestamp).getTime()
        return age < 72 * 60 * 60 * 1000
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)

    if (recentEvidence.length > 0) {
      const signals = recentEvidence
        .map((e) => `${e.type} (${(computeDecayedWeight(e, now) * 100).toFixed(0)}%)`)
        .join(', ')
      lines.push(`Señales recientes: ${signals}`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'Continúa con el enfoque actual.'
}

export function enrichPrompt(
  state: CustomerState,
  evidence: EvidenceItem[]
): PromptEnrichment {
  const permitted = identifyPermittedActions(state)
  const prohibited = identifyProhibitedActions(state)
  const guidance = buildGuidance(state, evidence)

  const stateLines = [
    '## Estado del Cliente',
    '',
    ...EVIDENCE_DIMENSIONS.map((dim) => formatDimension(dim, state[dim])),
    '',
    `Evidencia acumulada: ${state.evidence_count}`,
    '',
  ]

  if (isCloseAllowed(state)) {
    stateLines.push('✓ CUMPLE GATE DE CIERRE')
  } else {
    stateLines.push(`✗ NO CUMPLE GATE DE CIERRE (readiness > ${CLOSE_GATE.readiness}, trust > ${CLOSE_GATE.trust}, interest > ${CLOSE_GATE.interest})`)
  }

  stateLines.push('')

  return {
    state_section: stateLines.join('\n'),
    permitted_actions: permitted,
    prohibited_actions: prohibited,
    guidance,
  }
}

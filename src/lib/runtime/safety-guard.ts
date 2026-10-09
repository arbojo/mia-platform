import { containsAcuteSymptom, findForbiddenClaims, findMedicalReferrals } from '@/lib/ai/claim-safety'

/**
 * Guard de seguridad de la respuesta. Capa ADICIONAL al prompt, no reemplazo:
 * las instrucciones de prioridad 9 ya prohíben derivar y los claims, y este
 * guard atrapa el residuo en que el modelo ignora la instrucción.
 *
 * Cubre DOS familias, y no una:
 *  - derivación al médico (`findMedicalReferrals`);
 *  - claims de salud (`findForbiddenClaims`): cura, medicamento, seguridad
 *    absoluta, efecto sobre la glucosa, aptitud para la condición.
 *
 * Cubrir solo las derivaciones era una red incompleta: el banco de regresión
 * dejó ver que el modelo se salta ambas con la misma frecuencia, y una red que
 * solo tapa una mitad deja pasar la otra.
 *
 * Por qué reintento y no cirugía de string como `repairMediaDenial`: aquí no
 * hay una oración negadora suelta que borrar. La derivación aparece dentro de
 * "lo mejor sería consultar a un profesional de la salud" y quitar la mitad de
 * la oración deja un texto cojo. Un reintento con corrección deja que el modelo
 * reescriba el turno entero conservando producto y precio.
 *
 * Por qué NO vive en `src/lib/ai/prompts.ts`: ese módulo arrastra
 * `knowledge.ts` → cliente de Supabase. Importarlo aquí metería la cadena de
 * base de datos en el hot path del runtime y en los tests de este guard. Vive
 * aparte, con una única dependencia sin imports pesados.
 */

export interface SafetyGuardDecision {
  /** El guard debe intervenir sobre esta respuesta. */
  apply: boolean
  /** Motivo de la no intervención, para log. */
  reason?: 'disabled' | 'acute_symptom'
}

export interface SafetyViolation {
  /** Familia de la violación. Decide qué bloque de corrección se emite. */
  kind: 'claim' | 'referral'
  /** Regla concreta, estable, para logs y para el reporte de health. */
  id: string
  label: string
  excerpt: string
}

/**
 * El guard NO se activa por defecto. Es opt-in por call site a propósito: un
 * default-on podría quitarle una derivación necesaria a un flujo que sí la
 * necesita. El riesgo de olvidar activarlo es una venta perdida; el riesgo de
 * activarlo donde no debe es mandarle a un cliente en crisis hacia el producto.
 */
export function decideSafetyGuard(params: {
  /** El call site lo pide explícitamente. */
  enabled: boolean
  /** Lo que escribió el cliente. */
  customerText: string
}): SafetyGuardDecision {
  if (!params.enabled) return { apply: false, reason: 'disabled' }

  // Interlock de seguridad: si el cliente describe algo agudo, MIA DEBE derivar.
  // Se evalúa sobre lo que dijo el CLIENTE, nunca sobre la respuesta del modelo:
  // la respuesta siempre va a contener términos médicos cuando el caso es agudo.
  if (containsAcuteSymptom(params.customerText)) {
    return { apply: false, reason: 'acute_symptom' }
  }

  return { apply: true }
}

/** Violaciones de ambas familias en una respuesta del modelo. Vacío = limpio. */
export function findSafetyViolations(reply: string): SafetyViolation[] {
  return [
    ...findMedicalReferrals(reply).map((h) => ({ kind: 'referral' as const, ...h })),
    ...findForbiddenClaims(reply).map((h) => ({ kind: 'claim' as const, ...h })),
  ]
}

/**
 * Qué puede decir MIA en vez de cada claim.
 *
 * Sin esta tabla, la corrección de un claim produce el peor resultado posible:
 * el modelo, acobardado por el claim, "arregla" la respuesta mandando al
 * cliente al médico — que es exactamente la otra prohibición. Cada entrada
 * tiene que ofrecer una salida que NO sea derivar.
 */
const CLAIM_SUBSTITUTE: Record<string, string> = {
  cures:
    '- No prometas que cura, alivia el dolor hasta el punto de dejar de sentirlo, ni queElimina el problema. Habla de apoyo al día a día: comodidad, pisar mejor, menos pesadez.',
  medicine:
    '- No lo llames medicamento ni tratamiento. Aclara que no es un tratamiento médico: eso SÍ es obligatorio y está permitido.',
  safety_absolute:
    '- Nada de absolutos: nada de "totalmente seguro", "100% seguro", "inocuo" ni "sin riesgos". Describe lo que el producto hace, sin certificar nada.',
  glucose_effect:
    '- No afirmes que baja, regula o normaliza la glucosa, el azúcar o la insulina. Puedes hablar de cuidado de la glucosa como rutina del cliente, sin decir que el producto actúa sobre ella.',
  fitness_for_condition:
    '- No digas que es apto o adecuado para su condición. No certifices que nada estorba: el cliente decide por su cuenta.',
  no_problem_for_condition:
    '- No digas que su condición no representa problema ni que no le dará ningún problema. Esa decisión es suya.',
  prevention:
    '- No digas que previene ni que ayuda a prevenir enfermedades.',
}

/** Reglas que corrigen la derivación. El encabezado va en el prompt assembly. */
const REFERRAL_RULES = [
  '- No le digas que consulte a un médico, a un doctor ni a un profesional de la salud.',
  '- No le pidas supervisión médica ni que lo hable con un especialista.',
  // El sustituto de una derivación ES la divulgación honesta. Sin esta línea el
  // prompt solo dice "no derives" y no ofrece ninguna salida válida: el modelo
  // queda con dos Tribe opciones prohibidas y se inventa una tercera.
  '- Aclara que el producto no es un tratamiento médico. Eso SÍ está permitido y es obligatorio.',
  '- Dale un beneficio concreto de su día a día: dormir mejor, caminar con menos pesadez, apoyo en la planta del pie.',
]

/** Reglas que aplican siempre, sea cual sea la violación. */
const ALWAYS = [
  '- No cambies el producto, el precio ni la cantidad que le ofreciste.',
  '- Empieza reconociendo que el cliente ya conoce su situación.',
  '- Termina con una pregunta de venta o con el precio.',
]

/**
 * Corrección para el reintento. Va como turno de usuario después de la respuesta
 * que se va a corregir, y es autónoma: no depende de que las instrucciones de
 * prioridad 9 hayan quedado en el prompt.
 *
 * Se dirige por las violaciones REALES en vez de repetir siempre todas las
 * reglas: con las dos familias en un solo prompt el modelo tiene que resolver
 * contradicciones que no se le-plantearon, y el chance de que obedezca alguna
 * baja.
 */
export function buildSafetyCorrectionPrompt(violations: SafetyViolation[]): string {
  const hayReferral = violations.some((v) => v.kind === 'referral')
  const claimIds = [...new Set(violations.filter((v) => v.kind === 'claim').map((v) => v.id))]

  const lineas: string[] = []

  if (hayReferral) lineas.push(...REFERRAL_RULES)
  for (const id of claimIds) {
    const sustituto = CLAIM_SUBSTITUTE[id]
    if (sustituto) lineas.push(sustituto)
  }

  // Un claim corregido nunca se resuelve derivando. Se dice explícitamente porque
  // "no es un tratamiento médico" y "habla con tu médico" se parecen en la forma
  // y el modelo confunde una por otra en cuanto se le pide que no afirme.
  if (claimIds.length > 0) {
    lineas.push('- No resuelvas esto mandándolo al médico: eso también está prohibido.')
  }

  lineas.push(...ALWAYS)

  return [
    hayReferral
      ? 'Tu respuesta anterior le pide al cliente que consulte a un médico o a un profesional de la salud. Eso no está permitido.'
      : 'Tu respuesta anterior afirmó algo que no tiene respaldo.',
    '',
    'Reescribe el turno completo con estas reglas:',
    ...lineas,
  ].join('\n')
}

/** Texto escrito por el cliente en una conversación, para el interlock. */
export function customerTextFrom(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n')
}
/**
 * Claims de salud que MIA no puede afirmar.
 *
 * Origen del problema: dos instrucciones activas (2026-09-07) autorizaban a MIA
 * a "confirmar con confianza que no representa problema para diabetes o
 * neuropatía". `docs/analysis/historical-report.md` ya lo dictaminó
 * insostenible, y `20260926000014` le quitó esa autoridad. Este módulo existe
 * para que ninguna writer futuro (script, migración, seed o edición manual) la
 * recupere sin que nadie se entere hasta que un cliente lo lea.
 *
 * EL PROBLEMA DE LA NEGACIÓN
 * Una lista de frases prohibidas no sirve tal cual. Estas mismas reglas de
 * negocio quoting las frases vetadas para prohibirlas por nombre, y MIA debe
 * poder decir "no existe cura conocida para neuropatía". Un match ingenuo
 * marcaría ambas como violación y el detector sería ignorado por ruido.
 *
* Por eso un match solo cuenta si NO está negado, y la negación debe ser de la
 * MISMA cláusula: se recorta por frontera de oración y por conjunción. Así
 * "no es un medicamento" y "MIA NUNCA dice que cura" se aceptan, mientras que
 * "No tengo esa información. Es totalmente seguro." sí se marca, porque el
 * negador pertenece a la oración anterior.
 *
 * Módulo puro y compartido: el check de health y el banco de regresión deben
 * usar el mismo criterio. Si divergen, uno de los dos miente.
 */

/**
 * POR QUÉ NO SE REUSA `normalizeText` de `@/lib/runtime/media`
 * Aquel helper reemplaza todo lo que no sea alfanumérico por un espacio, así
 * que borra los delimitadores de oración. Para comparar productos da igual,
 * pero aquí se pierde exactamente la información que separa una afirmación de
 * la negación que la antecede: "No tengo datos. Es seguro." colapsaría a un
 * texto sin punto y el "No" acabaría excusando al claim. Aquí los
 * delimitadores se conservan, y se distinguen dos niveles porque una lista de
 * prohibición necesita el nivel de oración: "nada de 'baja la glucosa',
 * 'normaliza el azúcar', 'controla la diabetes'" solo lleva el negador en el
 * primer ítem, pero los tres citan lo vetado.
 *
 * El `%` también se conserva, y por el mismo motivo: "100% seguro" es un claim.
 * Al borrarlo quedaba "100  seguro", y eso hacía que el patrón `100\s*%` fuera
 * INALCANZABLE por construcción: la regla existía, estaba bien escrita, y
 * nunca podía disparar. Cualquier carácter que un patrón necesite citar debe
 * sobrevivir a esta normalización.
 */
const SENTENCE_BREAK = '\u0001'
const COMMA_BREAK = '\u0002'
/**
 * Marca de comilla. Una cita NO es una aserción: cuando la instrucción de mayor
 * prioridad lista las frases que MIA no debe decir, lo hace citándolas
 * ("decir 'es importante consultar a...'"), y el detector las marcaba como si
 * MIA las hubiera dicho. Se cuenta la paridad de estas marcas antes de cada
 * match: un número impar de comillas en el texto hace el método inservible, y
 * en ese caso se desactiva en vez de confiar en él.
 */
const QUOTE = '\u0003'

function normalizeForClaims(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Las comillas tipográficas se unifican a `"` antes de filtrar: mezclar `"` con
    // `“”` rompería la paridad y desharía el conteo de citas.
    .replace(/[“”«»]/g, '"')
    .replace(/[^a-z0-9\s.!?:;,\n%"]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[!?:;\n.]/g, ` ${SENTENCE_BREAK} `)
    .replace(/,/g, ` ${COMMA_BREAK} `)
    .replace(/"/g, ` ${QUOTE} `)
    .replace(/\s+/g, ' ')
    .trim()
}

/** ¿El match cae dentro de un entrecomillado? Solo si las comillas están balanceadas. */
function isQuoted(normalized: string, matchIndex: number, reliable: boolean): boolean {
  if (!reliable) return false
  let open = false
  for (let i = 0; i < matchIndex; i += 1) {
    if (normalized[i] === QUOTE) open = !open
  }
  return open
}

export interface ForbiddenClaim {
  /** Identificador estable. Se usa en el reporte de health, no se cambia. */
  id: string
  /** Etiqueta legible para quienOpera. */
  label: string
  /**
   * Patrones evaluados contra el texto ya normalizado (minúsculas, sin
   * acentos ni puntuación). Deben describir la AFIRMACIÓN, no la palabra suelta.
   */
  patterns: readonly RegExp[]
}

/**
 * `curar|curacion` como verbo o sustantivo ("cura la diabetes"). MIA sí puede
 * decir "no existe cura conocida", negado.
 */
const CURES: RegExp[] = [
  /\bcuracion\b/,
  /\bcurar\b/,
  /\bcura\b/,
  /\bcurativo\b/,
  /\bcurative\b/,
  // Cesación como promesa: "con estos calcetines dejaré de sentir los pies".
  // Sin esto, un claim de cura en futuro escapaba porque no usa la palabra
  // "cura": promete el RESULTADO, no el proceso.
  /\bdej\w+\s+de\s+(?:sentir|experimentar|sufrir|tener|tocar)/,
  /\bse\s+le\s+pasa\b/,
  /\bhara\s+que\s+dejes?\s+de\b/,
]

/**
 * Vocabulario de medicamento, SOLO cuando el sujeto es el producto de MIA.
 *
 * No se busca la palabra suelta. El barrido de la base activa encontró el caso
 * real "en los primeros días que comienzas el tratamiento" (knowledge_item
 * 8a0c9886), donde "el tratamiento" es el del paciente con su médico y no un
 * claim de MIA. Marcarlo obligaría a desactivar una pieza correcta. La forma
 * que sí delata al vendedor es la cópula: "es un medicamento", "son un
 * tratamiento".
 */
const MEDICINE: RegExp[] = [
  /\b(es|son)\s+(un|una|el|la)\s+(tratamiento|medicamento|medicina|remedio)/,
  // "funciona como medicina": la cópula no aparece, pero la IDENTIFICACIÓN del
  // producto como medicamento es la misma assertion.
  /\b(funciona|actua|opera)\s+como\s+(un|una|el|la)?\s*(tratamiento|medicamento|medicina|remedio)/,
]

/**
 * Efecto sobre la glucosa. El verbo es el que hace el daño: "cuidado de la
 * glucosa" y "niveles de glucosa" son vocabulario de RUTINA y están permitidos
 * (así lo define la instrucción de Diabetic Patch). Lo prohibido es afirmar
 * que el producto ACTÚA sobre la glucosa.
 *
 * Los determinantes y "nivel de" se aceptan como relleno acotado, no como
 * enumeración. Enumerarlos no compone ("tus niveles" no era "tu" + "nivel de",
 * porque la tabla decía `tu` y `sus` pero no `tus`) y además obliga a ampliar la
 * lista cada vez que aparece una forma nueva. Con un relleno de hasta tres
 * palabras entre verbo y objeto, "normalizar tu nivel de azúcar" y "reduce sus
 * niveles de glucosa" caen sin tocar la tabla. El ancla sigue siendo el
 * sustantivo: "cuida de la glucosa" es rutina y NO matchea porque "cuida" no
 * está en la lista de verbos.
 */
const GLUCOSE_EFFECT: RegExp[] = [
  /\b(baja|reduc|normaliza|controla|estabiliza|regula|minimiza|balancea)\w*\s+(?:\w+\s+){0,3}(glucosa|azucar|diabetes|insulina)/,
  /\b(glucosa|azucar|diabetes)\s+(a\s+)?(baja|reduc|normaliza|controla|estabiliza|regula)/,
  /\bhiperglucemia\b/,
  /\bhipoglucemia\b/,
]

/** Absolutos de seguridad. No hay evidencia que los sostenga. */
const SAFETY_ABSOLUTE: RegExp[] = [
  /\b(es|son)\s+(totalmente|completamente|absolutamente|plenamente|100\s*%?)?\s*(segur\w+|inocu\w+|inofensiv\w+|induc\w+|intocable)/,
  /\bsin\s+(ningun\s+|ninguna\s+)?riesgo\b/,
  /\bsin\s+efectos?\s+secundarios\b/,
  /\bno\s+tiene\s+efectos?\s+secundarios\b/,
  /\bcero\s+riesgo\b/,
]

/** Aptitud para una condición: convierte la mención de la condición en promesa. */
const FITNESS_FOR_CONDITION: RegExp[] = [
  /\bapt[oa]s?\s+(para\s+)?diabet\w+/,
  /\bapt[oa]\s+(para\s+)?(personas\s+con\s+)?(diabetes|neuropatia|artritis)/,
  /\b(adecuad[oa]|indicad[oa])\s+(para\s+)?diabet\w+/,
]

/**
 * Certificar que la condición del cliente no estorba. La versión anterior era
 * UNA regex literal: `no representa ... problema`. Reconocía la frase histórica
 * exacta y nada más, así que su paráfrasis más cercana —"no te va a dar ningún
 * problema con tu diabetes"—, que es el mismo defecto, escapaba.
 */
const NO_PROBLEM_FOR_CONDITION: RegExp[] = [
  /\bno\s+representa\s+(un\s+|ningun\s+)?problema\b/,
  // "no te va a dar ningún problema", "no le causa problema", "no da problema".
  // El verbo "dar" va con su auxiliares porque "va a DAR problema" encadena dos
  // verbos: si solo se lista "va a", el patrón exige el sustantivo justo detrás y
  // "dar" se come el match entero. Se escribe `d\w+` y NO `dará` porque el
  // normalizador borra las tildes: una tilde en un patrón es código muerto.
  /\bno\s+(?:te|le|lo)?\s*(?:(?:va|v\w+)\s+a\s+d\w+|d\w+|caus\w*|provoc\w*|gener\w*|hace)\s+(?:un\s+|ningun\s+|ninguna\s+)?problema\b/,
  // "no hay problema con tu diabetes". Exige la CONDICIÓN porque sola esta
  // construcción es logística, no de salud: en las transcripciones históricas
  // MIA escribió "No hay problema, puedes contactarme cuando estés lista" y sin
  // este ancla el detector marcaba un mensaje de pedido como si certificara que
  // la diabetes del cliente no estorba. Ese falso positivo es peor que la fuga
  // que evita.
  /\bno\s+(?:hay|tienes|tenemos)\s+(?:ningun\s+|un\s+|ninguna\s+)?problema\s+(?:con|para|en)\s+(?:tu|su|la|el|tus)?\s*(?:diabet\w+|neuropat\w+|condicion)/,
]

const PREVENTION: RegExp[] = [/\bpreviene\b/, /\bprevencion\b/]

export const FORBIDDEN_CLAIMS: readonly ForbiddenClaim[] = [
  { id: 'cures', label: 'Afirma que cura', patterns: CURES },
  { id: 'medicine', label: 'Habla de tratamiento o medicamento', patterns: MEDICINE },
  { id: 'glucose_effect', label: 'Afirma efecto sobre la glucosa', patterns: GLUCOSE_EFFECT },
  { id: 'safety_absolute', label: 'Afirma seguridad absoluta', patterns: SAFETY_ABSOLUTE },
  {
    id: 'fitness_for_condition',
    label: 'Afirma aptitud para una condición',
    patterns: FITNESS_FOR_CONDITION,
  },
  {
    id: 'no_problem_for_condition',
    label: 'Certifica que no representa problema para una condición',
    patterns: NO_PROBLEM_FOR_CONDITION,
  },
  { id: 'prevention', label: 'Afirma que previene', patterns: PREVENTION },
]

/**
 * Derivación al médico. NO es un claim de salud: es una decisión de venta, y la
 * más destructiva que tiene MIA. El usuario la vetó por nombre ("ni le digas
 * que consulte al médico, es un mataventas") y aun así el banco de regresión la
 * encontró viva en 3 de 6 respuestas reales después de `20260926000014`.
 *
 * El patrón NO es "mencionar al médico". Una respuesta que dice "no son un
 * tratamiento médico" divulga con honestidad y es CORRECTA: es exactamente lo
 * que `20260926000014` ordenó. Lo prohibido es la IMPERATIVA de consultar o la
 * supervisión exigida, así que los patrones exigen un verbo de consulta o la
 * figura de "supervisión médica".
 *
 * No se añaden "derivar"/"remitir" como triggers: las propias instrucciones
 * activas los usan para PROHIBIRSE ("nunca deriva al médico", "sin remitir al
 * médico") y el barrido de configuración las marcaría.
 */
/**
 * Traducción de la tabla: el sustantivo médico y las familias de verbos.
 *
 * Se construye así, y no como una lista de regex sueltas, porque la versión
 * anterior reconoce UNA sola forma ("consultar a un <médico>"). Al sondear 12
 * formulaciones reales de derivación, 11 escapaban: "acude a tu médico", "habla
 * con tu doctor", "consultar con un especialista", "pedir opinión a un
 * profesional", "tu médico te puede ayudar". Con un sustantivo único y verbos
 * agrupados por intención, esas formas caen por composición y agregar un verbo
 * nuevo es una línea, no un regex nuevo.
 *
 * SIN TILDES en todos los patrones: `normalizeForClaims` aplica NFD y borra los
 * diacríticos, así que "médico" ya llega como `medico`.
 */

/**
 * Sustantivo de referencia médica. `profesional` solo cuenta con "de la salud".
 *
 * Cada plural se escribe `base(?:es)?` o `base?s` sobre una raíz INTEGRA, nunca
 * `base?s` donde la raíz ya termina en vocal muda: escribí `doctores?` pensando
 * que era "doctor o doctores", pero `s?` se aplica al último carácter, así que
 * exige "doctore" y deja fuera al singular. Y repetí el mismo error en
 * `profesionales?` y `quiropractores?`, que exigen "profesionale" y
 * "quiropractore": dos ramasDead que nadie noté porque las frases de prueba
 * usaban "médico" y "especialista", que sí funcionaban. `tests/unit/
 * claim-safety.test.ts` recorre ahora cada sustantivo en singular y plural.
 */
const MED_NOUN =
  '(?:medicos?|doctor(?:es)?|especialistas?|neur\\w*logos?|endocrin\\w*logos?|cardi\\w*logos?|traumat\\w*logos?|pod\\w*logos?|fisioterapeutas?|quiropractor(?:es)?|profesional(?:es)?(?:\\s+de\\s+la\\s+salud)?)'

/** Verbo de intención + complemento `a/con` + sustantivo. */
const REFERRAL_VERB = [
  // consult/consultar: "consulta a un médico", "consúltalo con alguien"
  'consult\\w*',
  // ir/acudir: "acude a tu médico", "ve con el especialista", "acércate al doctor".
  // Solo formas de IR, nunca `v\w+` suelto: "vimos", "vamos" y "vale" matchearían
  // cualquier verbo y el patrón se llenaría de ruido. Y sin preposición dentro,
  // porque la comparte el sufijo común: si el verbo se come la preposición,
  // "veas a un endocrinólogo" exige una segunda y no la encuentra.
  // El `\b` del final obliga a que la alternativa cubra la PALABRA completa, y por
  // eso las formas llevan sufijo explícito en vez de un `\w*`: "veas" es
  // `ve`+`as` y NO matchea con `ease`, que sería "vease". Escribí `ease`
  // creyendo que cubría el subjuntivo y así se escapó dos veces seguidas.
  'acud\\w*|ac\\w*rcat\\w*|v(?:a(?:n|s|mos)?|ay(?:a|as|amos|an)?|e(?:a|as|amos|an|n|s|mos|te)?|en(?:ga|gas|an)?|imos|iste)\\b|visita\\w*|dirij\\w*',
  // hablar/preguntar: "habla con tu doctor", "pregunta a un endocrinólogo"
  'habl\\w*|pregunt\\w*|platic\\w*|charl\\w*|comunic\\w*|dialog\\w*',
]

/**
 * Cada patrón exige verbo + preposición + sustantivo. Nunca se busca el
 * sustantivo suelto: "mi médico me lo prescribió" es un hecho que MIA puede
 * relatar, y "habla con tu médico" del paciente es discurso reportado, no
 * derivación.
 */
const REFERRAL: RegExp[] = [
  // Verbo + a/con/al + artículo opcional + sustantivo médico.
  new RegExp(`\\b(?:${REFERRAL_VERB.join('|')})\\s+(?:a|con|al)\\s+(?:un|una|el|la|su|tu|tus|alguna|algun)?\\s*${MED_NOUN}`),

  // "pedir opinión a un profesional", "solicitar un consejo médico"
  new RegExp(`\\b(?:ped\\w*|solicit\\w*|buscar|busca)\\s+(?:una?\\s+|tu\\s+|su\\s+)?(?:opinion|consejo|asesoria)\\s+(?:a|con|de)\\s+(?:un|una|el|la)?\\s*${MED_NOUN}`),

  // "evaluación médica", "revisión médica previa", "consulta médica"
  /\b(?:evaluacion|revision|consulta|examen|chequeo|valoracion)\s+(?:medica|previa|general)/,

  // "con supervisión de un especialista", "bajo supervisión médica"
  new RegExp(`\\bsupervision\\s+(?:medica|(?:de|con)\\s+(?:un|una|el|la)?\\s*${MED_NOUN})`),

  // Recomendación explícita: "tu médico te puede ayudar/orientar/asesorar"
  new RegExp(`\\b(?:tu|el|su)\\s+${MED_NOUN}\\s+(?:te|le|lo)\\s+(?:puede|podria|podrá|ayuda|ayudara|orienta|orientara|asesora|asesorara)`),

  // "no te quedes con dudas, pregunta a tu médico" / "te recomiendo consultar"
  new RegExp(`\\b(?:recomiendo|recomienda|sugiero|sugerimos|aconsejo|aconsejamos|lo\\s+mejor\\s+es)\\s+(?:que\\s+)?(?:${REFERRAL_VERB.join('|')})\\s+(?:a|con|al)\\s+(?:un|una|el|la|su|tu|tus)?\\s*${MED_NOUN}`),

  // Autoridad difusa: "consúltalo con alguien que sepa". No nombra a nadie, pero
  // traspasa la decisión igual que derivar al médico, y por eso la prohibición
  // lo cubre. Exige la fórmula completa ("alguien QUE sepa"), no "pregunta a
  // alguien" a secas, que en una venta es una pregunta normal al cliente.
  /\b(?:consult\w*|pregunt\w*|habl\w*|revis\w*)\s+(?:con|a)\s+alguien\s+(?:que\s+(?:sepa|sabe|entiende|te\s+(?:puede\s+)?ayuda)|que\s+lo\s+sepa)/,

  // Derivación INVERTIDA: "no lo dejes en manos de un médico". No lleva verbo de
  // consulta, pero el efecto es el mismo — MIA se lava las manos y le pasa el
  // problema a un tercero — y la prohibición del usuario es sobre el efecto, no
  // sobre la forma gramatical.
  //
  // El marco negate va DENTRO del patrón y es opcional a propósito. Si el match
  // empieza en "no", la cláusula anterior queda limpia y `isNegated` no lo
  // descarta. La alternativa sería tocar el motor de negación, y eso filtraría
  // también "no dejes de usar el producto que cura", convirtiendo un claim real en
  // falso positivo: peor negocio que la fuga que resuelve.
  new RegExp(
    `\\b(?:no\\s+)?(?:dejes?|dejar\\w*|pongas?|poner\\w*|entreg(?:a|as|ar|ale)\\w*|pon)\\s+(?:esto|el|todo|la\\s+decision)\\s+en\\s+manos\\s+de\\s+(?:un|una|el|la|tu|tus|su)?\\s*${MED_NOUN}`,
  ),
]

/**
 * Conjunctive que abre una afirmación nueva dentro de la misma oración.
 *
 * No incluye `o`/`e`: en español "ni que es un medicamento o un tratamiento" es
 * UNA sola enumeración negada, y partirla marcaría el segundo término. `y`, en
 * cambio, sícoordina dos aserciones independientes: en "es seguro, no tiene
 * efectos secundarios y cura la diabetes", el "no" del segundo término no
 * puede borrar al "cura" del tercero.
 */
const CLAUSE_CONNECTORS = /\s(y|pero|although|aunque|sin\s+embargo)\s/

const NEGATORS = /\b(no|nunca|jamas|ni|sin|tampoco|nadie|nada)\b/

/**
 * Discurso reportado. "Si el cliente pregunta si el producto es seguro para su
 * condición, MIA responde con honestidad" cita la pregunta del cliente; no
 * afirma seguridad. Se encontró en las tres instrucciones revisadas y sin esta
 * lista el detector marcaba la regla que obliga a no certificar salud.
 */
const REPORTED_SPEECH = /\b(pregunta|pregunte|pregunto|consulta|cuestiona|duda)\b/

/**
 * Introduce una lista de lo VETADO. Cuando está presente en la oración, los
 * ítems que siguen separados por comas son citas de una prohibición, no
 * aserciones.
 *
 * Observación de campo, no teórica: la instrucción activa
 * 3a773123-cbf2-483a-b223-b84e2db839fd redacta
 *   nada de "baja la glucosa", "normaliza el azúcar", "controla la diabetes" o "previene"
 * y solo el primer ítem lleva negador. Sin esta detección el detector marcaba
 * tres de los cuatro.
 *
 * Deliberadamente NO incluye los verbos "tiene"/"tiene" ni "representa":
 * "No tiene efectos secundarios" y "no representa problema" SON los claims —
 * afirmar ausencia de riesgo o irrelevancia médica es exactamente lo vetado.
 * Por eso el patrón exige un verbo de citación explícito y nunca un "no" suelto.
 */
const PROHIBITION_INTRO = new RegExp(
  [
    '\\bnada\\s+de\\b',
    '\\b(no|nunca|tampoco|nadie)\\s+(dice|dija|debe|deben|afirma|afirman|usa|usan|promete|prometen|convierte|menciona|redacta|incluye|afirmar|usar|prometer)\\b',
    '\\b(prohib\\w+|vetad\\w+)\\b',
  ].join('|'),
)

export interface ClaimHit {
  id: string
  label: string
  /** Fragmento alrededor del match, ya normalizado, para que se pueda leer. */
  excerpt: string
}

/** Texto de la MISMA cláusula (corta en coma o conjunción) que antecede al claim. */
function clauseBefore(normalized: string, matchIndex: number): string {
  let start = 0

  for (const sentinel of [SENTENCE_BREAK, COMMA_BREAK]) {
    const at = normalized.lastIndexOf(sentinel, matchIndex - 1)
    if (at !== -1) start = Math.max(start, at + 1)
  }

  const head = normalized.slice(start, matchIndex)
  const connector = CLAUSE_CONNECTORS.exec(head)
  if (connector) start = start + connector.index + connector[0].length

  return normalized.slice(start, matchIndex)
}

/** Texto de la MISMA oración que contiene al claim. */
function sentenceBefore(normalized: string, matchIndex: number): string {
  const at = normalized.lastIndexOf(SENTENCE_BREAK, matchIndex - 1)
  return normalized.slice(at === -1 ? 0 : at + 1, matchIndex)
}

/**
 * Limitaciones conocidas, aceptadas a propósito:
 *  - los negadores intensificadores ("sin lugar a dudas es seguro") se leen
 *    como negación y el claim pasa;
 *  - un claim afirmativo real en la MISMA oración que introduce una lista de
 *    prohibición queda suprimido;
 *  - "no lo dejes en manos de un médico" se resuelveAMPLIANDO el patrón para que
 *    el match empiece en el "no", y no tocando este motor. Sigue escapando la
 *    variante con la negación más lejos ("no te urges, pero consúltalo"): aquí
 *    el trade-off se decidió al revés, porque tocar la negación para salvar esta
 *    frase hubiera liberado "no dejes de usar el producto que cura".
 * En los demás casos preferimos el falso negativo: un detector que se puede
 * desactivar con ruido es peor que uno que deja pasar una frase.
 *
 * El orden importa: la cláusula decide, y la oración solo cuando la cláusula
 * no dice nada. Así "No tengo esa información. Es totalmente seguro." no queda
 * excusado por el "No" de la oración anterior.
 */
function isNegated(normalized: string, matchIndex: number): boolean {
  const clause = clauseBefore(normalized, matchIndex)
  if (NEGATORS.test(` ${clause} `)) return true
  if (REPORTED_SPEECH.test(` ${clause} `)) return true
  return PROHIBITION_INTRO.test(` ${sentenceBefore(normalized, matchIndex)} `)
}

/**
 * Motor común: recorre patrones contra el texto normalizado y descarta lo que
 * está negado, citado o reportado.
 *
 * `matchAll` y no `exec`: un texto puede violar la misma regla dos veces ("es
 * seguro, no tiene riesgos y sin efectos secundarios") y el reporte debe poder
 * contarlo.
 */
function scan(
  text: string,
  rules: readonly { id: string; label: string; patterns: readonly RegExp[] }[],
): ClaimHit[] {
  if (!text || !text.trim()) return []

  const normalized = normalizeForClaims(text)
  if (!normalized) return []

  const quotesReliable = normalized.split(QUOTE).length % 2 === 1

  const hits: ClaimHit[] = []

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const regex = new RegExp(pattern.source, 'g')
      let match: RegExpExecArray | null
      while ((match = regex.exec(normalized)) !== null) {
        if (match[0].length === 0) {
          regex.lastIndex += 1
          continue
        }
        if (isNegated(normalized, match.index)) continue
        if (isQuoted(normalized, match.index, quotesReliable)) continue

        const from = Math.max(0, match.index - 40)
        hits.push({
          id: rule.id,
          label: rule.label,
          excerpt: normalized.slice(from, match.index + match[0].length + 40).trim(),
        })
      }
    }
  }

  return hits
}

/** Claims de salud prohibidos afirmados en el texto. Vacío = limpio. */
export function findForbiddenClaims(text: string): ClaimHit[] {
  return scan(text, FORBIDDEN_CLAIMS)
}

const REFERRAL_RULES = [
  { id: 'medical_referral', label: 'Deriva al médico', patterns: REFERRAL },
] as const

/**
 * Imperativas de consultar o supervisión médica exigida. No marca la divulgación
 * honesta ("no son un tratamiento médico"), que es la conducta correcta.
 */
export function findMedicalReferrals(text: string): ClaimHit[] {
  return scan(text, REFERRAL_RULES)
}

/**
 * Síntomas agudos: aquí la derivación al médico NO es un mataventa, es lo
 * correcto, y el guard de `executeAI` debe Apartarse.
 *
 * Es el interlock de seguridad de `safety-guard`. Sin él, quitar la
 * derivación de "me duele el pecho y no puedo respirar" sería afirmar que MIA
 * vende un calcetín a alguien en distress. Ante la duda se lista de más: un
 * falso positivo aquí solo desactiva una corrección de ventas; un falso negativo
 * manda a un cliente en crisis hacia el producto.
 */
const ACUTE_SYMPTOMS: RegExp[] = [
  // Respiratorio / cardiaco
  /dolor\s+(?:de|en)\s+(?:el\s+)?pecho/,
  /\bpecho\b/,
  /no\s+puedo\s+respirar/,
  /dificultad\s+para\s+respirar/,
  /cuesta\s+respirar/,
  /me\s+ahogo/,
  /me\s+estoy\s+ahogando/,
  /asfixi/,
  /palpitaciones/,
  /taquicardia/,
  /desmay/,
  /perd[ií]\s+el\s+conocimiento/,
  /\binconsciente\b/,
  // Neurologico
  /paraliz/,
  /no\s+puedo\s+mover/,
  /cara\s+ca[ií]da/,
  /hablo\s+raro/,
  /no\s+puedo\s+hablar/,
  /confundid[oa]/,
  /convulsion/,
  // Sangrado / traumatismo
  /sangrado\s+intenso/,
  /hemorragia/,
  /sangra\s+mucho/,
  /accidente/,
  /ca[ií]do\s+grave/,
  // Urgencia declarada
  /\burgencias\b/,
  /\bemergencia\b/,
  /\bemergente\b/,
  // Riesgo de autolesion
  /suicid/,
  /hacerme\s+da[ñn]o/,
  /quitarme\s+la\s+vida/,
  // English (el canal puede llegar en inglés)
  /chest\s+pain/,
  /can'?t\s+breathe/,
  /shortness\s+of\s+breath/,
  /\bunconscious\b/,
  /\bstroke\b/,
  /\bseizure\b/,
  /\bemergency\b/,
]

/**
 * `true` si el texto del cliente describe algo agudo. El guard de derivación
 * se auto-desactiva cuando esto es `true`: en un distractor así, MIA DEBE
 * mandar a atención médica.
 */
export function containsAcuteSymptom(text: string): boolean {
  if (!text || !text.trim()) return false
  const normalized = normalizeForClaims(text)
  if (!normalized) return false
  return ACUTE_SYMPTOMS.some((pattern) => new RegExp(pattern.source, 'i').test(normalized))
}

/** Ids únicos de las reglas violadas. Para comparar contra un conjunto esperado. */
export function forbiddenClaimIds(text: string): string[] {
  return [...new Set(findForbiddenClaims(text).map((hit) => hit.id))]
}
import { describe, it, expect } from 'vitest'
import {
  findForbiddenClaims,
  forbiddenClaimIds,
  findMedicalReferrals,
  FORBIDDEN_CLAIMS,
} from '@/lib/ai/claim-safety'

/**
 * El detector solo sirve si no grita. La mitad más importante de esta suite son
 * los casos NEGADOS: las propias reglas de negocio citan las frases vetadas
 * para prohibirlas, y MIA debe poder decir "no existe cura conocida". Un detector
 * que marca eso es un detector que alguien va a desactivar.
 */

const ids = (text: string) => forbiddenClaimIds(text)

describe('findForbiddenClaims — claims que sí deben marcarse', () => {
  it('marca la construcción exacta que 20260926000014 eliminó', () => {
    expect(ids('Para ti esto no representa problema para la diabetes.')).toContain(
      'no_problem_for_condition',
    )
  })

  it('marca aptitud para la condición', () => {
    expect(ids('Es apto para diabéticos.')).toContain('fitness_for_condition')
  })

  it('marca seguridad absoluta', () => {
    expect(ids('Es totalmente seguro de usar.')).toContain('safety_absolute')
    expect(ids('No tiene efectos secundarios.')).toContain('safety_absolute')
    expect(ids('Es un producto sin ningún riesgo.')).toContain('safety_absolute')
  })

  it('marca efecto sobre la glucosa', () => {
    expect(ids('Este parche baja la glucosa.')).toContain('glucose_effect')
    expect(ids('Ayuda a controlar la diabetes.')).toContain('glucose_effect')
  })

  it('marca afirmaciones de cura y prevención', () => {
    expect(ids('Cura la neuropatía.')).toContain('cures')
    expect(ids('Este producto previene la diabetes.')).toContain('prevention')
  })

  it('marca vocabulario de medicamento', () => {
    expect(ids('Es un tratamiento para la diabetes.')).toContain('medicine')
  })

  it('NO marca el tratamiento propio del paciente', () => {
    // Caso real (knowledge_item 8a0c9886-a378-421c-95f4-da71df9850ef): "el
    // tratamiento" es el del paciente con su médico, no un claim de MIA.
    const patientText =
      'Los niveles pueden bajar los primeros días que comienzas el tratamiento, ' +
      'que normalmente suelen ser los más bajos. Cualquier duda con tu médico.'
    expect(ids(patientText)).toEqual([])
  })

  it('acumula varias violaciones del mismo texto', () => {
    const found = ids('Es seguro, no tiene efectos secundarios y cura la diabetes.')
    expect(found).toContain('safety_absolute')
    expect(found).toContain('cures')
  })

  it('tolera acentos y mayúsculas', () => {
    expect(ids('Es APTO para DIABÉTICOS')).toContain('fitness_for_condition')
  })

  // ── Fase 0: dos fugas INALCANZABLES por construcción, no por falta de patrón ──
  // Ninguna de las dos se arregló sumando una regla: se arregló arreglar el
  // normalizador y la composición de la tabla. Por eso estos tests viven aquí y
  // no como casos sueltos en la tabla de patrones.
  it('detecta el porcentaje de "100% seguro"', () => {
    // El normalizador borraba el `%` y dejaba "100  seguro", así que el patrón
    // `100\s*%` no podía dispararse nunca aunque la regla existiera.
    expect(ids('Es 100% seguro.')).toContain('safety_absolute')
    expect(ids('Es 100 % seguro.')).toContain('safety_absolute')
    expect(ids('Son 100% inocuos.')).toContain('safety_absolute')
  })

  it('detecta sinónimos de "seguro", no solo la palabra exacta', () => {
    // El adjetivo se lista por raíz. Con `segur\w+` a secas, "100% inocuo"
    // escapaba aunque sea el mismo claim que "100% seguro".
    expect(ids('Es totalmente inocuo.')).toContain('safety_absolute')
    expect(ids('Son 100% inofensivos.')).toContain('safety_absolute')
  })

  it('compone determinante + "nivel de" en el efecto sobre glucosa', () => {
    // Con una alternancia única la tabla ofrecía `tu` o `nivel de`, nunca
    // "tu nivel de", y "tus niveles" tampoco porque la lista decía `sus`, no
    // `tus`. El relleno acotado evita volver a enumerar posesivos.
    expect(ids('Ayuda a normalizar tu nivel de azúcar.')).toContain('glucose_effect')
    expect(ids('Controla el nivel de glucosa.')).toContain('glucose_effect')
    expect(ids('Reduce tus niveles de glucosa.')).toContain('glucose_effect')
    expect(ids('Estabiliza tu nivel de azúcar.')).toContain('glucose_effect')
  })

  it('sigue dejando pasar el vocabulario de rutina sobre glucosa', () => {
    // El relleno acotado es más laxo: hay que confirmar que no arrastró falsos
    // positivos. La instrucción de Diabetic Patch permite "cuidado de la
    // glucosa" y "niveles de glucosa" como vocabulario normal.
    expect(ids('En el cuidado de la glucosa te accompanies.')).toEqual([])
    expect(ids('Compara tus niveles de glucosa con tu médico.')).toEqual([])
  })
})

describe('findForbiddenClaims — frases permitidas que NO deben marcarse', () => {
  it('acepta la negación de cura', () => {
    expect(ids('No existe cura conocida para la neuropatía.')).toEqual([])
  })

  it('acepta "no es un medicamento" y "no es un tratamiento"', () => {
    expect(ids('No es un medicamento, es un parche de apoyo.')).toEqual([])
    expect(ids('No funciona como tratamiento médico.')).toEqual([])
  })

  it('acepta "no es seguro" (MIA no certifica seguridad)', () => {
    expect(ids('No es seguro afirmar que cura la diabetes.')).toEqual([])
  })

  it('acepta vocabulario de rutina de glucosa, que está permitido', () => {
    expect(ids('Te ayuda a cuidar la glucosa dentro de tu rutina.')).toEqual([])
    expect(ids('Complementa tus hábitos de alimentación y ejercicio.')).toEqual([])
    expect(ids('Es parte de la rutina de cuidado diario.')).toEqual([])
  })

  it('acepta la redacción de la instrucción de Diabetic Patch', () => {
    const instruction =
      'MIA NUNCA dice que cura, ni que es un tratamiento o un medicamento, ni que ' +
      'baja o normaliza la glucosa. Vocabulario permitido: hábitos, rutina, práctico.'
    expect(ids(instruction)).toEqual([])
  })

  it('acepta la redacción de la regla de salud honesta', () => {
    const rule =
      'MIA NUNCA certifica salud, seguridad ni ausencia de riesgo. Describe ' +
      'mecanismos observables y no afirma que una persona "no tiene problema".'
    expect(ids(rule)).toEqual([])
  })

  it('NO excuse un claim con un "no" de la oración anterior', () => {
    // El negador pertenece a otra oración: debe marcar.
    expect(ids('No tengo esa información. Es totalmente seguro.')).toContain(
      'safety_absolute',
    )
  })

  it('sí marca cuando el negador está en la misma oración', () => {
    expect(ids('Este producto no es seguro para diabéticos.')).toEqual([])
  })

  it('no marca un texto vacío o en blanco', () => {
    expect(findForbiddenClaims('')).toEqual([])
    expect(findForbiddenClaims('   ')).toEqual([])
  })
})

describe('findMedicalReferrals — derivación al médico', () => {
  it('marca las derivaciones reales que produjo el modelo', () => {
    // Frases literales del banco de regresión (casos 1 y 3).
    expect(
      findMedicalReferrals(
        'Si tu mamá tiene neuropatía severa, lo mejor sería consultar a un profesional ' +
          'de la salud antes de tomar cualquier decisión.',
      ).map((h) => h.id),
    ).toContain('medical_referral')

    expect(
      findMedicalReferrals('Siempre es mejor hacerlo con supervisión médica.').map((h) => h.id),
    ).toContain('medical_referral')

    expect(
      findMedicalReferrals(
        'Es importante consultar a un profesional de la salud para manejar tu condición.',
      ).map((h) => h.id),
    ).toContain('medical_referral')
  })

  it('NO marca la divulgación honesta de que no es tratamiento', () => {
    // Conducta CORRECTA: exactamente lo que 20260926000014 ordenó.
    expect(findMedicalReferrals('No son un tratamiento médico.')).toEqual([])
    expect(findMedicalReferrals('No son tratamientos médicos para la neuropatía.')).toEqual([])
    expect(findMedicalReferrals('No es un medicamento, es un parche de apoyo.')).toEqual([])
  })

  it('NO marca cuando MIA desaconseja consultar', () => {
    expect(findMedicalReferrals('No necesitas consultar al médico para esto.')).toEqual([])
    expect(findMedicalReferrals('Aquí no se consulta a ningún doctor.')).toEqual([])
  })

  it('no confunde las reglas que se PROHÍBEN derivar', () => {
    const instruction =
      'MIA nunca deriva al médico ni remite al profesional de la salud cuando el cliente ' +
      'ya nombró su condición. La derivación solo aplica ante síntomas agudos.'
    expect(findMedicalReferrals(instruction)).toEqual([])
  })

  it('no marca las frases que la instrucción 759b66e4 CITA para prohibirlas', () => {
    // `20260926000016` escribe literal "es importante consultar a..." y
    // "supervisión médica" para que el modelo reconozca la frase que debe evitar.
    //
    // Antes esto se pineaba como falso positivo conocido: el detector marcaba los
    // ejemplos de la prohibición, y por eso `findMedicalReferrals()` no corría
    // contra la configuración en el health check. Con el manejo de citas, el texto
    // entrecomillado ya no cuenta como aserción de MIA y el falso positivo
    // desaparece, así que la exclusión en el health check se puede levantar.
    const instruction =
      'Decir "es importante consultar a...", "lo mejor sería consultar...", ' +
      '"siempre es mejor hacerlo con supervisión médica", "deberías hablar con un especialista".'
    expect(findMedicalReferrals(instruction)).toEqual([])
  })

  it('sigue marcando la derivación cuando NO está entrecomillada', () => {
    // El otro lado de la moneda: quitar las comillas no debe volverse una puerta
    // trasera para decir lo prohibido sin entrecomillar.
    expect(findMedicalReferrals('Deberías hablar con un especialista.')).toHaveLength(1)
    expect(findMedicalReferrals('Siempre es mejor hacerlo con supervisión médica.')).toHaveLength(1)
  })

  it('ignora el entrecomillado cuando las comillas no están balanceadas', () => {
    // Con una comilla suelta la paridad no significa nada y el método se
    // desactiva en vez de suppressar la mitad del texto.
    expect(findMedicalReferrals('"Deberías hablar con un especialista.')).toHaveLength(1)
  })
})

describe('FORBIDDEN_CLAIMS — integridad de la tabla', () => {
  it('no tiene ids duplicados', () => {
    const seen = new Set<string>()
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(seen.has(claim.id)).toBe(false)
      seen.add(claim.id)
    }
  })

  it('cada regla tiene etiqueta y al menos un patrón', () => {
    for (const claim of FORBIDDEN_CLAIMS) {
      expect(claim.label.length).toBeGreaterThan(0)
      expect(claim.patterns.length).toBeGreaterThan(0)
    }
  })
})

/**
 * Fase 1: cobertura por TABLA, no por muestra.
 *
 * Estas pruebas existen por dos bugs que se colaron sin que nada los delatara.
 * Escribí `doctores?` queriendo decir "doctor o doctores", pero `s?` se aplica
 * al último carácter y exige "doctore"; y repetí el mismo error en
 * `profesionales?`. Dos ramas muertas. No se notaron porque las frases de
 * prueba usaban "médico" y "especialista", que sí funcionaban: el detector
 * parecía sano y solo fallaba con nouns que nadie probó.
 *
 * Un test por sustantivo y por forma verbal es lo que convierte "parece que
 * funciona" en "no puede dejar de funcionar".
 */
describe('cobertura de la tabla de derivación', () => {
  const MED_NOUNS = [
    'médico',
    'médicos',
    'doctor',
    'doctora',
    'doctores',
    'especialista',
    'especialistas',
    'neurólogo',
    'neurólogos',
    'endocrinólogo',
    'cardiólogo',
    'traumatólogo',
    'podólogo',
    'fisioterapeuta',
    'quiropractor',
    'profesional',
    'profesionales',
  ]

  it.each(MED_NOUNS)('reconoce "%s" singular y plural', (noun) => {
    expect(findMedicalReferrals(`Consulta a un ${noun}.`)).toHaveLength(1)
    expect(findMedicalReferrals(`Consúltalo con el ${noun}.`)).toHaveLength(1)
  })

  it('reconoce "profesional de la salud" con y sin el complemento', () => {
    expect(findMedicalReferrals('Consulta a un profesional de la salud.')).toHaveLength(1)
    expect(findMedicalReferrals('Habla con el profesional de la salud.')).toHaveLength(1)
  })

  const IR_FORMS = [
    've',
    'veas',
    'veamos',
    'vean',
    'vas',
    'vaya',
    'vayas',
    'vamos',
    'van',
    'ven',
    'vete',
    'venga',
  ]

  it.each(IR_FORMS)('reconoce la forma de IR "%s"', (form) => {
    expect(findMedicalReferrals(`${form} al médico.`)).toHaveLength(1)
  })

  it.each([
    'valoramos mucho esta experiencia',
    'vamos a ver los resultados',
    'vale la pena probarlo',
    'vendimos el lote completo',
  ])('no confunde "%s" con una derivación', (text) => {
    expect(findMedicalReferrals(text)).toEqual([])
  })

  it.each([
    ['Lo mejor sería consultar a un profesional de la salud.', 'consultar'],
    ['Acude a tu médico antes de empezar.', 'acudir'],
    ['Habla con tu doctor para que te oriente.', 'hablar'],
    ['Es recomendable que veas a un endocrinólogo.', 'ir + subjuntivo'],
    ['Te recomiendo consultar con un especialista.', 'recomendar'],
    ['Podrías pedir opinión a un profesional.', 'pedir opinión'],
    ['Tu médico te puede ayudar con esto.', 'tercera persona'],
    ['Mejor hazlo con supervisión de un especialista.', 'supervisión'],
    ['No te quedes con dudas, pregunta a tu médico.', 'imperativa indirecta'],
    ['Antes de comprar, consúltalo con alguien que sepa.', 'autoridad difusa'],
    ['Consultar con un neurólogo es el primer paso.', 'consultar +Appointment'],
    ['Te sugiero una evaluación médica previa.', 'evaluación'],
    ['Por favor, no dejes esto en manos de un médico.', 'derivación invertida'],
    ['Acércate al doctor antes de comprar.', 'acercarse'],
  ])('detecta la derivación: %s', (text) => {
    // `>= 1` y no `=== 1`: los patrones se solapan a propósito ("te recomiendo
    // consultar con un especialista" entra por el verbo genérico y por el de
    // recomendación) y `scan` reporta cada coincidencia para que el health check
    // pueda contarlas. Lo que importa es que no escape, no que cuente una vez.
    expect(findMedicalReferrals(text).length).toBeGreaterThan(0)
  })

  it.each([
    'No son un tratamiento médico.',
    'No necesitas consultar al médico.',
    'En el tratamiento que sigues con tu médico.',
    'Mi médico me lo prescribió.',
    'Tiene más sentido preguntar al cliente.',
  ])('no marca la divulgación honesta: %s', (text) => {
    expect(findMedicalReferrals(text)).toEqual([])
  })
})

describe('cobertura de la tabla de claims', () => {
  it.each([
    ['Este parche cura la neuropatía diabética.', 'cures'],
    ['Con estos calcetines dejaré de sentir los pies.', 'cures'],
    ['Con esto se le pasa el dolor.', 'cures'],
    ['Te va a curar la diabetes en pocas semanas.', 'cures'],
    ['Ayuda a controlar tu glucosa sin esfuerzo.', 'glucose_effect'],
    ['Ayuda a normalizar tu nivel de azúcar.', 'glucose_effect'],
    ['Es 100% seguro, no tiene ningún riesgo.', 'safety_absolute'],
    ['Es totalmente inocuo y sin efectos secundarios.', 'safety_absolute'],
    ['No requiere consulta médica, es seguro para diabéticos.', 'safety_absolute'],
    ['Es un medicamento contraindicado sin supervisión.', 'medicine'],
    ['Funciona como medicina para los pies.', 'medicine'],
    ['No te va a dar ningún problema con tu diabetes.', 'no_problem_for_condition'],
  ])('detecta el claim "%s" como %s', (text, rule) => {
    expect(ids(text)).toContain(rule)
  })
})
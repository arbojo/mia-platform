'use client'

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  X,
  Star,
  Clock,
  Heart,
  Droplets,
  CheckCircle2,
} from 'lucide-react'
import ExitModal from './ExitModal'
import { cnSupabase } from '@/lib/clean-nails/supabase'
import { startSession, track, finishSession, setConverted } from '@/lib/clean-nails/insights'

type Severity = 'mild' | 'moderate' | 'severe'

const conditionMeta: Record<
  Severity,
  {
    labelEs: string
    tagline: string
    image: string
    symptoms: string[]
    statNumber: string
    statDetail: string
    empathyTitle: string
    empathyText: string
    solutionTitle: string
    solutionBody: string
    testimonials: { name: string; age: number; text: string; weeks: number }[]
    product: string
    productDesc: string
    includes: string[]
    timeframe: string
  }
> = {
  mild: {
    labelEs: 'Leve',
    tagline: 'Señales tempranas que ya puedes ver',
    image: '/clean-nails/leve.jpg',
    symptoms: ['Ligera pérdida de brillo natural', 'Leve cambio de tonalidad', 'Pequeñas líneas en la superficie'],
    statNumber: '1 de cada 3',
    statDetail: 'personas nota cambios en sus uñas con el tiempo. Y la mayoría se pregunta si hay algo que realmente funcione.',
    empathyTitle: 'Sabemos que ya lo notaste.',
    empathyText:
      'Si estás aquí es porque ya lo viste y te preocupó. Y probablemente ya probaste algo: una crema, un esmalte, buscar en internet. Es normal. La mayoría hace lo mismo cuando nota algo distinto en sus uñas.',
    solutionTitle: 'Tu Rutina: Prevención y Cuidado',
    solutionBody:
      'Clean Nails usa tecnología de luz para mejorar progresivamente la apariencia de tus uñas. Son solo 7 minutos, dos veces al día. Así de simple.',
    testimonials: [
      { name: 'Carmen R.', age: 48, text: 'Empecé a notar mis uñas más opacas. Usé Clean Nails 4 semanas y la apariencia mejoró mucho. No esperaba que funcionara tan bien.', weeks: 4 },
      { name: 'Alex M.', age: 47, text: 'Lo ignoré por meses. Cuando empecé con Clean Nails, en 3 semanas ya veía la diferencia. Mis uñas se veían mucho mejor.', weeks: 3 },
      { name: 'Lucía G.', age: 51, text: 'Mis amigas pensaron que era una manicura nueva. Solo era Clean Nails después de un mes de uso constante.', weeks: 5 },
      { name: 'Andrea M.', age: 34, text: 'Noté mis uñas más opacas después del embarazo. En un mes de Clean Nails recuperaron su brillo natural.', weeks: 4 },
      { name: 'Fernanda L.', age: 39, text: 'Siempre cuidé mis uñas, pero empezaron a verse apagadas. Clean Nails me devolvió la confianza para mostrar mis manos.', weeks: 5 },
      { name: 'Roberto S.', age: 44, text: 'Por el trabajo tengo las manos en agua todo el día. Mis uñas se pusieron opacas. Esto funcionó mejor de lo que esperaba.', weeks: 6 },
    ],
    product: 'Clean Nails — Dispositivo de Luz',
    productDesc:
      'Un dispositivo ligero y portátil con tecnología de luz para el cuidado estético de tus uñas. Fácil de usar en casa.',
    includes: ['1 Dispositivo Clean Nails', '1 Cargador USB', 'Guía rápida de uso', 'Asistencia por WhatsApp para resolver tus dudas'],
    timeframe: '3–4 semanas para notar la diferencia',
  },
  moderate: {
    labelEs: 'Moderado',
    tagline: 'Cambios que ya son difíciles de ignorar',
    image: '/clean-nails/moderado.jpg',
    symptoms: ['Textura más áspera o irregular', 'Coloración más opaca o amarillenta', 'Bordes que se resquebrajan'],
    statNumber: '7 de cada 10',
    statDetail: 'personas notan cambios en sus uñas después de los 40. Y muchas ya probaron de todo sin éxito.',
    empathyTitle: 'Sabemos que ya intentaste de todo.',
    empathyText:
      'Has probado cremas, remedios, quizá hasta productos de farmacia. Y nada funcionó como esperabas. No es que lo hayas hecho mal. Es que la mayoría de las soluciones no están hechas para el uso constante que esto requiere.',
    solutionTitle: 'Tu Rutina: Regeneración Progresiva',
    solutionBody:
      'Clean Nails usa tecnología de luz para mejorar la apariencia de tus uñas de forma progresiva. 7 minutos, dos veces al día, sin complicaciones.',
    testimonials: [
      { name: 'Patricia S.', age: 57, text: 'Probé cremas, esmaltes, de todo. Clean Nails fue lo único que realmente hizo la diferencia. A las 6 semanas, ya no me preocupaba mostrar mis pies.', weeks: 6 },
      { name: 'Carlos R.', age: 55, text: 'La gente notó el cambio y me preguntó qué había hecho. Les sorprendió que fuera un dispositivo tan sencillo.', weeks: 7 },
      { name: 'Elena V.', age: 58, text: 'Creí que esto no tenía solución. Me alegra haberle dado una oportunidad.', weeks: 8 },
      { name: 'Jorge L.', age: 42, text: 'Empecé a notar cambios en mis uñas y no sabía qué hacer. Probé de todo. Clean Nails fue la primera vez que algo funcionó de verdad.', weeks: 6 },
      { name: 'Mariana K.', age: 38, text: 'Lo noté hace un año y probé mil cosas. Con constancia y este dispositivo, la diferencia es real.', weeks: 7 },
      { name: 'Ricardo M.', age: 53, text: 'Pensé que era cosa de la edad y ya. Una amiga me prestó su Clean Nails. A las 5 semanas compré el mío.', weeks: 5 },
    ],
    product: 'Clean Nails — Dispositivo de Luz',
    productDesc:
      'Un dispositivo ligero y portátil con tecnología de luz para el cuidado estético de tus uñas. Ideal para tu rutina diaria.',
    includes: ['1 Dispositivo Clean Nails', '1 Cargador USB', 'Guía de uso en 5 pasos', 'Asistencia personalizada por WhatsApp'],
    timeframe: '6–8 semanas para notar la diferencia',
  },
  severe: {
    labelEs: 'Severo',
    tagline: 'Afectación importante que necesita atención',
    image: '/clean-nails/severo.jpg',
    symptoms: ['Uñas notablemente opacas o amarillentas', 'Textura visiblemente irregular', 'Fragilidad o sensibilidad'],
    statNumber: '97%',
    statDetail: 'de personas que siguieron la rutina completa notaron mejoría. Porque la constancia sí marca la diferencia.',
    empathyTitle: 'Sabemos que esto ya pesa.',
    empathyText:
      'Llevas tiempo con esto. Has gastado dinero, tiempo y paciencia en cosas que no dieron resultado. Es frustrante, y es válido sentirse así. Pero no significa que no haya una opción distinta.',
    solutionTitle: 'Tu Rutina: Constancia Total',
    solutionBody:
      'Constancia y tecnología de luz. Clean Nails se usa 7 minutos, dos veces al día. La mejora es progresiva, pero los resultados hablan solos.',
    testimonials: [
      { name: 'Dolores M.', age: 59, text: 'El resultado habla por sí solo. Solo había que ser constante.', weeks: 9 },
      { name: 'Rosa T.', age: 58, text: 'Años probando cosas sin resultado. Clean Nails me tomó 10 semanas, pero valió cada día.', weeks: 10 },
      { name: 'Consuelo A.', age: 56, text: 'Volví a usar sandalias después de varios años. Mi familia no lo podía creer. Vi el cambio paso a paso.', weeks: 11 },
      { name: 'Hugo P.', age: 52, text: 'Llevaba tiempo con esto y ya había perdido la esperanza. Mi hija me regaló el dispositivo y sí dio resultado.', weeks: 10 },
      { name: 'Laura F.', age: 46, text: 'Nunca pensé que algo tan sencillo como 7 minutos al día pudiera hacer tanta diferencia. Ahora lo recomiendo a todas mis conocidas.', weeks: 9 },
      { name: 'Arturo D.', age: 49, text: 'Soy escéptico con estas cosas. Pero los cambios fueron tan claros que hasta mi esposa notó la diferencia antes que yo.', weeks: 12 },
    ],
    product: 'Clean Nails — Dispositivo de Luz',
    productDesc:
      'Nuestro dispositivo más completo — tecnología de luz para el cuidado intensivo de la apariencia de tus uñas.',
    includes: ['1 Dispositivo Clean Nails', '1 Cargador USB', 'Asistencia personalizada por WhatsApp', 'Guía de uso paso a paso'],
    timeframe: '8–12 semanas de transformación completa',
  },
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, n)
}

const objections = [
  { Icon: Clock, title: 'Has probado muchos productos', text: 'Cremas, esmaltes, remedios caseros, productos de farmacia… Si estás aquí, probablemente ya lo intentaste. Y nada te dio el resultado que esperabas.' },
  { Icon: Droplets, title: 'Esperas resultados rápidos', text: 'Es normal querer ver cambios ya. Pero la apariencia de las uñas no mejora de un día para otro. Los productos que prometen resultados inmediatos suelen decepcionar.' },
  { Icon: Heart, title: 'Abandonas antes de tiempo', text: 'Es la razón más común. Se empieza con ganas, pero al no ver resultados rápidos se deja de lado. La clave es la constancia: 7 minutos, dos veces al día.' },
]

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round(((step + 1) / total) * 100)
  return (
    <div className="w-full h-0.5 bg-border">
      <motion.div
        className="h-full bg-accent"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
    </div>
  )
}

function Header({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pt-6 pb-2 max-w-lg mx-auto">
      <div className="w-10">
        {step > 0 && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
      <span className="font-display text-lg tracking-widest text-foreground">CLEAN NAILS</span>
      <div className="w-10 text-right">
        <span className="text-[0.65rem] tracking-[0.1em] text-muted-foreground font-body">
          {step + 1}
          <span className="opacity-40">/6</span>
        </span>
      </div>
    </div>
  )
}

function ScreenQuestion({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.65rem] tracking-[0.25em] uppercase text-muted-foreground font-body font-medium mb-2 text-center">
      {children}
    </p>
  )
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-body font-medium text-sm tracking-[0.06em] flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {children}
      <ArrowRight className="w-4 h-4" />
    </button>
  )
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
}

function StepAssessment({ onSelect }: { onSelect: (s: Severity) => void }) {
  const [hovered, setHovered] = useState<Severity | null>(null)
  const severities: Severity[] = ['mild', 'moderate', 'severe']

  return (
    <div className="px-4 pt-4 pb-10 max-w-lg mx-auto">
      <div className="text-center mb-7">
        <ScreenQuestion>Paso 1 de 6</ScreenQuestion>
        <h1 className="font-display text-[2rem] leading-tight text-foreground mb-2">
          ¿Cómo están
          <br />
          <em>tus uñas hoy?</em>
        </h1>
        <p className="text-sm text-muted-foreground font-body font-light leading-relaxed max-w-xs mx-auto">
          Elige la opción que mejor describe lo que ves. No hay respuesta incorrecta.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        {severities.map((sev) => {
          const c = conditionMeta[sev]
          return (
            <button
              key={sev}
              onClick={() => onSelect(sev)}
              onMouseEnter={() => setHovered(sev)}
              onMouseLeave={() => setHovered(null)}
              className="group relative rounded-2xl overflow-hidden bg-card border border-border text-left shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="flex items-stretch">
                <div className="relative w-28 shrink-0 bg-stone-200 overflow-hidden">
                  <img
                    src={c.image}
                    alt={c.labelEs}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
                </div>
                <div className="flex-1 px-4 py-4 flex flex-col justify-between min-h-[7rem]">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[0.68rem] tracking-[0.2em] uppercase font-body font-medium text-muted-foreground">
                        {c.labelEs}
                      </span>
                      <motion.div animate={{ x: hovered === sev ? 3 : 0 }} transition={{ duration: 0.15 }}>
                        <ArrowRight className="w-3.5 h-3.5 text-accent" />
                      </motion.div>
                    </div>
                    <p className="text-sm font-display text-foreground leading-snug mb-2.5">{c.tagline}</p>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {c.symptoms.slice(0, 2).map((s) => (
                      <li key={s} className="flex items-center gap-1.5 text-[0.72rem] text-muted-foreground font-light">
                        <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <p className="text-center text-[0.7rem] text-muted-foreground/70 font-light mt-6">
        No compartimos tus datos · Sin compromiso
      </p>
    </div>
  )
}

function StepValidation({ sev, onNext }: { sev: Severity; onNext: () => void }) {
  const c = conditionMeta[sev]
  return (
    <div className="px-5 pt-4 pb-10 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <ScreenQuestion>¿Te suena esto?</ScreenQuestion>
        <h2 className="font-display text-[2rem] leading-tight text-foreground">{c.empathyTitle}</h2>
      </div>

      <div className="rounded-2xl bg-secondary border border-border px-6 py-7 text-center mb-6">
        <p className="font-display text-5xl text-foreground mb-2">{c.statNumber}</p>
        <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-[220px] mx-auto">{c.statDetail}</p>
      </div>

      <p className="text-sm text-muted-foreground font-light leading-relaxed text-center max-w-[280px] mx-auto mb-6">
        Y hemos visto este caso cientos de veces:
        <br />
        personas que probaron de todo y están hartas de soluciones que no funcionan.
      </p>

      <div className="mb-6">
        <p className="text-[0.92rem] leading-relaxed text-foreground font-light">{c.empathyText}</p>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-card mb-8">
        <span className="text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground font-medium">Tu caso:</span>
        <span className="text-xs font-medium text-foreground">
          {c.labelEs} · {c.tagline}
        </span>
      </div>

      <PrimaryButton onClick={onNext}>Quiero ver si esto es diferente</PrimaryButton>
    </div>
  )
}

function StepEducation({ onNext }: { onNext: () => void }) {
  return (
    <div className="px-5 pt-4 pb-10 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <ScreenQuestion>¿Por qué no ha funcionado antes?</ScreenQuestion>
        <h2 className="font-display text-[2rem] leading-tight text-foreground mb-2">
          Quizá esto ya
          <br />
          <em>te ha pasado antes.</em>
        </h2>
        <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-[260px] mx-auto">
          No te preocupes. Es más común de lo que crees. Y casi siempre es por alguna de estas razones.
        </p>
      </div>

      <div className="flex flex-col gap-3 mb-8">
        {objections.map(({ Icon, title, text }) => (
          <div key={title} className="rounded-xl px-5 py-4 border border-border bg-card">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 p-2 rounded-lg bg-secondary shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/80 mb-1">{title}</p>
                <p className="text-[0.8rem] text-muted-foreground font-light leading-relaxed">{text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <PrimaryButton onClick={onNext}>¿Y qué funciona entonces?</PrimaryButton>
    </div>
  )
}

function StepProof({ sev, onNext }: { sev: Severity; onNext: () => void }) {
  const c = conditionMeta[sev]
  return (
    <div className="px-5 pt-4 pb-10 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <ScreenQuestion>¿Realmente funciona?</ScreenQuestion>
        <h2 className="font-display text-[2rem] leading-tight text-foreground mb-2">
          Personas con
          <br />
          <em>tu mismo caso.</em>
        </h2>
        <p className="text-sm text-muted-foreground font-light">
          Caso {c.labelEs.toLowerCase()} · Resultados reales.
        </p>
      </div>

      <div className="flex flex-col gap-3.5 mb-8">
        {pickRandom(c.testimonials, 3).map((t) => (
          <div key={t.name} className="rounded-2xl border border-border bg-card px-5 py-5">
            <div className="flex gap-0.5 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-3 h-3 fill-accent text-accent" />
              ))}
            </div>
            <p className="text-[0.85rem] leading-relaxed text-foreground font-light italic mb-4">&ldquo;{t.text}&rdquo;</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                  <span className="text-[0.7rem] font-medium text-muted-foreground">{t.name[0]}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground leading-none mb-0.5">{t.name}</p>
                  <p className="text-[0.65rem] text-muted-foreground font-light">{t.age} años · Compra verificada</p>
                </div>
              </div>
              <span className="text-[0.65rem] tracking-[0.1em] text-muted-foreground font-light text-right leading-tight">
                {t.weeks} sem.
              </span>
            </div>
          </div>
        ))}
      </div>

      <PrimaryButton onClick={onNext}>Ver el tratamiento</PrimaryButton>
    </div>
  )
}

function StepSolution({ sev, onNext }: { sev: Severity; onNext: () => void }) {
  const c = conditionMeta[sev]
  return (
    <div className="px-5 pt-4 pb-10 max-w-lg mx-auto">
      <div className="text-center mb-6">
        <ScreenQuestion>¿Cuál es mi tratamiento?</ScreenQuestion>
        <h2 className="font-display text-[1.85rem] leading-tight text-foreground mb-1">{c.solutionTitle}</h2>
      </div>

      <div className="relative rounded-2xl overflow-hidden bg-stone-50 border border-border mb-5 h-72">
        <img
          src="/clean-nails/final.jpeg"
          alt="Tratamiento Clean Nails"
          className="w-full h-full object-contain object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/70 via-transparent to-transparent" />
        <div className="absolute bottom-3.5 left-4">
          <span className="text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground font-medium">
            {c.labelEs}
          </span>
          <p className="font-display text-base text-foreground leading-tight">{c.product}</p>
        </div>
      </div>

      <p className="text-[0.88rem] leading-relaxed text-muted-foreground font-light mb-5">{c.solutionBody}</p>

      <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-secondary border border-border mb-5">
        <div className="w-1 h-8 rounded-full bg-accent shrink-0" />
        <div>
          <p className="text-[0.65rem] tracking-[0.15em] uppercase text-muted-foreground font-medium mb-0.5">
            Tiempo estimado
          </p>
          <p className="text-sm font-medium text-foreground">{c.timeframe}</p>
        </div>
      </div>

      <div className="mb-7">
        <p className="text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground font-medium mb-3">
          Asistencia incluida
        </p>
        <ul className="flex flex-col gap-2">
          {c.includes.map((item) => (
            <li key={item} className="flex items-center gap-3 text-[0.83rem] text-foreground font-light">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <PrimaryButton onClick={onNext}>Quiero Clean Nails</PrimaryButton>
    </div>
  )
}

const CITIES = ['León', 'Silao', 'Guanajuato Capital', 'Irapuato', 'Lagos de Moreno']

const DELIVERY_MESSAGES: Record<string, string> = {
  León: 'Entregas todos los días.\nSi tu pedido se registra antes del horario de corte, puede entregarse el mismo día.',
  Silao: 'Entregamos los lunes, miércoles y viernes.',
  'Guanajuato Capital': 'Entregamos los lunes, miércoles y viernes.',
  Irapuato: 'Entregamos los lunes, miércoles y viernes.',
  'Lagos de Moreno': 'Entregamos los martes, jueves y sábados.',
}

function StepOffer({ sev }: { sev: Severity }) {
  const c = conditionMeta[sev]
  const formStartedRef = useRef(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    street: '',
    colony: '',
    city: '',
    zip: '',
    references: '',
    support_opt_in: true,
  })
  const [submitted, setSubmitted] = useState(false)

  const change = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim() || !form.street.trim() || !form.colony.trim() || !form.city) return

    track('form_submitted')

    const metadata = {
      product: { severity: sev },
      landing: { version: 'v1', campaign: '' },
    }

    if (cnSupabase) {
      const { data, error } = await cnSupabase
        .from('order_requests')
        .insert({
          customer_name: form.name,
          phone: form.phone,
          street: form.street,
          colony: form.colony,
          city: form.city,
          state: '',
          zip: form.zip || null,
          references: form.references || null,
          product_id: null,
          product_name: conditionMeta[sev].product,
          quantity: 1,
          total: 599.0,
          support_opt_in: form.support_opt_in,
          metadata: metadata,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error al registrar pedido:', error)
        return
      }

      track('order_request_created', { order_request_id: data.id })
      setConverted(data.id)
    } else {
      console.warn('[clean-nails] cnSupabase not configured; order not persisted.')
    }

    const msg = encodeURIComponent(
      `*Nuevo pedido Clean Nails*\n\n` +
        `Nombre: ${form.name}\n` +
        `Teléfono: ${form.phone}\n` +
        `Dirección: ${form.street}, ${form.colony}\n` +
        `Ciudad: ${form.city}\n` +
        (form.zip ? `CP: ${form.zip}\n` : '') +
        (form.references ? `Referencias: ${form.references}\n` : '') +
        `\nTratamiento: ${conditionMeta[sev].labelEs}\n` +
        `Producto: ${conditionMeta[sev].product}\n` +
        `Acompañamiento: ${form.support_opt_in ? 'Sí' : 'No'}`
    )
    window.open(`https://wa.me/524775250039?text=${msg}`, '_blank')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="px-5 pt-4 pb-10 max-w-lg mx-auto flex flex-col items-center text-center min-h-[60dvh] justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-8 h-8 text-accent" />
        </motion.div>
        <h2 className="font-display text-2xl text-foreground mb-3">¡Gracias, {form.name.split(' ')[0]}!</h2>
        <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-[300px] mb-2">
          Recibimos tu pedido de Clean Nails por <strong className="text-foreground font-medium">$599 MXN</strong>.
        </p>
        <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-[300px] mb-2">
          Te escribiremos por WhatsApp al <strong className="text-foreground font-medium">{form.phone}</strong> para
          coordinar la entrega en <strong className="text-foreground font-medium">{form.city}</strong>.
        </p>
        {form.support_opt_in && (
          <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-[300px]">
            Durante 21 días tendrás acompañamiento para aprovechar al máximo tu dispositivo.
          </p>
        )}
        <div className="mt-8 w-full rounded-xl bg-secondary border border-border px-5 py-4 text-left">
          <p className="text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground font-medium mb-2">Tu pedido</p>
          <p className="text-base font-medium text-foreground">{form.name}</p>
          <p className="text-sm text-muted-foreground font-light">{c.product}</p>
          <p className="text-sm text-muted-foreground font-light">{form.city}</p>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[0.65rem] tracking-[0.15em] uppercase text-muted-foreground font-medium">Total</span>
            <span className="font-display text-lg text-foreground">$599 MXN</span>
          </div>
        </div>
        <p className="font-display text-xl text-foreground mt-7">¡Gracias por tu compra!</p>
      </div>
    )
  }

  const inputClass =
    'w-full px-4 py-3.5 rounded-xl border border-border bg-input-background text-foreground text-sm font-light placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent/60 transition-colors'
  const labelClass = 'block text-[0.7rem] tracking-[0.15em] uppercase text-muted-foreground font-medium mb-1.5'

  return (
    <div className="px-5 pt-4 pb-10 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <ScreenQuestion>¿Cómo lo recibo?</ScreenQuestion>
        <h2 className="font-display text-[2rem] leading-tight text-foreground mb-2">
          Tu kit está
          <br />
          <em>listo para ti.</em>
        </h2>
        <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-[260px] mx-auto">
          Completa tus datos y te contactaremos al <strong className="text-foreground font-medium">{form.phone || 'teléfono registrado'}</strong> para coordinar la entrega.
        </p>
      </div>

      <div className="rounded-2xl bg-secondary border border-border px-6 py-6 text-center mb-5">
        <p className="text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground font-medium mb-1">Precio único</p>
        <p className="font-display text-4xl text-foreground">$599 MXN</p>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-4 mb-5">
        <p className="text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground font-medium mb-3">El kit incluye</p>
        <ul className="flex flex-col gap-2">
          {['Dispositivo Clean Nails', 'Cable USB de carga', 'Guía rápida de uso'].map((item) => (
            <li key={item} className="flex items-center gap-2 text-[0.83rem] text-foreground font-light">
              <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-secondary px-4 py-4 mb-6">
        <p className="text-[0.65rem] tracking-[0.18em] uppercase text-accent font-medium mb-3">Tu compra incluye</p>
        <div className="flex flex-col gap-3">
          {[
            { icon: '🚚', text: 'Envío sin costo en las ciudades participantes. Entrega local programada según tu ciudad.' },
            { icon: '🛡', text: 'Garantía de 30 días por defectos de fabricación.' },
            { icon: '💬', text: 'Programa de Acompañamiento Clean Nails durante 21 días por WhatsApp para ayudarte a mantener tu rutina, resolver dudas y aprovechar al máximo tu dispositivo.' },
          ].map(({ icon, text }) => (
            <div key={icon} className="flex items-start gap-2 text-[0.83rem] text-foreground font-light">
              <span className="shrink-0">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {form.city && DELIVERY_MESSAGES[form.city] && (
        <div className="rounded-xl border border-border bg-accent/5 px-4 py-3.5 mb-6">
          <p className="text-[0.65rem] tracking-[0.18em] uppercase text-accent font-medium mb-1">Entrega en tu zona</p>
          <p className="text-sm text-foreground font-light whitespace-pre-line">{DELIVERY_MESSAGES[form.city]}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-5">
        <div>
          <label className={labelClass}>Nombre completo</label>
          <input
            type="text"
            placeholder="Nombre completo"
            value={form.name}
            onChange={(e) => change('name', e.target.value)}
            onFocus={() => {
              if (!formStartedRef.current) {
                formStartedRef.current = true
                track('form_started')
              }
            }}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Teléfono / WhatsApp</label>
          <input
            type="tel"
            placeholder="+52 123 456 7890"
            value={form.phone}
            onChange={(e) => change('phone', e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Calle y número</label>
          <input
            type="text"
            placeholder="Calle, número"
            value={form.street}
            onChange={(e) => change('street', e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Colonia</label>
          <input
            type="text"
            placeholder="Colonia"
            value={form.colony}
            onChange={(e) => change('colony', e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>Ciudad</label>
          <select
            value={form.city}
            onChange={(e) => {
              change('city', e.target.value)
              if (e.target.value) track('city_selected', { city: e.target.value })
            }}
            className={inputClass}
            required
          >
            <option value="">Selecciona tu ciudad</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Código Postal <span className="text-muted-foreground/50">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="CP"
            value={form.zip}
            onChange={(e) => change('zip', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            Referencias del domicilio <span className="text-muted-foreground/50">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Ej: casa color verde, frente al parque"
            value={form.references}
            onChange={(e) => change('references', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3 mt-2">
          <p className="text-[0.65rem] tracking-[0.18em] uppercase text-muted-foreground font-medium mb-3">
            Acompañamiento personal
          </p>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="support_opt_in"
                checked={form.support_opt_in === true}
                onChange={() => {
                  setForm({ ...form, support_opt_in: true })
                  track('support_opt_in_enabled')
                }}
                className="mt-0.5 accent-accent shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-[0.83rem] text-foreground font-medium">Sí, quiero acompañamiento por 21 días</span>
                <span className="text-[0.72rem] text-muted-foreground font-light">
                  Te ayudamos a mantener tu rutina y resolver dudas
                </span>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="radio"
                name="support_opt_in"
                checked={form.support_opt_in === false}
                onChange={() => {
                  setForm({ ...form, support_opt_in: false })
                  track('support_opt_in_disabled')
                }}
                className="mt-0.5 accent-accent shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-[0.83rem] text-foreground font-medium">Solo confirmación y entrega</span>
                <span className="text-[0.72rem] text-muted-foreground font-light">Sin mensajes de seguimiento</span>
              </div>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-body font-medium text-sm tracking-[0.06em] flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98] mt-4"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Registrar mi pedido
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {form.support_opt_in ? (
        <p className="text-[0.75rem] text-muted-foreground font-light leading-relaxed text-center max-w-[300px] mx-auto mb-6">
          Al registrar tu pedido, el seguimiento continuará por WhatsApp. Desde ahí confirmaremos tu entrega y te
          acompañaremos durante los primeros 21 días para ayudarte a mantener tu rutina con Clean Nails.
        </p>
      ) : (
        <p className="text-[0.75rem] text-muted-foreground font-light leading-relaxed text-center max-w-[300px] mx-auto mb-6">
          Al registrar tu pedido, el seguimiento continuará por WhatsApp para coordinar la entrega.
        </p>
      )}

      <div className="flex flex-col gap-2 mb-6">
        {['Envío gratuito a domicilio', 'Garantía de 30 días', 'Sin suscripciones ni cargos ocultos'].map((t) => (
          <div key={t} className="flex items-center gap-2 text-[0.78rem] text-muted-foreground font-light">
            <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
            {t}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-5">
        {[
          { val: '10.847', sub: 'uñas cuidadas' },
          { val: 'Eficaz', sub: 'con uso constante' },
          { val: '97%', sub: 'lo recomendaría' },
        ].map((s) => (
          <div key={s.sub}>
            <p className="font-display text-base text-foreground mb-0.5">{s.val}</p>
            <p className="text-[0.62rem] text-muted-foreground font-light leading-tight">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

type FaqItem = { q: string; r: string }

const baseFaq: FaqItem[] = [
  {
    q: '¿Qué es Clean Nails exactamente?',
    r: 'Clean Nails es un dispositivo de uso doméstico que utiliza luz UV e infrarroja de baja intensidad (luz fría) para ayudar a mejorar el aspecto de las uñas afectadas por hongos como la onicomicosis. Su función es apoyar la reducción del hongo mientras ayuda a mantener un entorno menos favorable para su crecimiento.',
  },
  {
    q: '¿Duele o quema?',
    r: 'No. Es completamente indoloro. Funciona con luz fría, por lo que no genera calor, no quema y no causa molestia durante el uso.',
  },
  {
    q: '¿Cómo se usa?',
    r: '2 veces al día\n2 sesiones de 7 minutos por uso\nSe adapta a uñas de manos y pies\n\nIMPORTANTE: Antes de cada uso, se debe limar ligeramente la superficie de la uña para permitir mejor acción del dispositivo.\n\nRecomendación: mantener la uña seca.\nSi te bañas en la noche, úsalo en la mañana.\nSi te bañas en la mañana, úsalo en la noche.',
  },
  {
    q: '¿En cuánto tiempo veo resultados?',
    r: 'Depende del nivel del hongo y la constancia. Los cambios suelen comenzar a notarse en las primeras semanas con uso continuo.',
  },
  {
    q: '¿Es seguro usarlo todos los días?',
    r: 'Sí. Está diseñado para uso doméstico diario siguiendo instrucciones. No genera dolor ni daño en la piel o la uña.',
  },
]

const conditionalFaq: Record<Severity, FaqItem[]> = {
  mild: [
    {
      q: '¿Aunque sea leve realmente necesito usarlo?',
      r: 'Sí, ayuda a evitar que el problema avance y mejora la apariencia progresivamente.',
    },
    {
      q: '¿Esto es más preventivo o tratamiento?',
      r: 'Ambos. Ayuda a controlar y mejorar el estado actual.',
    },
  ],
  moderate: [
    {
      q: '¿En cuánto tiempo debería ver cambios visibles?',
      r: 'Depende de la constancia, pero normalmente los cambios comienzan a notarse en las primeras semanas.',
    },
    {
      q: 'Ya probé otros tratamientos, ¿esto es diferente?',
      r: 'Sí. No es crema ni tratamiento tópico. Utiliza luz dirigida para actuar de forma distinta.',
    },
  ],
  severe: [
    {
      q: '¿Funciona si ya está muy avanzado?',
      r: '¡Claro! Funciona y funciona muy bien. Mientras seas constante y no abandones las sesiones, verás la mejoría.',
    },
    {
      q: '¿Por qué otros tratamientos no me funcionaron?',
      r: 'Muchos tratamientos son tópicos; este funciona con luz dirigida y enfoque diferente.',
    },
  ],
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  const toggle = (q: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(q)) next.delete(q)
      else next.add(q)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(({ q, r }) => {
        const isOpen = open.has(q)
        return (
          <div key={q} className="rounded-xl border border-border bg-card overflow-hidden transition-shadow duration-200">
            <button
              onClick={() => toggle(q)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left text-sm font-medium text-foreground/90 leading-snug"
            >
              <span>{q}</span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-4 text-[0.83rem] text-muted-foreground font-light leading-relaxed whitespace-pre-line">
                {r}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FaqOverlay({
  sev,
  onClose,
  onGoToCheckout,
}: {
  sev: Severity
  onClose: () => void
  onGoToCheckout: () => void
}) {
  const extra = conditionalFaq[sev]
  const ctaText: Record<Severity, string> = {
    mild: 'Empezar prevención',
    moderate: 'Iniciar recuperación',
    severe: 'Iniciar tratamiento ahora',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background px-5 pt-6 pb-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-foreground">
            Antes de terminar
            <br />
            <em>tu pedido</em>
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <FaqAccordion items={baseFaq} />

        {extra.length > 0 && (
          <>
            <div className="flex items-center gap-3 my-5">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[0.65rem] tracking-[0.15em] uppercase text-muted-foreground font-medium shrink-0">
                Según tu caso
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <FaqAccordion items={extra} />
          </>
        )}

        <button
          onClick={onGoToCheckout}
          className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-body font-medium text-sm tracking-[0.06em] flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 active:scale-[0.98] mt-6"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {ctaText[sev]}
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  )
}

function FloatingFaqButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={onClick}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-body font-medium text-sm tracking-[0.04em] shadow-lg hover:opacity-90 active:scale-[0.97] transition-all"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          ¿Tienes dudas?
        </motion.button>
      )}
    </AnimatePresence>
  )
}

const TOTAL_STEPS = 6

const stepTitles = [
  '¿Qué ves en tus uñas?',
  '¿Te suena esto?',
  '¿Por qué no ha funcionado antes?',
  'Testimonios',
  'Conoce Clean Nails',
  'Tu kit está listo',
]

export function CleanNailsFunnel() {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [selected, setSelected] = useState<Severity | null>(null)
  const [showExitModal, setShowExitModal] = useState(false)
  const [showFaq, setShowFaq] = useState(false)
  const [timerReady, setTimerReady] = useState(false)
  const [scrolledPastHalf, setScrolledPastHalf] = useState(false)
  const [faqEverOpened, setFaqEverOpened] = useState(false)
  const stepStartRef = useRef<number | null>(null)

  const go = (n: number) => {
    setDir(n > step ? 1 : -1)
    setStep(n)
    setTimerReady(false)
    setScrolledPastHalf(false)
  }

  const next = () => {
    const n = Math.min(step + 1, TOTAL_STEPS - 1)
    window.history.pushState({ step: n }, '')
    go(n)
  }
  const back = () => go(Math.max(step - 1, 0))

  useEffect(() => {
    window.history.replaceState({ step: 0 }, '')
  }, [])

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state as { step?: number } | null)?.step ?? 0
      if (step === TOTAL_STEPS - 1) {
        setShowExitModal(true)
      } else {
        setShowExitModal(false)
        const clamped = Math.max(0, Math.min(s, TOTAL_STEPS - 1))
        setDir(clamped > step ? 1 : -1)
        setStep(clamped)
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [step])

  useEffect(() => {
    startSession()
    stepStartRef.current = Date.now()
    return () => {
      finishSession()
    }
  }, [])

  useEffect(() => {
    const prev = step
    track('step_completed', {
      step: prev,
      time_spent_seconds: Math.floor((Date.now() - (stepStartRef.current ?? 0)) / 1000),
    })
    stepStartRef.current = Date.now()
    track('step_view', { step: step + 1, title: stepTitles[step] })
    if (step === 5) track('offer_view')
  }, [step])

  useEffect(() => {
    const t = setTimeout(() => setTimerReady(true), 8000)
    return () => clearTimeout(t)
  }, [step])

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight
      const winHeight = window.innerHeight
      const pct = docHeight > winHeight ? scrollTop / (docHeight - winHeight) : 1
      if (pct > 0.5) setScrolledPastHalf(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSelect = (sev: Severity) => {
    setSelected(sev)
    setDir(1)
    setStep(1)
    setTimerReady(false)
    setScrolledPastHalf(false)
    window.history.pushState({ step: 1 }, '')
  }

  const handleExitContinue = () => {
    window.history.pushState({ step: TOTAL_STEPS - 1 }, '')
    setShowExitModal(false)
  }

  const handleExitClose = () => {
    setShowExitModal(false)
    back()
  }

  const goToCheckout = () => {
    setShowFaq(false)
    const n = TOTAL_STEPS - 1
    window.history.pushState({ step: n }, '')
    go(n)
  }

  const openFaq = () => {
    setShowFaq(true)
    setFaqEverOpened(true)
  }

  const closeFaq = () => {
    setShowFaq(false)
  }

  const showButton =
    step >= 4 && step < TOTAL_STEPS - 1 && (timerReady || scrolledPastHalf) && !faqEverOpened

  const screens = [
    <StepAssessment key="0" onSelect={handleSelect} />,
    <StepValidation key="1" sev={selected ?? 'mild'} onNext={next} />,
    <StepEducation key="2" onNext={next} />,
    <StepProof key="3" sev={selected ?? 'mild'} onNext={next} />,
    <StepSolution key="4" sev={selected ?? 'mild'} onNext={next} />,
    <StepOffer key="5" sev={selected ?? 'mild'} />,
  ]

  return (
    <div className="min-h-screen bg-background font-body">
      <ProgressBar step={step} total={TOTAL_STEPS} />
      <Header step={step} onBack={back} />

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.32, ease: 'easeInOut' }}
        >
          {screens[step]}
        </motion.div>
      </AnimatePresence>

      <FloatingFaqButton visible={showButton} onClick={openFaq} />

      <AnimatePresence>
        {showFaq && <FaqOverlay sev={selected ?? 'mild'} onClose={closeFaq} onGoToCheckout={goToCheckout} />}
      </AnimatePresence>

      <ExitModal open={showExitModal} onContinue={handleExitContinue} onClose={handleExitClose} />
    </div>
  )
}

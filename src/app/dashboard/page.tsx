import { requireAuth } from '@/lib/auth'
import { getDashboardData } from '@/lib/dashboard/queries'
import { MorningGreeting } from '@/components/dashboard/MorningGreeting'
import { VitalPresence } from '@/components/dashboard/VitalPresence'
import { ModuleCard } from '@/components/dashboard/ModuleCard'
import { ConversationTimeline } from '@/components/dashboard/ConversationTimeline'
import { DailyReport } from '@/components/dashboard/DailyReport'
import { EmployeeStatusCard } from '@/components/dashboard/EmployeeStatusCard'
import { MIAReadiness } from '@/components/dashboard/MIAReadiness'
import { SkillsDisplay } from '@/components/dashboard/SkillsDisplay'
import { LearningTimeline } from '@/components/dashboard/LearningTimeline'
import { OpportunityAlerts } from '@/components/dashboard/OpportunityAlerts'
import { ProactiveSuggestions } from '@/components/dashboard/ProactiveSuggestions'
import { WeeklyReportCard } from '@/components/dashboard/WeeklyReportCard'
import { MistakePrevention } from '@/components/dashboard/MistakePrevention'
import { MaturityStageBadge } from '@/components/dashboard/MaturityStageBadge'
import { OwnerGuidance } from '@/components/dashboard/OwnerGuidance'
import Link from 'next/link'
import {
  BookOpen,
  Brain,
  FlaskConical,
} from 'lucide-react'

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, onboarding_status, assistants(id, name, is_active)')
    .eq('owner_id', user.id)
    .single()

  const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'ahí'

  if (!business) {
    return (
      <div className="animate-appear-up space-y-8">
        <MorningGreeting
          context={{
            greeting: `Bienvenido, ${userName}`,
            subtitle: 'Cuéntame sobre tu negocio para que pueda empezar a acompañarte.',
          }}
        />
        <div className="rounded-2xl border-2 border-dashed p-12 text-center"
          style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--elevation-1)' }}>
          <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
            ¡Empecemos!
          </h2>
          <p className="mb-6" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Cuéntame sobre tu negocio para que pueda empezar a trabajar contigo.
          </p>
          <Link
            href="/dashboard/onboarding"
            className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: 'var(--atmosphere-accent)',
              color: 'white',
            }}
          >
            Contarle a MIA sobre mi negocio
          </Link>
        </div>
      </div>
    )
  }

  if (business.assistants.length === 0) {
    return (
      <div className="animate-appear-up space-y-8">
        <MorningGreeting
          context={{
            greeting: `Hola, ${userName}`,
            subtitle: 'Estoy lista. Solo créame y empezaré a trabajar contigo.',
          }}
        />
        <div className="rounded-2xl border-2 border-dashed p-12 text-center"
          style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--elevation-1)' }}>
          <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
            Crea tu primera asistente
          </h2>
          <p className="mb-6" style={{ color: 'var(--atmosphere-text-secondary)' }}>
          Configuremos a MIA para que empiece a conocer a tus clientes.
          </p>
          <Link
            href="/dashboard/onboarding"
            className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: 'var(--atmosphere-accent)',
              color: 'white',
            }}
          >
            Crear a MIA
          </Link>
        </div>
      </div>
    )
  }

  const data = await getDashboardData(supabase, business.id, userName)

  return (
    <div className="animate-appear-up space-y-8">
      <MorningGreeting context={data.greetingContext} />

      {/* MIA's Current State */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EmployeeStatusCard
            status={data.employeeStatus}
            skills={data.skillsSnapshot?.skills ?? []}
          />
        </div>
        <MaturityStageBadge maturity={data.maturityStage} />
      </div>

      {/* Today's Activity */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <VitalPresence
          value={data.todaysActivity.conversations}
          action="Conversaciones activas"
          meaning="El corazón de MIA latiendo por tu negocio"
          context="En las últimas 24 horas"
          icon="MessageSquare"
          trend={{ value: 8, positive: true }}
          href="/dashboard/conversations"
        />
        <VitalPresence
          value={data.todaysActivity.newCustomers}
          action="Nuevos clientes"
          meaning="Personas que MIA está conociendo"
          context="Llegaron hoy"
          color="var(--mia-green)"
          icon="UserPlus"
        />
        <VitalPresence
          value={data.todaysActivity.messagesHandled}
          action="Mensajes gestionados"
          meaning="Conversaciones que MIA ha cuidado por ti"
          context="Hoy"
          color="var(--mia-cyan)"
          icon="BellRing"
          href="/dashboard/conversations"
        />
        <VitalPresence
          value={Math.round(data.miaReadiness.overall)}
          action="Preparación"
          meaning="Qué tan lista está MIA para atender"
          context="Score general de acompañamiento"
          color="var(--mia-violet)"
          icon="Sparkles"
          trend={{ value: 5, positive: true }}
          href="/dashboard/knowledge-studio"
        />
      </div>

      {/* What MIA Knows & How Confident She Feels */}
      <div>
        <h2
          className="mb-4 text-sm font-medium tracking-wide uppercase"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
        >
          Lo que sé y cómo me siento
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {data.skillsSnapshot && (
            <SkillsDisplay
              skills={data.skillsSnapshot.skills}
              overallLevel={data.skillsSnapshot.overall_level}
              growthSummary={data.skillsSnapshot.growth_summary}
            />
          )}
          <MIAReadiness data={data.miaReadiness} />
        </div>
      </div>

      {/* Coaching Guidance */}
      <div>
        <h2
          className="mb-4 text-sm font-medium tracking-wide uppercase"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
        >
          Coaching del día
        </h2>
        <OwnerGuidance recommendation={data.ownerGuidance} />
      </div>

      {/* Patterns & Learning */}
      <div>
        <h2
          className="mb-4 text-sm font-medium tracking-wide uppercase"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
        >
          Lo que aprendo y observo
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OpportunityAlerts memories={data.businessMemory} />
          <div className="space-y-6">
            <LearningTimeline
              recentLessons={[]}
              velocity={data.velocityHistory[0] ?? null}
            />
            <MistakePrevention items={data.mistakePrevention} />
          </div>
        </div>
      </div>

      {/* Suggestions & Needs */}
      {data.proactiveSuggestions.length > 0 && (
        <ProactiveSuggestions suggestions={data.proactiveSuggestions} />
      )}

      {/* Weekly Report */}
      <WeeklyReportCard report={data.weeklyReport} />

      {/* Recent Conversations */}
      {data.conversationTimeline.entries.length > 0 && (
        <div style={{ backgroundColor: 'var(--elevation-1)', border: '1px solid var(--atmosphere-border)', borderRadius: '1rem' }}>
          <div className="p-6">
            <ConversationTimeline data={data.conversationTimeline} />
          </div>
        </div>
      )}

      {/* Daily Report */}
      {data.dailyReport.items.length > 0 && (
        <DailyReport report={data.dailyReport} />
      )}

      {/* Explore Modules */}
      <div>
        <h2
          className="mb-4 text-sm font-medium tracking-wide uppercase"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
        >
          Explora lo que MIA está haciendo por ti
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            title="Memoria"
            description="Todo lo que MIA ha aprendido de tu negocio y tus clientes"
            href="/dashboard/knowledge"
            status="3 nuevos hoy"
            statusColor="var(--mia-green)"
            accentColor="var(--mia-green)"
            icon={BookOpen}
          />
          <ModuleCard
            title="Pensamiento"
            description="Señales, ideas y estrategias que MIA está analizando para ti"
            href="/dashboard/knowledge-studio"
            status="5 hipótesis"
            statusColor="var(--mia-violet)"
            accentColor="var(--mia-violet)"
            icon={Brain}
          />
          <ModuleCard
            title="Laboratorio"
            description="Entrena a MIA con simulaciones para que mejore cada día"
            href="/dashboard/laboratorio"
            status="Score 7.8"
            statusColor="var(--mia-gold)"
            accentColor="var(--mia-gold)"
            icon={FlaskConical}
          />
        </div>
      </div>
    </div>
  )
}

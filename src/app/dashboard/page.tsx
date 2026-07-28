import { requireAuth } from '@/lib/auth'
import { getDashboardData } from '@/lib/dashboard/queries'
import { MorningGreeting } from '@/components/dashboard/MorningGreeting'
import { EmployeeStatusCard } from '@/components/dashboard/EmployeeStatusCard'
import { MIAReadiness } from '@/components/dashboard/MIAReadiness'
import { TodaysActivity } from '@/components/dashboard/TodaysActivity'
import { DailyReport } from '@/components/dashboard/DailyReport'
import { NeedsFromYou } from '@/components/dashboard/NeedsFromYou'
import { ConversationTimeline } from '@/components/dashboard/ConversationTimeline'
import { BusinessHealth } from '@/components/dashboard/BusinessHealth'
import { ProactiveSuggestions } from '@/components/dashboard/ProactiveSuggestions'
import { CelebrateProgress } from '@/components/dashboard/CelebrateProgress'
import { LearningTimeline } from '@/components/dashboard/LearningTimeline'
import { SkillsDisplay } from '@/components/dashboard/SkillsDisplay'
import { WeeklyReportCard } from '@/components/dashboard/WeeklyReportCard'
import { ProductIntelligenceCard } from '@/components/dashboard/ProductIntelligenceCard'
import { OpportunityAlerts } from '@/components/dashboard/OpportunityAlerts'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
      <div className="space-y-8">
        <MorningGreeting
          context={{
            greeting: `Bienvenido, ${userName}`,
            subtitle: "Configuremos tu negocio para que pueda empezar a ayudar a tus clientes.",
          }}
        />
        <div className="py-12 text-center border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            ¡Empecemos!
          </h2>
          <p className="mb-6 text-gray-600">
            Primero cuéntame sobre tu negocio para que pueda empezar a trabajar para ti.
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Contarle a MIA sobre mi negocio
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (business.assistants.length === 0) {
    return (
      <div className="space-y-8">
        <MorningGreeting
          context={{
            greeting: `Hola, ${userName}`,
            subtitle: "Estoy lista. Solo créame y empezaré a trabajar.",
          }}
        />
        <div className="py-12 text-center border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Crea tu primera asistente
          </h2>
          <p className="mb-6 text-gray-600">
            Configuremos tu asistente paso a paso.
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Crear a MIA
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const data = await getDashboardData(supabase, business.id, userName)

  return (
    <div className="space-y-6">
      <MorningGreeting context={data.greetingContext} />

      <CelebrateProgress milestones={data.milestones} />

      <EmployeeStatusCard status={data.employeeStatus} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodaysActivity metrics={data.todaysActivity} />
        </div>
        <MIAReadiness data={data.miaReadiness} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DailyReport report={data.dailyReport} />
        <NeedsFromYou data={data.needsFromYou} />
      </div>

      <ProactiveSuggestions suggestions={data.proactiveSuggestions} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConversationTimeline data={data.conversationTimeline} />
        <BusinessHealth data={data.businessHealth} />
      </div>

      {data.skillsSnapshot && data.skillsSnapshot.skills.length > 0 && (
        <SkillsDisplay
          skills={data.skillsSnapshot.skills}
          overallLevel={data.skillsSnapshot.overall_level}
          growthSummary={data.skillsSnapshot.growth_summary}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LearningTimeline
          recentLessons={[]}
          velocity={data.velocityHistory[0] ?? null}
        />
        <OpportunityAlerts memories={data.businessMemory} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WeeklyReportCard report={data.weeklyReport} />
        {data.productIntelligence && data.productIntelligence.products.length > 0 && (
          <ProductIntelligenceCard products={data.productIntelligence.products} />
        )}
      </div>
    </div>
  )
}

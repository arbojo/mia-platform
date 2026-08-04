import { requireAuth } from '@/lib/auth'
import { getDashboardData } from '@/lib/dashboard/queries'
import { MorningGreeting } from '@/components/dashboard/MorningGreeting'
import { VitalPresence } from '@/components/dashboard/VitalPresence'
import { ModuleCard } from '@/components/dashboard/ModuleCard'
import { ConversationTimeline } from '@/components/dashboard/ConversationTimeline'
import { SalesMetricsCard } from '@/components/dashboard/SalesMetricsCard'
import Link from 'next/link'
import {
  BookOpen,
  Brain,
  FlaskConical,
} from 'lucide-react'
import { getUserLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth()
  const locale = await getUserLocale(user.id)
  const t = getDictionary(locale)

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
            greeting: `${t.dashboard.welcome}, ${userName}`,
            subtitle: t.dashboard.greetingSubtitleEmpty,
          }}
        />
        <div className="rounded-2xl border-2 border-dashed p-12 text-center"
          style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--elevation-1)' }}>
          <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
            {t.dashboard.letsStart}
          </h2>
          <p className="mb-6" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            {t.dashboard.tellAboutBusiness}
          </p>
          <Link
            href="/dashboard/onboarding"
            className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: 'var(--atmosphere-accent)',
              color: 'white',
            }}
          >
            {t.dashboard.tellMia}
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
            greeting: `${t.dashboard.hi}, ${userName}`,
            subtitle: t.dashboard.greetingSubtitleEmpty,
          }}
        />
        <div className="rounded-2xl border-2 border-dashed p-12 text-center"
          style={{ borderColor: 'var(--atmosphere-border)', backgroundColor: 'var(--elevation-1)' }}>
          <h2 className="mb-2 text-xl font-semibold" style={{ color: 'var(--atmosphere-text)' }}>
            {t.dashboard.createAssistantTitle}
          </h2>
          <p className="mb-6" style={{ color: 'var(--atmosphere-text-secondary)' }}>
            {t.dashboard.createAssistantSubtitle}
          </p>
          <Link
            href="/dashboard/onboarding"
            className="inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-200"
            style={{
              backgroundColor: 'var(--atmosphere-accent)',
              color: 'white',
            }}
          >
            {t.dashboard.createMia}
          </Link>
        </div>
      </div>
    )
  }

  const data = await getDashboardData(supabase, business.id, userName)

  return (
    <div className="animate-appear-up space-y-8">
      <MorningGreeting context={data.greetingContext} />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <VitalPresence
          value={data.todaysActivity.conversations}
          action={t.dashboard.activeConversations}
          meaning={t.dashboard.heartOfMia}
          context={t.dashboard.last24h}
          icon="MessageSquare"
          trend={data.conversationTrend}
          href="/dashboard/conversations"
        />
        <VitalPresence
          value={data.todaysActivity.newCustomers}
          action={t.dashboard.newCustomers}
          meaning={t.dashboard.peopleMiaMeets}
          context={t.dashboard.arrivedToday}
          color="var(--mia-green)"
          icon="UserPlus"
        />
        <VitalPresence
          value={data.todaysActivity.messagesHandled}
          action={t.dashboard.messagesHandled}
          meaning={t.dashboard.conversationsCared}
          context={t.dashboard.today}
          color="var(--mia-cyan)"
          icon="BellRing"
          href="/dashboard/conversations"
        />
        <VitalPresence
          value={Math.round(data.miaReadiness.overall)}
          action={t.dashboard.readiness}
          meaning={t.dashboard.howReadyMia}
          context={t.dashboard.overallScore}
          color="var(--mia-violet)"
          icon="Sparkles"
          trend={data.readinessTrend}
          href="/dashboard/knowledge-studio"
        />
      </div>

      {data.conversationTimeline.entries.length > 0 && (
        <div style={{ backgroundColor: 'var(--elevation-1)', border: '1px solid var(--atmosphere-border)', borderRadius: '1rem' }}>
          <div className="p-6">
            <ConversationTimeline data={data.conversationTimeline} />
          </div>
        </div>
      )}

      <SalesMetricsCard metrics={data.salesMetrics} />

      <div>
        <h2
          className="mb-4 text-sm font-medium tracking-wide uppercase"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
        >
          {t.dashboard.explore}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            title={t.dashboard.memoryTitle}
            description={t.dashboard.memoryDescription}
            href="/dashboard/knowledge"
            status={data.moduleCards.memoriaStatus}
            statusColor="var(--mia-green)"
            accentColor="var(--mia-green)"
            icon={BookOpen}
          />
          <ModuleCard
            title={t.dashboard.thinkingTitle}
            description={t.dashboard.thinkingDescription}
            href="/dashboard/knowledge-studio"
            status={data.moduleCards.pensamientoStatus}
            statusColor="var(--mia-violet)"
            accentColor="var(--mia-violet)"
            icon={Brain}
          />
          <ModuleCard
            title={t.dashboard.labTitle}
            description={t.dashboard.labDescription}
            href="/dashboard/laboratorio"
            status={data.moduleCards.laboratorioStatus}
            statusColor="var(--mia-gold)"
            accentColor="var(--mia-gold)"
            icon={FlaskConical}
          />
        </div>
      </div>

      {data.dailyReport.items.length > 0 && (
        <div
          className="rounded-2xl border p-5"
          style={{
            backgroundColor: 'var(--elevation-1)',
            borderColor: 'var(--atmosphere-border)',
          }}
        >
          <h3
            className="mb-3 text-sm font-semibold"
            style={{ color: 'var(--atmosphere-text)' }}
          >
            {data.dailyReport.greeting}
          </h3>
          <div className="space-y-2">
            {data.dailyReport.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3 py-2"
                style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                <span className="text-base">{item.icon}</span>
                <span
                  className="text-sm"
                  style={{ color: 'var(--atmosphere-text-secondary)' }}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

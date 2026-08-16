import { requirePageAuth } from '@/lib/auth'
import { getDashboardData, type ModuleCardStatus } from '@/lib/dashboard/queries'
import type { Dict } from '@/lib/i18n/dictionaries'
import { MorningGreeting } from '@/components/dashboard/MorningGreeting'
import { VitalPresence } from '@/components/dashboard/VitalPresence'
import { ModuleZone } from '@/components/dashboard/ModuleZone'
import { ConversationTimeline } from '@/components/dashboard/ConversationTimeline'
import { SalesMetricsCard } from '@/components/dashboard/SalesMetricsCard'
import { WeeklyReportCard } from '@/components/dashboard/WeeklyReportCard'
import Link from 'next/link'
import {
  BookOpen,
  Brain,
  FlaskConical,
} from 'lucide-react'
import { getUserLocale } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'

function moduleStatusText(status: ModuleCardStatus, t: Dict): string {
  switch (status.kind) {
    case 'no_news':
      return t.moduleStatus.noNews
    case 'new_today':
      return t.moduleStatus.newToday(status.count)
    case 'analyzing':
      return t.moduleStatus.analyzing
    case 'hypotheses':
      return t.moduleStatus.hypotheses(status.count)
    case 'no_simulations':
      return t.moduleStatus.noSimulations
    case 'score':
      return t.moduleStatus.score(status.score.toFixed(1))
  }
}

export default async function DashboardPage() {
  const { supabase, user } = await requirePageAuth()
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
        <div
          className="rounded-2xl border-2 border-dashed p-12 text-center"
          style={{
            borderColor: 'var(--atmosphere-border)',
            backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          }}
        >
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
        <div
          className="rounded-2xl border-2 border-dashed p-12 text-center"
          style={{
            borderColor: 'var(--atmosphere-border)',
            backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          }}
        >
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

      <div
        data-tour="home-vitals"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
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
          color="var(--mia-teal)"
          icon="Sparkles"
          trend={data.readinessTrend}
          href="/dashboard/knowledge-studio"
        />
      </div>

      {data.conversationTimeline.entries.length > 0 && (
        <div
          style={{
            borderRadius: 'var(--mod-radius-lg)',
            border: '1px solid var(--atmosphere-border)',
            backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            boxShadow: '0 0 0 1px var(--module-accent-border), 0 0 24px var(--module-glow-soft)',
          }}
        >
          <div className="p-6">
            <ConversationTimeline data={data.conversationTimeline} />
          </div>
        </div>
      )}

      <SalesMetricsCard metrics={data.salesMetrics} />

      <WeeklyReportCard report={data.weeklyReport} />

      <div>
        <h2
          className="mb-4 text-sm font-medium tracking-wide uppercase"
          style={{ color: 'var(--atmosphere-text-secondary)', opacity: 0.6 }}
        >
          {t.dashboard.explore}
        </h2>
        <div
          data-tour="home-modules"
          className="flex flex-col overflow-hidden"
          style={{
            borderRadius: 'var(--mod-radius-lg)',
            backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
            border: '1px solid var(--atmosphere-border)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            boxShadow: '0 0 0 1px var(--module-accent-border), 0 0 24px var(--module-glow-soft)',
          }}
        >
          <ModuleZone
            title={t.dashboard.memoryTitle}
            description={t.dashboard.memoryDescription}
            href="/dashboard/knowledge"
            status={moduleStatusText(data.moduleCards.memoriaStatus, t)}
            statusColor="var(--mia-green)"
            accentColor="var(--mia-green)"
            icon={BookOpen}
          />
          <div className="h-px w-full" style={{ backgroundColor: 'var(--atmosphere-border)' }} />
          <ModuleZone
            title={t.dashboard.thinkingTitle}
            description={t.dashboard.thinkingDescription}
            href="/dashboard/knowledge-studio"
            status={moduleStatusText(data.moduleCards.pensamientoStatus, t)}
            statusColor="var(--mia-teal)"
            accentColor="var(--mia-teal)"
            icon={Brain}
          />
          <div className="h-px w-full" style={{ backgroundColor: 'var(--atmosphere-border)' }} />
          <ModuleZone
            title={t.dashboard.labTitle}
            description={t.dashboard.labDescription}
            href="/dashboard/laboratorio"
            status={moduleStatusText(data.moduleCards.laboratorioStatus, t)}
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
            borderRadius: 'var(--mod-radius-lg)',
            backgroundColor: 'color-mix(in srgb, var(--atmosphere-bg) 90%, transparent)',
            borderColor: 'var(--atmosphere-border)',
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            boxShadow: '0 0 0 1px var(--module-accent-border), 0 0 24px var(--module-glow-soft)',
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
                style={{ backgroundColor: 'var(--atmosphere-surface)' }}
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

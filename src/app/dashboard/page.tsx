import { requireAuth } from '@/lib/auth'
import { getDashboardData } from '@/lib/dashboard/queries'
import { MorningGreeting } from '@/components/dashboard/MorningGreeting'
import { EmployeeStatusCard } from '@/components/dashboard/EmployeeStatusCard'
import { TodaysActivity } from '@/components/dashboard/TodaysActivity'
import { DailyReport } from '@/components/dashboard/DailyReport'
import { NeedsFromYou } from '@/components/dashboard/NeedsFromYou'
import { ConversationTimeline } from '@/components/dashboard/ConversationTimeline'
import { BusinessHealth } from '@/components/dashboard/BusinessHealth'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { ProactiveSuggestions } from '@/components/dashboard/ProactiveSuggestions'
import { CelebrateProgress } from '@/components/dashboard/CelebrateProgress'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const { supabase, user } = await requireAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, onboarding_status, assistants(id, name, is_active)')
    .eq('owner_id', user.id)
    .single()

  const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'there'

  if (!business) {
    return (
      <div className="space-y-8">
        <MorningGreeting
          context={{
            greeting: `Welcome, ${userName}`,
            subtitle: "Let's set up your business so I can start helping your customers.",
          }}
        />
        <div className="py-12 text-center border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Let&apos;s get started!
          </h2>
          <p className="mb-6 text-gray-600">
            First, tell me about your business so I can start working for you.
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Tell MIA about my business
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
            greeting: `Hi, ${userName}`,
            subtitle: "I'm ready. Just create me and I'll start working.",
          }}
        />
        <div className="py-12 text-center border-2 border-dashed border-violet-200 rounded-xl">
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Create your first assistant
          </h2>
          <p className="mb-6 text-gray-600">
            Let&apos;s set up your assistant step by step.
          </p>
          <Link href="/dashboard/onboarding">
            <Button className="bg-violet-600 hover:bg-violet-700">
              Create MIA
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
        <QuickActions />
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
    </div>
  )
}

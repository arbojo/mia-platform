import { createAdminClient } from '@/lib/supabase/admin'

export type UserRole = 'demo' | 'user' | 'admin'
export type UserStatus = 'trial' | 'active' | 'disabled'

export interface UserProfile {
  id: string
  role: UserRole
  status: UserStatus
  trial_ends_at: string
  demo_interactions_used: number
  created_at: string
  updated_at: string
}

export function getDemoFreeMessageLimit(): number {
  const raw = process.env.MIA_DEMO_FREE_MESSAGES
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 10
}

export function isDemoLead(
  profile: Pick<UserProfile, 'role' | 'status'>
): boolean {
  return profile.role === 'demo' && profile.status === 'trial'
}

export function isTrialExpired(
  profile: Pick<UserProfile, 'trial_ends_at'>
): boolean {
  return new Date(profile.trial_ends_at).getTime() < Date.now()
}

export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return (data as UserProfile) ?? null
}

export async function getOrCreateProfile(
  userId: string
): Promise<UserProfile> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw new Error(`Failed to load profile: ${error.message}`)
  return data as UserProfile
}

export async function incrementDemoInteractions(
  userId: string
): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('increment_demo_interactions', {
    target_user: userId,
  })
  if (error) throw new Error(`Failed to increment interactions: ${error.message}`)
  return data as number
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApiAuthError, ApiForbiddenError } from '@/lib/api-error'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

interface AuthResult {
  supabase: SupabaseClient
  user: User
}

export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new ApiAuthError()
  }

  return { supabase, user }
}

export async function requirePageAuth(): Promise<AuthResult> {
  try {
    return await requireAuth()
  } catch (error) {
    if (error instanceof ApiAuthError) {
      redirect('/login')
    }
    throw error
  }
}

export async function requirePlatformOwner(): Promise<AuthResult> {
  const { supabase, user } = await requireAuth()

  const ownerId = process.env.PLATFORM_OWNER_ID
  if (!ownerId || user.id !== ownerId) {
    throw new ApiForbiddenError()
  }

  return { supabase, user }
}

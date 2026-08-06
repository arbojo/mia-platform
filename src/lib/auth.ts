import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ApiAuthError } from '@/lib/api-error'
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

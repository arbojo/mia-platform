import { invalidateConversationContext } from '@/lib/conversation/context'

/**
 * Centralized context cache invalidation. Call this whenever any
 * prompt-affecting data changes (products, rules, instructions,
 * sales config, brand, personality, memory, lessons, etc.).
 *
 * Every API route and server action that mutates prompt-affecting
 * tables MUST call this function after a successful write.
 */
export function invalidateSystemContext(businessId: string): void {
  invalidateConversationContext(businessId)
}

import { describe, it, expect } from 'vitest'
import { derivePresence, presenceToAssistantUpdate } from '@/lib/assistants/presence'

describe('derivePresence', () => {
  it('returns paused when assistant is missing', () => {
    expect(derivePresence(null)).toBe('paused')
  })

  it('returns paused when assistant is explicitly deactivated', () => {
    expect(derivePresence({ id: 'a', is_active: false, status: 'active' })).toBe('paused')
    expect(derivePresence({ id: 'a', is_active: false, status: 'ready' })).toBe('paused')
    expect(derivePresence({ id: 'a', is_active: false, status: 'training' })).toBe('paused')
  })

  it('returns active when assistant serves traffic (ready)', () => {
    expect(derivePresence({ id: 'a', is_active: true, status: 'ready' })).toBe('active')
  })

  it('returns active when assistant serves traffic (active)', () => {
    expect(derivePresence({ id: 'a', is_active: true, status: 'active' })).toBe('active')
  })

  it('returns learning when assistant is training', () => {
    expect(derivePresence({ id: 'a', is_active: true, status: 'training' })).toBe('learning')
  })

  it('returns learning when assistant is draft', () => {
    expect(derivePresence({ id: 'a', is_active: true, status: 'draft' })).toBe('learning')
  })

  it('returns paused for unknown status when active', () => {
    expect(derivePresence({ id: 'a', is_active: true, status: 'weird' })).toBe('paused')
  })
})

describe('presenceToAssistantUpdate', () => {
  it('maps active to published assistant', () => {
    expect(presenceToAssistantUpdate('active')).toEqual({ status: 'active', is_active: true })
  })

  it('maps learning to training state', () => {
    expect(presenceToAssistantUpdate('learning')).toEqual({ status: 'training', is_active: true })
  })

  it('maps paused to deactivated assistant', () => {
    expect(presenceToAssistantUpdate('paused')).toEqual({ status: 'inactive', is_active: false })
  })
})
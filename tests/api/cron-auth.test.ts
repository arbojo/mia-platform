import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { verifyCronAuth } from '@/lib/cron/auth'

const originalMia = process.env.MIA_CRON_SECRET
const originalCron = process.env.CRON_SECRET

beforeEach(() => {
  process.env.MIA_CRON_SECRET = 'mia-secret-aaa'
  process.env.CRON_SECRET = 'scheduler-secret-bbb'
})

afterEach(() => {
  process.env.MIA_CRON_SECRET = originalMia
  process.env.CRON_SECRET = originalCron
})

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/cron/whatever', { method: 'GET', headers })
}

describe('verifyCronAuth', () => {
  it('accepts the Vercel scheduler Authorization Bearer header', () => {
    expect(verifyCronAuth(req({ Authorization: 'Bearer scheduler-secret-bbb' }))).toBe(true)
  })

  it('accepts the shared secret header used by manual runs', () => {
    expect(verifyCronAuth(req({ 'x-mia-cron-secret': 'mia-secret-aaa' }))).toBe(true)
  })

  it('rejects a bearer token that is not the configured secret', () => {
    expect(verifyCronAuth(req({ Authorization: 'Bearer wrong' }))).toBe(false)
  })

  it('rejects a shared secret of the right shape but wrong value', () => {
    expect(verifyCronAuth(req({ 'x-mia-cron-secret': 'mia-secret-bbb' }))).toBe(false)
  })

  it('rejects a shared secret that is a prefix of the real one', () => {
    expect(verifyCronAuth(req({ 'x-mia-cron-secret': 'mia-secret' }))).toBe(false)
  })

  it('rejects a request with no credentials at all', () => {
    expect(verifyCronAuth(req({}))).toBe(false)
  })

  it('rejects an empty bearer value', () => {
    expect(verifyCronAuth(req({ Authorization: 'Bearer ' }))).toBe(false)
  })

  // Fails closed: these routes read through the service-role client, so a
  // missing variable must disable the endpoint, never open it.
  it('rejects everything when no secret is configured at all', () => {
    delete process.env.MIA_CRON_SECRET
    delete process.env.CRON_SECRET

    expect(verifyCronAuth(req({}))).toBe(false)
    expect(verifyCronAuth(req({ Authorization: 'Bearer anything' }))).toBe(false)
    expect(verifyCronAuth(req({ 'x-mia-cron-secret': 'anything' }))).toBe(false)
  })

  it('rejects everything when only the shared secret is configured', () => {
    delete process.env.CRON_SECRET

    expect(verifyCronAuth(req({ Authorization: 'Bearer scheduler-secret-bbb' }))).toBe(false)
    expect(verifyCronAuth(req({ 'x-mia-cron-secret': 'mia-secret-aaa' }))).toBe(true)
  })

  it('rejects everything when only CRON_SECRET is configured', () => {
    delete process.env.MIA_CRON_SECRET

    expect(verifyCronAuth(req({ 'x-mia-cron-secret': 'mia-secret-aaa' }))).toBe(false)
    expect(verifyCronAuth(req({ Authorization: 'Bearer scheduler-secret-bbb' }))).toBe(true)
  })

  it('does not let one configured secret stand in for the other', () => {
    // The two variables are independent credentials. A caller holding the
    // manual-run secret must not be able to replay it as a scheduler token.
    expect(
      verifyCronAuth(req({ Authorization: 'Bearer mia-secret-aaa', 'x-mia-cron-secret': '' }))
    ).toBe(false)
  })
})

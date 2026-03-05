import { describe, it, expect } from 'vitest'
import { $fetch, ensureAdminExists } from '../setup/test-helpers'

describe('Security: Login Rate Limiting', () => {
  // Use a unique email to avoid polluting other test suites
  const rateLimitEmail = `ratelimit-${Date.now()}@test.com`

  it('setup: ensure admin exists', async () => {
    await ensureAdminExists()
  })

  it('allows first 5 failed login attempts', async () => {
    for (let i = 0; i < 5; i++) {
      const err = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email: rateLimitEmail, password: 'wrong' },
      }).catch((e: any) => e)
      expect(err.status).toBe(401)
    }
  })

  it('blocks 6th attempt with 429', async () => {
    const err = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: rateLimitEmail, password: 'wrong' },
    }).catch((e: any) => e)
    expect(err.status).toBe(429)
  })

  it('rate limit is case-insensitive (security)', async () => {
    const err = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: rateLimitEmail.toUpperCase(), password: 'wrong' },
    }).catch((e: any) => e)
    expect(err.status).toBe(429)
  })
})

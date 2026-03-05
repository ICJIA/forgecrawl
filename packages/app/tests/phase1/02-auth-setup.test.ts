import { describe, it, expect } from 'vitest'
import { $fetch, $fetchRaw } from '../setup/test-helpers'

describe('Auth: Setup', () => {
  let setupAlreadyDone = false

  it('check initial setup state', async () => {
    const health = await $fetch<{ setup_complete: boolean }>('/api/health')
    setupAlreadyDone = health.setup_complete
  })

  it('rejects setup with missing email', async () => {
    const err = await $fetch('/api/auth/setup', {
      method: 'POST',
      body: { password: 'testpassword123', confirmPassword: 'testpassword123' },
    }).catch((e: any) => e)
    // 400 = validation error (setup not yet done), 403 = setup already locked
    expect(err.status).toBe(setupAlreadyDone ? 403 : 400)
  })

  it('rejects setup with short password', async () => {
    const err = await $fetch('/api/auth/setup', {
      method: 'POST',
      body: { email: 'test@test.com', password: 'short', confirmPassword: 'short' },
    }).catch((e: any) => e)
    expect(err.status).toBe(setupAlreadyDone ? 403 : 400)
  })

  it('rejects setup with mismatched passwords', async () => {
    const err = await $fetch('/api/auth/setup', {
      method: 'POST',
      body: { email: 'test@test.com', password: 'testpassword123', confirmPassword: 'different123' },
    }).catch((e: any) => e)
    expect(err.status).toBe(setupAlreadyDone ? 403 : 400)
  })

  it('creates admin account on first setup', async () => {
    const health = await $fetch<{ setup_complete: boolean }>('/api/health')
    if (health.setup_complete) {
      // Already done — verify re-setup is blocked
      const err = await $fetch('/api/auth/setup', {
        method: 'POST',
        body: { email: 'new@test.com', password: 'testpassword123', confirmPassword: 'testpassword123' },
      }).catch((e: any) => e)
      expect(err.status).toBe(403)
      return
    }

    const res = await $fetchRaw('/api/auth/setup', {
      method: 'POST',
      body: {
        email: 'test@forgecrawl.dev',
        password: 'testpassword123',
        confirmPassword: 'testpassword123',
      },
    })
    expect(res.status).toBe(200)
    const cookies = res.headers.getSetCookie?.() || []
    expect(cookies.some((c: string) => c.includes('forgecrawl_session'))).toBe(true)
  })

  it('permanently locks setup after first admin (security)', async () => {
    const err = await $fetch('/api/auth/setup', {
      method: 'POST',
      body: {
        email: 'attacker@evil.com',
        password: 'testpassword123',
        confirmPassword: 'testpassword123',
      },
    }).catch((e: any) => e)
    expect(err.status).toBe(403)
  })
})

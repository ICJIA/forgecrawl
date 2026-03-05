import { describe, it, expect } from 'vitest'
import { $fetch, ensureAdminExists, login, createApiKey } from '../setup/test-helpers'

describe('Security: Error Sanitization', () => {
  let apiKey: string

  it('setup: ensure admin and get API key', async () => {
    await ensureAdminExists()
    const cookie = await login()
    apiKey = await createApiKey(cookie, 'error-test')
  })

  it('does not leak server paths in error responses', async () => {
    const err = await $fetch('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'https://this-domain-definitely-does-not-exist-xyzzy.com' },
    }).catch((e: any) => e)

    const message = err.data?.message || err.message || ''
    expect(message).not.toMatch(/\/home\//)
    expect(message).not.toMatch(/\/app\//)
    expect(message).not.toMatch(/\/Users\//)
    expect(message).not.toMatch(/node_modules/)
    expect(message).not.toMatch(/\.ts:/)
    expect(message).not.toMatch(/\.js:/)
  })

  it('returns generic error for unexpected scrape failures', async () => {
    const err = await $fetch('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'https://this-domain-definitely-does-not-exist-xyzzy.com' },
    }).catch((e: any) => e)

    // Should be 400 (blocked by DNS resolution) or 500 (generic error)
    expect([400, 500]).toContain(err.status)
  })

  it('login errors do not reveal whether email exists', async () => {
    const err1 = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@nowhere.com', password: 'anypassword' },
    }).catch((e: any) => e)

    const err2 = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: 'test@forgecrawl.dev', password: 'wrongpassword' },
    }).catch((e: any) => e)

    const msg1 = err1.data?.message || err1.message
    const msg2 = err2.data?.message || err2.message
    expect(msg1).toBe(msg2) // Same message for both cases
  })
})

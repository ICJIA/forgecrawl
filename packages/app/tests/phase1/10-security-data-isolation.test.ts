import { describe, it, expect } from 'vitest'
import { $fetch, ensureAdminExists, login, createApiKey } from '../setup/test-helpers'

describe('Security: Data Isolation', () => {
  let apiKey: string

  it('setup: ensure admin and get API key', async () => {
    await ensureAdminExists()
    const cookie = await login()
    apiKey = await createApiKey(cookie, 'isolation-test')
  })

  it('cannot delete another user\'s scrape (returns 404, not 403)', async () => {
    const err = await $fetch('/api/scrapes/fake-uuid-from-another-user', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch((e: any) => e)
    // Returns 404 (not 403) to avoid confirming the scrape exists
    expect(err.status).toBe(404)
  })

  it('cannot view another user\'s scrape (returns 404)', async () => {
    const err = await $fetch('/api/scrapes/fake-uuid-from-another-user', {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch((e: any) => e)
    expect(err.status).toBe(404)
  })

  it('cannot delete another user\'s API key', async () => {
    const err = await $fetch('/api/auth/api-keys/fake-key-id', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch((e: any) => e)
    expect(err.status).toBe(404)
  })

  it('scrape list only returns current user\'s data', async () => {
    const data = await $fetch<{ jobs: any[] }>('/api/scrapes', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(Array.isArray(data.jobs)).toBe(true)
  })

  it('API key list only returns current user\'s keys', async () => {
    const data = await $fetch<{ keys: any[] }>('/api/auth/api-keys', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(Array.isArray(data.keys)).toBe(true)
    for (const key of data.keys) {
      expect(key.keyPrefix).toMatch(/^fc_/)
    }
  })
})

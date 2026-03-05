import { describe, it, expect } from 'vitest'
import { $fetch, ensureAdminExists, login, createApiKey } from '../setup/test-helpers'

describe('Auth: API Keys', () => {
  let cookie: string
  let apiKey: string
  let keyId: string

  it('setup: ensure admin and login', async () => {
    await ensureAdminExists()
    cookie = await login()
  })

  it('creates an API key with fc_ prefix', async () => {
    const res = await $fetch<any>('/api/auth/api-keys', {
      method: 'POST',
      body: { name: 'test-key' },
      headers: { cookie },
    })
    expect(res.key).toMatch(/^fc_[a-f0-9]{64}$/)
    expect(res.keyPrefix).toMatch(/^fc_/)
    expect(res.message).toContain('not be shown again')
    apiKey = res.key
    keyId = res.id
  })

  it('rejects API key creation without a name', async () => {
    const err = await $fetch('/api/auth/api-keys', {
      method: 'POST',
      body: {},
      headers: { cookie },
    }).catch((e: any) => e)
    expect(err.status).toBe(400)
  })

  it('lists API keys without exposing full key or hash', async () => {
    const res = await $fetch<any>('/api/auth/api-keys', {
      headers: { cookie },
    })
    expect(res.keys.length).toBeGreaterThan(0)
    const key = res.keys[0]
    expect(key).toHaveProperty('keyPrefix')
    expect(key).toHaveProperty('name')
    expect(key).not.toHaveProperty('key')
    expect(key).not.toHaveProperty('keyHash')
  })

  it('authenticates with Bearer token', async () => {
    const data = await $fetch<any>('/api/scrapes', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(data).toHaveProperty('jobs')
  })

  it('rejects invalid Bearer token', async () => {
    const err = await $fetch('/api/scrapes', {
      headers: { Authorization: 'Bearer fc_invalidkey' },
    }).catch((e: any) => e)
    expect(err.status).toBe(401)
  })

  it('rejects Bearer token with wrong prefix', async () => {
    const err = await $fetch('/api/scrapes', {
      headers: { Authorization: 'Bearer bad_prefix_key' },
    }).catch((e: any) => e)
    expect(err.status).toBe(401)
  })

  it('revokes an API key', async () => {
    const res = await $fetch<any>(`/api/auth/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(res.success).toBe(true)
  })

  it('rejects requests with revoked API key', async () => {
    const err = await $fetch('/api/scrapes', {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch((e: any) => e)
    expect(err.status).toBe(401)
  })
})

import { describe, it, expect } from 'vitest'
import { $fetch, $fetchRaw, ensureAdminExists, login, createApiKey } from '../setup/test-helpers'

describe('Security: Auth Middleware', () => {
  let cookie: string
  let apiKey: string

  it('setup: ensure admin, login, create API key', async () => {
    await ensureAdminExists()
    cookie = await login()
    apiKey = await createApiKey(cookie, 'middleware-test')
  })

  // Routes that should NOT require auth
  const publicRoutes = [
    { method: 'GET' as const, path: '/api/health' },
  ]

  for (const route of publicRoutes) {
    it(`allows unauthenticated access to ${route.method} ${route.path}`, async () => {
      const data = await $fetch(route.path, { method: route.method })
      expect(data).toBeTruthy()
    })
  }

  // Routes that MUST require auth
  const protectedRoutes = [
    { method: 'GET' as const, path: '/api/scrapes' },
    { method: 'GET' as const, path: '/api/auth/me' },
    { method: 'POST' as const, path: '/api/scrape', body: { url: 'https://example.com' } },
    { method: 'GET' as const, path: '/api/auth/api-keys' },
  ]

  for (const route of protectedRoutes) {
    it(`rejects unauthenticated ${route.method} ${route.path} with 401`, async () => {
      const err = await $fetch(route.path, {
        method: route.method,
        body: route.body,
      }).catch((e: any) => e)
      expect(err.status).toBe(401)
    })
  }

  it('accepts session cookie auth', async () => {
    const data = await $fetch<any>('/api/auth/me', {
      headers: { cookie },
    })
    expect(data).toHaveProperty('user')
  })

  it('accepts Bearer token auth', async () => {
    const data = await $fetch<any>('/api/scrapes', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(data).toHaveProperty('jobs')
  })

  it('prefers Bearer token over invalid cookie', async () => {
    const data = await $fetch<any>('/api/scrapes', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        cookie: 'forgecrawl_session=invalid_token',
      },
    })
    expect(data).toHaveProperty('jobs')
  })

  it('rejects tampered JWT cookie', async () => {
    const err = await $fetch('/api/auth/me', {
      headers: { cookie: 'forgecrawl_session=tampered.jwt.token' },
    }).catch((e: any) => e)
    expect(err.status).toBe(401)
  })

  it('rejects request with invalid cookie', async () => {
    const err = await $fetch('/api/auth/me', {
      headers: { cookie: 'forgecrawl_session=invalid' },
    }).catch((e: any) => e)
    expect(err.status).toBe(401)
  })
})

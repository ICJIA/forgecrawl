import { describe, it, expect } from 'vitest'
import { $fetch, ensureAdminExists, login, createApiKey } from '../setup/test-helpers'

describe('Security: SSRF Protection', () => {
  let apiKey: string

  it('setup: ensure admin and get API key', async () => {
    await ensureAdminExists()
    const cookie = await login()
    apiKey = await createApiKey(cookie, 'ssrf-test')
  })

  // All of these URLs should be blocked
  const blockedUrls = [
    { url: 'http://localhost/secret', reason: 'localhost' },
    { url: 'http://127.0.0.1/secret', reason: 'loopback IP' },
    { url: 'http://0.0.0.0/', reason: 'zero address' },
    { url: 'http://[::1]/', reason: 'IPv6 loopback' },
    { url: 'http://169.254.169.254/latest/meta-data/', reason: 'AWS metadata' },
    { url: 'http://metadata.google.internal/', reason: 'GCP metadata' },
    { url: 'http://10.0.0.1/', reason: 'private Class A' },
    { url: 'http://172.16.0.1/', reason: 'private Class B' },
    { url: 'http://192.168.1.1/', reason: 'private Class C' },
    { url: 'ftp://example.com/file', reason: 'non-HTTP protocol (ftp)' },
    { url: 'file:///etc/passwd', reason: 'file protocol' },
    { url: 'gopher://evil.com/', reason: 'gopher protocol' },
    { url: 'javascript:alert(1)', reason: 'javascript protocol' },
    { url: 'not-a-valid-url', reason: 'invalid URL' },
  ]

  for (const { url, reason } of blockedUrls) {
    it(`blocks ${reason}: ${url}`, async () => {
      const err = await $fetch('/api/scrape', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: { url },
      }).catch((e: any) => e)
      expect(err.status).toBe(400)
    })
  }

  it('blocks cloud metadata IP even as raw IP', async () => {
    const err = await $fetch('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'http://169.254.169.254/' },
    }).catch((e: any) => e)
    expect(err.status).toBe(400)
  })

  it('allows valid external HTTPS URL', async () => {
    const data = await $fetch<any>('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'https://example.com' },
    })
    expect(data.title).toBeTruthy()
  })
})

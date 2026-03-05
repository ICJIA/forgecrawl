import { describe, it, expect } from 'vitest'
import { $fetch, ensureAdminExists, login, createApiKey } from '../setup/test-helpers'

describe('Scraping', () => {
  let apiKey: string
  let scrapeJobId: string

  it('setup: ensure admin and get API key', async () => {
    await ensureAdminExists()
    const cookie = await login()
    apiKey = await createApiKey(cookie, 'scrape-test')
  })

  it('rejects scrape without URL', async () => {
    const err = await $fetch('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: {},
    }).catch((e: any) => e)
    expect(err.status).toBe(400)
  })

  it('scrapes a valid URL and returns markdown', async () => {
    const data = await $fetch<any>('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'https://example.com', bypass_cache: true },
    })

    expect(data.job_id).toBeTruthy()
    expect(data.title).toBe('Example Domain')
    expect(data.markdown).toContain('---')
    expect(data.markdown).toContain('Example Domain')
    expect(data.wordCount).toBeGreaterThan(0)
    expect(data.metadata).toHaveProperty('url')
    scrapeJobId = data.job_id
  })

  it('markdown includes YAML frontmatter', async () => {
    const data = await $fetch<any>('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'https://example.com', bypass_cache: true },
    })

    expect(data.markdown).toMatch(/^---\n/)
    expect(data.markdown).toContain('title:')
    expect(data.markdown).toContain('url:')
    expect(data.markdown).toContain('scraped_at:')
    expect(data.markdown).toContain('scraper: ForgeCrawl/')
  })

  it('returns cached result on repeated scrape', async () => {
    const data = await $fetch<any>('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'https://example.com' },
    })
    expect(data.cached).toBe(true)
  })

  it('bypasses cache when requested', async () => {
    const data = await $fetch<any>('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'https://example.com', bypass_cache: true },
    })
    expect(data.cached).toBe(false)
  })

  it('lists scrapes for authenticated user', async () => {
    const data = await $fetch<{ jobs: any[] }>('/api/scrapes', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(data.jobs.length).toBeGreaterThan(0)
    expect(data.jobs[0]).toHaveProperty('url')
    expect(data.jobs[0]).toHaveProperty('status')
  })

  it('gets scrape detail by ID', async () => {
    const data = await $fetch<{ job: any; result: any }>(`/api/scrapes/${scrapeJobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(data.job).toBeTruthy()
    expect(data.job.id).toBe(scrapeJobId)
    expect(data.result).toBeTruthy()
    expect(data.result.markdown).toContain('Example Domain')
  })

  it('returns 404 for non-existent scrape ID', async () => {
    const err = await $fetch('/api/scrapes/non-existent-id', {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch((e: any) => e)
    expect(err.status).toBe(404)
  })

  it('deletes a scrape', async () => {
    // Create a scrape to delete
    const scrape = await $fetch<any>('/api/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: { url: 'https://example.com', bypass_cache: true },
    })

    const res = await $fetch<{ success: boolean }>(`/api/scrapes/${scrape.job_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    expect(res.success).toBe(true)

    // Verify it's gone
    const err = await $fetch(`/api/scrapes/${scrape.job_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch((e: any) => e)
    expect(err.status).toBe(404)
  })
})

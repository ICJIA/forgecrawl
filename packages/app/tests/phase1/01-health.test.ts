import { describe, it, expect } from 'vitest'
import { $fetch } from '../setup/test-helpers'

describe('Health Check', () => {
  it('returns 200 with status ok', async () => {
    const data = await $fetch<any>('/api/health')
    expect(data.status).toBe('ok')
  })

  it('returns version string', async () => {
    const data = await $fetch<any>('/api/health')
    expect(data.version).toBeTruthy()
    expect(typeof data.version).toBe('string')
  })

  it('returns database status', async () => {
    const data = await $fetch<any>('/api/health')
    expect(data.database).toBe('ok')
  })

  it('returns setup_complete boolean', async () => {
    const data = await $fetch<any>('/api/health')
    expect(typeof data.setup_complete).toBe('boolean')
  })

  it('does NOT expose memory or uptime (security)', async () => {
    const data = await $fetch<any>('/api/health')
    expect(data).not.toHaveProperty('memory')
    expect(data).not.toHaveProperty('uptime')
  })

  it('requires no authentication', async () => {
    const data = await $fetch<any>('/api/health')
    expect(data.status).toBe('ok')
  })
})

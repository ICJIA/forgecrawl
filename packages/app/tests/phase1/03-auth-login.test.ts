import { describe, it, expect } from 'vitest'
import { $fetch, $fetchRaw, ensureAdminExists, TEST_EMAIL, TEST_PASSWORD } from '../setup/test-helpers'

describe('Auth: Login', () => {
  it('setup: ensure admin exists', async () => {
    await ensureAdminExists()
  })

  it('rejects login with missing fields', async () => {
    const err = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL },
    }).catch((e: any) => e)
    expect(err.status).toBe(400)
  })

  it('rejects login with wrong password', async () => {
    const err = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'wrongpassword' },
    }).catch((e: any) => e)
    expect(err.status).toBe(401)
  })

  it('rejects login with non-existent email', async () => {
    const err = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@nowhere.com', password: 'somepassword' },
    }).catch((e: any) => e)
    expect(err.status).toBe(401)
  })

  it('returns same error for wrong email and wrong password (no user enumeration)', async () => {
    const wrongEmail = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@nowhere.com', password: 'somepassword' },
    }).catch((e: any) => e)

    const wrongPassword = await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: 'wrongpassword' },
    }).catch((e: any) => e)

    expect(wrongEmail.status).toBe(401)
    expect(wrongPassword.status).toBe(401)
    expect(wrongEmail.data?.message).toBe('Invalid credentials')
    expect(wrongPassword.data?.message).toBe('Invalid credentials')
  })

  it('succeeds with correct credentials and sets HTTP-only cookie', async () => {
    const res = await $fetchRaw('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    expect(res.status).toBe(200)

    const cookies = res.headers.getSetCookie?.() || []
    const session = cookies.find((c: string) => c.includes('forgecrawl_session'))
    expect(session).toBeTruthy()
    expect(session).toContain('HttpOnly')
    expect(session).toContain('SameSite=Lax')
    expect(session).toContain('Path=/')
  })

  it('returns user data on successful login', async () => {
    const data = await $fetch<any>('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    expect(data.success).toBe(true)
    expect(data.user.email).toBe(TEST_EMAIL)
    expect(data.user.role).toBe('admin')
  })

  it('does not expose password hash in response', async () => {
    const data = await $fetch<any>('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    const str = JSON.stringify(data)
    expect(str).not.toContain('passwordHash')
    expect(str).not.toContain('password_hash')
    expect(str).not.toContain('$2b$')
  })
})

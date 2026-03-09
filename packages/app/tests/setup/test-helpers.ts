import { ofetch, type FetchOptions } from 'ofetch'

const TEST_EMAIL = 'test@forgecrawl.dev'
const TEST_PASSWORD = 'testpassword123'

function getBaseUrl() {
  return process.env.TEST_BASE_URL || 'http://127.0.0.1:5199'
}

/**
 * Fetch wrapper that uses the test server base URL.
 */
function $fetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  return ofetch<T>(`${getBaseUrl()}${path}`, {
    ...options,
    retry: 0,
  } as any)
}

/**
 * Raw fetch that returns the full response (for inspecting headers, status, etc.)
 */
function $fetchRaw(path: string, options: FetchOptions = {}) {
  return ofetch.raw(`${getBaseUrl()}${path}`, {
    ...options,
    retry: 0,
  } as any)
}

/**
 * Create admin account via setup endpoint (only works if setup not complete).
 */
async function ensureAdminExists() {
  const health = await $fetch<{ setup_complete: boolean }>('/api/health')
  if (health.setup_complete) return

  await $fetch('/api/auth/setup', {
    method: 'POST',
    body: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    },
  })
}

/**
 * Login and return session cookie string.
 */
async function login(email = TEST_EMAIL, password = TEST_PASSWORD) {
  const res = await $fetchRaw('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })

  const cookies = res.headers.getSetCookie?.() || []
  const session = cookies.find((c: string) => c.startsWith('forgecrawl_session='))
  if (!session) throw new Error('No session cookie returned')

  return session.split(';')[0]
}

/**
 * Create an API key and return the raw key string.
 */
async function createApiKey(cookie: string, name = 'test-key') {
  const res = await $fetch<{ key: string }>('/api/auth/api-keys', {
    method: 'POST',
    body: { name },
    headers: { cookie },
  })
  return res.key
}

export {
  TEST_EMAIL,
  TEST_PASSWORD,
  getBaseUrl,
  $fetch,
  $fetchRaw,
  ensureAdminExists,
  login,
  createApiKey,
}

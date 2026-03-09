import { config } from '../../../../forgecrawl.config'

const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = config.rateLimit.loginMaxAttempts
const WINDOW_MS = config.rateLimit.loginWindowMs

export function checkLoginRateLimit(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  const record = attempts.get(key)

  if (record) {
    if (now > record.resetAt) {
      attempts.delete(key)
      return
    }
    if (record.count >= MAX_ATTEMPTS) {
      throw createError({
        statusCode: 429,
        message: 'Too many login attempts. Try again in 15 minutes.',
      })
    }
  }
}

export function recordFailedLogin(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  const record = attempts.get(key)

  if (record && now <= record.resetAt) {
    record.count++
  } else {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
  }
}

export function clearLoginAttempts(email: string): void {
  attempts.delete(email.toLowerCase())
}

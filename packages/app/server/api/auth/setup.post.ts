import { getDb } from '../../db'
import { getSqlite } from '../../db'
import { appConfig, users } from '../../db/schema'
import { hashPassword } from '../../auth/password'
import { createToken } from '../../auth/jwt'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = getDb()

  // Early check: is setup already complete?
  const existing = db.select().from(appConfig)
    .where(eq(appConfig.key, 'setup_complete'))
    .get()

  if (existing) {
    throw createError({ statusCode: 403, message: 'Setup already completed' })
  }

  const body = await readBody(event)

  if (!body.email || !body.password || body.password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Email and password (min 8 chars) required',
    })
  }

  if (body.password !== body.confirmPassword) {
    throw createError({
      statusCode: 400,
      message: 'Passwords do not match',
    })
  }

  const passwordHash = await hashPassword(body.password)
  const userId = crypto.randomUUID()

  // Transaction prevents race condition: re-check + insert atomically
  const sqlite = getSqlite()!
  const runSetup = sqlite.transaction(() => {
    const alreadyDone = db.select().from(appConfig)
      .where(eq(appConfig.key, 'setup_complete'))
      .get()

    if (alreadyDone) {
      throw createError({ statusCode: 403, message: 'Setup already completed' })
    }

    db.insert(users).values({
      id: userId,
      email: body.email,
      passwordHash,
      displayName: body.displayName || body.email,
      role: 'admin',
    }).run()

    db.insert(appConfig).values({
      key: 'setup_complete',
      value: {
        completedAt: new Date().toISOString(),
        adminId: userId,
      },
    }).run()
  })

  runSetup()

  // Issue JWT session cookie
  const token = await createToken({
    id: userId,
    email: body.email,
    role: 'admin',
  })

  setCookie(event, 'forgecrawl_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: useRuntimeConfig().sessionMaxAge as number,
    path: '/',
  })

  return { success: true, user: { id: userId, email: body.email, role: 'admin' } }
})

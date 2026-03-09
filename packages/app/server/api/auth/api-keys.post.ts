import { getDb } from '../../db'
import { apiKeys } from '../../db/schema'
import { generateApiKey } from '../../auth/api-key'
import { eq } from 'drizzle-orm'
import { config } from '../../../../../forgecrawl.config'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)

  const name = body.name?.trim()
  if (!name) {
    throw createError({ statusCode: 400, message: 'API key name is required' })
  }

  const db = getDb()

  // Enforce per-user API key limit
  const maxKeys = config.apiKeys.maxPerUser
  if (maxKeys > 0) {
    const existing = db.select().from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .all()
    if (existing.length >= maxKeys) {
      throw createError({
        statusCode: 403,
        message: `API key limit reached (max ${maxKeys}). Revoke an existing key to create a new one.`,
      })
    }
  }

  const { rawKey, keyHash, keyPrefix } = generateApiKey()

  const id = crypto.randomUUID()

  db.insert(apiKeys).values({
    id,
    userId: user.id,
    name,
    keyHash,
    keyPrefix,
    expiresAt: body.expiresAt || null,
  }).run()

  // Return the raw key ONCE — it cannot be retrieved again
  return {
    id,
    name,
    key: rawKey,
    keyPrefix,
    expiresAt: body.expiresAt || null,
    message: 'Store this key securely. It will not be shown again.',
  }
})

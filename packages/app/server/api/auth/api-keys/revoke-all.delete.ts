import { getDb } from '../../../db'
import { apiKeys } from '../../../db/schema'
import { eq, and, ne } from 'drizzle-orm'

export default defineEventHandler((event) => {
  const user = event.context.user
  const db = getDb()

  // If called via API key, preserve the calling key
  const callingKeyId = event.context.apiKeyId as string | undefined

  let revoked: number

  if (callingKeyId) {
    // Revoke all except the calling key
    const result = db.delete(apiKeys)
      .where(and(eq(apiKeys.userId, user.id), ne(apiKeys.id, callingKeyId)))
      .run()
    revoked = result.changes
  } else {
    // Called via session cookie — revoke all keys
    const result = db.delete(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .run()
    revoked = result.changes
  }

  return {
    success: true,
    revoked,
    preserved: callingKeyId ? 1 : 0,
    message: callingKeyId
      ? `Revoked ${revoked} key(s). The key used for this request was preserved.`
      : `Revoked ${revoked} key(s).`,
  }
})

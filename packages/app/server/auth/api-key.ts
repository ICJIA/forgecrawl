import { createHash, randomBytes } from 'crypto'
import { getDb } from '../db'
import { apiKeys, users } from '../db/schema'
import { eq } from 'drizzle-orm'

const PREFIX = 'fc_'

/**
 * Generate a new API key.
 * Returns the raw key (shown once to the user) and metadata for storage.
 */
export function generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const random = randomBytes(32).toString('hex')
  const rawKey = `${PREFIX}${random}`
  const keyHash = hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 8) // "fc_xxxxx" for identification
  return { rawKey, keyHash, keyPrefix }
}

/**
 * SHA-256 hash of the full key. Fast enough for lookup since keys are
 * high-entropy (no need for bcrypt's slow hashing).
 */
function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

/**
 * Look up a user by their API key. Returns null if the key is invalid or expired.
 * Updates lastUsedAt on successful lookup.
 */
export function verifyApiKey(rawKey: string): { id: string; email: string; role: string; apiKeyId: string } | null {
  if (!rawKey.startsWith(PREFIX)) return null

  const keyHash = hashKey(rawKey)
  const db = getDb()

  const record = db.select().from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .get()

  if (!record) return null

  // Check expiry
  if (record.expiresAt) {
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
    if (now > record.expiresAt) return null
  }

  // Update lastUsedAt
  db.update(apiKeys).set({
    lastUsedAt: new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
  }).where(eq(apiKeys.id, record.id)).run()

  // Look up the owning user
  const user = db.select().from(users)
    .where(eq(users.id, record.userId))
    .get()

  if (!user) return null

  return { id: user.id, email: user.email, role: user.role, apiKeyId: record.id }
}

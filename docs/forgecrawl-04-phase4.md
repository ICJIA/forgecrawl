# ForgeCrawl — Phase 4: API Keys & Multi-User

**Version:** 1.0  
**Date:** March 3, 2026  
**Depends on:** Phase 3 (complete)  
**Deliverable:** API key authentication for programmatic access, user management for admin, per-user usage tracking

---

## 1. Phase 4 Goal

Enable programmatic access to ForgeCrawl via API keys so it can be called from scripts, CLI tools, and other applications. Add multi-user support so the admin can create additional users. Implement per-user usage tracking and rate limiting.

---

## 2. Scope

### In Scope

- API key generation with secure hashing (bcrypt)
- API key authentication in server middleware (alongside existing JWT auth)
- Key prefix display for identification (`bc_xxxxxxxx...`)
- Key expiration dates (optional)
- Key revocation
- Admin user management: create, disable, delete users
- Per-user role enforcement (admin vs user)
- Per-user usage tracking: scrapes count, pages scraped, storage used
- Per-user rate limiting (configurable by admin)
- Admin dashboard: user list, usage stats, key management
- API documentation page (auto-generated from route definitions)

### Out of Scope

- RAG chunking (Phase 5)
- Login-gated scraping (Phase 5)
- OAuth/SSO (future enhancement)

---

## 3. API Key System

### 3.1 Key Format

```
bc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
|  |
|  +-- 40 random hex characters
+-- prefix identifying ForgeCrawl keys
```

- Total length: 43 characters
- Prefix: `bc_` (always)
- Key body: 40 chars of `crypto.randomBytes(20).toString('hex')`
- Storage: bcrypt hash of full key; first 8 chars stored as `key_prefix` for display

### 3.2 Key Generation Endpoint

```typescript
// server/api/auth/api-keys.post.ts
import { hash } from 'bcrypt'
import { randomBytes } from 'crypto'
import { getDb } from '../../db'
import { apiKeys } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const { user } = event.context
  const body = await readBody(event)

  // Generate key
  const keyBody = randomBytes(20).toString('hex')
  const fullKey = `bc_${keyBody}`
  const keyHash = await hash(fullKey, 12)
  const keyPrefix = fullKey.substring(0, 11)  // "bc_xxxxxxxx"

  // Store via Drizzle ORM
  const db = getDb()
  const keyId = crypto.randomUUID()

  db.insert(apiKeys).values({
    id: keyId,
    userId: user.id,
    name: body.name || 'Untitled Key',
    keyHash,
    keyPrefix,
    expiresAt: body.expires_at || null,
  }).run()

  // Return full key ONCE — it cannot be retrieved again
  return {
    id: keyId,
    name: body.name || 'Untitled Key',
    key: fullKey,           // only time this is returned
    prefix: keyPrefix,
    expires_at: body.expires_at || null,
    warning: 'Save this key now. It cannot be retrieved again.',
  }
})
```

### 3.3 Updated Auth Middleware

The Phase 4 auth middleware adds API key validation alongside the existing session cookie auth. See Document 11, Section 5.5 for the complete implementation. Key changes from Phase 1:

```typescript
// server/middleware/auth.ts
import { verifyToken } from '../auth/jwt'
import { compare } from 'bcrypt'
import { getDb } from '../db'
import { apiKeys, users } from '../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Skip auth for public routes
  if (path === '/api/health') return
  if (path === '/api/auth/setup') return
  if (path === '/api/auth/login') return
  if (!path.startsWith('/api/')) return

  // Strategy 1: API Key (Bearer bc_xxx)
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer bc_')) {
    const apiKey = authHeader.replace('Bearer ', '')
    const user = await validateApiKey(apiKey)
    if (user) {
      event.context.user = user
      event.context.authMethod = 'api_key'
      return
    }
    throw createError({ statusCode: 401, message: 'Invalid API key' })
  }

  // Strategy 2: Session cookie (JWT)
  const token = getCookie(event, 'forgecrawl_session')
  if (token) {
    const payload = await verifyToken(token)
    if (payload) {
      event.context.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      }
      event.context.authMethod = 'session'
      return
    }
  }

  throw createError({ statusCode: 401, message: 'Authentication required' })
})

async function validateApiKey(key: string) {
  const db = getDb()
  const prefix = key.substring(0, 11)

  // Use key_prefix to narrow bcrypt comparisons
  const keys = db.select({
    keyId: apiKeys.id,
    keyHash: apiKeys.keyHash,
    expiresAt: apiKeys.expiresAt,
    userId: users.id,
    email: users.email,
    role: users.role,
  })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(eq(apiKeys.keyPrefix, prefix))
    .all()

  for (const k of keys) {
    // Skip expired keys
    if (k.expiresAt && new Date(k.expiresAt) < new Date()) continue

    if (await compare(key, k.keyHash)) {
      // Update last used timestamp
      db.update(apiKeys)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(apiKeys.id, k.keyId))
        .run()

      return { id: k.userId, email: k.email, role: k.role }
    }
  }
  return null
}
```

---

## 4. User Management

### 4.1 Admin Endpoints

```
GET    /api/admin/users           — List all users with usage stats
POST   /api/admin/users           — Create new user
GET    /api/admin/users/:id       — Get user detail
PUT    /api/admin/users/:id       — Update user (role, display_name)
PATCH  /api/admin/users/:id       — Disable/delete user
GET    /api/admin/users/:id/keys  — List user's API keys
DELETE /api/admin/keys/:id        — Revoke an API key
```

### 4.2 Admin Guard

```typescript
// server/utils/admin.ts
export function requireAdmin(event: any) {
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401, message: 'Authentication required' })
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }
}
```

### 4.3 Create User Flow

1. Admin fills in email, display name, role (user or admin), and a temporary password
2. Server creates user row in `users` table with bcrypt-hashed password and specified role
3. Admin shares temporary password with new user securely (out of band)
4. New user logs in with temporary password
5. (Future enhancement: password change endpoint so users can update their own password)

---

## 5. Usage Tracking

### 5.1 Database Schema

The `usage_log` table is already defined in the master Drizzle schema (Document 11, `server/db/schema.ts`):

```typescript
// Already in server/db/schema.ts
export const usageLog = sqliteTable('usage_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),       // 'scrape', 'crawl', 'api_call'
  url: text('url'),
  pagesCount: integer('pages_count').default(1),
  storageBytes: integer('storage_bytes').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
```

**Note:** SQLite does not support `MATERIALIZED VIEW` or `FILTER (WHERE ...)`. Usage stats are computed via application-level queries:

```typescript
// server/utils/usage-stats.ts
import { getDb } from '../db'
import { usageLog } from '../db/schema'
import { eq, sql, count, sum } from 'drizzle-orm'

export function getUserStats(userId: string) {
  const db = getDb()
  return db.select({
    totalActions: count(),
    totalScrapes: sql<number>`SUM(CASE WHEN action = 'scrape' THEN 1 ELSE 0 END)`,
    totalCrawls: sql<number>`SUM(CASE WHEN action = 'crawl' THEN 1 ELSE 0 END)`,
    totalPages: sum(usageLog.pagesCount),
    totalStorageBytes: sum(usageLog.storageBytes),
    lastActiveAt: sql<string>`MAX(created_at)`,
  })
    .from(usageLog)
    .where(eq(usageLog.userId, userId))
    .get()
}
```

### 5.2 Usage Logging

Log every API action automatically:

```typescript
// server/utils/usage.ts
import { getDb } from '../db'
import { usageLog } from '../db/schema'

export function logUsage(event: any, action: string, details: {
  url?: string
  pagesCount?: number
  storageBytes?: number
}) {
  const db = getDb()
  db.insert(usageLog).values({
    userId: event.context.user.id,
    action,
    url: details.url,
    pagesCount: details.pagesCount || 1,
    storageBytes: details.storageBytes || 0,
  }).run()
}
```

### 5.3 Per-User Rate Limiting

```typescript
// Configurable in app_config
{
  "rate_limits": {
    "default": {
      "scrapes_per_hour": 60,
      "crawls_per_hour": 5,
      "max_pages_per_crawl": 100
    },
    "admin": {
      "scrapes_per_hour": -1,    // unlimited
      "crawls_per_hour": -1,
      "max_pages_per_crawl": 500
    }
  }
}
```

---

## 6. UI Updates

### 6.1 API Keys Page

`app/pages/admin/api-keys.vue` (for own keys) and admin view for all keys:

- Generate new key form (name, optional expiration date)
- Key displayed once in a modal with copy button and strong warning
- Key list: name, prefix, created date, last used, expiration
- Revoke button with confirmation

### 6.2 User Management Page

`app/pages/admin/users.vue`:

- User table: email, display name, role, created date, last active, scrape count
- Create user button and modal
- Inline role toggle (user/admin)
- Disable/delete user with confirmation
- Click user row to see detailed usage stats

### 6.3 Usage Dashboard

Enhanced dashboard showing:

- Total scrapes (all users, last 24h / 7d / 30d)
- Per-user breakdown chart
- Top scraped domains
- Storage usage by user

---

## 7. API Documentation

### 7.1 Auto-Generated Docs Page

`app/pages/docs.vue` — Public-facing (after auth) API reference.

Document all endpoints:

```
POST /api/scrape
  Headers: Authorization: Bearer bc_xxx
  Body: { url, config }
  Response: { job_id, status }

POST /api/crawl
  Headers: Authorization: Bearer bc_xxx
  Body: { url, max_depth, max_pages, ... }
  Response: { job_id, status }

GET /api/jobs/:id
  Response: { id, status, progress }

GET /api/jobs/:id/progress
  Response: { total, completed, failed, pending }

GET /api/results/:id
  Response: { url, title, markdown, metadata }
```

### 7.2 cURL Examples

Include copy-pasteable examples for every endpoint:

```bash
# Scrape a single URL
curl -X POST https://forgecrawl.yourdomain.com/api/scrape \
  -H "Authorization: Bearer bc_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article", "config": {"render_js": true}}'

# Start a crawl
curl -X POST https://forgecrawl.yourdomain.com/api/crawl \
  -H "Authorization: Bearer bc_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "max_depth": 2, "max_pages": 50}'

# Check job progress
curl https://forgecrawl.yourdomain.com/api/jobs/JOB_ID/progress \
  -H "Authorization: Bearer bc_your_api_key_here"
```

---

## 8. Testing Checklist

- [ ] API key generation returns full key exactly once
- [ ] Subsequent API key queries show only prefix
- [ ] API key auth: `curl` with `Bearer bc_xxx` header succeeds
- [ ] Expired API keys are rejected
- [ ] Revoked API keys are rejected
- [ ] Admin can create new users
- [ ] Admin can share temp password with new user securely
- [ ] New users can log in with admin-provided password
- [ ] Users can only see their own scrapes/jobs
- [ ] Admin can see all users' scrapes/jobs
- [ ] Usage logging records all actions
- [ ] Per-user rate limiting enforces limits
- [ ] Admin rate limits are separate from user limits
- [ ] User management page shows accurate stats
- [ ] API docs page is accurate and examples work
- [ ] Disabling a user invalidates their sessions and API keys

---

## 9. Known Limitations (Phase 4)

- **No OAuth/SSO:** Email + password only. OAuth is a future enhancement.
- **No team/organization model:** Flat user list, no groups. Sufficient for small deployments.
- **Rate limit by count only:** No bandwidth-based limiting. Future enhancement.
- **API key rotation:** No automatic rotation. User must manually create new key and revoke old one.

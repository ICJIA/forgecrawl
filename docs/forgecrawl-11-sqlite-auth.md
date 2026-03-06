# ForgeCrawl -- Document 11: SQLite-First Architecture (Supabase Optional)

**Version:** 1.0
**Date:** March 3, 2026
**Impact:** Replaces Supabase as default. Affects docs 00-07, 10.

---

## 1. The Problem with Supabase as Default

The original design required a Supabase paid tier ($25/mo) for auth and database. For a solo developer who just wants to scrape some websites into Markdown, this means:

- Creating a Supabase account before you can use ForgeCrawl
- Managing an external cloud dependency for a self-hosted tool
- Paying $25/mo for auth on a single-user app
- Network latency on every database query (your droplet talks to Supabase servers)
- If Supabase has an outage, your local scraper stops working

This defeats the "self-hosted, five-minute deploy" philosophy.

---

## 2. The Solution: SQLite + Built-in Auth

ForgeCrawl ships with **SQLite as the default database** and a **built-in authentication system**. No external services required. The entire application -- auth, database, job queue, scrape storage -- lives in a single SQLite file on disk.

Supabase becomes an **optional backend** for teams who want managed Postgres, RLS, and multi-user features at scale.

### What Changes

| Concern | Before (Supabase) | After (SQLite default) |
|---------|-------------------|----------------------|
| Database | Supabase Postgres (cloud) | SQLite file on disk |
| Auth | Supabase GoTrue (cloud) | Built-in bcrypt + JWT |
| Sessions | Supabase JWT | Self-issued JWT via jose |
| RLS | Supabase Row Level Security | Application-level middleware |
| Connection | Network (HTTPS to Supabase) | Local file I/O (microseconds) |
| Backup | Supabase dashboard | Copy one .sqlite file |
| Cost | $25/mo minimum | $0 |
| Setup | Create Supabase project, get keys, run migrations | Nothing. First run creates DB. |

### What Stays the Same

- All API routes, request/response shapes
- Auth middleware pattern (JWT validation on /api/*)
- First-run admin registration flow
- API key system (bcrypt hashed)
- Scrape engine pipeline (fetch, extract, convert, chunk)
- Docker Compose deployment
- PM2 bare-metal deployment

---

## 3. Tech Stack Update

| Layer | Old | New (Default) | New (Optional) |
|-------|-----|---------------|----------------|
| Database | Supabase Postgres | better-sqlite3 via Drizzle ORM | Supabase Postgres via Drizzle |
| Auth | @nuxtjs/supabase | Built-in (bcrypt + jose JWT) | Supabase GoTrue |
| ORM | Raw Supabase client | Drizzle ORM (SQLite driver) | Drizzle ORM (Postgres driver) |
| Session | Supabase session | HTTP-only cookie with JWT | Supabase session |
| Migration | Supabase SQL editor | Drizzle Kit (push/migrate) | Drizzle Kit |

### New Dependencies

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.36.0",
    "bcrypt": "^5.1.1",
    "jose": "^5.9.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/bcrypt": "^5.0.0"
  }
}
```

### Removed Dependencies (no longer required by default)

```
@nuxtjs/supabase
@supabase/supabase-js
```

---

## 4. Database Schema (Drizzle ORM + SQLite)

```typescript
// server/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// App configuration (first-run detection, settings)
export const appConfig = sqliteTable('app_config', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// Users (built-in auth)
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// API Keys
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  lastUsedAt: text('last_used_at'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Scrape Jobs
export const scrapeJobs = sqliteTable('scrape_jobs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  url: text('url').notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
  }).notNull().default('pending'),
  jobType: text('job_type', {
    enum: ['single', 'crawl', 'batch']
  }).notNull().default('single'),
  config: text('config', { mode: 'json' }).default('{}'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  errorMessage: text('error_message'),
  pagesDiscovered: integer('pages_discovered').default(0),
  pagesCompleted: integer('pages_completed').default(0),
  pagesFailed: integer('pages_failed').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Scrape Results
export const scrapeResults = sqliteTable('scrape_results', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text('job_id').notNull().references(() => scrapeJobs.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: text('title'),
  markdown: text('markdown'),
  rawHtml: text('raw_html'),
  filePath: text('file_path'),
  wordCount: integer('word_count'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// RAG Chunks
export const scrapeChunks = sqliteTable('scrape_chunks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resultId: text('result_id').notNull()
    .references(() => scrapeResults.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Job Queue
export const jobQueue = sqliteTable('job_queue', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text('job_id').notNull().references(() => scrapeJobs.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  priority: integer('priority').default(0),
  attempts: integer('attempts').default(0),
  maxAttempts: integer('max_attempts').default(3),
  config: text('config', { mode: 'json' }).default('{}'),
  depth: integer('depth').default(0),
  scheduledFor: text('scheduled_for').default(sql`(datetime('now'))`),
  lockedBy: text('locked_by'),
  lockedAt: text('locked_at'),
  completedAt: text('completed_at'),
  failedAt: text('failed_at'),
  error: text('error'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

// Site Credentials (encrypted at rest)
export const siteCredentials = sqliteTable('site_credentials', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  domain: text('domain').notNull(),
  name: text('name').notNull(),
  authType: text('auth_type', { enum: ['cookies', 'form_login'] }).notNull(),
  cookiesEncrypted: text('cookies_encrypted'),
  loginUrl: text('login_url'),
  usernameEncrypted: text('username_encrypted'),
  passwordEncrypted: text('password_encrypted'),
  usernameSelector: text('username_selector'),
  passwordSelector: text('password_selector'),
  submitSelector: text('submit_selector'),
  successIndicator: text('success_indicator'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

// Usage Log
export const usageLog = sqliteTable('usage_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  url: text('url'),
  pagesCount: integer('pages_count').default(1),
  storageBytes: integer('storage_bytes').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})
```

### Database Initialization

```typescript
// server/db/index.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { join } from 'path'

let db: ReturnType<typeof drizzle>

export function getDb() {
  if (db) return db

  const dataDir = process.env.NUXT_DATA_DIR || './data'
  const dbPath = join(dataDir, 'forgecrawl.sqlite')

  const sqlite = new Database(dbPath)

  // Performance pragmas for production use
  sqlite.pragma('journal_mode = WAL')        // Write-Ahead Logging
  sqlite.pragma('synchronous = NORMAL')      // Safe with WAL
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')       // Wait up to 5s on locks
  sqlite.pragma('cache_size = -64000')       // 64MB cache

  db = drizzle(sqlite, { schema })

  // Auto-migrate on startup
  migrate(db, { migrationsFolder: './server/db/migrations' })

  return db
}
```

**Why WAL mode matters:** SQLite in WAL (Write-Ahead Logging) mode supports concurrent reads during writes. The queue worker can write results while the API serves read requests without blocking. For a single-server scraper with one writer thread, WAL eliminates virtually all contention.

---

## 5. Built-in Authentication System

### 5.1 Password Hashing

```typescript
// server/auth/password.ts
import { hash, compare } from 'bcrypt'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return compare(password, hashedPassword)
}
```

### 5.2 JWT Token Management

```typescript
// server/auth/jwt.ts
import { SignJWT, jwtVerify } from 'jose'

function getSecret() {
  const secret = process.env.NUXT_AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('NUXT_AUTH_SECRET must be at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export async function createToken(user: {
  id: string
  email: string
  role: string
}): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as { sub: string; email: string; role: string }
  } catch {
    return null
  }
}
```

### 5.3 First-Run Admin Setup

```typescript
// server/api/auth/setup.post.ts
import { getDb } from '../../db'
import { appConfig, users } from '../../db/schema'
import { hashPassword } from '../../auth/password'
import { createToken } from '../../auth/jwt'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  // Atomic check: is setup already complete?
  const existing = db.select().from(appConfig)
    .where(eq(appConfig.key, 'setup_complete'))
    .get()

  if (existing) {
    throw createError({ statusCode: 403, message: 'Setup already complete' })
  }

  // Validate
  if (!body.email || !body.password || body.password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Email and password (min 8 chars) required'
    })
  }

  const passwordHash = await hashPassword(body.password)
  const userId = crypto.randomUUID()

  // Create admin user
  db.insert(users).values({
    id: userId,
    email: body.email,
    passwordHash,
    displayName: body.displayName || body.email,
    role: 'admin',
  }).run()

  // Mark setup complete (permanently)
  db.insert(appConfig).values({
    key: 'setup_complete',
    value: JSON.stringify({
      completedAt: new Date().toISOString(),
      adminId: userId,
    }),
  }).run()

  // Issue session
  const token = await createToken({
    id: userId, email: body.email, role: 'admin',
  })

  setCookie(event, 'forgecrawl_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return {
    success: true,
    user: { id: userId, email: body.email, role: 'admin' },
  }
})
```

### 5.4 Login Endpoint

```typescript
// server/api/auth/login.post.ts
import { getDb } from '../../db'
import { users } from '../../db/schema'
import { verifyPassword } from '../../auth/password'
import { createToken } from '../../auth/jwt'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = getDb()
  const body = await readBody(event)

  if (!body.email || !body.password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const user = db.select().from(users)
    .where(eq(users.email, body.email))
    .get()

  if (!user) {
    // Constant-time: still hash to prevent timing attacks
    await verifyPassword(body.password, '$2b$12$invalidhashpaddingthatislong')
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const valid = await verifyPassword(body.password, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const token = await createToken({
    id: user.id, email: user.email, role: user.role,
  })

  setCookie(event, 'forgecrawl_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return {
    success: true,
    user: { id: user.id, email: user.email, role: user.role },
  }
})
```

### 5.5 Auth Middleware (Dual: Session Cookie + API Key)

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
    if (k.expiresAt && new Date(k.expiresAt) < new Date()) continue
    if (await compare(key, k.keyHash)) {
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

## 6. Security: SQLite Auth vs Supabase

| Concern | Supabase | SQLite Built-in | Notes |
|---------|----------|-----------------|-------|
| Password storage | bcrypt (GoTrue) | bcrypt (12 rounds) | Equivalent |
| Session tokens | Supabase JWT | Self-issued JWT (jose HS256) | Equivalent |
| Token storage | localStorage (Supabase default) | HTTP-only cookie | **SQLite is more secure** -- immune to XSS token theft |
| CSRF protection | N/A (token in header) | SameSite=Lax cookie | Adequate: blocks cross-origin POST mutations. GET requests and same-site subdomain requests are not protected, but all ForgeCrawl mutations are POST. |
| Brute force | Supabase built-in | App-level: 5 failures per IP per 15min | Must implement |
| SQL injection | PostgREST (parameterized) | Drizzle ORM (parameterized) | Equivalent |
| Encryption at rest | Supabase manages | File permissions (600) + optional volume encryption | App responsibility |
| Password reset | Supabase email flow | Admin resets manually | Acceptable for small teams |

### Security Requirements

1. `NUXT_AUTH_SECRET` must be at least 32 random characters
2. bcrypt with 12 salt rounds for all passwords
3. HTTP-only, Secure, SameSite=Lax cookies for sessions
4. JWT expiry at 7 days
5. Login rate limiting: max 5 failed attempts per email per 15 minutes
6. SQLite file permissions: 600 (owner read/write only)
7. Auto-generate `NUXT_AUTH_SECRET` on first Docker start if not provided:

```bash
# In entrypoint.sh
if [ -z "$NUXT_AUTH_SECRET" ]; then
  export NUXT_AUTH_SECRET=$(openssl rand -base64 48)
  echo "NUXT_AUTH_SECRET=$NUXT_AUTH_SECRET" >> /app/data/.env.generated
  echo "[ForgeCrawl] Auth secret auto-generated. Saved to /app/data/.env.generated"
fi
```

---

## 7. Updated Environment Variables

```bash
# === Auth (required -- auto-generated if empty) ===
NUXT_AUTH_SECRET=

# === Storage ===
NUXT_STORAGE_MODE=both
NUXT_DATA_DIR=./data            # SQLite DB + scrape files

# === Scraping ===
NUXT_PUPPETEER_CONCURRENCY=3
NUXT_SCRAPE_TIMEOUT=30000
NUXT_SCRAPE_USER_AGENT=ForgeCrawl/1.0
NUXT_CACHE_TTL=3600

# === Server ===
PORT=3000

# === Optional: Supabase (replaces SQLite) ===
# NUXT_DB_BACKEND=supabase
# NUXT_SUPABASE_URL=https://xxx.supabase.co
# NUXT_SUPABASE_KEY=eyJ...
# NUXT_SUPABASE_SERVICE_KEY=eyJ...
```

---

## 8. Database Backend Abstraction

```typescript
// server/db/backend.ts
export type DbBackend = 'sqlite' | 'supabase'

export function getDbBackend(): DbBackend {
  return (process.env.NUXT_DB_BACKEND as DbBackend) || 'sqlite'
}
```

All server code uses Drizzle ORM. Switching from SQLite to Supabase/Postgres is a config change (`NUXT_DB_BACKEND=supabase`), not a code change. The schema definitions use Drizzle's dialect system to swap between `sqliteTable` and `pgTable` at the driver level.

---

## 9. Updated Docker Compose (Zero External Dependencies)

```yaml
name: forgecrawl

services:
  app:
    build:
      context: .
      dockerfile: packages/app/Dockerfile
    ports:
      - "${PORT:-3000}:3000"
    environment:
      NUXT_AUTH_SECRET: ${NUXT_AUTH_SECRET:-}
      NUXT_STORAGE_MODE: ${NUXT_STORAGE_MODE:-both}
      NUXT_DATA_DIR: /app/data
      NUXT_PUPPETEER_EXECUTABLE: /usr/bin/chromium
      NUXT_PUPPETEER_CONCURRENCY: ${NUXT_PUPPETEER_CONCURRENCY:-3}
      NUXT_SCRAPE_TIMEOUT: ${NUXT_SCRAPE_TIMEOUT:-30000}
      NUXT_CACHE_TTL: ${NUXT_CACHE_TTL:-3600}
    volumes:
      - forgecrawl-data:/app/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 4G
        reservations:
          memory: 2G

volumes:
  forgecrawl-data:
    driver: local
```

### Updated Quick Start (Now truly 2 commands)

```bash
git clone https://github.com/cschweda/forgecrawl
cd forgecrawl
docker compose up -d

# Visit http://localhost:3000
# Register admin account on first visit
# Start scraping
```

No `.env` file needed for basic use. Auth secret auto-generates. SQLite auto-creates in the Docker volume. Clone and run.

---

## 10. SQLite Limits and When to Upgrade

### SQLite Is Fine For

- Solo developer or small team (1-5 users)
- Under 10,000 scrape results
- Single server deployment
- Under 50 concurrent API requests
- Database under 10GB

### Consider Supabase When

- Many users needing isolated permissions
- Database exceeds 10GB
- Need managed backups and point-in-time recovery
- Need connection pooling for many concurrent clients
- Want Supabase dashboard for DB management

### Migration Path: SQLite to Supabase

```bash
# 1. Export
pnpm --filter @forgecrawl/app run db:export --format sql

# 2. Set up Supabase, run Drizzle migrations
pnpm --filter @forgecrawl/app run db:migrate --backend supabase

# 3. Import
pnpm --filter @forgecrawl/app run db:import --backend supabase --file export.sql

# 4. Update config
echo 'NUXT_DB_BACKEND=supabase' >> .env
echo 'NUXT_SUPABASE_URL=...' >> .env

# 5. Restart
docker compose restart
```

---

## 11. Impact on Existing Documents

**All Phase Docs (01-05):** Replace Supabase client calls with Drizzle ORM calls. Replace `serverSupabaseServiceRole(event)` with `getDb()`. Replace `client.from('table').select()` with `db.select().from(table)`.

**Master Doc (00):** Database row becomes "SQLite (default) / Postgres (optional)". Auth becomes "Built-in bcrypt + JWT (default) / Supabase GoTrue (optional)". Remove `@nuxtjs/supabase` as required. Add Drizzle ORM.

**Security Doc (06):** Add SQLite file permissions, WAL mode. Note HTTP-only cookies are more secure than Supabase localStorage tokens.

**LLM Build Prompt (07):** Remove Supabase setup from Phase 1 prerequisites. Add "Database auto-creates on first run. No external services."

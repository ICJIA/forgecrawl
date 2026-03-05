# ForgeCrawl — Phase 1: Foundation & Auth

**Version:** 1.0  
**Date:** March 3, 2026  
**Depends on:** Nothing (greenfield)  
**Deliverable:** Working app with first-run admin setup and basic single-URL scraping

---

## 1. Phase 1 Goal

Stand up the Nuxt 4 monorepo with SQLite database, built-in bcrypt/JWT authentication, implement the first-run admin registration flow, and deliver a basic single-URL scraper that fetches a page via HTTP and returns clean Markdown. At the end of this phase, you can run `docker compose up -d` on a DO droplet, visit the URL, register an admin account, log in, paste a URL, and get Markdown back. No external services required.

---

## 2. Scope

### In Scope

- Nuxt 4 pnpm monorepo scaffold (packages/app + packages/web)
- SQLite database with Drizzle ORM (auto-creates on first run)
- Database schema: `app_config`, `users`, `api_keys`, `scrape_jobs`, `scrape_results`
- Built-in auth: bcrypt password hashing + jose JWT tokens
- First-run detection and `/setup` admin registration page
- Login/logout flow with HTTP-only session cookies
- Client-side auth middleware (redirect unauthenticated users)
- Server-side auth middleware (protect all `/api/*` routes)
- Basic scrape endpoint: `POST /api/scrape` accepting a URL
- HTTP-only fetch (no Puppeteer yet) using native `fetch` or `ofetch`
- HTML-to-Markdown conversion via Turndown + GFM plugin
- Simple dashboard page with scrape form and result display
- Scrape history list (stored in SQLite via Drizzle ORM)
- Health check endpoint: `GET /api/health`
- Result caching: return cached result for same URL within configurable TTL (`NUXT_CACHE_TTL`)
- SSRF protection: URL validation blocking private IPs, localhost, cloud metadata, non-HTTP protocols
- Login rate limiting: max 5 failed attempts per email per 15 minutes
- Docker Compose deployment config
- PM2 deployment config (bare-metal alternative)
- `.env.example` with all required variables

### Out of Scope (Later Phases)

- Puppeteer / JS rendering (Phase 2)
- Filesystem storage (Phase 2)
- Job queue (Phase 3)
- Site crawling (Phase 3)
- API key auth (Phase 4)
- Multi-user management (Phase 4)
- RAG chunking (Phase 5)

---

## 3. Setup & Initialization

### 3.1 Project Bootstrap

```bash
mkdir forgecrawl && cd forgecrawl
pnpm init

# Create monorepo workspace
cat > pnpm-workspace.yaml << EOF
packages:
  - 'packages/*'
EOF

# Scaffold the app package
mkdir -p packages/app packages/web
cd packages/app
pnpm dlx nuxi@latest init .
pnpm add better-sqlite3 drizzle-orm bcrypt jose
pnpm add turndown turndown-plugin-gfm cheerio @mozilla/readability jsdom
pnpm add @nuxt/ui
pnpm add -D drizzle-kit @types/better-sqlite3 @types/bcrypt
```

### 3.2 Nuxt Configuration

```typescript
// packages/app/nuxt.config.ts
import { config, toRuntimeConfig } from '../../forgecrawl.config'

export default defineNuxtConfig({
  compatibilityDate: '2025-03-01',
  future: { compatibilityVersion: 4 },
  modules: ['@nuxt/ui'],

  // Nuxt UI 4 uses @nuxt/ui module which auto-configures:
  //   - @nuxt/icon
  //   - @nuxtjs/tailwindcss (or the built-in CSS engine)
  //   - @nuxtjs/color-mode
  // Ensure the module is listed and CSS loads by verifying
  // components render with proper Nuxt UI styles on first run.

  css: ['~/assets/css/main.css'],  // App-level overrides if needed

  // All public defaults imported from forgecrawl.config.ts.
  // Secrets (NUXT_AUTH_SECRET, etc.) come from .env via Nuxt's auto-mapping.
  runtimeConfig: toRuntimeConfig(),

  nitro: {
    preset: 'node-server',
  },
})
```

> **Note:** All public configuration defaults (ports, timeouts, storage mode, concurrency, etc.) are defined in `forgecrawl.config.ts` at the monorepo root. The `toRuntimeConfig()` helper maps them into Nuxt's `runtimeConfig` format. Secret values (`NUXT_AUTH_SECRET`, `NUXT_ENCRYPTION_KEY`) are loaded from `.env` at runtime via Nuxt's automatic `NUXT_*` environment variable mapping. Never hardcode secrets in `forgecrawl.config.ts`.

### 3.3 Database Setup

No external setup required. The SQLite database auto-creates on first run.

The schema is defined in `packages/app/server/db/schema.ts` using Drizzle ORM (see Document 11 for complete schema). The database initialization file (`packages/app/server/db/index.ts`) creates the SQLite file, sets WAL mode pragmas, and runs Drizzle migrations automatically on startup.

### 3.4 Phase 1 Schema (Drizzle ORM)

```typescript
// packages/app/server/db/schema.ts
// See Document 11 for the complete schema definition.
// Phase 1 tables: app_config, users, api_keys, scrape_jobs, scrape_results
// All tables use text IDs (crypto.randomUUID()), text timestamps,
// and JSON columns via { mode: 'json' }.
```

Database initialization:

```typescript
// packages/app/server/db/index.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { join } from 'path'

let db: ReturnType<typeof drizzle>

export function getDb() {
  if (db) return db

  const config = useRuntimeConfig()
  const dataDir = config.dataDir || './data'
  const dbPath = join(dataDir, 'forgecrawl.sqlite')

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('cache_size = -64000')

  db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './server/db/migrations' })

  return db
}
```

---

## 4. First-Run Registration Flow

### 4.1 Detection Logic

The app checks whether setup is complete on every page load via a client-side middleware and on every API call via server middleware.

```typescript
// server/utils/setup.ts
import { getDb } from '../db'
import { appConfig } from '../db/schema'
import { eq } from 'drizzle-orm'

export function isSetupComplete(): boolean {
  const db = getDb()
  const row = db.select().from(appConfig)
    .where(eq(appConfig.key, 'setup_complete'))
    .get()
  return !!row
}
```

### 4.2 Setup Page

`app/pages/setup.vue` — Only accessible when `setup_complete` is not set.

**Behavior:**
1. On mount, check if setup is already complete. If yes, redirect to `/`.
2. Display a registration form: email, password, confirm password, display name.
3. On submit:
   a. Call `POST /api/auth/setup` with credentials
   b. Server validates no existing admin exists
   c. Server hashes password with bcrypt, creates user row with `role: 'admin'`
   d. Server sets `app_config.setup_complete = true`
   e. Server issues JWT session cookie
   f. Redirect to dashboard

### 4.3 Setup API Endpoint

```typescript
// server/api/auth/setup.post.ts
import { getDb } from '../../db'
import { appConfig, users } from '../../db/schema'
import { hashPassword } from '../../auth/password'
import { createToken } from '../../auth/jwt'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = getDb()

  // 1. Check setup not already complete
  const existing = db.select().from(appConfig)
    .where(eq(appConfig.key, 'setup_complete'))
    .get()

  if (existing) {
    throw createError({ statusCode: 403, message: 'Setup already completed' })
  }

  // 2. Validate input
  const body = await readBody(event)
  if (!body.email || !body.password || body.password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Email and password (min 8 chars) required',
    })
  }

  // 3. Create admin user with hashed password
  const passwordHash = await hashPassword(body.password)
  const userId = crypto.randomUUID()

  db.insert(users).values({
    id: userId,
    email: body.email,
    passwordHash,
    displayName: body.displayName || body.email,
    role: 'admin',
  }).run()

  // 4. Mark setup complete (permanently)
  db.insert(appConfig).values({
    key: 'setup_complete',
    value: JSON.stringify({
      completedAt: new Date().toISOString(),
      adminId: userId,
    }),
  }).run()

  // 5. Issue JWT session cookie
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

  return { success: true, user: { id: userId, email: body.email, role: 'admin' } }
})
```

### 4.4 Client Middleware

```typescript
// app/middleware/setup.global.ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/setup') return

  // Check if setup is complete via API
  try {
    await $fetch('/api/auth/me')
  } catch (err: any) {
    if (err?.statusCode === 401) {
      // Auth required but not available -- check if setup done
      try {
        const { setup_complete } = await $fetch('/api/health')
        if (!setup_complete) return navigateTo('/setup')
      } catch {
        // Health check failed, let it through
      }
    }
  }
})
```

---

## 5. Scraping Engine (Phase 1 — HTTP Only)

### 5.1 Scrape Endpoint

```typescript
// server/api/scrape.post.ts
import { getDb } from '../db'
import { scrapeJobs, scrapeResults } from '../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user  // set by auth middleware
  const body = await readBody(event)

  // Validate URL
  const url = validateUrl(body.url)

  const db = getDb()
  const jobId = crypto.randomUUID()

  // Create job record
  db.insert(scrapeJobs).values({
    id: jobId,
    userId: user.id,
    url,
    status: 'running',
    jobType: 'single',
    config: body.config || {},
    startedAt: new Date().toISOString(),
  }).run()

  try {
    // Run scrape pipeline
    const result = await scrape(url, body.config || {})

    // Store result
    db.insert(scrapeResults).values({
      jobId,
      url,
      title: result.title,
      markdown: result.markdown,
      wordCount: result.wordCount,
      metadata: result.metadata,
    }).run()

    // Update job status
    db.update(scrapeJobs).set({
      status: 'completed',
      completedAt: new Date().toISOString(),
    }).where(eq(scrapeJobs.id, jobId)).run()

    return { job_id: jobId, ...result }
  } catch (err: any) {
    db.update(scrapeJobs).set({
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date().toISOString(),
    }).where(eq(scrapeJobs.id, jobId)).run()

    throw createError({ statusCode: 500, message: err.message })
  }
})
```

### 5.2 Scraper Module

```typescript
// server/engine/scraper.ts
import { fetchPage } from './fetcher'
import { extractContent } from './extractor'
import { toMarkdown } from './converter'

export interface ScrapeConfig {
  include_links?: boolean
  include_images?: boolean
  selectors?: {
    include?: string
    exclude?: string
  }
}

export interface ScrapeResult {
  title: string
  markdown: string
  wordCount: number
  metadata: Record<string, any>
}

export async function scrape(url: string, config: ScrapeConfig): Promise<ScrapeResult> {
  // Step 1: Fetch raw HTML
  const html = await fetchPage(url)

  // Step 2: Extract article content
  const extracted = extractContent(html, url, config)

  // Step 3: Convert to Markdown
  const markdown = toMarkdown(extracted.content, config)

  return {
    title: extracted.title,
    markdown,
    wordCount: markdown.split(/\s+/).length,
    metadata: {
      url,
      excerpt: extracted.excerpt,
      byline: extracted.byline,
      siteName: extracted.siteName,
      scrapedAt: new Date().toISOString(),
    },
  }
}
```

### 5.3 Fetcher (HTTP Only in Phase 1)

```typescript
// server/engine/fetcher.ts
export async function fetchPage(url: string): Promise<string> {
  const config = useRuntimeConfig()

  const response = await $fetch.raw(url, {
    headers: {
      'User-Agent': config.scrapeUserAgent,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: config.scrapeTimeout,
    redirect: 'follow',
  })

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) {
    throw new Error(`Unsupported content type: ${contentType}`)
  }

  return response._data as string
}
```

### 5.4 Extractor (Readability)

```typescript
// server/engine/extractor.ts
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import * as cheerio from 'cheerio'

export function extractContent(html: string, url: string, config: ScrapeConfig) {
  // Pre-process: remove excluded selectors
  let processedHtml = html
  if (config.selectors?.exclude) {
    const $ = cheerio.load(html)
    $(config.selectors.exclude).remove()
    processedHtml = $.html()
  }

  // Use Readability for content extraction
  const dom = new JSDOM(processedHtml, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()

  if (!article) {
    throw new Error('Could not extract content from page')
  }

  return {
    title: article.title,
    content: article.content,       // clean HTML
    excerpt: article.excerpt,
    byline: article.byline,
    siteName: article.siteName,
  }
}
```

### 5.5 Converter (Turndown)

```typescript
// server/engine/converter.ts
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

export function toMarkdown(html: string, config: ScrapeConfig): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  })

  turndown.use(gfm)

  // Remove images if not requested
  if (!config.include_images) {
    turndown.addRule('removeImages', {
      filter: 'img',
      replacement: () => '',
    })
  }

  // Remove links if not requested (keep text)
  if (config.include_links === false) {
    turndown.addRule('removeLinks', {
      filter: 'a',
      replacement: (content) => content,
    })
  }

  let markdown = turndown.turndown(html)

  // Clean up excessive whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')

  return markdown
}
```

---

## 6. UI Pages

### 6.1 Dashboard (`app/pages/index.vue`)

The main page after login. Contains:

- **Scrape form:** URL input, submit button
- **Recent scrapes:** Table showing last 20 scrapes with URL, title, status, date
- **Result preview:** When a scrape completes or a row is clicked, show Markdown preview with copy-to-clipboard

### 6.2 Login (`app/pages/login.vue`)

Standard email/password form using built-in auth. Calls `POST /api/auth/login` which validates credentials via bcrypt and issues a JWT session cookie.

### 6.3 Setup (`app/pages/setup.vue`)

First-run admin registration. See section 4.2.

### 6.4 Scrape Detail (`app/pages/scrapes/[id].vue`)

Full view of a scrape result:
- Original URL (linked)
- Extracted title
- Metadata (word count, date, byline)
- Full Markdown output with syntax highlighting
- Copy to clipboard button
- Raw HTML toggle (for debugging)

---

## 7. Server Auth Middleware

See Document 11, Section 5.5 for the full dual-auth middleware (session cookie + API key). The Phase 1 version below handles session cookies only (API key support added in Phase 4):

```typescript
// server/middleware/auth.ts
import { verifyToken } from '../auth/jwt'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Skip auth for public routes
  if (path === '/api/health') return
  if (path === '/api/auth/setup') return
  if (path === '/api/auth/login') return
  if (!path.startsWith('/api/')) return

  // Session cookie (JWT)
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
```

---

## 8. SSRF URL Validation

All user-submitted URLs must be validated before fetching. This is a critical security requirement.

```typescript
// server/utils/url.ts
import { resolve } from 'dns/promises'

const BLOCKED_HOSTS = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '[::1]',
  'metadata.google.internal',
  'metadata.internal',
])

const BLOCKED_IP_RANGES = [
  /^127\./,                    // Loopback
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local / cloud metadata
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // Shared address space
  /^::1$/,                     // IPv6 loopback
  /^f[cd]/i,                   // IPv6 private
  /^fe80/i,                    // IPv6 link-local
]

export function validateUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid URL' })
  }

  // Block non-HTTP(S) protocols
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw createError({
      statusCode: 400,
      message: `Blocked protocol: ${url.protocol}. Only http: and https: are allowed.`,
    })
  }

  // Block known dangerous hostnames
  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(hostname)) {
    throw createError({ statusCode: 400, message: 'Blocked host' })
  }

  // Block cloud metadata IP directly in URL
  if (hostname === '169.254.169.254') {
    throw createError({ statusCode: 400, message: 'Blocked: cloud metadata endpoint' })
  }

  return url.href
}

export async function validateUrlWithDns(input: string): Promise<string> {
  const href = validateUrl(input)
  const url = new URL(href)

  // Resolve DNS and check resolved IP against blocklists
  try {
    const addresses = await resolve(url.hostname)
    for (const addr of addresses) {
      if (BLOCKED_IP_RANGES.some(pattern => pattern.test(addr))) {
        throw createError({
          statusCode: 400,
          message: 'URL resolves to a blocked IP range',
        })
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err  // Re-throw our own errors
    // DNS resolution failure — allow through (may be a valid hostname
    // that the fetcher can reach but dns/promises cannot resolve)
  }

  return href
}
```

The scrape endpoint (`POST /api/scrape`) calls `validateUrlWithDns(body.url)` before fetching. The synchronous `validateUrl()` is available for cases where DNS resolution is not needed (e.g., validating URL format in the UI).

---

## 9. Result Caching

When the same URL is scraped within a configurable TTL window, return the cached result instead of re-fetching.

```typescript
// server/engine/cache.ts
import { getDb } from '../db'
import { scrapeResults } from '../db/schema'
import { eq, gte, desc, and } from 'drizzle-orm'

export function getCachedResult(url: string, ttlSeconds: number) {
  if (ttlSeconds <= 0) return null

  const cutoff = new Date(Date.now() - ttlSeconds * 1000).toISOString()
  const db = getDb()

  const result = db.select().from(scrapeResults)
    .where(
      and(
        eq(scrapeResults.url, url),
        gte(scrapeResults.createdAt, cutoff)
      )
    )
    .orderBy(desc(scrapeResults.createdAt))
    .limit(1)
    .get()

  return result || null
}
```

**Behavior:**
- When a cache hit occurs, the response includes `"cached": true` and `"cached_at"` timestamp
- Users can force a fresh scrape with `"bypass_cache": true` in the request body
- Controlled by env var `NUXT_CACHE_TTL=3600` (seconds, 0 to disable)

---

## 10. Login Rate Limiting

Prevent brute-force attacks on the login endpoint with in-memory rate limiting.

```typescript
// server/utils/login-limiter.ts
const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000  // 15 minutes

export function checkLoginRateLimit(email: string): void {
  const key = email.toLowerCase()
  const now = Date.now()
  const record = attempts.get(key)

  if (record) {
    if (now > record.resetAt) {
      // Window expired, reset
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
```

Used in the login endpoint:
```typescript
// In server/api/auth/login.post.ts
checkLoginRateLimit(body.email)  // throws 429 if exceeded
// ... validate credentials ...
if (!valid) {
  recordFailedLogin(body.email)
  throw createError({ statusCode: 401, message: 'Invalid credentials' })
}
clearLoginAttempts(body.email)  // reset on success
```

---

## 11. Testing Checklist

After Phase 1 is complete, verify:

- [ ] `pnpm dev` starts without errors
- [ ] First visit redirects to `/setup`
- [ ] Admin registration completes successfully
- [ ] Second visit to `/setup` after registration is blocked
- [ ] Login works with registered admin credentials
- [ ] Unauthenticated API requests return 401
- [ ] `POST /api/scrape` with a URL returns Markdown
- [ ] Test URLs produce clean, readable Markdown:
  - Simple article: `https://example.com`
  - News article: any major news site article URL
  - Documentation page: `https://nuxt.com/docs/getting-started/introduction`
- [ ] Scrape history shows in the dashboard
- [ ] Scrape detail page displays full Markdown
- [ ] Copy to clipboard works
- [ ] `GET /api/health` returns 200 without auth
- [ ] SSRF: `POST /api/scrape` with `http://127.0.0.1` returns 400
- [ ] SSRF: `POST /api/scrape` with `http://169.254.169.254` returns 400
- [ ] SSRF: `POST /api/scrape` with `file:///etc/passwd` returns 400
- [ ] Caching: second scrape of same URL within TTL returns `"cached": true`
- [ ] Caching: `"bypass_cache": true` forces fresh scrape
- [ ] Login rate limit: 6th failed login attempt returns 429
- [ ] App builds with `pnpm build`
- [ ] PM2 starts the built app successfully
- [ ] Nginx proxies requests correctly with SSL

---

## 9. Deployment Steps (Phase 1)

```bash
# On DO droplet
mkdir -p /opt/forgecrawl
cd /opt/forgecrawl

# Clone or upload code
git clone <repo> .

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# No .env editing required for basic use. Auth secret auto-generates.

# Build
pnpm build

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# Verify
curl http://localhost:3000/api/health
```

---

## 10. Known Limitations (Phase 1)

- **No JS rendering:** Pages requiring JavaScript will return incomplete content. Phase 2 adds Puppeteer.
- **No concurrent scraping:** Scrapes run synchronously in the request handler. Phase 3 adds the job queue.
- **SQLite-only storage:** All content stored in SQLite. Phase 2 adds filesystem option.
- **Single user:** Only the admin can use the system. Phase 4 adds multi-user.
- **No API key auth:** Browser session only. Phase 4 adds API keys.

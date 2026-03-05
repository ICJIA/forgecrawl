# ForgeCrawl — Phase 5: RAG Chunking & Advanced Features

**Version:** 1.0  
**Date:** March 3, 2026  
**Depends on:** Phase 4 (complete)  
**Deliverable:** Token-aware RAG chunking, login-gated site scraping, export formats, production hardening, and monitoring

---

## 1. Phase 5 Goal

Complete the feature set with LLM-optimized output: token-aware chunking with semantic boundaries and metadata for RAG pipelines. Add the ability to scrape login-gated sites by injecting cookies or credentials. Implement export formats (JSON, JSONL) for pipeline integration. Harden the application for production with monitoring, backups, and operational tooling.

---

## 2. Scope

### In Scope

- Token-aware content chunking (configurable max tokens, overlap)
- Semantic chunking by headings and paragraph boundaries
- Chunk metadata: heading context, position, source URL, token count
- Login-gated scraping: cookie injection, form-based login via Puppeteer
- Credential storage (encrypted, per-site)
- Export formats: JSON, JSONL, zip of Markdown files
- Batch export for crawl results
- Production monitoring: PM2 metrics, health check enhancements
- Log rotation and management
- Backup strategy for filesystem storage
- Performance optimization: caching, connection pooling
- Error reporting and alerting (optional webhook)

### Out of Scope

- Vector embedding generation (leave to downstream pipeline)
- Full-text search across scraped content (future enhancement)
- Scheduled/recurring crawls (future enhancement)
- Redis queue implementation (designed for, not built)

---

## 3. RAG Chunking Engine

### 3.1 Chunking Strategy

ForgeCrawl uses a hierarchical chunking approach:

1. **Split by headings:** Each H1/H2/H3 section becomes a potential chunk boundary
2. **Split by paragraphs:** Within sections, split at paragraph boundaries
3. **Token counting:** Use a fast tokenizer approximation (4 chars = 1 token) or optionally tiktoken for accuracy
4. **Overlap:** Include configurable overlap between chunks for context continuity
5. **Metadata injection:** Each chunk carries its heading context, position, and source

### 3.2 Chunker Implementation

```typescript
// server/engine/chunker.ts

export interface ChunkConfig {
  max_tokens: number        // default: 512
  overlap_tokens: number    // default: 50
  respect_headings: boolean // default: true
  include_metadata: boolean // default: true
}

export interface Chunk {
  index: number
  content: string
  token_count: number
  metadata: {
    heading_hierarchy: string[]
    position: 'start' | 'middle' | 'end'
    source_url: string
    chunk_of: number
    has_overlap: boolean
  }
}

export function chunkMarkdown(
  markdown: string,
  url: string,
  config: ChunkConfig
): Chunk[] {
  // 1. Parse markdown into AST sections by headings
  // 2. Walk sections, accumulating text up to max_tokens
  // 3. When a section exceeds max_tokens, split at paragraph boundaries
  // 4. Add overlap from previous chunk's tail
  // 5. Attach heading hierarchy context to each chunk
  // 6. Return array of Chunk objects
}

// Fast token estimation (no external dependency)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
```

### 3.3 Chunk Storage

Chunks are stored in the `scrape_chunks` table defined in the master Drizzle schema (Document 11, `server/db/schema.ts`).

```typescript
// Query: get all chunks for a result, ordered
import { getDb } from '../db'
import { scrapeChunks } from '../db/schema'
import { eq, asc } from 'drizzle-orm'

function getChunksForResult(resultId: string) {
  const db = getDb()
  return db.select().from(scrapeChunks)
    .where(eq(scrapeChunks.resultId, resultId))
    .orderBy(asc(scrapeChunks.chunkIndex))
    .all()
}
```

### 3.4 Chunk API Endpoints

```
GET /api/results/:id/chunks         — Get all chunks for a result
GET /api/results/:id/chunks/:index  — Get specific chunk
GET /api/jobs/:id/chunks            — Get all chunks for all pages in a crawl
```

### 3.5 Chunk Output Format

```json
{
  "chunks": [
    {
      "index": 0,
      "content": "# Introduction\n\nThis article covers...",
      "token_count": 487,
      "metadata": {
        "heading_hierarchy": ["Introduction"],
        "position": "start",
        "source_url": "https://example.com/article",
        "chunk_of": 5,
        "has_overlap": false
      }
    },
    {
      "index": 1,
      "content": "...continuation.\n\n## Methods\n\nThe approach uses...",
      "token_count": 512,
      "metadata": {
        "heading_hierarchy": ["Introduction", "Methods"],
        "position": "middle",
        "source_url": "https://example.com/article",
        "chunk_of": 5,
        "has_overlap": true
      }
    }
  ]
}
```

---

## 4. Login-Gated Scraping

### 4.1 Approach

Two strategies for scraping authenticated content:

**Strategy A: Cookie Injection**
- User provides cookies (copied from browser dev tools)
- Cookies set on Puppeteer page before navigation
- Simplest, works for most sites

**Strategy B: Form-Based Login**
- User provides login URL, username/password, and form selectors
- Puppeteer navigates to login page, fills form, submits
- Captures session cookies after login
- Uses session for subsequent requests in the crawl

### 4.2 Site Credentials Storage

The `site_credentials` table is already defined in the master Drizzle schema (Document 11, `server/db/schema.ts`):

```typescript
// Already in server/db/schema.ts
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
```

**Access control:** SQLite does not have Row Level Security. Access control is enforced at the application level — the credentials API endpoints filter by `userId` matching the authenticated user. Admin users cannot view other users' decrypted credentials.

### 4.3 Encryption

All credentials are encrypted at rest using AES-256-GCM with a server-side key.

```typescript
// server/utils/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

export function encrypt(text: string): string {
  const key = getEncryptionKey()  // from NUXT_ENCRYPTION_KEY
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey()
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

### 4.4 Authenticated Fetch Flow

```typescript
// In server/engine/fetcher.ts — extended for auth

async function fetchWithPuppeteerAuth(
  url: string,
  config: FetchConfig
): Promise<string> {
  const page = await acquirePage()

  try {
    // Inject cookies if provided
    if (config.credentials?.auth_type === 'cookies') {
      const cookies = JSON.parse(decrypt(config.credentials.cookies_encrypted))
      await page.setCookie(...cookies)
    }

    // Form-based login if provided
    if (config.credentials?.auth_type === 'form_login') {
      await page.goto(config.credentials.login_url, {
        waitUntil: 'networkidle2'
      })
      await page.type(
        config.credentials.username_selector,
        decrypt(config.credentials.username_encrypted)
      )
      await page.type(
        config.credentials.password_selector,
        decrypt(config.credentials.password_encrypted)
      )
      await page.click(config.credentials.submit_selector)

      if (config.credentials.success_indicator) {
        await page.waitForSelector(
          config.credentials.success_indicator,
          { timeout: 10000 }
        )
      } else {
        await page.waitForNavigation({ waitUntil: 'networkidle2' })
      }
    }

    // Navigate to target URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: config.timeout
    })

    return await page.content()
  } finally {
    await releasePage(page)
  }
}
```

---

## 5. Export Formats

### 5.1 Export Endpoints

```
GET /api/results/:id/export?format=json
GET /api/results/:id/export?format=markdown
GET /api/jobs/:id/export?format=json
GET /api/jobs/:id/export?format=jsonl
GET /api/jobs/:id/export?format=zip
```

### 5.2 JSON Export Schema

```json
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "markdown": "# Article Title\n\nContent...",
  "metadata": {
    "scraped_at": "2026-03-03T12:00:00Z",
    "word_count": 1523,
    "source": "Example Site"
  },
  "chunks": [
    {
      "index": 0,
      "content": "...",
      "token_count": 487,
      "metadata": {}
    }
  ]
}
```

### 5.3 JSONL Format

One JSON object per line, ideal for streaming into data pipelines.

---

## 6. Production Hardening

### 6.1 Enhanced Health Check

```typescript
// server/api/health.get.ts
export default defineEventHandler(async (event) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: await checkDatabase(),
      puppeteer: await checkBrowser(),
      filesystem: await checkFilesystem(),
      queue: await checkQueue(),
    },
  }

  const allHealthy = Object.values(checks.checks)
    .every(c => c.status === 'ok')

  if (!allHealthy) {
    setResponseStatus(event, 503)
    checks.status = 'degraded'
  }

  return checks
})
```

### 6.2 Log Rotation

```
# /etc/logrotate.d/forgecrawl
/var/log/forgecrawl/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 6.3 Filesystem Backup Script

```bash
#!/bin/bash
# /opt/forgecrawl/scripts/backup.sh
BACKUP_DIR="/opt/forgecrawl/backups"
DATA_DIR="/opt/forgecrawl/data"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/forgecrawl-data-$DATE.tar.gz" -C "$DATA_DIR" .

# Keep last 7 daily backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```

Crontab entry: `0 2 * * * /opt/forgecrawl/scripts/backup.sh`

### 6.4 Error Webhook (Optional)

Configure `NUXT_ALERT_WEBHOOK` to receive error notifications via Discord, Slack, or any webhook-compatible service. Alerts fire on scrape failures, browser crashes, and health check degradation.

### 6.5 New Environment Variables

```bash
# Encryption (required for site credentials)
NUXT_ENCRYPTION_KEY=    # Generate with: openssl rand -hex 32

# Alerts (optional)
NUXT_ALERT_WEBHOOK=     # Discord, Slack, or generic webhook URL
```

---

## 7. UI Updates

### 7.1 Chunk Preview

On the scrape detail page, add a "Chunks" tab showing visual chunk boundaries overlaid on the Markdown, token counts per chunk, heading hierarchy breadcrumbs, and copy controls for individual chunks or all chunks as JSON.

### 7.2 Site Credentials Manager

`app/pages/admin/credentials.vue` — Add, test, and manage site credentials with a form for domain, auth type, and relevant fields. Includes a test button that attempts login and reports success/failure.

### 7.3 Export Controls

Export dropdown on scrape and crawl detail pages supporting Markdown, JSON, JSONL, and Zip formats.

---

## 8. Testing Checklist

- [ ] Chunking: single page produces expected chunk count at 512 tokens
- [ ] Chunking: heading hierarchy is correct in chunk metadata
- [ ] Chunking: overlap content appears at chunk boundaries
- [ ] Chunking: custom max_tokens and overlap values work
- [ ] Cookie injection: scrape a site with provided cookies
- [ ] Form login: Puppeteer logs into a test site and scrapes gated content
- [ ] Credentials are encrypted at rest in the database
- [ ] Credentials can be decrypted and used correctly
- [ ] JSON export returns valid JSON with chunks
- [ ] JSONL export returns one valid JSON object per line
- [ ] Zip export contains correctly named .md files
- [ ] Health check returns component-level status
- [ ] Health check returns 503 when a component is unhealthy
- [ ] Log rotation works (verify after 24h)
- [ ] Backup script creates valid tar.gz archive
- [ ] Alert webhook fires on scrape failures (if configured)
- [ ] Memory usage stable over 100+ scrapes (no leaks)

---

## 9. Post-Phase 5: Future Enhancements

These are explicitly out of scope but noted for future planning:

- **Redis queue backend:** Swap Postgres queue for Redis/BullMQ
- **Scheduled crawls:** Cron-like recurring crawl configuration
- **Full-text search:** Search across all scraped Markdown content
- **Vector embeddings:** Generate embeddings for RAG retrieval
- **Webhook notifications:** Notify external systems when crawls complete
- **Multi-instance scaling:** Cluster mode with Redis for coordination
- **Plugin system:** Custom extractors and transformers

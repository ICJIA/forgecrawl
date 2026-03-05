# ForgeCrawl — Phase 3: Job Queue & Site Crawling

**Version:** 1.0  
**Date:** March 3, 2026  
**Depends on:** Phase 2 (complete)  
**Deliverable:** Async job queue with SQLite backend (via Drizzle ORM), multi-page site crawling with depth control, robots.txt compliance, rate limiting, and crawl progress UI

---

## 1. Phase 3 Goal

Move scraping from synchronous request handling to an async job queue. Implement multi-page site crawling that follows internal links up to a configurable depth. Add robots.txt compliance, rate limiting per domain, and a real-time crawl progress UI in the admin dashboard.

---

## 2. Scope

### In Scope

- Abstract queue interface (SQLite implementation, Redis-ready)
- SQLite-backed job queue with `BEGIN IMMEDIATE` transactions (via Drizzle ORM)
- Worker loop running inside the Nitro server process
- Multi-page site crawl: follow internal links within same domain
- Crawl configuration: max depth, max pages, URL patterns (include/exclude)
- robots.txt fetching and compliance
- Per-domain rate limiting (configurable delay between requests)
- Crawl progress tracking: pages discovered, scraped, failed, queued
- Real-time progress UI using polling (SSE optional)
- Crawl pause/resume/cancel controls
- Updated dashboard showing active crawls and job queue status

### Out of Scope

- Redis queue implementation (designed for but not built in Phase 3)
- API key auth (Phase 4)
- Multi-user (Phase 4)
- RAG chunking (Phase 5)

---

## 3. Queue Architecture

### 3.1 Abstract Queue Interface

```typescript
// server/queue/interface.ts
export interface QueueJob {
  id: string
  jobId: string          // references scrape_jobs.id
  url: string
  priority: number
  attempts: number
  maxAttempts: number
  config: Record<string, any>
}

export interface QueueBackend {
  enqueue(job: Omit<QueueJob, 'id' | 'attempts'>): Promise<string>
  dequeue(workerId: string): Promise<QueueJob | null>
  complete(queueId: string): Promise<void>
  fail(queueId: string, error: string): Promise<void>
  retry(queueId: string): Promise<void>
  cancel(jobId: string): Promise<void>        // cancel all queued items for a job
  getStats(): Promise<QueueStats>
  getJobProgress(jobId: string): Promise<JobProgress>
}

export interface QueueStats {
  pending: number
  running: number
  completed: number
  failed: number
}

export interface JobProgress {
  totalUrls: number
  completed: number
  failed: number
  pending: number
  running: number
}
```

### 3.2 SQLite Queue Implementation

SQLite doesn't support `SELECT FOR UPDATE SKIP LOCKED`. Instead, use `BEGIN IMMEDIATE` transactions which acquire a write lock immediately, preventing concurrent dequeue conflicts. With a single worker process in fork mode, this is sufficient.

```typescript
// server/queue/sqlite.ts
import { getDb } from '../db'
import { jobQueue } from '../db/schema'
import { eq, and, isNull, lte, or, sql } from 'drizzle-orm'
import type { QueueBackend, QueueJob } from './interface'

export class SqliteQueue implements QueueBackend {
  async dequeue(workerId: string): Promise<QueueJob | null> {
    const db = getDb()
    const now = new Date().toISOString()
    const staleLockCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    // SQLite: use a transaction with BEGIN IMMEDIATE for write lock
    // This prevents concurrent dequeue (safe with single worker)
    const result = db.transaction((tx) => {
      const next = tx.select().from(jobQueue)
        .where(
          and(
            isNull(jobQueue.completedAt),
            isNull(jobQueue.failedAt),
            lte(jobQueue.scheduledFor, now),
            or(
              isNull(jobQueue.lockedBy),
              lte(jobQueue.lockedAt, staleLockCutoff)
            ),
            sql`${jobQueue.attempts} < ${jobQueue.maxAttempts}`
          )
        )
        .orderBy(sql`${jobQueue.priority} DESC, ${jobQueue.scheduledFor} ASC`)
        .limit(1)
        .get()

      if (!next) return null

      tx.update(jobQueue)
        .set({
          lockedBy: workerId,
          lockedAt: now,
          attempts: sql`${jobQueue.attempts} + 1`,
        })
        .where(eq(jobQueue.id, next.id))
        .run()

      return next
    })

    return result as QueueJob | null
  }

  // ... complete(), fail(), retry(), cancel(), getStats(), getJobProgress()
}
```

**Why `BEGIN IMMEDIATE`:** SQLite's default `BEGIN DEFERRED` only acquires a write lock when the first write statement executes. `BEGIN IMMEDIATE` acquires the write lock at transaction start, which prevents two workers from reading the same row and both trying to lock it. Since ForgeCrawl runs a single worker in PM2 fork mode, this is sufficient. For multi-worker setups, swap to Redis via the queue interface.

### 3.3 Worker Loop

```typescript
// server/queue/worker.ts
export class QueueWorker {
  private running = false
  private pollInterval = 1000  // 1 second
  private workerId: string

  constructor(private queue: QueueBackend, private engine: ScrapingEngine) {
    this.workerId = `worker-${process.pid}-${Date.now()}`
  }

  async start() {
    this.running = true
    console.log(`[Worker ${this.workerId}] Started`)

    while (this.running) {
      try {
        const job = await this.queue.dequeue(this.workerId)

        if (job) {
          await this.process(job)
        } else {
          // No work available, wait before polling again
          await sleep(this.pollInterval)
        }
      } catch (err) {
        console.error(`[Worker] Error:`, err)
        await sleep(this.pollInterval * 2)
      }
    }
  }

  async stop() {
    this.running = false
  }

  private async process(job: QueueJob) {
    try {
      // Check rate limit for domain
      await this.engine.rateLimiter.waitForDomain(new URL(job.url).hostname)

      // Run scrape
      const result = await this.engine.scrape(job.url, job.config)

      // Store result
      await this.engine.storeResult(job.jobId, result)

      // Mark complete
      await this.queue.complete(job.id)

      // If this is a crawl job, discover and enqueue new URLs
      if (job.config.crawl) {
        await this.discoverLinks(job, result)
      }
    } catch (err) {
      if (job.attempts >= job.maxAttempts) {
        await this.queue.fail(job.id, err.message)
      } else {
        await this.queue.retry(job.id)
      }
    }
  }

  private async discoverLinks(job: QueueJob, result: ScrapeResult) {
    // Extract links from the page
    // Filter to same domain
    // Apply include/exclude patterns
    // Check depth limit
    // Check max pages limit
    // Check robots.txt
    // Enqueue new URLs not already scraped or queued
  }
}
```

### 3.4 Worker Startup

The worker starts automatically with the Nitro server via a server plugin:

```typescript
// server/plugins/queue-worker.ts
export default defineNitroPlugin((nitroApp) => {
  const queue = createQueue()       // factory based on config
  const engine = createEngine()
  const worker = new QueueWorker(queue, engine)

  worker.start()

  nitroApp.hooks.hook('close', () => {
    worker.stop()
  })
})
```

---

## 4. Site Crawling

### 4.1 Crawl Endpoint

```typescript
// server/api/crawl.post.ts
export default defineEventHandler(async (event) => {
  const { user } = event.context
  const body = await readBody(event)

  // Validate
  const url = validateUrl(body.url)
  const config = {
    render_js: body.render_js ?? true,
    max_depth: Math.min(body.max_depth ?? 3, 10),    // cap at 10
    max_pages: Math.min(body.max_pages ?? 50, 500),   // cap at 500
    include_patterns: body.include_patterns || [],     // regex patterns
    exclude_patterns: body.exclude_patterns || [],
    delay_ms: Math.max(body.delay_ms ?? 1000, 500),   // min 500ms
    crawl: true,
  }

  // Create crawl job
  const job = await createCrawlJob(user.id, url, config)

  // Enqueue the seed URL
  await queue.enqueue({
    jobId: job.id,
    url,
    priority: 10,
    maxAttempts: 3,
    config,
  })

  return { job_id: job.id, status: 'queued' }
})
```

### 4.2 Crawl Configuration

| Option | Type | Default | Max | Description |
|--------|------|---------|-----|-------------|
| `max_depth` | integer | 3 | 10 | How many links deep to follow |
| `max_pages` | integer | 50 | 500 | Maximum total pages to scrape |
| `include_patterns` | string[] | `[]` | — | Regex patterns URLs must match |
| `exclude_patterns` | string[] | `[]` | — | Regex patterns to skip |
| `delay_ms` | integer | 1000 | — | Minimum delay between requests to same domain |
| `same_domain` | boolean | `true` | — | Only follow links on same domain |

### 4.3 Link Discovery

When a page is scraped during a crawl, the worker extracts all links and filters them:

1. Parse all `<a href>` from the raw HTML (before Readability strips them)
2. Resolve relative URLs against page URL
3. Filter: same domain only (if `same_domain` enabled)
4. Filter: match `include_patterns`, reject `exclude_patterns`
5. Filter: not already in `scrape_results` for this job
6. Filter: not already in `job_queue` for this job
7. Check against robots.txt
8. Check depth limit (track depth via config metadata)
9. Check max_pages limit
10. Enqueue remaining URLs

---

## 5. Robots.txt Compliance

```typescript
// server/utils/robots.ts
import robotsParser from 'robots-parser'

const robotsCache = new Map<string, { rules: any; fetchedAt: number }>()
const CACHE_TTL = 3600000  // 1 hour

export async function isAllowed(url: string, userAgent: string): Promise<boolean> {
  const { hostname, protocol } = new URL(url)
  const robotsUrl = `${protocol}//${hostname}/robots.txt`

  let cached = robotsCache.get(hostname)
  if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL) {
    try {
      const response = await $fetch(robotsUrl, { timeout: 5000 })
      cached = {
        rules: robotsParser(robotsUrl, response as string),
        fetchedAt: Date.now(),
      }
      robotsCache.set(hostname, cached)
    } catch {
      // No robots.txt or fetch error: allow all
      return true
    }
  }

  return cached.rules.isAllowed(url, userAgent)
}
```

---

## 6. Rate Limiting

```typescript
// server/utils/rate-limiter.ts
export class DomainRateLimiter {
  private lastRequest = new Map<string, number>()
  private defaultDelay: number

  constructor(defaultDelayMs = 1000) {
    this.defaultDelay = defaultDelayMs
  }

  async waitForDomain(domain: string, delayMs?: number): Promise<void> {
    const delay = delayMs || this.defaultDelay
    const lastTime = this.lastRequest.get(domain) || 0
    const elapsed = Date.now() - lastTime
    const waitTime = Math.max(0, delay - elapsed)

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastRequest.set(domain, Date.now())
  }
}
```

---

## 7. Progress Tracking

### 7.1 API Endpoint

```typescript
// server/api/jobs/[id]/progress.get.ts
export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'id')
  const progress = await queue.getJobProgress(jobId)
  const job = await getJob(jobId)

  return {
    job_id: jobId,
    status: job.status,
    progress: {
      total: progress.totalUrls,
      completed: progress.completed,
      failed: progress.failed,
      pending: progress.pending,
      running: progress.running,
      percentage: progress.totalUrls > 0
        ? Math.round((progress.completed / progress.totalUrls) * 100)
        : 0,
    },
  }
})
```

### 7.2 Crawl Control Endpoints

```
POST /api/jobs/:id/pause    — Pause a running crawl
POST /api/jobs/:id/resume   — Resume a paused crawl
POST /api/jobs/:id/cancel   — Cancel and clean up
```

---

## 8. UI Updates

### 8.1 New Crawl Page

`app/pages/crawls/index.vue`:

- Crawl form: seed URL, depth, max pages, patterns, delay
- Active crawls list with progress bars
- Recent completed crawls

### 8.2 Crawl Detail Page

`app/pages/crawls/[id].vue`:

- Real-time progress bar (poll every 2 seconds)
- URL tree visualization showing discovered pages and their depth
- Per-page status indicators (completed, failed, pending)
- Pause/resume/cancel buttons
- Export all results as single Markdown file or zip

### 8.3 Updated Dashboard

- Active jobs count with status breakdown
- Queue depth indicator
- Recent activity feed

---

## 9. Database Schema (Phase 3)

The `job_queue` table and crawl tracking columns on `scrape_jobs` are already defined in the master Drizzle schema (Document 11, `server/db/schema.ts`). No separate SQL migration is needed — Drizzle Kit generates migrations from the TypeScript schema automatically.

Key schema elements for Phase 3:

```typescript
// Already in server/db/schema.ts (from Document 11)
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

// scrape_jobs already includes:
//   pagesDiscovered: integer('pages_discovered').default(0),
//   pagesCompleted: integer('pages_completed').default(0),
//   pagesFailed: integer('pages_failed').default(0),
```

**Note:** SQLite does not support `SELECT FOR UPDATE SKIP LOCKED`, `UUID`, `TIMESTAMPTZ`, or `JSONB`. All IDs are text (UUID generated in application code), timestamps are ISO 8601 text strings, and JSON columns use Drizzle's `{ mode: 'json' }` which stores as text.

---

## 10. Testing Checklist

- [ ] Single-URL scrapes now go through queue (async)
- [ ] Scrape endpoint returns immediately with `job_id` and `status: 'queued'`
- [ ] Worker picks up and processes queued jobs
- [ ] Failed jobs retry up to `max_attempts`
- [ ] Crawl with `max_depth: 1` discovers and scrapes linked pages
- [ ] Crawl respects `max_pages` limit
- [ ] Crawl respects `include_patterns` / `exclude_patterns`
- [ ] robots.txt is fetched and honored
- [ ] Rate limiting enforces delay between requests to same domain
- [ ] Progress endpoint returns accurate counts
- [ ] Crawl pause stops enqueueing new URLs
- [ ] Crawl resume continues from where it paused
- [ ] Crawl cancel marks remaining queue items as cancelled
- [ ] Dashboard shows active jobs and queue status
- [ ] Crawl detail page shows real-time progress
- [ ] No memory leaks during long crawls (monitor with `pm2 monit`)

---

## 11. Known Limitations (Phase 3)

- **Single worker:** One worker thread processes the queue. For higher throughput, Phase 3+ could add configurable worker count.
- **No deduplication across jobs:** Same URL can be scraped in different jobs. Global dedup is a future enhancement.
- **Polling-based progress:** UI polls for progress. WebSocket/SSE would be more efficient but adds complexity.
- **No scheduled/recurring crawls:** One-shot crawls only. Scheduling is a future enhancement.

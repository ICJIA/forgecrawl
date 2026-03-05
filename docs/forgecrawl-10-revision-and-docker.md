# ForgeCrawl -- Revision 2.0: Gap Analysis, Docker Compose, and Missing Features

**Version:** 2.0
**Date:** March 3, 2026
**Scope:** Comprehensive revision of all 10 existing documents

---

## 1. Summary of Changes

This document is a complete gap analysis and revision guide. It identifies everything missing, contradicted, or underspecified across the existing 10-document suite and provides concrete additions for each.

### Document-Level Issues Found

| Doc | Issue |
|-----|-------|
| 00 (Master) | Project structure shows flat layout, not monorepo. Design decision table says "not a monorepo" -- contradicts doc 09. |
| 00 (Master) | No Docker deployment option. Only bare-metal PM2. |
| 00 (Master) | No PDF support in pipeline. No screenshot support. No result caching. |
| 01 (Phase 1) | Bootstrap commands assume flat project, not monorepo workspace. |
| 02 (Phase 2) | No PDF-to-Markdown extraction. No screenshot capture. No result caching. |
| 03 (Phase 3) | No sitemap.xml discovery for crawls. No batch scrape endpoint. |
| 05 (Phase 5) | Listed "PDF/document scraping" as future -- now Phase 2 (PDF via pdf-parse, DOCX via mammoth). |
| 05 (Phase 5) | Missing HTML as an export format. |
| 06 (Security) | No Docker-specific security guidance. |
| 07 (Build Prompt) | Says "Single Nuxt app (not monorepo)" -- contradicts doc 09. No Docker instructions. |
| All phases | No `formats` parameter on scrape API (request markdown + screenshot + html in one call). |
| All phases | No `include_selector` support (only `exclude`). |
| All phases | No Readability fallback when extraction fails (returns null on non-article pages). |

---

## 2. Docker Compose Deployment (NEW -- Major Addition)

### 2.1 Philosophy

Docker Compose is the **recommended deployment method** for anyone who just wants ForgeCrawl running. The bare-metal PM2 approach remains documented as an alternative for advanced users.

Docker Compose bundles the ForgeCrawl Nuxt app with Chromium for Puppeteer. No Redis, no RabbitMQ, no separate services -- just the app.

Supabase is no longer required. ForgeCrawl uses SQLite by default with built-in bcrypt/JWT auth. The entire stack runs in a single Docker container with no external dependencies. Supabase remains available as an optional backend for teams who need managed Postgres at scale (set `NUXT_DB_BACKEND=supabase` in env).

### 2.2 Dockerfile

```dockerfile
# packages/app/Dockerfile
FROM node:22-slim AS base

# Install Chromium and fonts for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Copy app package
COPY packages/app/package.json packages/app/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @forgecrawl/app...

# Copy app source
COPY packages/app packages/app

# Build
RUN pnpm --filter @forgecrawl/app build

# --- Production stage ---
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r forgecrawl && useradd -r -g forgecrawl -m forgecrawl

WORKDIR /app

# Copy built output
COPY --from=base /app/packages/app/.output .output

# Create data directory
RUN mkdir -p /app/data && chown -R forgecrawl:forgecrawl /app/data

USER forgecrawl

ENV NODE_ENV=production
ENV NUXT_PUPPETEER_EXECUTABLE=/usr/bin/chromium
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
```

### 2.3 docker-compose.yml

```yaml
# docker-compose.yml (project root)
name: forgecrawl

services:
  app:
    build:
      context: .
      dockerfile: packages/app/Dockerfile
    ports:
      - "${PORT:-3000}:3000"
    environment:
      # Auth (auto-generated if empty)
      NUXT_AUTH_SECRET: ${NUXT_AUTH_SECRET:-}
      # Storage
      NUXT_STORAGE_MODE: ${NUXT_STORAGE_MODE:-both}
      NUXT_DATA_DIR: /app/data
      # Scraping
      NUXT_PUPPETEER_EXECUTABLE: /usr/bin/chromium
      NUXT_PUPPETEER_CONCURRENCY: ${NUXT_PUPPETEER_CONCURRENCY:-3}
      NUXT_SCRAPE_TIMEOUT: ${NUXT_SCRAPE_TIMEOUT:-30000}
      NUXT_SCRAPE_USER_AGENT: ${NUXT_SCRAPE_USER_AGENT:-ForgeCrawl/1.0}
      # Cache
      NUXT_CACHE_TTL: ${NUXT_CACHE_TTL:-3600}
      # Encryption (required for Phase 5 site credentials)
      NUXT_ENCRYPTION_KEY: ${NUXT_ENCRYPTION_KEY:-}
      # Alerts (optional)
      NUXT_ALERT_WEBHOOK: ${NUXT_ALERT_WEBHOOK:-}
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

### 2.4 .env.example (Docker)

```bash
# === Auth (auto-generated on first run if empty) ===
NUXT_AUTH_SECRET=

# === Storage ===
NUXT_STORAGE_MODE=both          # database | filesystem | both
NUXT_DATA_DIR=./data

# === Scraping ===
NUXT_PUPPETEER_CONCURRENCY=3
NUXT_SCRAPE_TIMEOUT=30000
NUXT_SCRAPE_USER_AGENT=ForgeCrawl/1.0
NUXT_CACHE_TTL=3600             # Result cache TTL in seconds (0 to disable)

# === Server ===
PORT=3000

# === Security (required for Phase 5) ===
# NUXT_ENCRYPTION_KEY=           # Generate: openssl rand -hex 32

# === Alerts (optional) ===
# NUXT_ALERT_WEBHOOK=            # Discord/Slack webhook URL
```

### 2.5 Quick Start (Docker Compose)

```bash
git clone https://github.com/youruser/forgecrawl
cd forgecrawl
cp .env.example .env
# No .env editing needed for basic use. Auth secret auto-generates.

docker compose up -d

# Visit http://localhost:3000
# Register admin account on first run
# Start scraping
```

Three commands to a running scraper.

### 2.6 Docker vs Bare-Metal Comparison

| Aspect | Docker Compose | Bare-Metal PM2 |
|--------|---------------|----------------|
| Setup time | 2 minutes | 30 minutes |
| Chromium install | Automatic (in image) | Manual apt-get |
| Process management | Docker restart policy | PM2 |
| Log management | docker logs | PM2 logs + logrotate |
| SSL/HTTPS | Add Nginx or Caddy in front | Nginx + Certbot |
| Data persistence | Docker volume | Filesystem directory |
| Updates | docker compose pull and up -d | git pull, pnpm build, pm2 restart |
| Resource visibility | docker stats | pm2 monit |
| Best for | Quick setup, local dev, single server | Production with custom Nginx, multi-app servers |

### 2.7 Production Docker with Nginx + SSL

For production, add an Nginx reverse proxy with SSL:

```yaml
# docker-compose.prod.yml (extends base)
services:
  app:
    expose:
      - "3000"
    ports: !reset []

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped
```

```bash
# Production deployment
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 3. New Features to Add to Phase Documents

### 3.1 Result Caching (Add to Phase 1)

When the same URL is scraped within a configurable TTL window, return the cached result instead of re-fetching.

**Database addition:**
```sql
CREATE INDEX idx_scrape_results_url_date ON scrape_results(url, created_at DESC);
```

**Implementation:**
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

**New env var:** `NUXT_CACHE_TTL=3600` (seconds, 0 to disable)

**API behavior:** When cache hit, response includes `"cached": true` and `"cached_at"` timestamp. User can force fresh scrape with `"bypass_cache": true` in request body.

### 3.2 PDF-to-Markdown Extraction (Add to Phase 2)

When the fetcher detects `content-type: application/pdf` or a `.pdf` URL extension, route to PDF extraction instead of Readability.

**New dependency:** `pdf-parse` (lightweight, pure JS, no native binaries)

**Implementation:**
```typescript
// server/engine/pdf-extractor.ts
import pdf from 'pdf-parse'

export async function extractPdf(buffer: Buffer): Promise<{
  text: string
  metadata: { pages: number; title?: string; author?: string }
}> {
  const data = await pdf(buffer)
  return {
    text: data.text,
    metadata: {
      pages: data.numpages,
      title: data.info?.Title || undefined,
      author: data.info?.Author || undefined,
    },
  }
}
```

**Pipeline change:** The fetcher checks content-type and URL extension. PDFs get routed to `extractPdf` instead of Readability. The extracted text is converted to Markdown with frontmatter including page count, title, and author.

**Markdown output for PDFs:**
```markdown
---
title: "Document Title"
url: "https://example.com/report.pdf"
scraped_at: "2026-03-03T12:00:00Z"
type: "pdf"
pages: 12
author: "Author Name"
scraper: "ForgeCrawl/1.0"
---

[Extracted text content with paragraph breaks preserved]
```

### 3.3 DOCX-to-Markdown Extraction (Add to Phase 2)

When the fetcher detects `content-type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` or a `.docx` URL extension, route to DOCX extraction instead of Readability.

**New dependency:** `mammoth` (pure JS, converts DOCX to clean HTML — no LibreOffice needed)

**Implementation:**
```typescript
// server/engine/docx-extractor.ts
import mammoth from 'mammoth'

export async function extractDocx(buffer: Buffer): Promise<{
  html: string
  text: string
  metadata: { warnings: string[] }
}> {
  const result = await mammoth.convertToHtml({ buffer })
  const textResult = await mammoth.extractRawText({ buffer })

  return {
    html: result.value,
    text: textResult.value,
    metadata: {
      warnings: result.messages
        .filter(m => m.type === 'warning')
        .map(m => m.message),
    },
  }
}
```

**Pipeline change:** The fetcher checks content-type and URL extension. DOCX files get routed to `extractDocx`, which returns clean HTML. That HTML then passes through Turndown for Markdown conversion (same as the Readability path). This means DOCX output benefits from all existing Turndown rules — GFM tables, code blocks, heading styles.

**Why mammoth over other libraries:** mammoth produces semantic HTML (headings, lists, tables) rather than trying to replicate Word's visual layout. This is exactly what Turndown needs. It's pure JS with no native binaries, runs in Docker without extra dependencies, and handles embedded images (as base64 in the HTML, which Turndown can preserve or strip based on `include_images` config).

**Markdown output for DOCX files:**
```markdown
---
title: "Document Title"
url: "https://example.com/report.docx"
scraped_at: "2026-03-03T12:00:00Z"
type: "docx"
scraper: "ForgeCrawl/1.0"
---

# Document Title

[Converted content with headings, lists, tables preserved]
```

**Note:** DOCX title extraction is limited — mammoth doesn't parse document properties. The title falls back to the first heading in the document, or the filename if no heading is found. This is acceptable for scraping use cases.

### 3.4 Screenshot Capture (Add to Phase 2)

When Puppeteer is rendering a page, optionally capture a full-page screenshot.

**Implementation:**
```typescript
// In fetchWithPuppeteer -- after page loads:
let screenshot: Buffer | null = null
if (config.formats?.includes('screenshot')) {
  screenshot = await page.screenshot({
    type: 'png',
    fullPage: true,
  }) as Buffer
}
```

**Storage:** Screenshots stored alongside Markdown in filesystem mode (`{resultId}.png`), or as base64 in the `scrape_results.metadata` JSON field in database mode.

**API response:** When `screenshot` is requested, response includes `"screenshot": "data:image/png;base64,..."` or a file path depending on storage mode.

### 3.5 Formats Parameter on Scrape API (Add to Phase 2)

Allow clients to request specific output formats in a single scrape.

**Updated API request:**
```json
{
  "url": "https://example.com",
  "formats": ["markdown", "html", "screenshot", "rawHtml"],
  "config": { "render_js": true }
}
```

**Available formats:**

| Format | Description | Requires Puppeteer? |
|--------|-------------|-------------------|
| `markdown` | Clean Markdown with frontmatter (default, always included) | No |
| `html` | Clean HTML from Readability extraction | No |
| `rawHtml` | Original unmodified HTML | No |
| `screenshot` | Full-page PNG screenshot | Yes |
| `metadata` | Page metadata (title, description, OG tags) | No |
| `links` | All links found on the page | No |

**Response shape:**
```json
{
  "job_id": "...",
  "url": "https://example.com",
  "formats": {
    "markdown": "# Example\n\nContent...",
    "html": "<article><h1>Example</h1><p>Content...</p></article>",
    "screenshot": "data:image/png;base64,...",
    "metadata": {
      "title": "Example",
      "description": "...",
      "og:image": "..."
    }
  }
}
```

### 3.6 Include Selectors (Add to Phase 2)

In addition to `selectors.exclude`, add `selectors.include` to target specific page regions.

```json
{
  "url": "https://example.com/article",
  "config": {
    "selectors": {
      "include": ".article-body, .post-content",
      "exclude": ".sidebar, .comments, .ads, nav, footer"
    }
  }
}
```

**Behavior:** If `include` is set, extract only HTML within matching elements before running Readability. If `include` returns no content, fall back to full-page extraction with a warning in metadata.

### 3.7 Readability Fallback (Add to Phase 2)

When Readability returns null (non-article pages like homepages, dashboards, app UIs), fall back to cheerio-based extraction.

```typescript
// server/engine/extractor.ts
export async function extractContent(html: string, url: string, config: any) {
  // Try Readability first
  const article = readabilityExtract(html, url)

  if (article?.content) {
    return { html: article.content, title: article.title, method: 'readability' }
  }

  // Fallback: strip nav/footer/script, convert remaining body
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, aside, .ad, #cookie-banner').remove()

  if (config?.selectors?.exclude) {
    $(config.selectors.exclude).remove()
  }

  const bodyHtml = $('main').html() || $('body').html() || html
  const title = $('title').text() || $('h1').first().text() || ''

  return { html: bodyHtml, title, method: 'fallback' }
}
```

**Metadata includes `extraction_method`** so consumers know whether Readability or fallback was used.

### 3.8 Sitemap Discovery (Add to Phase 3)

During crawls, check for sitemap.xml to discover URLs more efficiently.

```typescript
// server/engine/sitemap.ts
export async function discoverFromSitemap(baseUrl: string): Promise<string[]> {
  const sitemapUrls = [
    new URL('/sitemap.xml', baseUrl).href,
    new URL('/sitemap_index.xml', baseUrl).href,
  ]

  for (const url of sitemapUrls) {
    try {
      const response = await $fetch(url, { timeout: 5000, responseType: 'text' })
      return parseSitemap(response as string)
    } catch {
      continue
    }
  }
  return []
}
```

**Crawl behavior:** When a crawl starts, optionally check sitemap.xml first. If found, merge discovered URLs with link-following discovery. Controlled via config flag `use_sitemap: true` (default: true).

### 3.9 Batch Scrape Endpoint (Add to Phase 3)

Accept an array of URLs and queue them all as a single batch job.

```
POST /api/scrape/batch
Body: { urls: ["url1", "url2", ...], config: {} }
Response: { job_id, total_urls, status: 'queued' }
```

Each URL becomes a queue item under one parent `scrape_job` with `job_type: 'batch'`. Progress tracking works identically to crawls.

### 3.10 HTML Export Format (Add to Phase 5)

Add clean HTML as an export option alongside Markdown, JSON, JSONL, and Zip.

```
GET /api/results/:id/export?format=html
GET /api/jobs/:id/export?format=html
```

### 3.11 Cleanup / Maintenance (Add to Phase 5)

```
POST /api/admin/cleanup
Body: { older_than_days: 30, dry_run: true }
Response: { would_delete: 142, storage_freed: "1.2 GB" }
```

Admin-only endpoint that purges old scrape results, queue entries, and filesystem storage. `dry_run: true` returns counts without deleting. Also available as a cron-schedulable Nitro task.

---

## 4. Document Corrections Required

### 4.1 Master Design Doc (00)

1. **Section 9 (Project Structure):** Replace flat structure with monorepo layout from doc 09.
2. **Section 11 (Design Decisions):** Change "Single Nuxt app (not monorepo)" to "pnpm workspace monorepo with packages/app (scraper) and packages/web (marketing site). Independent deployments."
3. **Section 2 (Tech Stack):** Add: PDF Extraction (pdf-parse), Deployment Primary (Docker Compose), Deployment Alt (PM2 + Nginx).
4. **Section 3 (Architecture):** Add result cache layer. Add content-type router branching to PDF extractor vs Readability.
5. **Section 6 (Scraping Configuration):** Add `formats` array, `selectors.include`, `bypass_cache`, `use_sitemap`.
6. **Section 10 (Env Vars):** Add `NUXT_CACHE_TTL`.

### 4.2 Phase 1 (01)

1. **Bootstrap commands:** Update to monorepo initialization with pnpm-workspace.yaml.
2. **Scope (In Scope):** Add result caching.
3. Add Docker Compose files (Dockerfile, docker-compose.yml, .env.example, .dockerignore) to deliverable list.

### 4.3 Phase 2 (02)

1. **Scope (In Scope):** Add PDF-to-Markdown, DOCX-to-Markdown, screenshot capture, `formats` parameter, `selectors.include`, Readability fallback.
2. **New dependencies:** pdf-parse, mammoth.
3. **Testing Checklist:** Add PDF extraction, DOCX extraction, screenshot, formats param, include selectors, fallback extraction tests.

### 4.4 Phase 3 (03)

1. **Scope (In Scope):** Add sitemap.xml discovery, batch scrape endpoint.
2. **Testing Checklist:** Add sitemap discovery and batch scrape tests.

### 4.5 Phase 5 (05)

1. **Scope (In Scope):** Add HTML export, cleanup endpoint.
2. **Post-Phase 5 list:** Remove "PDF/document scraping" (now Phase 2: PDF via pdf-parse, DOCX via mammoth).
3. **Export Formats:** Add `format=html` to export endpoints.

### 4.6 Security Doc (06)

Add RISK-11: Docker-Specific Risks. Mitigations: non-root user, memory limits, no Docker socket mount, image scanning, volume permissions, secrets via .env not image layers.

### 4.7 LLM Build Prompt (07)

1. Change architecture rules to reference monorepo structure.
2. Add Docker Compose as primary deployment target.
3. Update file structure.
4. Add result caching to Phase 1 deliverables.
5. Note PDF, screenshots, formats for Phase 2.

---

## 5. Updated Quick Start Options

### Option A: Docker Compose (Recommended)

```bash
git clone https://github.com/youruser/forgecrawl
cd forgecrawl
cp .env.example .env
# Edit .env if needed (auth secret auto-generates on first run)
# No external database setup required

docker compose up -d
# Visit http://localhost:3000 -> register admin -> scrape
```

### Option B: Bare-Metal (Advanced)

```bash
git clone https://github.com/youruser/forgecrawl
cd forgecrawl
pnpm install

# Install Chromium
sudo apt-get install -y chromium-browser fonts-liberation fonts-noto-cjk

cd packages/app
cp .env.example .env
# Edit .env
pnpm build
pm2 start ecosystem.config.cjs
# Configure Nginx + Certbot for SSL
```

### Option C: Marketing Website (Optional, separate)

```bash
cd packages/web
pnpm install
pnpm dev          # Local preview
pnpm build        # Static build for Netlify/Vercel
```

---

## 6. Updated Export Format Matrix

| Format | Endpoint | MIME Type | Phase |
|--------|----------|-----------|-------|
| Markdown | /api/results/:id/export?format=markdown | text/markdown | 1 |
| Raw HTML | /api/results/:id/export?format=rawHtml | text/html | 2 |
| Screenshot | /api/results/:id/export?format=screenshot | image/png | 2 |
| JSON | /api/results/:id/export?format=json | application/json | 5 |
| JSONL | /api/jobs/:id/export?format=jsonl | application/x-ndjson | 5 |
| HTML (clean) | /api/results/:id/export?format=html | text/html | 5 |
| Zip (all) | /api/jobs/:id/export?format=zip | application/zip | 5 |
| Chunks | /api/results/:id/chunks | application/json | 5 |

---

## 7. Updated Monorepo File Structure

```
forgecrawl/
+-- docker-compose.yml              # Primary deployment
+-- docker-compose.prod.yml         # Production overlay (Nginx + SSL)
+-- .env.example
+-- .dockerignore
+-- .gitignore
+-- pnpm-workspace.yaml
+-- package.json                    # Root workspace config
+-- .npmrc
+-- README.md
+-- LICENSE                         # MIT
+--
+-- packages/
|   +-- app/                        # The scraper application
|   |   +-- Dockerfile
|   |   +-- .dockerignore
|   |   +-- package.json            # @forgecrawl/app
|   |   +-- nuxt.config.ts
|   |   +-- ecosystem.config.cjs    # PM2 config (bare-metal only)
|   |   +-- .env.example
|   |   +-- app/
|   |   |   +-- app.vue
|   |   |   +-- pages/
|   |   |   |   +-- index.vue              # Dashboard
|   |   |   |   +-- setup.vue              # First-run registration
|   |   |   |   +-- login.vue
|   |   |   |   +-- scrapes/
|   |   |   |   |   +-- index.vue
|   |   |   |   |   +-- [id].vue
|   |   |   |   +-- crawls/
|   |   |   |   |   +-- index.vue
|   |   |   |   |   +-- [id].vue
|   |   |   |   +-- admin/
|   |   |   |       +-- users.vue
|   |   |   |       +-- api-keys.vue
|   |   |   |       +-- settings.vue
|   |   |   |       +-- credentials.vue
|   |   |   +-- components/
|   |   |   +-- composables/
|   |   |   +-- middleware/
|   |   +-- server/
|   |   |   +-- middleware/
|   |   |   |   +-- auth.ts
|   |   |   +-- api/
|   |   |   |   +-- scrape.post.ts
|   |   |   |   +-- scrape/
|   |   |   |   |   +-- batch.post.ts      # Batch scrape
|   |   |   |   +-- crawl.post.ts
|   |   |   |   +-- jobs/
|   |   |   |   +-- results/
|   |   |   |   +-- admin/
|   |   |   |   |   +-- cleanup.post.ts    # Maintenance
|   |   |   |   +-- auth/
|   |   |   |   +-- health.get.ts
|   |   |   +-- engine/
|   |   |   |   +-- scraper.ts
|   |   |   |   +-- fetcher.ts
|   |   |   |   +-- extractor.ts           # Readability + fallback
|   |   |   |   +-- converter.ts           # Turndown
|   |   |   |   +-- chunker.ts
|   |   |   |   +-- browser.ts             # Puppeteer singleton
|   |   |   |   +-- pdf-extractor.ts       # PDF support
|   |   |   |   +-- docx-extractor.ts      # DOCX support
|   |   |   |   +-- cache.ts              # Result caching
|   |   |   |   +-- sitemap.ts            # Sitemap discovery
|   |   |   +-- queue/
|   |   |   +-- storage/
|   |   |   +-- utils/
|   |   +-- db/
|   |   |   +-- schema.ts
|   |   |   +-- index.ts
|   |   |   +-- migrations/
|   |   +-- data/                   # Filesystem storage (gitignored)
|   |
|   +-- web/                        # Marketing and documentation site
|       +-- package.json            # @forgecrawl/web
|       +-- nuxt.config.ts
|       +-- app/
|       +-- public/
+--
+-- nginx/                          # Production Nginx config
    +-- nginx.conf
```

---

## 8. Things Considered But Excluded

| Feature | Why Excluded |
|---------|-------------|
| Self-hosted Postgres | Adds operational complexity. SQLite is zero-config for single-server use. Supabase ($25/mo) available as optional upgrade via Drizzle ORM backend swap for teams needing managed Postgres. |
| Built-in proxy rotation | Infrastructure concern. Users who need proxies configure at network level or set NUXT_PROXY_URL. |
| AI-powered JSON extraction | Requires external LLM API key. ForgeCrawl outputs clean Markdown -- pipe into your own LLM. |
| WebSocket progress updates | Polling every 2s is fine for the UI. SSE/WS adds complexity for marginal UX gain. |
| SDKs (Python, JS, Go) | API is simple enough to call with curl or fetch. SDKs are post-v1. |
| Plugin system | Premature abstraction. Custom Turndown rules and Readability options are sufficient. |
| Vector embeddings | Downstream pipeline concern. Chunked output is ready for embedding by any provider. |
| Redis queue | SQLite queue is fine for single-server. Interface designed for Redis swap later. |

---

## 9. Revised Phase Summary

| Phase | Key Additions in This Revision |
|-------|-------------------------------|
| **1** | + Result caching, + Docker Compose files, + monorepo scaffold |
| **2** | + PDF extraction, + DOCX extraction, + screenshots, + `formats` param, + `include` selectors, + Readability fallback |
| **3** | + Sitemap discovery, + batch scrape endpoint |
| **4** | (No changes) |
| **5** | + HTML export, + cleanup endpoint, - PDF/DOCX from future list (now Phase 2) |

---

## 10. Final Document Inventory

After applying this revision, the ForgeCrawl documentation suite is:

| # | Document | Status |
|---|----------|--------|
| 00 | Master Design Document | Update: monorepo, Docker, new features |
| 01 | Phase 1: Foundation and Auth | Update: bootstrap, add caching, Docker files |
| 02 | Phase 2: Puppeteer and Storage | Update: PDF, DOCX, screenshots, formats, selectors, fallback |
| 03 | Phase 3: Job Queue and Crawling | Update: sitemap, batch scrape |
| 04 | Phase 4: API Keys and Multi-User | No changes |
| 05 | Phase 5: RAG and Advanced | Update: HTML export, cleanup, remove PDF/DOCX from future |
| 06 | Security Document | Update: Docker security section |
| 07 | LLM Build Prompt | Update: monorepo, Docker |
| 08 | Differentiation Analysis | No changes |
| 09 | Monorepo and Website | No changes |
| 10 | Revision 2.0 (this doc) | NEW: gap analysis, Docker, all additions |

Total: 11 documents covering architecture, 5 implementation phases, security, deployment, differentiation, marketing site, and this revision guide.

# ForgeCrawl — Phase 2: Puppeteer Engine & Configurable Storage

**Version:** 1.0  
**Date:** March 3, 2026  
**Depends on:** Phase 1 (complete)  
**Deliverable:** JS-rendered scraping with Puppeteer, Readability extraction, and configurable storage (database, filesystem, or both)

---

## 1. Phase 2 Goal

Add Puppeteer-based JavaScript rendering so ForgeCrawl can scrape SPAs, dynamic content, and JS-heavy pages. Implement configurable storage so scrape results can be stored in the database (SQLite by default), the local filesystem, or both. Improve Markdown output quality with better handling of tables, code blocks, and metadata.

---

## 2. Scope

### In Scope

- Puppeteer integration with shared browser instance management
- Configurable render mode: HTTP-only (fast) vs Puppeteer (full JS)
- `wait_for` selector support (wait for specific element before extracting)
- Concurrency limiting (max simultaneous Puppeteer pages)
- Browser crash recovery and auto-restart
- Configurable storage backend: database (SQLite default), filesystem, or both
- Filesystem storage with organized directory structure
- Storage interface abstraction for clean swapping
- PDF-to-Markdown extraction via pdf-parse (content-type or extension detection)
- DOCX-to-Markdown extraction via mammoth (content-type or extension detection)
- Enhanced Turndown rules for better Markdown (code blocks, tables, metadata headers)
- Scrape config UI: toggle JS rendering, set wait selectors, choose storage
- Admin settings page for default configuration
- Chromium dependency installation for DO droplet

### Out of Scope

- Job queue / async processing (Phase 3)
- Site crawling (Phase 3)
- API keys (Phase 4)
- RAG chunking (Phase 5)

---

## 3. Puppeteer Browser Management

### 3.1 Browser Singleton

```typescript
// server/engine/browser.ts
import puppeteer, { Browser, Page } from 'puppeteer'

let browser: Browser | null = null
let activePagesCount = 0

const config = {
  maxConcurrency: Number(process.env.NUXT_PUPPETEER_CONCURRENCY) || 3,
  executablePath: process.env.NUXT_PUPPETEER_EXECUTABLE || undefined,
}

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser

  browser = await puppeteer.launch({
    headless: true,
    executablePath: config.executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--single-process',
      '--no-zygote',
    ],
  })

  browser.on('disconnected', () => {
    browser = null
    activePagesCount = 0
  })

  return browser
}

export async function acquirePage(): Promise<Page> {
  if (activePagesCount >= config.maxConcurrency) {
    throw new Error('Max concurrent pages reached. Try again shortly.')
  }

  const b = await getBrowser()
  const page = await b.newPage()
  activePagesCount++

  // Set reasonable defaults
  await page.setUserAgent(process.env.NUXT_SCRAPE_USER_AGENT || 'ForgeCrawl/1.0')
  await page.setViewport({ width: 1280, height: 800 })

  return page
}

export async function releasePage(page: Page): Promise<void> {
  try {
    await page.close()
  } catch {
    // Page may already be closed
  }
  activePagesCount = Math.max(0, activePagesCount - 1)
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
    activePagesCount = 0
  }
}
```

### 3.2 Updated Fetcher

```typescript
// server/engine/fetcher.ts
import { acquirePage, releasePage } from './browser'

export interface FetchConfig {
  render_js?: boolean
  wait_for?: string | null
  timeout?: number
}

export async function fetchPage(url: string, config: FetchConfig = {}): Promise<string> {
  if (config.render_js) {
    return fetchWithPuppeteer(url, config)
  }
  return fetchWithHttp(url, config)
}

async function fetchWithHttp(url: string, config: FetchConfig): Promise<string> {
  // Existing Phase 1 HTTP fetch logic
  const response = await $fetch.raw(url, {
    headers: {
      'User-Agent': process.env.NUXT_SCRAPE_USER_AGENT || 'ForgeCrawl/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeout: config.timeout || 30000,
    redirect: 'follow',
  })
  return response._data as string
}

async function fetchWithPuppeteer(url: string, config: FetchConfig): Promise<string> {
  const page = await acquirePage()

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: config.timeout || 30000,
    })

    // Wait for specific selector if configured
    if (config.wait_for) {
      await page.waitForSelector(config.wait_for, {
        timeout: 10000,
      })
    }

    // Get fully rendered HTML
    const html = await page.content()
    return html
  } finally {
    await releasePage(page)
  }
}
```

---

## 4. Configurable Storage

### 4.1 Storage Interface

```typescript
// server/storage/interface.ts
export interface StorageResult {
  markdown: string | null   // null if filesystem-only
  filePath: string | null   // null if database-only
}

export interface StorageBackend {
  save(jobId: string, resultId: string, data: {
    url: string
    title: string
    markdown: string
    rawHtml?: string
    metadata: Record<string, any>
  }): Promise<StorageResult>

  load(resultId: string): Promise<{ markdown: string; rawHtml?: string } | null>

  delete(resultId: string): Promise<void>
}
```

### 4.2 Database Storage

```typescript
// server/storage/database.ts
export class DatabaseStorage implements StorageBackend {
  // Stores markdown and raw HTML directly in scrape_results table via Drizzle ORM
  // This is the Phase 1 behavior, now behind the interface
}
```

### 4.3 Filesystem Storage

```typescript
// server/storage/filesystem.ts
import { mkdir, writeFile, readFile, rm } from 'fs/promises'
import { join } from 'path'

export class FilesystemStorage implements StorageBackend {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  async save(jobId: string, resultId: string, data: any): Promise<StorageResult> {
    const dir = join(this.baseDir, 'scrapes', jobId)
    await mkdir(dir, { recursive: true })

    // Write markdown
    const mdPath = join(dir, `${resultId}.md`)
    await writeFile(mdPath, data.markdown, 'utf-8')

    // Write raw HTML (optional, for debugging)
    if (data.rawHtml) {
      const htmlPath = join(dir, `${resultId}.html`)
      await writeFile(htmlPath, data.rawHtml, 'utf-8')
    }

    // Write metadata
    const metaPath = join(dir, `${resultId}.meta.json`)
    await writeFile(metaPath, JSON.stringify({
      url: data.url,
      title: data.title,
      ...data.metadata,
    }, null, 2), 'utf-8')

    return { markdown: null, filePath: mdPath }
  }

  // load() and delete() implementations...
}
```

### 4.4 Combined Storage

```typescript
// server/storage/combined.ts
export class CombinedStorage implements StorageBackend {
  // Writes to both database and filesystem
  // Database gets markdown text for querying
  // Filesystem gets files for cheap blob storage
  // load() reads from database first, falls back to filesystem
}
```

### 4.5 Storage Factory

```typescript
// server/storage/index.ts
export function createStorage(): StorageBackend {
  const mode = process.env.NUXT_STORAGE_MODE || 'database'
  const dataDir = process.env.NUXT_DATA_DIR || './data'

  switch (mode) {
    case 'database': return new DatabaseStorage()
    case 'filesystem': return new FilesystemStorage(dataDir)
    case 'both': return new CombinedStorage(new DatabaseStorage(), new FilesystemStorage(dataDir))
    default: throw new Error(`Unknown storage mode: ${mode}`)
  }
}
```

---

## 5. Enhanced Markdown Conversion

### 5.1 Improved Turndown Rules

Add custom rules for:

- **Code blocks:** Detect language from class names (e.g., `language-python`, `highlight-js`)
- **Tables:** Ensure proper GFM table alignment
- **Metadata header:** Prepend YAML frontmatter with title, URL, date, word count
- **Cleanup:** Remove empty headings, orphaned links, excessive whitespace

### 5.2 Markdown Frontmatter

```markdown
---
title: "Page Title"
url: "https://example.com/page"
scraped_at: "2026-03-03T12:00:00Z"
word_count: 1523
source: "Example Site"
---

# Page Title

Content begins here...
```

---

## 6. UI Updates

### 6.1 Enhanced Scrape Form

Add configuration options to the scrape form:

- **Render JavaScript** toggle (default: on)
- **Wait for selector** text input (optional)
- **Include links** toggle (default: on)
- **Include images** toggle (default: off)
- **Exclude selectors** text input (comma-separated CSS selectors)

### 6.2 Admin Settings Page

`app/pages/admin/settings.vue`:

- Default scrape configuration (render_js, timeout, user agent)
- Storage mode display (read-only, set via env)
- Storage statistics (total scrapes, disk usage if filesystem enabled)
- Puppeteer status (browser connected, active pages, max concurrency)

---

## 7. DO Droplet: Chromium Setup

Add to the server provisioning script:

```bash
# Install Chromium and dependencies
apt-get update
apt-get install -y chromium-browser \
  fonts-liberation fonts-noto-cjk fonts-noto-color-emoji \
  libappindicator3-1 libasound2t64 libatk-bridge2.0-0t64 \
  libatk1.0-0t64 libcups2t64 libdbus-1-3 libdrm2 \
  libgbm1 libgtk-3-0t64 libnspr4 libnss3 \
  libxcomposite1 libxdamage1 libxrandr2 xdg-utils

# Verify
chromium-browser --version

# Set in .env
# NUXT_PUPPETEER_EXECUTABLE=/usr/bin/chromium-browser
```

### Filesystem Storage Directory

```bash
mkdir -p /opt/forgecrawl/data/scrapes
chown -R forgecrawl:forgecrawl /opt/forgecrawl/data
```

---

## 8. Testing Checklist

- [ ] HTTP-only scrape still works (regression)
- [ ] Puppeteer scrape returns content from JS-rendered pages
- [ ] Test SPA scraping: scrape a Vue/React app URL
- [ ] `wait_for` selector delays extraction until element appears
- [ ] Concurrency limit: fire 5 simultaneous requests, verify only 3 run at once
- [ ] Browser crash recovery: kill Chromium process, verify next scrape relaunches
- [ ] Storage mode `database`: content stored in `scrape_results.markdown`
- [ ] Storage mode `filesystem`: files written to `/opt/forgecrawl/data/scrapes/`
- [ ] Storage mode `both`: content in both locations
- [ ] Markdown includes YAML frontmatter
- [ ] Code blocks have language hints where detectable
- [ ] Tables render as proper GFM Markdown
- [ ] Admin settings page shows Puppeteer status and storage stats
- [ ] Memory usage stays under 3GB with 3 concurrent Puppeteer pages
- [ ] PDF URL returns extracted text as Markdown with frontmatter (type: pdf, page count)
- [ ] DOCX URL returns converted content as Markdown with headings, lists, tables preserved
- [ ] Non-HTML content-type detection routes to correct extractor (PDF, DOCX, or HTML)

---

## 9. Known Limitations (Phase 2)

- **Synchronous processing:** Scrapes still block the request. Long Puppeteer renders may timeout. Phase 3 adds async job queue.
- **No crawling:** Still single-URL only. Phase 3 adds multi-page crawling.
- **No auth for target sites:** Cannot scrape login-gated content. Phase 5 adds this.
- **Single user:** Still admin-only. Phase 4 adds multi-user.

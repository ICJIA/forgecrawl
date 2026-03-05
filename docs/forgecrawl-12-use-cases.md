# ForgeCrawl -- Document 12: Use Cases and Integration Guide

**Version:** 2.0
**Date:** March 3, 2026
**Audience:** Developers integrating ForgeCrawl into their workflows

---

## 1. Overview

ForgeCrawl is a self-hosted web scraper that converts any URL into clean, LLM-ready Markdown. Once deployed (via Docker Compose or bare-metal), it exposes a REST API you can call from anywhere: a browser-based JavaScript application, a Node.js CLI script, a Python data pipeline, a shell one-liner with curl, or any HTTP client in any language.

This document walks through every integration pattern with both explanations of what each approach does and complete, copy-pasteable code. It is organized in three layers: first, the client library that wraps the API; second, platform-specific integration examples (browser, Node.js, CLI, curl); and third, real-world recipes that combine multiple API calls into practical workflows.

### How Authentication Works

Every API call (except the health check) requires authentication. There are two mechanisms:

**API Keys** are the primary method for programmatic access. You generate a key through the admin UI, and it looks like `bc_` followed by 40 hex characters. Pass it in the `Authorization` header as a Bearer token. The key is hashed with bcrypt on the server and can never be retrieved again after generation, so store it securely.

**Session cookies** are used by the browser-based admin UI. When you log in through the web interface, ForgeCrawl sets an HTTP-only cookie containing a signed JWT. This cookie is sent automatically on every subsequent request. You don't need to manage this manually -- it's handled by the browser.

For all programmatic use (scripts, other applications, CLI tools), use an API key.

---

## 2. API Quick Reference

Before diving into code, here is the complete API surface. Every endpoint except `/api/health` requires authentication.

| Method | Endpoint | What It Does | Available |
|--------|----------|-------------|-----------|
| POST | /api/scrape | Scrapes a single URL and returns clean Markdown (and optionally HTML, screenshots, metadata). This is the core endpoint -- you give it a URL, it gives you back structured content. | Phase 1 |
| POST | /api/scrape/batch | Accepts an array of URLs and queues them all as a single batch job. Each URL is scraped independently, but they share a single job ID so you can track progress as a group. | Phase 3 |
| POST | /api/crawl | Starts a multi-page crawl from a seed URL. The crawler follows internal links (respecting depth limits, URL patterns, and robots.txt) and scrapes each discovered page. | Phase 3 |
| GET | /api/jobs/:id | Returns the current status of a job: pending, running, completed, failed, or cancelled. For crawls and batches, also includes page counts. | Phase 3 |
| GET | /api/jobs/:id/progress | Returns detailed progress for a crawl or batch job: how many pages have been discovered, completed, failed, and are still pending or running. | Phase 3 |
| POST | /api/jobs/:id/cancel | Cancels a running crawl or batch job. Pages already scraped are kept; remaining queued pages are discarded. | Phase 3 |
| GET | /api/results/:id | Retrieves the full result of a single scraped page: the Markdown content, metadata, word count, and any other requested formats. | Phase 1 |
| GET | /api/results/:id/chunks | Returns the RAG-ready chunks for a scraped page. Each chunk includes the text content, token count, heading hierarchy, and positional metadata. | Phase 5 |
| GET | /api/results/:id/export | Exports a single result in a specified format: markdown, json, html, rawHtml, or screenshot. Pass the desired format as a query parameter. | Phase 2+ |
| GET | /api/jobs/:id/export | Exports all results from a crawl or batch job. Supports json, jsonl (one JSON object per line, ideal for pipelines), and zip (a zip archive of Markdown files). | Phase 5 |
| GET | /api/health | Returns server health status including uptime, memory usage, database connectivity, Puppeteer status, and queue depth. This is the only endpoint that does not require authentication. | Phase 1 |

---

## 3. The ForgeCrawl Client Library

The following JavaScript class wraps the entire ForgeCrawl API into a clean, ergonomic interface. It works identically in both browser and Node.js environments because it uses the native `fetch` API (available in all modern browsers and Node.js 18+).

The class uses ES2022 private fields (the `#` prefix) to keep the API key out of accidental serialization or logging. The constructor takes two arguments: the base URL of your ForgeCrawl instance and your API key.

Every method returns a Promise that resolves to the parsed JSON response. If the server returns a non-2xx status code, the method throws an Error with the status code and server-provided message.

```javascript
// forgecrawl.js
// Universal client for ForgeCrawl API (browser + Node.js)

export class ForgeCrawl {
  #baseUrl
  #apiKey

  /**
   * Create a ForgeCrawl client.
   * @param {string} baseUrl - Your ForgeCrawl server URL (e.g. 'http://localhost:3000')
   * @param {string} apiKey  - Your API key (starts with 'bc_')
   */
  constructor(baseUrl, apiKey) {
    this.#baseUrl = baseUrl.replace(/\/$/, '')
    this.#apiKey = apiKey
  }

  /**
   * Internal: make an authenticated request to the ForgeCrawl API.
   * Handles JSON serialization, auth headers, and error parsing.
   */
  async #request(method, path, body = null) {
    const options = {
      method,
      headers: {
        'Authorization': 'Bearer ' + this.#apiKey,
        'Content-Type': 'application/json',
      },
    }
    if (body) options.body = JSON.stringify(body)

    const res = await fetch(this.#baseUrl + path, options)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new Error('ForgeCrawl ' + res.status + ': ' + err.message)
    }
    return res.json()
  }

  // =====================
  // Scraping
  // =====================

  /**
   * Scrape a single URL. This is the primary method for most use cases.
   *
   * @param {string} url - The URL to scrape
   * @param {object} options - Scrape configuration
   * @param {string[]} options.formats - Output formats: 'markdown', 'html', 'rawHtml',
   *                                     'screenshot', 'metadata', 'links'
   * @param {boolean} options.renderJs - Use Puppeteer for JS rendering (default: true)
   * @param {string} options.waitFor - CSS selector to wait for before extracting
   * @param {number} options.timeout - Request timeout in ms (default: 30000)
   * @param {boolean} options.bypassCache - Skip cache, force fresh scrape
   * @param {string} options.includeSelector - CSS selector to scope extraction to
   * @param {string} options.excludeSelector - CSS selectors to remove before extraction
   * @param {object} options.chunk - RAG chunking config { maxTokens, overlap }
   */
  async scrape(url, options = {}) {
    return this.#request('POST', '/api/scrape', {
      url,
      formats: options.formats || ['markdown'],
      config: {
        render_js: options.renderJs ?? true,
        wait_for: options.waitFor || null,
        timeout: options.timeout || 30000,
        bypass_cache: options.bypassCache || false,
        selectors: {
          include: options.includeSelector || null,
          exclude: options.excludeSelector || null,
        },
        chunk: options.chunk ? {
          enabled: true,
          max_tokens: options.chunk.maxTokens || 512,
          overlap: options.chunk.overlap || 50,
        } : undefined,
      },
    })
  }

  /**
   * Scrape multiple URLs as a single batch job. All URLs are queued and
   * processed asynchronously. Returns a job ID for progress tracking.
   *
   * @param {string[]} urls - Array of URLs to scrape
   * @param {object} options - Shared scrape config applied to all URLs
   */
  async batchScrape(urls, options = {}) {
    return this.#request('POST', '/api/scrape/batch', {
      urls,
      config: { render_js: options.renderJs ?? true, ...options.config },
    })
  }

  /**
   * Start a multi-page crawl from a seed URL. The crawler discovers internal
   * links and scrapes each page up to the configured depth and page limits.
   *
   * @param {string} url - Seed URL (starting point for the crawl)
   * @param {object} options - Crawl configuration
   * @param {number} options.maxDepth - How many links deep to follow (default: 3, max: 10)
   * @param {number} options.maxPages - Maximum total pages to scrape (default: 50, max: 500)
   * @param {number} options.delayMs - Minimum delay between requests in ms (default: 1000)
   * @param {string[]} options.includePatterns - Regex patterns URLs must match
   * @param {string[]} options.excludePatterns - Regex patterns to skip
   * @param {boolean} options.useSitemap - Check sitemap.xml for URL discovery (default: true)
   * @param {boolean} options.renderJs - Use Puppeteer (default: true)
   */
  async crawl(url, options = {}) {
    return this.#request('POST', '/api/crawl', {
      url,
      max_depth: options.maxDepth || 3,
      max_pages: options.maxPages || 50,
      delay_ms: options.delayMs || 1000,
      include_patterns: options.includePatterns || [],
      exclude_patterns: options.excludePatterns || [],
      use_sitemap: options.useSitemap ?? true,
      render_js: options.renderJs ?? true,
    })
  }

  // =====================
  // Job Management
  // =====================

  /** Get the current status of a job (pending, running, completed, failed, cancelled). */
  async getJob(jobId) {
    return this.#request('GET', '/api/jobs/' + jobId)
  }

  /** Get detailed progress for a crawl or batch job. */
  async getProgress(id) {
    return this.#request('GET', '/api/jobs/' + id + '/progress')
  }

  /** Cancel a running job. Already-scraped pages are kept. */
  async cancelJob(id) {
    return this.#request('POST', '/api/jobs/' + id + '/cancel')
  }

  /**
   * Poll a job until it completes or fails. This is a convenience method
   * that checks the job status every `interval` milliseconds and resolves
   * when the job reaches a terminal state. Throws if the timeout is exceeded.
   *
   * @param {string} jobId - The job to wait for
   * @param {number} options.interval - Polling interval in ms (default: 2000)
   * @param {number} options.timeout - Max wait time in ms (default: 300000 / 5 min)
   */
  async waitForJob(jobId, { interval = 2000, timeout = 300000 } = {}) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const job = await this.getJob(jobId)
      if (job.status === 'completed' || job.status === 'failed') return job
      await new Promise(r => setTimeout(r, interval))
    }
    throw new Error('Job ' + jobId + ' timed out after ' + timeout + 'ms')
  }

  // =====================
  // Results
  // =====================

  /** Retrieve the full result of a scraped page by its result ID. */
  async getResult(id) {
    return this.#request('GET', '/api/results/' + id)
  }

  /** Get RAG-ready chunks for a scraped page. */
  async getChunks(id) {
    return this.#request('GET', '/api/results/' + id + '/chunks')
  }

  // =====================
  // Health
  // =====================

  /** Check server health. This is the only unauthenticated endpoint. */
  async health() {
    const res = await fetch(this.#baseUrl + '/api/health')
    return res.json()
  }
}
```

---

## 4. Browser Integration (ES6 Modules)

The client class above works directly in any modern browser. Import it as an ES module and instantiate it with your server URL and API key. The following examples show common browser-side patterns.

### 4.1 Basic Scrape: Fetch a Page and Display the Markdown

The simplest possible use case: give ForgeCrawl a URL, get back clean Markdown. This is equivalent to copying an article's content by hand, but automated and stripped of navigation, ads, and boilerplate.

The `scrape()` method sends the URL to your ForgeCrawl server, which fetches the page (using Puppeteer for JavaScript rendering by default), runs it through Mozilla Readability to extract the article content, converts the result to Markdown via Turndown, and returns it with YAML frontmatter containing the title, source URL, word count, and scrape timestamp.

```html
<script type="module">
import { ForgeCrawl } from './forgecrawl.js'

const bc = new ForgeCrawl('http://localhost:3000', 'bc_your_api_key_here')

const result = await bc.scrape('https://example.com/article')
console.log(result.formats.markdown)
// Output:
// ---
// title: "Example Article"
// url: "https://example.com/article"
// scraped_at: "2026-03-03T12:00:00Z"
// word_count: 1523
// ---
//
// # Example Article
//
// Content begins here...
</script>
```

### 4.2 Rich Scrape: Markdown + Screenshot + Metadata

Sometimes you need more than just text. The `formats` parameter lets you request multiple output formats from a single scrape. This example fetches the Vue.js introduction page and asks for three things simultaneously: the extracted Markdown, a full-page screenshot (rendered by Puppeteer as a PNG), and the page metadata (title, description, Open Graph tags).

The `includeSelector` option tells ForgeCrawl to extract content only from elements matching `.content`, ignoring the rest of the page. The `excludeSelector` then removes the page navigation and sidebar from within that scope. This two-step targeting is especially useful for documentation sites where the actual content lives inside a specific container.

```javascript
const rich = await bc.scrape('https://vuejs.org/guide/introduction', {
  renderJs: true,
  formats: ['markdown', 'screenshot', 'metadata'],
  includeSelector: '.content',
  excludeSelector: '.page-nav, .sidebar',
})

// The Markdown is clean, scoped to just the content area
console.log(rich.formats.markdown)

// The metadata includes everything from the <head>
console.log(rich.formats.metadata.title)       // "Introduction | Vue.js"
console.log(rich.formats.metadata.description) // "Vue.js - The Progressive..."
console.log(rich.formats.metadata['og:image']) // Open Graph image URL

// The screenshot is a base64-encoded PNG of the full rendered page
// You can display it in an <img> tag or save it
const img = document.createElement('img')
img.src = rich.formats.screenshot  // "data:image/png;base64,..."
document.body.appendChild(img)
```

### 4.3 RAG Chunking: Split Content for LLM Retrieval

When you are building a retrieval-augmented generation (RAG) pipeline, you need content split into token-sized chunks with overlap for context continuity. Passing a `chunk` configuration to `scrape()` tells ForgeCrawl to split the extracted Markdown into chunks after conversion.

Chunking is hierarchical: ForgeCrawl first splits at heading boundaries (H1, H2, H3), then at paragraph boundaries within sections, and accumulates text until reaching the `maxTokens` limit. The `overlap` parameter controls how many tokens from the end of one chunk are repeated at the start of the next, which helps downstream retrieval systems maintain context across chunk boundaries.

Each chunk carries metadata including the heading hierarchy (so you know which section it came from), its position in the document (start, middle, or end), the source URL, the total number of chunks, and whether it contains overlap text from the previous chunk.

```javascript
const result = await bc.scrape('https://nuxt.com/docs/getting-started', {
  chunk: { maxTokens: 512, overlap: 50 },
})

// result.chunks is an array of chunk objects
for (const chunk of result.chunks) {
  console.log('Chunk', chunk.index, '/', chunk.metadata.chunk_of)
  console.log('  Tokens:', chunk.token_count)
  console.log('  Section:', chunk.metadata.heading_hierarchy.join(' > '))
  console.log('  Position:', chunk.metadata.position)  // 'start', 'middle', 'end'
  console.log('  Has overlap:', chunk.metadata.has_overlap)
  console.log('  Content preview:', chunk.content.substring(0, 100) + '...')
}
```

### 4.4 Batch Scrape: Multiple URLs in One Job

When you have a list of specific URLs (not a site to crawl -- just discrete pages), batch scraping is more efficient than calling `scrape()` in a loop. The batch endpoint accepts an array of URLs, creates a single parent job, and queues each URL for processing through the job queue.

Unlike individual scrapes, batch scrapes are always asynchronous. The `batchScrape()` method returns immediately with a job ID. You then poll for completion using `waitForJob()`, which checks the job status every 2 seconds (configurable) until it reaches a terminal state.

This is useful when you know exactly which pages you want -- for example, a list of product pages, a set of API documentation endpoints, or a curated reading list.

```javascript
const batch = await bc.batchScrape([
  'https://example.com/page-1',
  'https://example.com/page-2',
  'https://example.com/page-3',
])
// Returns immediately: { job_id: '...', total_urls: 3, status: 'queued' }

// Wait for all pages to finish (polls every 2 seconds by default)
const completed = await bc.waitForJob(batch.job_id)
console.log('Scraped ' + completed.pages_completed + ' pages')
console.log('Failed: ' + completed.pages_failed)
```

### 4.5 Site Crawl: Follow Links Automatically

Crawling is different from batch scraping. Instead of providing a list of URLs, you provide a single seed URL and let ForgeCrawl discover pages by following internal links. The crawler respects depth limits (how many clicks from the seed URL), page limits (total pages to scrape), URL pattern filters (include/exclude via regex), and robots.txt rules.

If `useSitemap` is enabled (the default), the crawler first checks for a sitemap.xml at the site root. If found, it merges those URLs with the ones discovered through link-following, which often produces more comprehensive results -- especially for sites where some pages are not linked from the main navigation.

The crawl runs asynchronously on the server. You get a job ID back and can monitor progress by polling the progress endpoint. The progress response tells you how many pages have been discovered, completed, failed, and are still pending.

```javascript
const crawl = await bc.crawl('https://docs.example.com', {
  maxDepth: 2,            // Follow links up to 2 clicks from seed
  maxPages: 100,          // Stop after 100 pages
  includePatterns: ['/docs/.*'],     // Only scrape URLs matching this regex
  excludePatterns: ['/blog/.*', '/changelog'],  // Skip these
})
// Returns immediately: { job_id: '...', status: 'queued' }

// Monitor progress with a polling loop
const interval = setInterval(async () => {
  const progress = await bc.getProgress(crawl.job_id)
  console.log(
    progress.progress.completed + '/' + progress.progress.total + ' pages' +
    ' (' + progress.progress.percentage + '%)'
  )
  if (progress.status === 'completed' || progress.status === 'failed') {
    clearInterval(interval)
    console.log('Crawl finished: ' + progress.status)
  }
}, 2000)
```

### 4.6 React Integration

For React applications, a custom hook wraps the client class and manages loading and error state. The hook stores the client instance in a ref (so it persists across re-renders without triggering effects) and exposes a `scrape` function that sets loading to true, makes the API call, stores the result in state, and handles errors.

This pattern keeps your components clean: they call `scrape()` and react to the `loading`, `error`, and `result` state values without managing any async logic directly.

```javascript
// useForgeCrawl.js
import { useState, useCallback, useRef } from 'react'
import { ForgeCrawl } from './forgecrawl'

export function useForgeCrawl(baseUrl, apiKey) {
  const client = useRef(new ForgeCrawl(baseUrl, apiKey))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const scrape = useCallback(async (url, options = {}) => {
    setLoading(true)
    setError(null)
    try {
      const data = await client.current.scrape(url, options)
      setResult(data)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { scrape, loading, error, result }
}

// In a component:
// const { scrape, loading, error, result } = useForgeCrawl(
//   'http://localhost:3000', 'bc_your_key'
// )
// <button onClick={() => scrape('https://example.com')}>Scrape</button>
// {loading && <p>Scraping...</p>}
// {result && <pre>{result.formats.markdown}</pre>}
```

---

## 5. Node.js / CLI Integration

The same client class works in Node.js 18+ without modification (native `fetch` is available). The following scripts are standalone CLI tools that use environment variables for configuration, accept command-line arguments, and write output to the filesystem. Each one is designed to be saved as an `.mjs` file and run directly with `node`.

### 5.1 Scrape a URL and Save to a File

The simplest CLI workflow: pass a URL as the first argument, and ForgeCrawl scrapes it and writes the resulting Markdown to a file. The script reads the server URL and API key from environment variables, making it easy to use in shell scripts and CI pipelines without hardcoding credentials.

This is the building block for more complex automation. You could call this from a cron job, a Makefile, a GitHub Action, or wrap it in a shell loop.

```javascript
#!/usr/bin/env node
// scrape.mjs -- Scrape a single URL to a Markdown file
import { ForgeCrawl } from './forgecrawl.js'
import { writeFile } from 'fs/promises'

const bc = new ForgeCrawl(
  process.env.FORGECRAWL_URL || 'http://localhost:3000',
  process.env.FORGECRAWL_KEY || 'bc_your_key_here'
)

const url = process.argv[2]
const output = process.argv[3] || './output.md'

if (!url) {
  console.error('Usage: node scrape.mjs <url> [output.md]')
  process.exit(1)
}

const result = await bc.scrape(url)
await writeFile(output, result.formats.markdown, 'utf-8')
console.log('Saved: ' + output + ' (' + result.formats.markdown.length + ' chars)')
```

**Usage:**

```bash
export FORGECRAWL_KEY="bc_your_key_here"
node scrape.mjs https://example.com/article ./articles/example.md
```

### 5.2 Crawl a Documentation Site

This script takes a seed URL and crawls the site, following internal links up to 2 levels deep and scraping up to 50 pages. It uses `waitForJob()` to block until the crawl finishes (with a 10-minute timeout), then reports the results.

In a real workflow, you would combine this with the export endpoint to download all scraped pages as a zip of Markdown files or a JSONL stream for pipeline ingestion. The crawl itself stores everything server-side; this script just kicks it off and waits.

```javascript
#!/usr/bin/env node
// crawl-site.mjs -- Crawl a site and wait for completion
import { ForgeCrawl } from './forgecrawl.js'

const bc = new ForgeCrawl(
  process.env.FORGECRAWL_URL || 'http://localhost:3000',
  process.env.FORGECRAWL_KEY
)

const seedUrl = process.argv[2]
if (!seedUrl) {
  console.error('Usage: node crawl-site.mjs <seed-url>')
  process.exit(1)
}

console.log('Starting crawl: ' + seedUrl)
const crawl = await bc.crawl(seedUrl, {
  maxDepth: 2,
  maxPages: 50,
})

console.log('Job ' + crawl.job_id + ' queued. Waiting...')

// waitForJob polls every 2 seconds until completion or failure
const job = await bc.waitForJob(crawl.job_id, { timeout: 600000 })

console.log('Crawl ' + job.status)
console.log('  Pages completed: ' + job.pages_completed)
console.log('  Pages failed: ' + job.pages_failed)
console.log('  Pages discovered: ' + job.pages_discovered)
```

**Usage:**

```bash
node crawl-site.mjs https://docs.nuxt.com
```

### 5.3 Batch Scrape from a URL List File

When you have a text file with one URL per line (exported from a spreadsheet, generated by another tool, or curated by hand), this script reads it, submits all URLs as a batch job, and waits for completion. This is a common pattern for content migration, archival, and compliance auditing.

The script filters out blank lines and whitespace, so you don't need to worry about trailing newlines in your URL file.

```javascript
#!/usr/bin/env node
// batch-scrape.mjs -- Batch scrape URLs from a text file
import { ForgeCrawl } from './forgecrawl.js'
import { readFile } from 'fs/promises'

const bc = new ForgeCrawl(
  process.env.FORGECRAWL_URL || 'http://localhost:3000',
  process.env.FORGECRAWL_KEY
)

const urlFile = process.argv[2]
if (!urlFile) {
  console.error('Usage: node batch-scrape.mjs <urls.txt>')
  process.exit(1)
}

// Read URLs from file (one per line, blank lines ignored)
const content = await readFile(urlFile, 'utf-8')
const urls = content.split('\n').map(l => l.trim()).filter(Boolean)

console.log('Batch scraping ' + urls.length + ' URLs...')
const batch = await bc.batchScrape(urls)

console.log('Job ' + batch.job_id + ' queued. Waiting...')
const job = await bc.waitForJob(batch.job_id, { timeout: 600000 })
console.log('Batch ' + job.status + ': ' + job.pages_completed + '/' + urls.length + ' pages')
```

**Usage:**

```bash
# Create a URL list
cat > urls.txt << EOF
https://example.com/page-1
https://example.com/page-2
https://example.com/page-3
EOF

node batch-scrape.mjs urls.txt
```

### 5.4 Generate RAG-Ready JSONL Output

This script is purpose-built for RAG (Retrieval-Augmented Generation) pipelines. It scrapes a URL with chunking enabled, then writes the chunks as a JSONL file -- one JSON object per line, each containing the chunk text, token count, source URL, heading hierarchy, and positional metadata.

JSONL is the standard input format for vector database ingestion tools, embedding pipelines, and data loaders like LangChain and LlamaIndex. Each line is a self-contained JSON object, which means you can stream the file line by line without loading the whole thing into memory.

The `includeSelector` targets common content containers (article, .content, main), and the `excludeSelector` strips navigation, footers, sidebars, and comment sections. This combination produces chunks that contain only the substantive content of the page.

```javascript
#!/usr/bin/env node
// rag-pipeline.mjs -- Scrape a URL into RAG-ready JSONL chunks
import { ForgeCrawl } from './forgecrawl.js'
import { writeFile } from 'fs/promises'

const bc = new ForgeCrawl(
  process.env.FORGECRAWL_URL || 'http://localhost:3000',
  process.env.FORGECRAWL_KEY
)

const url = process.argv[2]
const output = process.argv[3] || './chunks.jsonl'

if (!url) {
  console.error('Usage: node rag-pipeline.mjs <url> [output.jsonl]')
  process.exit(1)
}

const result = await bc.scrape(url, {
  chunk: { maxTokens: 512, overlap: 50 },
  includeSelector: 'article, .content, main',
  excludeSelector: 'nav, footer, .sidebar, .comments',
})

const chunks = result.chunks || []
const avgTokens = chunks.length > 0
  ? Math.round(chunks.reduce((s, c) => s + c.token_count, 0) / chunks.length)
  : 0

console.log(chunks.length + ' chunks, avg ' + avgTokens + ' tokens each')

// Write one JSON object per line (JSONL format)
const jsonl = chunks.map(c => JSON.stringify({
  text: c.content,
  tokens: c.token_count,
  source: url,
  headings: c.metadata.heading_hierarchy,
  position: c.metadata.position,
})).join('\n')

await writeFile(output, jsonl, 'utf-8')
console.log('Saved: ' + output)
```

**Usage:**

```bash
node rag-pipeline.mjs https://docs.nuxt.com/getting-started ./nuxt-chunks.jsonl
# Output: 12 chunks, avg 478 tokens each
# Saved: ./nuxt-chunks.jsonl
```

---

## 6. curl Examples

curl is the universal HTTP client. These examples work on any system with curl and jq installed, and they serve as the ground-truth reference for what the raw API requests and responses look like. Every client library and integration ultimately generates these same HTTP calls.

Set up your environment variables once, then copy-paste any of the commands below.

```bash
export BC_KEY="bc_your_api_key_here"
export BC_URL="http://localhost:3000"
```

**Check server health.** This is the only endpoint that doesn't require authentication. It returns the server's uptime, memory usage, database status, Puppeteer browser status, and queue depth. Use it for monitoring, load balancer health checks, or just confirming the server is running.

```bash
curl $BC_URL/api/health | jq .
```

**Scrape a single URL.** The simplest API call. Sends a URL, gets back Markdown. By default, Puppeteer renders the page with JavaScript before extraction.

```bash
curl -X POST $BC_URL/api/scrape \
  -H "Authorization: Bearer $BC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' | jq .
```

**Scrape with multiple formats and CSS selectors.** This request asks for three output formats simultaneously: Markdown, a screenshot, and metadata. The `include` selector targets only the content area of the page, while `exclude` strips out the navigation and footer. The response contains all three formats in a single JSON object.

```bash
curl -X POST $BC_URL/api/scrape \
  -H "Authorization: Bearer $BC_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://nuxt.com/docs/getting-started",
    "formats": ["markdown", "screenshot", "metadata"],
    "config": {
      "render_js": true,
      "selectors": {
        "include": ".document-driven-page",
        "exclude": ".aside-nav, .page-footer"
      }
    }
  }' | jq .
```

**Scrape and pipe the Markdown directly to a file.** The `-s` flag silences curl's progress output, and `jq -r` extracts the raw Markdown string (without JSON escaping) so the output file is a valid Markdown document you can open in any editor.

```bash
curl -s -X POST $BC_URL/api/scrape \
  -H "Authorization: Bearer $BC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}' \
  | jq -r '.formats.markdown' > article.md
```

**Scrape a PDF.** ForgeCrawl detects the content type automatically. When the URL points to a PDF (by content-type header or .pdf extension), the server uses pdf-parse to extract the text instead of Readability, and returns Markdown with frontmatter that includes the page count and author.

```bash
curl -X POST $BC_URL/api/scrape \
  -H "Authorization: Bearer $BC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/report.pdf"}' | jq .
```

**Batch scrape multiple URLs.** Submits three URLs as a single batch job. The response returns immediately with a job ID; the actual scraping happens asynchronously on the server.

```bash
curl -X POST $BC_URL/api/scrape/batch \
  -H "Authorization: Bearer $BC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://a.com", "https://b.com", "https://c.com"]}' | jq .
```

**Start a site crawl.** Initiates an asynchronous crawl starting from the seed URL. The crawler checks sitemap.xml first (if `use_sitemap` is true), then follows internal links up to the specified depth, scraping each page it discovers.

```bash
curl -X POST $BC_URL/api/crawl \
  -H "Authorization: Bearer $BC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com", "max_depth": 2, "max_pages": 50}' | jq .
```

**Check job progress.** Replace JOB_ID with the actual job ID returned by the crawl or batch endpoint. The response shows how many pages are completed, failed, pending, and running.

```bash
curl $BC_URL/api/jobs/JOB_ID/progress \
  -H "Authorization: Bearer $BC_KEY" | jq .
```

**Cancel a running job.** Stops a crawl or batch in progress. Pages already scraped are kept; remaining queued pages are discarded.

```bash
curl -X POST $BC_URL/api/jobs/JOB_ID/cancel \
  -H "Authorization: Bearer $BC_KEY" | jq .
```

**Export crawl results as JSONL.** Downloads all scraped pages from a job as a JSONL file (one JSON object per line). This format is ideal for feeding into data pipelines, vector databases, or LLM context windows.

```bash
curl $BC_URL/api/jobs/JOB_ID/export?format=jsonl \
  -H "Authorization: Bearer $BC_KEY" > results.jsonl
```

**Export crawl results as a zip of Markdown files.** Downloads all scraped pages as a zip archive where each page is a separate Markdown file with frontmatter. Useful for archival, migration, or offline reading.

```bash
curl $BC_URL/api/jobs/JOB_ID/export?format=zip \
  -H "Authorization: Bearer $BC_KEY" -o results.zip
```

---

## 7. Real-World Use Case Recipes

The examples above cover individual API calls. The recipes below combine multiple calls into complete workflows that solve specific problems. Each recipe includes context on when and why you would use it, followed by the implementation.

### 7.1 Build a Knowledge Base for an LLM

**The problem:** You have a documentation site (or any content-heavy site) and you want to feed its contents into an LLM -- either as context for a chatbot, as training data, or as a retrieval corpus for RAG. Manually copying pages is impractical, and the site has hundreds or thousands of pages.

**The solution:** Use ForgeCrawl's crawl endpoint to discover and scrape every page on the site, then export the results as JSONL with RAG chunks. The crawler follows internal links, respects robots.txt, and produces clean Markdown with heading-aware chunking. The output is ready to feed directly into a vector database (Pinecone, Weaviate, Chroma, pgvector) or an embedding pipeline.

**Key decisions:** Set `maxPages` high enough to cover the site, use `includePatterns` to limit the crawl to documentation pages (skip blog posts, changelogs, and marketing pages), and choose a `maxDepth` that matches the site's link structure. Most documentation sites are fully reachable within 3-5 link hops from the root.

```javascript
const bc = new ForgeCrawl('http://localhost:3000', process.env.FORGECRAWL_KEY)

const { job_id } = await bc.crawl('https://docs.yourcompany.com', {
  maxDepth: 5,
  maxPages: 500,
  includePatterns: ['/docs/.*'],
  excludePatterns: ['/blog/.*', '/changelog', '/api-reference/internal'],
})

// This may take 10-30 minutes for a large site
const job = await bc.waitForJob(job_id, { timeout: 1800000 })
console.log('Crawled ' + job.pages_completed + ' pages')

// Export as JSONL: each line is { url, title, markdown, chunks }
// Pipe this directly into your vector DB ingestion script
```

### 7.2 Monitor Competitor Pricing Pages

**The problem:** You want to track competitor pricing over time. Pricing pages are typically JavaScript-rendered (React/Vue SPAs), change without notice, and don't have RSS feeds.

**The solution:** Batch scrape the pricing pages on a schedule (via cron), save the Markdown output, and diff against previous runs to detect changes. Because ForgeCrawl renders JavaScript, it can capture dynamically loaded pricing tables, toggles between monthly/annual billing, and other interactive elements that static scrapers miss.

```javascript
const urls = [
  'https://competitor-a.com/pricing',
  'https://competitor-b.com/pricing',
  'https://competitor-c.com/pricing',
]

const batch = await bc.batchScrape(urls, { renderJs: true })
const job = await bc.waitForJob(batch.job_id)

// Each result contains clean Markdown of the pricing page
// Save to files named by date for easy diffing:
// ./pricing/2026-03-03/competitor-a.md
// Compare against yesterday's run to detect changes
```

### 7.3 Archive a Blog Before Migration

**The problem:** You are migrating a blog from one platform to another (WordPress to Hugo, Ghost to Astro, etc.) and need every post exported as clean Markdown with frontmatter. The blog has years of content and no reliable export tool.

**The solution:** Crawl the entire blog with ForgeCrawl, setting a high page limit and using URL patterns to target only post pages (skipping category pages, tag pages, author pages, and pagination). Export the results as a zip of Markdown files. Each file has YAML frontmatter with the title, URL, and date -- ready to drop into a static site generator.

```javascript
const { job_id } = await bc.crawl('https://oldblog.example.com', {
  maxDepth: 10,         // Blogs often have deep pagination
  maxPages: 1000,       // Adjust to match your blog's size
  includePatterns: ['/posts/.*', '/articles/.*', '/\\d{4}/\\d{2}/.*'],
  excludePatterns: ['/tag/', '/category/', '/author/', '/page/\\d+'],
})

const job = await bc.waitForJob(job_id, { timeout: 3600000 })
console.log('Archived ' + job.pages_completed + ' posts')

// Download as zip via the export endpoint:
// GET /api/jobs/{job_id}/export?format=zip
// Each post becomes a .md file with frontmatter
```

### 7.4 Feed Scraped Content to Claude via the Anthropic API

**The problem:** You want to use Claude to analyze, summarize, or answer questions about web content, but Claude's knowledge has a cutoff date and it cannot browse the web on its own (outside of built-in tools).

**The solution:** Use ForgeCrawl to scrape the page into clean Markdown, then pass that Markdown as context in a Claude API call. The Markdown is already optimized for LLM consumption -- boilerplate removed, headings preserved, code blocks properly formatted. This two-step pattern (scrape then prompt) is the foundation of any LLM-powered content analysis workflow.

```javascript
import Anthropic from '@anthropic-ai/sdk'
import { ForgeCrawl } from './forgecrawl.js'

const bc = new ForgeCrawl('http://localhost:3000', process.env.FORGECRAWL_KEY)
const anthropic = new Anthropic()

// Step 1: Scrape the page into clean Markdown
const { formats } = await bc.scrape('https://docs.nuxt.com/getting-started')

// Step 2: Send the Markdown to Claude as context
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: 'Summarize this documentation page. '
      + 'Focus on the key concepts a beginner needs to understand.\n\n'
      + formats.markdown,
  }],
})

console.log(response.content[0].text)
```

### 7.5 Screenshot Gallery for Visual Regression Testing

**The problem:** You want to capture screenshots of every page on your site after a deployment, so you can visually compare them against the previous version and catch layout regressions.

**The solution:** Loop through your site's key pages, scrape each one with `formats: ['screenshot']` and JavaScript rendering enabled, then decode the base64 PNG and save it to disk. Compare these screenshots against a baseline set using any image diffing tool (pixelmatch, BackstopJS, or manual review).

ForgeCrawl's screenshots are full-page captures (not just the viewport), so they include below-the-fold content. The screenshots are rendered at 1280x800 viewport by default (configurable via Puppeteer settings).

```javascript
import { writeFile, mkdir } from 'fs/promises'

await mkdir('./screenshots', { recursive: true })

const pages = ['/', '/about', '/pricing', '/docs', '/contact']

for (const path of pages) {
  const result = await bc.scrape('https://yoursite.com' + path, {
    formats: ['screenshot'],
    renderJs: true,
  })

  // Convert base64 PNG to a file
  const slug = path.replace(/\//g, '_') || '_index'
  const base64Data = result.formats.screenshot.replace(/^data:image\/png;base64,/, '')
  await writeFile(
    './screenshots/' + slug + '.png',
    Buffer.from(base64Data, 'base64')
  )
  console.log('Captured: ' + path)
}
```

### 7.6 Convert Government PDFs to Searchable Markdown

**The problem:** Government agencies publish reports, grant documents, and policy papers as PDFs. These PDFs are often scanned or poorly structured, making them hard to search, quote, or feed into LLMs.

**The solution:** Point ForgeCrawl at the PDF URLs. It detects the content type, routes the document through pdf-parse for text extraction, and returns the content as Markdown with frontmatter that includes the page count, title, and author fields from the PDF metadata. This works for text-based PDFs; scanned image PDFs would need OCR (not included in ForgeCrawl).

This is particularly relevant for state agency work where compliance documents, RFPs, and legislative reports are published as PDFs and need to be made accessible or searchable.

```javascript
const pdfUrls = [
  'https://agency.gov/reports/annual-2025.pdf',
  'https://agency.gov/reports/quarterly-q4.pdf',
  'https://agency.gov/grants/rfp-2026.pdf',
]

for (const url of pdfUrls) {
  const result = await bc.scrape(url)

  // Frontmatter includes PDF-specific metadata
  console.log(url)
  console.log('  Title: ' + (result.formats.metadata?.title || 'untitled'))
  console.log('  Pages: ' + (result.formats.metadata?.pages || 'unknown'))
  console.log('  Characters: ' + result.formats.markdown.length)

  // Save each PDF's extracted text as a Markdown file
  const filename = url.split('/').pop().replace('.pdf', '.md')
  await writeFile('./pdf-output/' + filename, result.formats.markdown, 'utf-8')
}
```

### 7.7 Scrape Behind a Login Wall

**The problem:** Some content you need is behind a login -- an internal wiki, a paywalled site, a customer portal. Standard scraping tools cannot access this content because they do not have valid session credentials.

**The solution:** ForgeCrawl supports two authentication strategies for target sites (not to be confused with ForgeCrawl's own API authentication). You configure credentials through the admin UI, and ForgeCrawl stores them encrypted in the database.

**Cookie injection** is the simpler approach: export your session cookies from your browser's developer tools (or a browser extension like EditThisCookie), paste them into ForgeCrawl's credential manager, and all subsequent scrapes to that domain will include those cookies. This works for sites that use session cookies for auth.

**Form-based login** is the automated approach: provide the login URL, your username and password, and the CSS selectors for the username field, password field, and submit button. ForgeCrawl uses Puppeteer to navigate to the login page, fill in the form, click submit, wait for the redirect, and then use the resulting session cookies for scraping. This is more fragile (it breaks if the login form changes) but fully automated.

In both cases, credentials are encrypted with AES-256-GCM before being stored and are only decrypted in memory at fetch time.

```javascript
// Once credentials are configured via the admin UI for a domain,
// scrapes to that domain automatically use them. No code changes needed.
const result = await bc.scrape('https://internal.company.com/wiki/architecture', {
  renderJs: true,
})

// The scrape happens with your stored credentials.
// The response is the same as any other scrape.
console.log(result.formats.markdown)
```

---

## 8. Error Handling

All ForgeCrawl API errors return a JSON object with `statusCode` and `message` fields. The client class throws an Error that includes both values in its message string, so you can inspect the status code to determine the cause.

The most common errors you will encounter:

| Status | Meaning | Typical Cause |
|--------|---------|---------------|
| 400 | Bad Request | Invalid URL (private IP, non-HTTP protocol), missing required field, malformed config |
| 401 | Unauthorized | Missing or invalid API key, expired session |
| 403 | Forbidden | Attempting to access admin routes as a regular user, hitting /api/auth/setup after initial setup |
| 429 | Rate Limited | Too many requests. The response includes a Retry-After header. |
| 500 | Server Error | Scrape failed (navigation timeout, browser crash, target site returned error) |

```javascript
try {
  const result = await bc.scrape('https://example.com')
} catch (err) {
  if (err.message.includes('401')) {
    console.error('Authentication failed. Check your API key.')
  } else if (err.message.includes('429')) {
    console.error('Rate limit exceeded. Wait and retry.')
  } else if (err.message.includes('400')) {
    console.error('Bad request: ' + err.message)
  } else {
    console.error('Scrape failed: ' + err.message)
  }
}
```

---

## 9. Rate Limits

ForgeCrawl enforces per-user rate limits to prevent accidental or intentional resource exhaustion. The default limits are set by the admin and can be adjusted per-role.

| Role | Scrapes/hour | Crawls/hour | Max pages/crawl |
|------|-------------|-------------|-----------------|
| admin | Unlimited | Unlimited | 500 |
| user | 60 | 5 | 100 |

Every API response includes rate limit headers so your code can adapt:

| Header | Meaning |
|--------|---------|
| X-RateLimit-Limit | Maximum requests allowed in the current window |
| X-RateLimit-Remaining | Requests remaining before throttling |
| X-RateLimit-Reset | Unix timestamp when the window resets |

When you hit the limit, the server returns a 429 status with a `Retry-After` header indicating how many seconds to wait.

---

## 10. Response Shapes

### Single Scrape Response

This is what comes back from `POST /api/scrape`. The `formats` object contains whichever formats you requested (markdown is always included). The `cached` field tells you whether this result was served from the cache or freshly scraped. The `metadata` object includes extraction details, word count, and the method used (readability or fallback).

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/article",
  "cached": false,
  "formats": {
    "markdown": "---\ntitle: \"Article Title\"\n...\n---\n\n# Article Title\n\nContent...",
    "html": "<article><h1>Article Title</h1><p>Content...</p></article>",
    "screenshot": "data:image/png;base64,...",
    "metadata": {
      "title": "Article Title",
      "description": "A summary of the article",
      "extraction_method": "readability",
      "word_count": 1523,
      "scraped_at": "2026-03-03T12:00:00Z"
    }
  }
}
```

### Job Progress Response

Returned by `GET /api/jobs/:id/progress` for crawl and batch jobs. The `percentage` field gives you a quick completion estimate, while the individual counts let you build more nuanced progress indicators.

```json
{
  "job_id": "...",
  "status": "running",
  "job_type": "crawl",
  "progress": {
    "total": 47,
    "completed": 23,
    "failed": 1,
    "pending": 20,
    "running": 3,
    "percentage": 49
  }
}
```

### RAG Chunks Response

Returned by `GET /api/results/:id/chunks`. Each chunk is a contiguous section of the source document, split at heading and paragraph boundaries, with token counts and positional metadata. The `heading_hierarchy` array tells you which section(s) the chunk belongs to, which is valuable for downstream retrieval systems that want to filter or weight by section.

```json
{
  "result_id": "...",
  "url": "https://example.com/article",
  "total_chunks": 5,
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
      "content": "...continued from previous section.\n\n## Methods\n\nThe approach...",
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

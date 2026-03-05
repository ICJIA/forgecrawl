# ForgeCrawl vs Firecrawl — Differentiation Analysis

**Version:** 1.0
**Date:** March 3, 2026

---

## 1. Firecrawl Architecture (What We Learned)

Firecrawl is a **5+ container Docker Compose deployment** built as a cloud SaaS first, with self-hosting as a secondary concern. Its stack:

| Component | Technology | Required? |
|-----------|-----------|-----------|
| API Server | Express.js (Node) | Yes |
| Job Queue | Redis + BullMQ | Yes |
| Message Queue | RabbitMQ | Yes |
| Database | PostgreSQL (custom "nuq-postgres") | Yes |
| JS Rendering | Playwright (separate microservice) | Yes |
| HTML-to-MD | Go service (separate process) | Yes |
| Auth | Built-in (Supabase optional) | No |

**To self-host Firecrawl, you must run 5 Docker containers minimum** (API, Redis, RabbitMQ, Postgres, Playwright), with a recommended 8GB RAM allocation. The architecture is designed around horizontal scaling for their cloud product, not simplicity for self-hosters.

### Key Firecrawl Pain Points for Self-Hosters

1. **No admin UI at all.** Firecrawl is API-only. No dashboard, no user management, no visual feedback. You interact entirely via curl or SDKs.
2. **No first-run experience.** Setup requires manually configuring 20+ environment variables, running Docker Compose, and understanding the multi-service architecture.
3. **Cloud features locked behind proprietary "fire-engine."** The self-hosted version lacks features available in their cloud product (screenshot capture, advanced JS rendering, some Actions).
4. **Billing/credit system baked into the codebase.** Even when self-hosting, you're running code designed around usage tracking, Stripe integration, and credit limits -- unnecessary complexity.
5. **AGPL-3.0 license.** Any modifications to the server code must be released as open source. This is intentionally restrictive to drive cloud adoption.
6. **Separate Go service for Markdown conversion.** The HTML-to-Markdown pipeline runs in a separate Go process, adding operational complexity and inter-process communication overhead.
7. **Heavy resource requirements.** The official Docker setup recommends 4 CPU / 8GB RAM just for the API container, plus 2 CPU / 4GB for Playwright. Realistic minimum: 16GB RAM total.
8. **No built-in RAG/chunking support.** Firecrawl outputs raw Markdown. Chunking for LLM context windows is left entirely to the consumer.

---

## 2. ForgeCrawl Differentiation Strategy

### Philosophy: "One Process, One Server, Your Data"

ForgeCrawl is designed from the ground up for **solo developers, small teams, and state/gov agencies** who need a private web scraper without the operational overhead of a distributed system.

### Head-to-Head Comparison

| Dimension | Firecrawl | ForgeCrawl |
|-----------|-----------|------------|
| **Deployment** | 5+ Docker containers | Single Node process + PM2 |
| **Minimum RAM** | 16 GB | 4 GB |
| **Setup Time** | 30-60 min (Docker + env config) | 5 min (pnpm build + PM2 start) |
| **First Run** | Manual env var config | Browser-based admin registration |
| **Admin UI** | None (API only) | Full Nuxt UI dashboard |
| **User Management** | External (Supabase optional) | Built-in admin panel |
| **Auth** | API key only | API key + session auth + first-run setup |
| **Job Queue** | Redis + RabbitMQ (required) | SQLite-backed (zero extra services) |
| **JS Rendering** | Playwright microservice | Puppeteer (in-process) |
| **HTML-to-MD** | Go service (separate process) | Turndown (in-process JavaScript) |
| **RAG Chunking** | Not included | Built-in token-aware chunking |
| **Document Extraction** | PDF and DOCX | PDF (pdf-parse) and DOCX (mammoth) |
| **Login-Gated Scraping** | Via Actions (cloud only for some) | Native cookie/form-login support |
| **Export Formats** | JSON, Markdown | JSON, JSONL, Markdown, Zip |
| **Storage** | API response only (no persistence UI) | Configurable database (SQLite default) + filesystem with browsable history |
| **License** | AGPL-3.0 | MIT |
| **Package Manager** | pnpm | pnpm |
| **Framework** | Express.js (bare) | Nuxt 4 (full-stack SSR) |
| **Ongoing Cost** | $0 (self-host) or $16+/mo cloud | $0 (SQLite default) + DO droplet ($24-48/mo) |

### What ForgeCrawl Does NOT Try To Be

ForgeCrawl intentionally excludes features that add complexity without serving the self-hosted use case:

- **No billing/credit system.** You own the server. No metering.
- **No proxy infrastructure.** If you need proxies, configure them at the network level.
- **No search API.** ForgeCrawl scrapes URLs you give it. It doesn't crawl the web for you.
- **No AI extraction (yet).** Firecrawl's JSON extraction mode uses OpenAI. ForgeCrawl focuses on clean Markdown and lets you pipe that into your own LLM pipeline.
- **No multi-region deployment.** Single server, single process. If you need global distribution, use a CDN or run multiple instances.

---

## 3. Unique ForgeCrawl Features (Not in Firecrawl)

### 3.1 First-Run Admin Setup

No Firecrawl equivalent. ForgeCrawl detects a fresh install and walks you through admin account creation in the browser. Zero config files needed beyond the .env.

### 3.2 Full Admin Dashboard

Firecrawl has no UI. ForgeCrawl provides:
- Visual scrape history with Markdown preview
- Crawl progress with real-time updates
- User management panel
- API key management with usage tracking
- Storage statistics and system health
- Site credential management for gated scraping

### 3.3 Built-in RAG Chunking

Firecrawl returns raw Markdown. ForgeCrawl optionally splits output into token-aware chunks with heading hierarchy metadata, overlap configuration, and position tracking. Output is immediately consumable by RAG pipelines.

### 3.4 Browsable Scrape History

Every scrape is stored and browsable. You can search past scrapes, re-export results, compare versions, and bulk-export crawl results as JSONL or zip.

### 3.5 Configurable Dual Storage

Choose database-only, filesystem-only, or both. Filesystem storage is organized by job/result ID with raw HTML, clean Markdown, metadata JSON, and chunk files. The database (SQLite by default) stores metadata for fast querying regardless of storage mode.

### 3.6 Zero-Dependency Queue

Firecrawl requires Redis AND RabbitMQ for job queuing. ForgeCrawl uses SQLite with `BEGIN IMMEDIATE` transactions -- zero additional services. The interface is abstract, so Redis can be swapped in later without code changes.

### 3.7 Marketing & Documentation Website

The monorepo includes a deployable Nuxt Content site explaining ForgeCrawl, with live Markdown samples, setup guides, and API documentation. Deploy it alongside the app or separately on Netlify/Vercel.

---

## 4. Positioning Statement

> **ForgeCrawl** is a self-hosted web scraper for people who want clean Markdown from any website without running a distributed system. One server, one process, full admin UI, built-in RAG chunking. Inspired by Firecrawl, designed for humans who deploy their own tools.

---

## 5. Markdown Output Comparison

### Firecrawl Output (typical)

```markdown
# Example Article

This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.

[More information...](https://www.iana.org/domains/example)
```

### ForgeCrawl Output (same page, with frontmatter + metadata)

```markdown
---
title: "Example Domain"
url: "https://example.com"
scraped_at: "2026-03-03T12:00:00Z"
word_count: 28
source: "IANA"
scraper: "ForgeCrawl/1.0"
---

# Example Domain

This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.

[More information...](https://www.iana.org/domains/example)
```

### ForgeCrawl RAG Chunk Output (same page, chunked)

```json
{
  "chunks": [
    {
      "index": 0,
      "content": "# Example Domain\n\nThis domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.",
      "token_count": 32,
      "metadata": {
        "heading_hierarchy": ["Example Domain"],
        "position": "start",
        "source_url": "https://example.com",
        "chunk_of": 1,
        "has_overlap": false
      }
    }
  ]
}
```

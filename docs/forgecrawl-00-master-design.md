# ForgeCrawl — Master Design Document

**Version:** 1.0  
**Date:** March 3, 2026  
**Author:** cschweda  
**Status:** Draft

---

## 1. Project Overview

ForgeCrawl is a self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption. Inspired by Firecrawl, ForgeCrawl fills a gap in the open-source ecosystem: a self-hosted solution with proper authentication, a management UI, and LLM-ready output — without SaaS dependencies or public endpoints.

### Core Value Proposition

- **Self-hosted & private:** Runs on your own infrastructure with no public API endpoints
- **Authenticated:** Built-in bcrypt + JWT auth with first-run admin registration, multi-user support, and API key access
- **LLM-optimized:** Outputs clean Markdown with optional RAG-ready chunking and metadata
- **Full rendering:** Puppeteer-based JavaScript rendering for SPAs and dynamic content
- **Login-gated scraping:** Can authenticate against target sites to scrape protected content

### What ForgeCrawl Is Not

- A public API service or SaaS platform
- A search engine crawler or indexer
- A general-purpose web archiver

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Nuxt 4 | >=4.3.1 |
| UI | Nuxt UI | 4+ |
| Package Manager | pnpm | latest |
| Runtime | Node.js | latest LTS |
| Auth | Built-in (bcrypt + jose JWT) | — |
| Database | SQLite via better-sqlite3 | latest |
| ORM | Drizzle ORM | latest |
| JS Rendering | Puppeteer | latest |
| Content Extraction | Mozilla Readability | latest |
| HTML to Markdown | Turndown | latest |
| Process Manager | PM2 | latest |
| Hosting | DigitalOcean Droplet | see Deployment section |

### Key Libraries

- **puppeteer** — headless Chromium for JS-rendered pages
- **@mozilla/readability** — article content extraction (same engine as Firefox Reader View)
- **turndown** — HTML-to-Markdown conversion with plugin support
- **turndown-plugin-gfm** — GitHub Flavored Markdown tables, strikethrough, task lists
- **better-sqlite3** — embedded SQLite database (zero-config, WAL mode)
- **drizzle-orm** — type-safe ORM for SQLite (and Postgres, if upgrading later)
- **bcrypt** — password hashing (12 salt rounds)
- **jose** — JWT signing and verification (HS256)
- **cheerio** — fast HTML parsing for non-JS pages
- **robots-parser** — robots.txt compliance

---

## 3. Architecture

```
+-----------------------------------------------------+
|                   Nuxt 4 Application                 |
|                                                      |
|  +--------------+  +----------------------------+    |
|  |  Nuxt UI     |  |  Nitro Server              |    |
|  |  Admin Panel  |  |                            |    |
|  |              |  |  +----------------------+   |    |
|  |  - Dashboard |  |  |  Auth Middleware      |   |    |
|  |  - Scrapes   |  |  |  (bcrypt/JWT +       |   |    |
|  |  - Users     |  |  |   API Key validation)|   |    |
|  |  - Settings  |  |  +----------+-----------+   |    |
|  |  - API Keys  |  |             |               |    |
|  +--------------+  |  +----------v-----------+   |    |
|                    |  |  API Routes           |   |    |
|                    |  |  /api/scrape          |   |    |
|                    |  |  /api/crawl           |   |    |
|                    |  |  /api/jobs            |   |    |
|                    |  |  /api/admin/*         |   |    |
|                    |  +----------+-----------+   |    |
|                    |             |               |    |
|                    |  +----------v-----------+   |    |
|                    |  |  Scraping Engine      |   |    |
|                    |  |                       |   |    |
|                    |  |  HTTP Fetch ---+      |   |    |
|                    |  |  Puppeteer ----+      |   |    |
|                    |  |               v      |   |    |
|                    |  |  Readability -> Clean |   |    |
|                    |  |  Turndown --> MD      |   |    |
|                    |  |  Chunker --> RAG      |   |    |
|                    |  +-----------------------+   |    |
|                    +----------------------------+    |
+-------------------------+----------------------------+
                          |
            +-------------v--------------+
            |    SQLite (local file)     |
            |                            |
            |  - Auth (users, sessions)  |
            |  - Jobs, scrape history    |
            |  - WAL mode, Drizzle ORM   |
            +----------------------------+

            +----------------------------+
            |   Local Filesystem (opt.)  |
            |                            |
            |  /data/scrapes/            |
            |    +-- {id}/               |
            |    |   +-- raw.html        |
            |    |   +-- content.md      |
            |    |   +-- chunks.json     |
            +----------------------------+
```

### Request Flow

1. Client sends request (browser session or API key in header)
2. Nitro middleware validates authentication
3. Route handler dispatches to scraping engine
4. Engine fetches page (HTTP or Puppeteer based on config)
5. Readability extracts article content
6. Turndown converts to Markdown
7. Optional: Chunker splits into RAG-ready segments
8. Results stored per configuration (database, filesystem, or both)
9. Response returned to client

---

## 4. Data Model

### Core Tables (SQLite via Drizzle ORM)

The database schema is defined in TypeScript using Drizzle ORM (`server/db/schema.ts`). See Document 11 for the complete schema definition. Key tables:

- **app_config** — first-run detection and application settings
- **users** — built-in auth (email, bcrypt password hash, role)
- **api_keys** — bcrypt-hashed API keys with prefix for lookup
- **scrape_jobs** — job tracking (single, crawl, batch)
- **scrape_results** — scraped content (Markdown, HTML, metadata)
- **scrape_chunks** — RAG-ready content chunks with token counts
- **job_queue** — SQLite-backed job queue (pending, locked, completed)
- **site_credentials** — encrypted credentials for login-gated scraping
- **usage_log** — per-user action tracking

The database auto-creates on first run. SQLite runs in WAL mode with `busy_timeout = 5000` for concurrent read/write safety. Drizzle Kit handles migrations automatically on startup.

**Supabase/Postgres migration path:** The same Drizzle schema can target Postgres by swapping `sqliteTable` for `pgTable`. Set `NUXT_DB_BACKEND=supabase` in your env to switch. See Document 11, Section 10.

---

## 5. Authentication Architecture

### First-Run Flow

1. App boots, checks `app_config` for `setup_complete` key
2. If not found, redirects all routes to `/setup`
3. `/setup` page collects admin email + password
4. Hashes password with bcrypt (12 rounds), creates user row with `role: 'admin'`
5. Sets `setup_complete: true` in `app_config`
6. Issues JWT session cookie and redirects to dashboard

### Session Auth (Browser)

- Login endpoint validates password with bcrypt, issues signed JWT (jose, HS256)
- JWT stored in HTTP-only, Secure, SameSite=Lax cookie (`forgecrawl_session`)
- Server middleware validates JWT on every `/api/*` request
- 7-day expiry with sliding renewal

### API Key Auth (Programmatic)

- Admin or user generates API key in dashboard
- Key shown once, stored as bcrypt hash
- Requests include `Authorization: Bearer bc_xxxxxxxxxxxx`
- Server middleware checks `api_keys` table, validates hash
- Falls back to session cookie JWT if no API key header

### Auth Middleware Priority

```
1. Check for API key header -> validate against api_keys table
2. Check for session cookie -> validate JWT signature and expiry
3. Reject with 401
```

---

## 6. Scraping Engine Design

### Pipeline

```
URL Input
    |
    +-- Config Check: render_js?
    |   +-- YES -> Puppeteer (launch browser, navigate, wait)
    |   +-- NO  -> HTTP fetch (lighter, faster)
    |
    v
Raw HTML
    |
    +-- Readability: extract article content
    |   (removes nav, ads, sidebars, footers)
    |
    v
Clean HTML
    |
    +-- Turndown: convert to Markdown
    |   (with GFM plugin for tables)
    |
    v
Markdown Output
    |
    +-- Optional: RAG Chunker
    |   (split by headings, paragraphs, token count)
    |
    v
Storage (Database / Filesystem / Both)
```

### Puppeteer Management

- Single browser instance shared across requests (reuse pages)
- Configurable concurrency limit (default: 3 pages)
- Auto-restart on crash
- Page timeout: 30 seconds default
- Network idle wait: `networkidle2` (2 or fewer connections for 500ms)

### Content Extraction Options

| Option | Description | Default |
|--------|-------------|---------|
| `render_js` | Use Puppeteer for JS rendering | `true` |
| `wait_for` | CSS selector to wait for before extraction | `null` |
| `timeout` | Page load timeout (ms) | `30000` |
| `include_links` | Preserve hyperlinks in Markdown | `true` |
| `include_images` | Include image references | `false` |
| `selectors.include` | CSS selectors to include | `null` |
| `selectors.exclude` | CSS selectors to remove before extraction | `null` |
| `chunk.enabled` | Split into RAG chunks | `false` |
| `chunk.max_tokens` | Max tokens per chunk | `512` |
| `chunk.overlap` | Token overlap between chunks | `50` |

---

## 7. Deployment — DigitalOcean Droplet

### Minimum Specifications

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 50 GB SSD | 80 GB SSD |
| OS | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

**Why 4GB minimum:** Puppeteer/Chromium needs ~200-400MB per browser instance. With the Node process, OS overhead, and headroom for concurrent scrapes, 2GB will OOM. 4GB gives comfortable room for 2-3 concurrent Puppeteer pages.

### PM2 Configuration

```javascript
// ecosystem.config.cjs
// Public defaults come from forgecrawl.config.ts (baked into the build).
// Only secrets and deployment-specific overrides go here.
module.exports = {
  apps: [{
    name: 'forgecrawl',
    script: '.output/server/index.mjs',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Secrets loaded from .env — do not hardcode here
    },
    max_memory_restart: '3G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/forgecrawl/error.log',
    out_file: '/var/log/forgecrawl/output.log',
  }]
};
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name forgecrawl.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name forgecrawl.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/forgecrawl.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/forgecrawl.yourdomain.com/privkey.pem;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    client_max_body_size 10M;
}
```

---

## 8. Phase Plan

| Phase | Deliverable | Key Features |
|-------|------------|--------------|
| **1** | Foundation & Auth | Nuxt 4 scaffold, SQLite + Drizzle ORM, built-in bcrypt/JWT auth, first-run admin setup, basic single-URL HTTP scrape returning Markdown, Docker Compose |
| **2** | Puppeteer & Storage | JS rendering engine, Readability extraction, configurable storage (database + filesystem), improved Markdown quality |
| **3** | Job Queue & Crawling | SQLite-backed queue with Redis-swappable interface, multi-page site crawling, depth limits, robots.txt, rate limiting, crawl progress UI |
| **4** | API Keys & Multi-User | API key generation and management, user CRUD for admin, per-user usage tracking, programmatic API access |
| **5** | RAG & Advanced | Token-aware chunking with metadata, login-gated site scraping, export formats (JSON, JSONL), production hardening, monitoring |

Each phase produces a testable, working deliverable. No phase depends on future phases to function.

---

## 9. Project Structure

```
forgecrawl/
+-- forgecrawl.config.ts           # Single source of truth for public config
+-- docker-compose.yml              # Primary deployment
+-- docker-compose.prod.yml         # Production overlay (Nginx + SSL)
+-- .env                            # Secrets only (gitignored)
+-- .env.example                    # Secret key templates (committed)
+-- .dockerignore
+-- .gitignore
+-- pnpm-workspace.yaml
+-- package.json                    # Root workspace config
+-- pnpm-lock.yaml
+-- .npmrc
+-- README.md
+-- LICENSE                         # MIT
+--
+-- packages/
|   +-- app/                        # The scraper application (Nuxt 4)
|   |   +-- Dockerfile
|   |   +-- package.json            # @forgecrawl/app
|   |   +-- nuxt.config.ts          # Imports from ../../forgecrawl.config.ts
|   |   +-- ecosystem.config.cjs    # PM2 config (bare-metal only)
|   |   +-- app/                     # Nuxt 4 app directory (srcDir)
|   |   |   +-- app.vue
|   |   |   +-- pages/
|   |   |   |   +-- index.vue              # Dashboard
|   |   |   |   +-- setup.vue              # First-run registration
|   |   |   |   +-- login.vue
|   |   |   |   +-- scrapes/
|   |   |   |   |   +-- index.vue          # Scrape history
|   |   |   |   |   +-- [id].vue           # Scrape detail
|   |   |   |   +-- crawls/
|   |   |   |   |   +-- index.vue
|   |   |   |   |   +-- [id].vue
|   |   |   |   +-- admin/
|   |   |   |       +-- users.vue
|   |   |   |       +-- api-keys.vue
|   |   |   |       +-- settings.vue
|   |   |   |       +-- credentials.vue
|   |   |   +-- components/
|   |   |   |   +-- ScrapeForm.vue
|   |   |   |   +-- MarkdownPreview.vue
|   |   |   |   +-- JobProgress.vue
|   |   |   |   +-- AdminLayout.vue
|   |   |   +-- composables/
|   |   |   |   +-- useScrape.ts
|   |   |   |   +-- useAuth.ts
|   |   |   |   +-- useAdmin.ts
|   |   |   +-- middleware/
|   |   |   |   +-- auth.ts
|   |   |   |   +-- setup.global.ts
|   |   |   +-- assets/
|   |   |       +-- css/
|   |   |           +-- main.css          # App-level CSS overrides
|   |   +-- shared/                  # Nuxt 4: code shared between app/ and server/
|   |   +-- server/
|   |   |   +-- middleware/
|   |   |   |   +-- auth.ts
|   |   |   +-- api/
|   |   |   |   +-- scrape.post.ts
|   |   |   |   +-- scrape/
|   |   |   |   |   +-- batch.post.ts      # Batch scrape (Phase 3)
|   |   |   |   +-- crawl.post.ts
|   |   |   |   +-- jobs/
|   |   |   |   +-- results/
|   |   |   |   +-- admin/
|   |   |   |   |   +-- cleanup.post.ts    # Maintenance (Phase 5)
|   |   |   |   +-- auth/
|   |   |   |   |   +-- setup.post.ts
|   |   |   |   |   +-- login.post.ts
|   |   |   |   |   +-- logout.post.ts
|   |   |   |   |   +-- me.get.ts
|   |   |   |   |   +-- api-keys.post.ts
|   |   |   |   +-- health.get.ts
|   |   |   +-- engine/
|   |   |   |   +-- scraper.ts
|   |   |   |   +-- fetcher.ts
|   |   |   |   +-- extractor.ts
|   |   |   |   +-- converter.ts
|   |   |   |   +-- chunker.ts
|   |   |   |   +-- browser.ts
|   |   |   |   +-- cache.ts
|   |   |   |   +-- pdf-extractor.ts    # PDF support (Phase 2)
|   |   |   |   +-- docx-extractor.ts   # DOCX support (Phase 2)
|   |   |   |   +-- sitemap.ts          # Sitemap discovery (Phase 3)
|   |   |   +-- queue/
|   |   |   |   +-- interface.ts
|   |   |   |   +-- sqlite.ts
|   |   |   +-- db/
|   |   |   |   +-- index.ts
|   |   |   |   +-- schema.ts
|   |   |   |   +-- backend.ts
|   |   |   |   +-- migrations/
|   |   |   +-- auth/
|   |   |   |   +-- password.ts
|   |   |   |   +-- jwt.ts
|   |   |   +-- storage/
|   |   |   |   +-- interface.ts
|   |   |   |   +-- database.ts
|   |   |   |   +-- filesystem.ts
|   |   |   +-- utils/
|   |   |       +-- robots.ts
|   |   |       +-- rate-limiter.ts
|   |   |       +-- url.ts
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

## 10. Configuration

### Public Configuration — `forgecrawl.config.ts`

All non-secret project variables live in a single file at the monorepo root: **`forgecrawl.config.ts`**. This is the single source of truth for defaults (ports, timeouts, concurrency, storage mode, app metadata, etc.). The Nuxt app imports this file in `nuxt.config.ts` via the `toRuntimeConfig()` helper.

Do not scatter public configuration defaults across `.env`, `nuxt.config.ts`, or individual source files. If a value is not a secret, it belongs in `forgecrawl.config.ts`.

### Secret Variables — `.env`

Only secrets and environment-specific overrides belong in `.env` (gitignored). The `.env.example` file (committed) provides key templates without values.

```bash
# .env — secrets only
NUXT_AUTH_SECRET=                  # Min 32 chars, signs JWTs (auto-generated if empty)
NUXT_ENCRYPTION_KEY=               # AES-256-GCM key for site credentials (Phase 5)
NUXT_ALERT_WEBHOOK=                # Discord/Slack webhook URL (optional)

# Optional: Supabase backend (replaces SQLite)
# NUXT_SUPABASE_URL=
# NUXT_SUPABASE_KEY=
# NUXT_SUPABASE_SERVICE_KEY=
```

### How It Works

```
forgecrawl.config.ts (public defaults)
        │
        ├──→ packages/app/nuxt.config.ts (imports toRuntimeConfig())
        │         └──→ runtimeConfig available in server via useRuntimeConfig()
        │
        └──→ packages/web/nuxt.config.ts (imports config.app for metadata)

.env (secrets only)
        └──→ Nuxt auto-maps NUXT_* vars to runtimeConfig at startup
```

---

## 11. Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| `forgecrawl.config.ts` as config source of truth | Single file for all public defaults prevents scattered configuration across `.env`, `nuxt.config.ts`, and source files. Secrets stay in `.env` only. |
| Nuxt 4 directory structure (`app/`, `server/`, `shared/`) | Clear separation of client and server code. `app/` for pages/components/composables, `server/` at package root, `shared/` for cross-boundary code. |
| SQLite over Supabase as default | Zero-config, zero-cost, no external dependency. Single file backup. Supabase available as optional upgrade via Drizzle ORM backend swap. |
| Puppeteer over Playwright | Smaller footprint, Chromium-only. Puppeteer's networkidle2 is well-suited for scraping. |
| SQLite queue over Redis | Fewer moving parts. Queue interface is abstract so Redis swap is config-only. SQLite WAL mode handles concurrent reads during writes. |
| pnpm workspace monorepo | Separates scraper app (packages/app) from marketing site (packages/web). Shared tooling, independent deploys. |
| PM2 fork mode (not cluster) | Puppeteer shares browser state. Cluster mode would spawn multiple browser instances and OOM. Scale via queue concurrency instead. |
| Turndown over remark/rehype | Purpose-built for HTML to Markdown. Plugin system handles edge cases. Lighter than remark pipeline. |
| Configurable storage | Database-only hits limits with large HTML blobs. Filesystem is cheaper for raw storage. Both gives metadata queries + cheap blob storage. |

---

## 12. Success Criteria

Each phase is considered complete when:

1. All specified features are implemented and functional
2. The application can be deployed to a fresh DO droplet via documented steps
3. Authentication works (first-run setup or login required for all routes)
4. The scraping pipeline produces clean, usable Markdown from test URLs
5. No critical security vulnerabilities in the deployment

---

## References

- Firecrawl (github.com/mendableai/firecrawl) — Inspiration
- Mozilla Readability (github.com/mozilla/readability)
- Turndown (github.com/mixmark-io/turndown)
- Puppeteer (pptr.dev)
- Drizzle ORM (orm.drizzle.team)
- better-sqlite3 (github.com/WiseLibs/better-sqlite3)
- Nuxt 4 (nuxt.com/docs)
- Nuxt UI (ui.nuxt.com)

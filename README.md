<p align="center">
  <img src="assets/forgecrawl-banner.png?v=2" alt="ForgeCrawl — Web content forged into Markdown for LLMs" width="100%">
</p>

# ForgeCrawl

Self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption.

https://forgecrawl.com

## Why ForgeCrawl?

LLMs work best with clean, structured text — not raw HTML full of navigation, ads, and scripts. ForgeCrawl gives you a private, self-hosted tool to scrape any public webpage and get back clean Markdown with metadata, ready to feed into your AI workflows.

### Who is this for?

- **Researchers** building knowledge bases from government reports, academic pages, or institutional websites that don't have APIs
- **Developers** creating RAG (retrieval-augmented generation) pipelines who need clean, structured content from the web
- **Content teams** archiving web content as Markdown for documentation, migration, or LLM fine-tuning datasets
- **Policy analysts** scraping legislative sites, agency reports, and public records into a format AI tools can actually use
- **Anyone** who's tired of copy-pasting web content into ChatGPT and losing all the formatting

### Real-world examples

| Use case | What you'd scrape | What you get |
|---|---|---|
| **Build a research corpus** | 200 pages from a state agency website | Clean Markdown files with metadata (dates, authors, canonical URLs) ready for a RAG pipeline |
| **Feed context to an LLM** | A long technical doc or policy page | Structured Markdown you can paste directly into Claude, GPT, or any LLM prompt |
| **Archive a blog** | Individual blog posts from a company site | Markdown with YAML frontmatter preserving publication dates, authors, and descriptions |
| **Create training data** | Product pages, FAQ sections, support docs | Consistently formatted Markdown suitable for fine-tuning or embedding generation |
| **Monitor content changes** | A regulatory page that updates quarterly | Re-scrape with cache bypass to get the latest version in a diffable format |

### Why not just use Firecrawl / Jina / etc.?

- **Self-hosted** — your data never leaves your server. No API keys, no usage limits, no third-party dependencies.
- **Free** — no per-page pricing. Scrape as much as you want on your own infrastructure.
- **Authenticated** — built-in user auth means you can deploy it on a public server without worrying about unauthorized access.
- **Simple** — one Docker command or PM2 start. No Redis, no Postgres, no message queue. SQLite handles everything.

### Why Markdown instead of raw HTML?

You could paste a webpage's HTML directly into an LLM. But you'd be wasting tokens on noise and getting worse results. Here's what Markdown gives you that raw HTML doesn't:

| | Raw HTML | ForgeCrawl Markdown |
|---|---|---|
| **Size** | 50-200KB per page (scripts, styles, nav, ads, tracking) | 2-10KB — content only (**80-95% fewer tokens**) |
| **Signal-to-noise** | `<div class="flex items-center px-4">` is layout, not content | Headings, paragraphs, lists, code blocks — pure content |
| **LLM comprehension** | HTML structure is ambiguous — models must infer what's content vs. chrome | Markdown is native to LLM training data (GitHub, docs, READMEs) — models parse it natively |
| **Metadata** | Scattered across `<meta>` tags, `<head>`, JSON-LD, microdata | Clean YAML frontmatter: title, URL, description, timestamp, word count |
| **Consistency** | Every site has different HTML structure | Every page outputs the same Markdown format — one parser for your pipeline |
| **Diffability** | HTML diffs are unreadable noise | Markdown diffs cleanly in git — you can track content changes over time |
| **Cost** | A 100KB HTML page uses ~25K tokens at $3/M = **$0.075 per page** | The same page as 5KB Markdown uses ~1.2K tokens = **$0.004 per page** (18x cheaper) |

**Bottom line:** Feeding raw HTML to an LLM is like feeding a book scanner the entire newspaper — ads, classifieds, and all — when you only need one article. ForgeCrawl extracts the article, formats it cleanly, and tags it with metadata so your pipeline knows exactly what it's working with.

## Current Status: Phase 1 Complete

Phase 1 (Foundation & Auth) is fully implemented and tested. The app is functional for single-URL HTTP scraping with built-in authentication.

### What Works Now

- First-run admin registration (one-time `/setup` flow)
- Login/logout with JWT sessions (configurable 15-day expiry)
- Single-URL scraping via HTTP fetch
- Content extraction (Mozilla Readability with full-body fallback)
- HTML-to-Markdown conversion (Turndown + GFM)
- YAML frontmatter with metadata (canonical URL, description, timestamps, etc.)
- Result caching (configurable TTL, bypass option)
- Scrape history with detail view
- Copy to clipboard and download as `.md`
- Delete scrapes
- Sitemap detection (notification only — crawling is Phase 3)
- Auto `https://` prefix on URLs
- SSRF protection (private IPs, localhost, cloud metadata, DNS resolution check)
- API key auth (`Bearer fc_...`) for CLI/scripting use
- Login rate limiting (5 attempts per email per 15 minutes)
- Health check endpoint (no auth required)
- Docker Compose deployment
- PM2 bare-metal deployment

### What's Not Built Yet

- **Phase 2:** Puppeteer JS rendering, filesystem storage, PDF/DOCX extraction
- **Phase 3:** Job queue, multi-page site crawling, robots.txt
- **Phase 4:** Multi-user management
- **Phase 5:** RAG chunking, login-gated scraping, export formats

## Quick Start — Development

```bash
# Prerequisites: Node.js 22+, pnpm
git clone https://github.com/cschweda/forgecrawl
cd forgecrawl
pnpm install

# Generate an auth secret (or let Docker auto-generate one)
cp .env.example .env
node -e "console.log('NUXT_AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env

# Start dev server
pnpm dev
# Visit http://localhost:5150
# Register admin account on first visit

# Run tests (builds app, starts test server, runs 81 tests)
pnpm test
```

### Available pnpm scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Nuxt dev server on port 5150 |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run all 81 tests |
| `pnpm test:health` | Health check tests only |
| `pnpm test:auth` | Auth tests (setup, login, API keys) |
| `pnpm test:security` | Security tests (SSRF, rate limiting, middleware, etc.) |
| `pnpm test:scrape` | Scraping tests (fetch, cache, CRUD) |
| `pnpm dev:web` | Start marketing site dev server on port 3200 |
| `pnpm build:web` | Generate static marketing site for Netlify |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate` | Run database migrations |

## Quick Start — Docker Compose

```bash
git clone https://github.com/cschweda/forgecrawl
cd forgecrawl
docker compose up -d
# Visit http://localhost:5150
# Auth secret auto-generates if not set
```

## Quick Start — Bare Metal (PM2)

```bash
git clone https://github.com/cschweda/forgecrawl
cd forgecrawl
pnpm install
cp .env.example .env
# Edit .env and set NUXT_AUTH_SECRET (min 32 chars)

pnpm build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

See [`ecosystem.config.cjs`](ecosystem.config.cjs) for PM2 tuning options.

## Deploy to Digital Ocean

ForgeCrawl runs on a Digital Ocean Droplet with PM2 + Nginx. A full step-by-step guide is in [`docs/deploy-digitalocean.md`](docs/deploy-digitalocean.md), but here's the short version:

### Prerequisites

- Digital Ocean Droplet (2GB+ RAM recommended) with Node.js 22+, pnpm, PM2, and Nginx
- Chromium installed for Puppeteer: `sudo apt-get install -y chromium-browser fonts-liberation fonts-noto-cjk`
- DNS A record: `api.forgecrawl.com` → your Droplet IP

### First deploy

```bash
ssh forge@YOUR_DROPLET_IP
git clone https://github.com/cschweda/forgecrawl.git
cd forgecrawl

# Configure secrets
cp .env.example .env
node -e "console.log('NUXT_AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env

# Build and start
pnpm install
pnpm --filter @forgecrawl/app build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup

# Set up Nginx + SSL
sudo cp deploy/nginx-forgecrawl.conf /etc/nginx/sites-available/forgecrawl
sudo ln -s /etc/nginx/sites-available/forgecrawl /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.forgecrawl.com
```

### Subsequent deploys

```bash
cd /home/forge/forgecrawl
./rebuild.sh
```

The [`rebuild.sh`](rebuild.sh) script pulls, installs, builds, restarts PM2, and runs a health check. If you use Laravel Forge, paste [`deploy/forge-deploy.sh`](deploy/forge-deploy.sh) into your deploy script — it works with Forge's auto-deploy on push.

See [`docs/deploy-digitalocean.md`](docs/deploy-digitalocean.md) for the complete guide including DNS setup (DNSimple), Nginx config, Laravel Forge integration, monitoring, backups, and troubleshooting.

## First-Time Use

After deploying (or starting the dev server), you need to create your admin account and get an API key. Replace `YOUR_DOMAIN` below with your own server (e.g., `api.example.com` or `localhost:5150`).

> **Note:** `api.forgecrawl.com` is the author's private instance — it is not a public service. ForgeCrawl is self-hosted: you deploy your own instance and control all access. The setup endpoint locks after the first admin account, and API keys require authentication, so no one else can use your install.

### 1. Create your admin account

Open `https://YOUR_DOMAIN` in a browser — you'll be redirected to the setup page. Or use curl:

```bash
curl -X POST https://YOUR_DOMAIN/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-strong-password","confirmPassword":"your-strong-password"}'
```

This endpoint works **exactly once** — it permanently locks itself after the first admin is created.

### 2. Log in

```bash
# Via browser: visit https://YOUR_DOMAIN/login
# Via curl:
curl -X POST https://YOUR_DOMAIN/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-strong-password"}' \
  -c cookies.txt
```

### 3. Create an API key

In the web UI, go to the dashboard and click **API Keys** → **Create Key**. Give it a name (e.g., "my-script"). The key (`fc_...`) is shown **once** — copy it immediately.

Or via curl (using the session cookie from login):

```bash
curl -X POST https://YOUR_DOMAIN/api/auth/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name":"my-script"}' \
  -b cookies.txt
```

Save the returned key — it cannot be retrieved again (only the prefix is stored).

### 4. Start scraping

```bash
export FC_KEY="fc_your_api_key_here"

curl -X POST https://YOUR_DOMAIN/api/scrape \
  -H "Authorization: Bearer $FC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

The response includes clean Markdown with YAML frontmatter, word count, metadata, and a job ID you can use to retrieve the result later.

## Why a VPS? (Not Netlify / Vercel)

ForgeCrawl requires a traditional server (VPS, Droplet, bare metal) and **cannot run on serverless platforms** like Netlify or Vercel. This isn't a limitation we plan to work around — it's fundamental to the architecture.

| Requirement | VPS / Droplet | Netlify / Vercel |
|---|---|---|
| **SQLite database** | Persistent disk, single-file DB, trivial backups | No persistent filesystem — DB lost on every cold start |
| **better-sqlite3** | Native C++ module, runs perfectly | Requires special bundling; synchronous I/O is an anti-pattern for serverless |
| **WAL mode** | Single long-running process, safe concurrent reads | Multiple function instances = write conflicts and corruption risk |
| **Puppeteer (Phase 2)** | Full Chrome, no size/time limits | Exceeds function size limits (~50MB zipped); cold starts are 10+ seconds |
| **Long scrapes** | No timeout constraints | 10-26 second function timeout kills slow pages |
| **File storage (Phase 2)** | Persistent disk for HTML/Markdown/chunks | Only ephemeral `/tmp` (512MB, wiped between invocations) |
| **In-memory rate limiter** | Works correctly in a single process | Each function invocation has its own memory — rate limiting is meaningless |
| **Stable process** | PM2 keeps it running with auto-restart | No persistent process; each request spins up a new instance |

**Bottom line:** ForgeCrawl is a stateful application with a local database, native modules, and long-running operations. Serverless platforms are designed for stateless, short-lived functions. You'd need to swap SQLite for a managed database (Postgres, Turso), rewrite all I/O to be async, remove native dependencies, and accept severe Puppeteer limitations — at which point it's a different application.

**Recommended hosts:** DigitalOcean Droplet ($6/mo), Hetzner VPS, AWS Lightsail, or any VPS with 1GB+ RAM and Node.js 22+. See the Docker Compose or PM2 quick starts above.

> **Note:** The marketing site (`packages/web`) deploys to Netlify as a static site — see the Marketing Site section below.

## Deployment Architecture

ForgeCrawl uses a split-domain architecture:

| Domain | Host | Purpose |
|--------|------|---------|
| `forgecrawl.com` | Netlify | Static marketing site (SSG) |
| `api.forgecrawl.com` | DigitalOcean Droplet (via Laravel Forge) | Scraper API (Nuxt server + SQLite) |

The marketing site is purely static HTML — no API, no server. The scraper API runs on your VPS behind Nginx (managed by Laravel Forge) with SSL via Let's Encrypt.

### DNS Records

| Type | Name | Value |
|------|------|-------|
| ALIAS | `forgecrawl.com` | `forgecrawl.netlify.app` (Netlify marketing site) |
| CNAME | `www` | `forgecrawl.netlify.app` |
| A | `api` | Your Droplet IP (e.g., `143.198.x.x`) |

> **DNSimple users:** Use an ALIAS record (not A) for the apex domain pointing to Netlify — Netlify IPs can change.

For the complete Nginx config, SSL setup, and Laravel Forge integration, see [`docs/deploy-digitalocean.md`](docs/deploy-digitalocean.md).

## Marketing Site

The marketing site (`packages/web`) is a separate Nuxt 4 static site with SEO, dark/light mode, and the forge aesthetic. It deploys to Netlify at [forgecrawl.com](https://forgecrawl.com). The API examples on the site point to `https://api.forgecrawl.com`.

### Development

```bash
# Start marketing site dev server
pnpm dev:web
# Visit http://localhost:3200
```

### Deploy to Netlify (Static Site)

ForgeCrawl's marketing site deploys as a **fully static site** (SSG) — not a single-page app (SPA). Nuxt pre-renders every route to plain HTML at build time, so there's no server, no functions, and no client-side routing fallback needed. This is configured via `nitro: { preset: 'static' }` in `nuxt.config.ts`.

#### Option A: Automatic via `netlify.toml` (Recommended)

The repo includes `packages/web/netlify.toml` which configures everything. Just connect the repo:

1. Log in to [Netlify](https://app.netlify.com) and click **Add new site** → **Import an existing project**
2. Select your GitHub repo (`cschweda/forgecrawl`)
3. Netlify will auto-detect `packages/web/netlify.toml` — verify the settings:
   - **Base directory:** `packages/web`
   - **Build command:** `npx nuxt generate`
   - **Publish directory:** `.output/public`
   - **Node version:** 22
4. Click **Deploy site**

That's it. Every push to `main` triggers a rebuild.

#### Option B: Manual Netlify Configuration

If the `netlify.toml` isn't detected, configure manually:

1. **Add new site** → **Import an existing project** → select the repo
2. Under **Build settings**:
   - **Base directory:** `packages/web`
   - **Build command:** `npx nuxt generate`
   - **Publish directory:** `packages/web/.output/public`
3. Under **Environment variables**, add:
   - `NODE_VERSION` = `22`
4. Click **Deploy site**

#### Option C: Local Build + Manual Deploy

```bash
# Generate the static site
pnpm build:web

# The output is in packages/web/.output/public/
# This directory contains plain HTML, CSS, JS — ready to upload

# Deploy via Netlify CLI
npx netlify-cli deploy --prod --dir=packages/web/.output/public
```

#### Verify It's Static (Not SPA)

After deploying, confirm the site is fully static:

- View source on any page — you should see fully rendered HTML content, not an empty `<div id="app"></div>`
- The `netlify.toml` has **no** `/* → /index.html` rewrite (that would be SPA mode)
- Each route gets its own `index.html` in `.output/public/`

#### Custom Domain (`forgecrawl.com`)

1. In Netlify, go to **Domain management** → **Add custom domain**
2. Enter `forgecrawl.com`
3. Update your DNS records as instructed (either Netlify DNS or a CNAME record)
4. Netlify provisions a free SSL certificate automatically

> **Note:** The API lives at `api.forgecrawl.com` on your VPS — see the [Deployment Architecture](#deployment-architecture) section above for DNS setup.

### Features

- Nuxt 4 + Nuxt UI 4 (same stack as the app)
- Dark/light mode toggle (defaults to dark)
- Full SEO: Open Graph, Twitter Card, canonical URL, structured meta
- OG image (`og-image.png`) — the forge-themed banner
- Responsive design with glassmorphism cards
- Sections: Hero, Features, How It Works, Why Markdown, API docs, Security, Get Started, Use Cases, Why Do I Need This?, Roadmap
- Static generation — zero server-side runtime

## Project Structure

```
forgecrawl/
├── forgecrawl.config.ts        # Public config (ports, timeouts, session, etc.)
├── docker-compose.yml
├── ecosystem.config.cjs        # PM2 config (bare-metal deployment)
├── pnpm-workspace.yaml
├── .env                        # Secrets only (gitignored)
├── .env.example                # Secret key templates
├── packages/
│   ├── web/                    # Marketing site (static, deploys to Netlify)
│   │   ├── nuxt.config.ts
│   │   ├── netlify.toml
│   │   ├── app/
│   │   │   ├── pages/index.vue # Landing page
│   │   │   ├── app.config.ts   # Nuxt UI theme (orange palette)
│   │   │   └── assets/css/
│   │   └── public/
│   │       ├── og-image.png    # SEO/social sharing image
│   │       └── favicon.svg
│   └── app/                    # Nuxt 4 application
│       ├── nuxt.config.ts
│       ├── Dockerfile
│       ├── drizzle.config.ts
│       ├── app/                # Client (Nuxt 4 srcDir)
│       │   ├── pages/          # setup, login, index, scrapes/[id]
│       │   ├── composables/    # useAuth
│       │   ├── middleware/     # setup.global (auth + setup routing)
│       │   └── assets/css/
│       └── server/
│           ├── api/            # health, auth/*, scrape, scrapes/*
│           ├── middleware/     # JWT auth middleware
│           ├── engine/         # scraper, fetcher, extractor, converter, cache
│           ├── db/             # schema, migrations, init
│           ├── auth/           # password (bcrypt), jwt (jose), api-key (SHA-256)
│           ├── plugins/       # graceful-shutdown, security-headers
│           └── utils/          # SSRF validation, rate limiter
└── docs/                       # Design documents
```

## API

All API endpoints except the health check require authentication via a **Bearer token** (API key) or a session cookie.

### No authentication required

```bash
# Health check
curl http://localhost:5150/api/health
```

### Authentication: get an API key

Log into the web UI, navigate to the API Keys section, and create a key. The key (`fc_...`) is shown once — store it securely. Then use it in all requests:

```bash
# Set your API key (shown once when created)
export FC_KEY="fc_your_api_key_here"
```

### Authenticated endpoints

```bash
# Scrape a URL
curl -X POST http://localhost:5150/api/scrape \
  -H "Authorization: Bearer $FC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Scrape with cache bypass
curl -X POST http://localhost:5150/api/scrape \
  -H "Authorization: Bearer $FC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "bypass_cache": true}'

# List scrapes
curl http://localhost:5150/api/scrapes \
  -H "Authorization: Bearer $FC_KEY"

# Get scrape detail
curl http://localhost:5150/api/scrapes/{job_id} \
  -H "Authorization: Bearer $FC_KEY"

# Delete a scrape
curl -X DELETE http://localhost:5150/api/scrapes/{job_id} \
  -H "Authorization: Bearer $FC_KEY"
```

### API key management

```bash
# Create an API key (requires session cookie from login)
curl -X POST http://localhost:5150/api/auth/api-keys \
  -H "Authorization: Bearer $FC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-script"}'

# List your API keys (key values are never shown — only prefixes)
curl http://localhost:5150/api/auth/api-keys \
  -H "Authorization: Bearer $FC_KEY"

# Revoke an API key
curl -X DELETE http://localhost:5150/api/auth/api-keys/{key_id} \
  -H "Authorization: Bearer $FC_KEY"

# Revoke ALL API keys (preserves the key used for this request)
curl -X DELETE http://localhost:5150/api/auth/api-keys/revoke-all \
  -H "Authorization: Bearer $FC_KEY"
```

### Node.js / scripting example

```js
const FC_URL = 'http://localhost:5150'
const FC_KEY = process.env.FC_KEY

const res = await fetch(`${FC_URL}/api/scrape`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${FC_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url: 'https://example.com' }),
})

const { markdown, title, wordCount } = await res.json()
console.log(`Scraped "${title}" (${wordCount} words)`)
```

## Configuration

Public configuration lives in [`forgecrawl.config.ts`](forgecrawl.config.ts) (single source of truth). Key settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `server.port` | 5150 | HTTP port |
| `storage.mode` | database | Where results are stored |
| `scrape.timeout` | 30000 | Page fetch timeout (ms) |
| `scrape.cacheTtl` | 3600 | Cache TTL in seconds (0 to disable) |
| `auth.sessionMaxAge` | 1296000 | JWT/cookie lifetime (15 days in seconds) |
| `rateLimit.loginMaxAttempts` | 5 | Failed logins before lockout |
| `apiKeys.maxPerUser` | 20 | Max active API keys per user (0 = unlimited) |
| `rateLimit.loginWindowMs` | 900000 | Lockout window (15 minutes) |

Secrets go in `.env` (gitignored):

```bash
NUXT_AUTH_SECRET=         # Min 32 chars, signs JWTs
NUXT_ENCRYPTION_KEY=      # Phase 5 (site credentials encryption)
NUXT_ALERT_WEBHOOK=       # Discord/Slack webhook (optional)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt 4 (4.3.1) |
| UI | Nuxt UI 4 |
| Database | SQLite via better-sqlite3 + Drizzle ORM (WAL mode) |
| Auth | bcrypt (12 rounds) + jose JWT (HS256) |
| Content Extraction | Mozilla Readability (with cheerio fallback) |
| HTML to Markdown | Turndown + GFM plugin |
| Process Manager | PM2 or Docker |

## Security

ForgeCrawl is designed to be deployed on a server you control, scraping arbitrary URLs from the internet. Security is not an afterthought — it's built into every layer.

### Authentication & Session Management

| Protection | Implementation |
|---|---|
| **Password hashing** | bcrypt with 12 salt rounds — resistant to brute-force and rainbow table attacks |
| **JWT sessions** | HS256-signed tokens in HTTP-only, Secure, SameSite=Lax cookies — never stored in localStorage or exposed to JavaScript |
| **Constant-time verification** | Password comparison uses `bcrypt.compare` which is constant-time; login also hashes a dummy value on user-not-found to prevent timing-based user enumeration |
| **Session expiry** | Configurable JWT lifetime (default 15 days) with automatic expired-token detection and stale cookie cleanup |
| **Auth secret validation** | `NUXT_AUTH_SECRET` must be at least 32 characters; the app throws on first auth action if missing |
| **API key auth** | Bearer tokens (`fc_...`) with SHA-256 hashed storage — raw keys shown once at creation and never stored. Keys support optional expiry and are scoped to the creating user |
| **Setup lockout** | First-run admin registration (`/setup`) is permanently locked after the first admin account is created — stored in the database, not bypassable |

### Server-Side Request Forgery (SSRF) Protection

Scraping user-supplied URLs is a high-risk operation. ForgeCrawl blocks SSRF at multiple levels:

| Layer | What it blocks |
|---|---|
| **Protocol allowlist** | Only `http:` and `https:` — blocks `file://`, `ftp://`, `gopher://`, etc. |
| **Hostname blocklist** | `localhost`, `0.0.0.0`, `127.0.0.1`, `[::1]`, `metadata.google.internal` |
| **IP range blocklist** | Private ranges (10.x, 172.16-31.x, 192.168.x), loopback, link-local (169.254.x), cloud metadata (169.254.169.254), shared address space (100.64-127.x), IPv6 private/link-local |
| **DNS resolution check** | After URL parsing, resolves the hostname and checks the resolved IP against all blocklists — prevents DNS rebinding attacks where a domain points to a private IP |
| **DNS failure = block** | If DNS resolution fails, the request is blocked rather than allowed through — prevents SSRF bypass during DNS outages |
| **Redirect re-validation** | HTTP redirects are handled manually; each redirect target is re-validated through the full SSRF pipeline before following — prevents open-redirect SSRF bypass |
| **Redirect depth limit** | Maximum 10 redirects per request — prevents infinite redirect loops used for DoS attacks |

### Input Validation & Injection Prevention

| Protection | Implementation |
|---|---|
| **SQL injection** | Drizzle ORM parameterized queries throughout — no raw SQL, no string concatenation |
| **XSS** | Vue template auto-escaping on all rendered content; no `v-html` usage |
| **Error message sanitization** | Internal error messages are filtered before reaching the client — only known-safe error types are passed through |
| **Rate limiting** | Login endpoint: 5 failed attempts per email per 15-minute window with automatic lockout |
| **Health endpoint** | Exposes only version, database status, and setup state — no memory usage, uptime, or server internals |

### Data Isolation

- All scrape data queries are scoped to the authenticated user's ID
- Delete operations verify ownership before execution
- No cross-user data access is possible through the API

### Known Limitations

- **No CSRF token** — SameSite=Lax cookies block cross-origin POST, which covers all mutation endpoints. Same-site subdomain attacks are not protected, but acceptable for single-server self-hosted deployment.
- **In-memory rate limiter** — resets on server restart. Acceptable for single-user deployment; persistent rate limiting via SQLite planned for a future phase.
- **Single user only** — no multi-user management until Phase 4.

## Testing

ForgeCrawl includes 81 integration tests across 10 test files, organized into four categories: **health**, **authentication**, **security**, and **scraping**. Every test runs against a real production-built server over HTTP — no mocks, no test doubles.

### Running tests

```bash
# Run all 81 tests
pnpm test

# Run individual suites
pnpm test:health      # Health check endpoint (6 tests)
pnpm test:auth        # Auth: setup, login, API keys (21 tests)
pnpm test:security    # Security: middleware, SSRF, rate limiting, error sanitization, data isolation (42 tests)
pnpm test:scrape      # Scraping: fetch, cache, CRUD (10 tests)
```

### How tests work

Tests use [Vitest](https://vitest.dev/) with a custom global setup (`tests/setup/global-setup.ts`) that:

1. **Builds the Nuxt app** for production (`pnpm build`)
2. **Starts the server** as a child process on port 5199 with a clean, isolated test database
3. **Runs all test files** sequentially — each file uses `ofetch` to make real HTTP requests against the running server
4. **Tears down** the server process and deletes all test data when complete

This approach tests the full stack end-to-end: HTTP routing, middleware, database queries, and response formatting. Test helpers (`tests/setup/test-helpers.ts`) provide shared utilities for login, API key creation, and authenticated requests.

### Test suites overview

| Suite | File | Tests | Category |
|-------|------|:-----:|----------|
| Health Check | `01-health` | 6 | Health |
| Auth: Setup | `02-auth-setup` | 6 | Auth |
| Auth: Login | `03-auth-login` | 7 | Auth |
| Auth: API Keys | `04-auth-api-keys` | 8 | Auth |
| Security: Auth Middleware | `05-security-auth-middleware` | 10 | Security |
| Security: SSRF Protection | `06-security-ssrf` | 18 | Security |
| Security: Rate Limiting | `07-security-rate-limit` | 4 | Security |
| Security: Error Sanitization | `08-security-error-sanitization` | 4 | Security |
| Scraping | `09-scrape` | 10 | Scraping |
| Security: Data Isolation | `10-security-data-isolation` | 6 | Security |

### Detailed test descriptions

#### 01 — Health Check (6 tests)

Validates the unauthenticated `/api/health` endpoint:

- Returns `200` with `status: "ok"`
- Returns a version string and database connection status
- Returns `setup_complete` boolean (used by the UI to route to setup or login)
- Does **not** expose `memory` or `uptime` (prevents server fingerprinting)
- Confirms no authentication is required

#### 02 — Auth: Setup (6 tests)

Tests the one-time admin registration flow (`POST /api/auth/setup`):

- Rejects requests with missing email, short passwords (< 8 chars), or mismatched password confirmation — returns `400`
- Creates the admin account and sets an HTTP-only session cookie on success
- **Permanently locks the setup endpoint** after the first admin is created — all subsequent attempts return `403`, regardless of credentials
- Adapts assertions if setup was already completed by an earlier test file (order-independent)

#### 03 — Auth: Login (7 tests)

Tests credential validation and session management (`POST /api/auth/login`):

- Rejects missing fields with `400`
- Rejects wrong password and non-existent email with identical `401` responses and the same `"Invalid credentials"` message — **prevents user enumeration** (an attacker cannot determine which emails have accounts)
- Returns `200` with a `forgecrawl_session` cookie that has `HttpOnly`, `SameSite=Lax`, and `Path=/` flags
- Returns user data (`email`, `role`) on successful login
- Verifies the response body never contains `passwordHash`, `password_hash`, or bcrypt hashes (`$2b$`)

#### 04 — Auth: API Keys (8 tests)

Tests Bearer token authentication lifecycle (`/api/auth/api-keys`):

- Creates an API key with the `fc_` prefix and a 64-character hex suffix (e.g., `fc_a1b2c3...`)
- Returns the raw key exactly once at creation with a warning it won't be shown again
- Rejects key creation without a `name` field
- Lists keys showing only the prefix (`fc_a1b2`) and name — **never exposes the full key or SHA-256 hash**
- Authenticates requests using `Authorization: Bearer fc_...` header
- Rejects invalid Bearer tokens and tokens with wrong prefixes with `401`
- Revokes a key via `DELETE /api/auth/api-keys/{id}` and confirms the revoked key is immediately rejected

#### 05 — Security: Auth Middleware (10 tests)

Tests the authentication middleware that protects all `/api/*` routes:

- **Public routes:** `GET /api/health` is accessible without authentication
- **Protected routes:** `GET /api/scrapes`, `GET /api/auth/me`, `POST /api/scrape`, and `GET /api/auth/api-keys` all return `401` without credentials
- Accepts both session cookie auth and Bearer token auth
- When both a Bearer token and a cookie are present, the **Bearer token takes priority** — allows API key auth even with a stale cookie
- Rejects tampered JWT cookies (`forgecrawl_session=tampered.jwt.token`) with `401`
- Rejects completely invalid cookies with `401`

#### 06 — Security: SSRF Protection (18 tests)

The largest test suite — validates that user-supplied URLs cannot be used to access internal resources:

- **Localhost/loopback:** Blocks `localhost`, `127.0.0.1`, `0.0.0.0`, `[::1]`
- **Cloud metadata:** Blocks `169.254.169.254` (AWS EC2 metadata) and `metadata.google.internal` (GCP)
- **Private IP ranges:** Blocks `10.x.x.x` (Class A), `172.16.x.x` (Class B), `192.168.x.x` (Class C)
- **Protocol allowlist:** Blocks `ftp://`, `file://`, `gopher://`, `javascript:` — only `http:` and `https:` are allowed
- **Invalid URLs:** Blocks malformed input like `not-a-valid-url`
- **Positive test:** Confirms a valid external HTTPS URL (`https://example.com`) succeeds

All blocked URLs return `400`. This prevents attackers from using the scraper to probe internal networks, read cloud instance credentials, or access services behind the firewall.

#### 07 — Security: Rate Limiting (4 tests)

Tests the login rate limiter that prevents brute-force password attacks:

- Allows the first 5 failed login attempts (each returns `401`)
- Blocks the 6th attempt with `429 Too Many Requests`
- Rate limiting is **case-insensitive** — `USER@TEST.COM` and `user@test.com` share the same counter (prevents bypass by varying case)
- Uses a unique email per test run to avoid interference with other test suites

#### 08 — Security: Error Sanitization (4 tests)

Verifies that internal server details never leak to clients:

- Scrape failures do not expose file paths (`/home/`, `/app/`, `/Users/`, `node_modules`)
- Scrape failures do not expose source file references (`.ts:`, `.js:`)
- Non-existent domain scrapes return `400` or `500` with a generic message — not raw Node.js error details
- Login errors return the **same message** for wrong-email and wrong-password cases — reconfirms no user enumeration from a different angle

#### 09 — Scraping (10 tests)

Tests the core scraping engine and result management:

- Rejects `POST /api/scrape` without a URL (`400`)
- Scrapes `https://example.com` and validates: `job_id`, `title` ("Example Domain"), Markdown with frontmatter (`---`), `wordCount > 0`, and `metadata.url`
- Validates YAML frontmatter contains `title:`, `url:`, `scraped_at:`, and `scraper: ForgeCrawl/`
- Returns `cached: true` on repeated scrape of the same URL
- Returns `cached: false` when `bypass_cache: true` is set
- Lists all scrapes for the authenticated user with `url` and `status` fields
- Gets scrape detail by ID with full Markdown content
- Returns `404` for non-existent scrape IDs
- Deletes a scrape and confirms it returns `404` afterward

#### 10 — Security: Data Isolation (6 tests)

Validates that users cannot access or modify other users' data:

- Attempting to delete a non-owned scrape returns `404` (not `403`) — prevents confirming whether a resource exists
- Attempting to view a non-owned scrape returns `404`
- Attempting to delete a non-owned API key returns `404`
- Scrape list returns only the current user's data (returns a valid array)
- API key list returns only keys belonging to the current user, all with `fc_` prefix

The deliberate use of `404` instead of `403` is a security pattern — returning `403 Forbidden` would confirm the resource exists but is owned by someone else, which leaks information.

## Roadmap

ForgeCrawl is actively developed across five phases. Phase 1 is complete; Phases 2-5 are planned.

### Phase 1: Foundation & Auth — Complete

Single-URL HTTP scraping, JWT auth, API keys, SSRF protection, caching, scrape history, 81 integration tests. See [Current Status](#current-status-phase-1-complete) above.

### Phase 2: JS Rendering & Document Support

- **Puppeteer engine** — shared browser instance with configurable concurrency for SPAs and JS-heavy pages
- **Render mode toggle** — HTTP-only (fast) or Puppeteer (full JS) per scrape
- **`wait_for` selector** — wait for a specific CSS selector before extracting content
- **Browser crash recovery** — auto-restart on Puppeteer disconnect
- **PDF & DOCX extraction** — detect content-type and convert to Markdown
- **Configurable storage** — database, filesystem, or both with clean abstraction layer
- **Enhanced Markdown** — better handling of code blocks, tables, and nested structures
- **Scrape config UI** — toggle JS rendering, set wait selectors, choose storage mode

See [`docs/forgecrawl-02-phase2.md`](docs/forgecrawl-02-phase2.md) for the full specification.

### Phase 3: Site Crawling & Job Queue

- **Sitemap crawling** — crawl entire sitemaps or subsections by URL pattern
- **Async job queue** — SQLite-backed queue with real-time progress tracking
- **Crawl controls** — max depth, max pages, include/exclude URL filters
- **robots.txt compliance** — automatic fetching and rule enforcement
- **Per-domain rate limiting** — configurable delay between requests to the same host
- **Pause, resume, cancel** — full lifecycle controls for active crawls
- **Progress UI** — real-time dashboard showing pages discovered, scraped, failed, and queued

See [`docs/forgecrawl-03-phase3.md`](docs/forgecrawl-03-phase3.md) for the full specification.

### Phase 4: Multi-User & Usage Tracking

- **Admin user management** — create, disable, and delete user accounts
- **Role enforcement** — admin vs. user permissions
- **Per-user usage stats** — scrapes count, pages scraped, storage consumed
- **Per-user rate limits** — configurable by admin
- **Auto-generated API docs** — documentation page built from route definitions

See [`docs/forgecrawl-04-phase4.md`](docs/forgecrawl-04-phase4.md) for the full specification.

### Phase 5: RAG Chunking & Advanced Features

- **Token-aware chunking** — configurable max tokens with overlap and semantic boundaries
- **Chunk metadata** — heading context, position, source URL, token count
- **Login-gated scraping** — cookie injection and form-based login via Puppeteer
- **Export formats** — JSON, JSONL, or zipped Markdown for pipeline integration
- **Production hardening** — monitoring, log rotation, backup strategy, alerting webhooks

See [`docs/forgecrawl-05-phase5.md`](docs/forgecrawl-05-phase5.md) for the full specification.

## Documentation

- [**Deploy to Digital Ocean**](docs/deploy-digitalocean.md) — complete deployment guide (DNS, Nginx, PM2, SSL, Laravel Forge, backups)
- [`00` — Master Design](docs/forgecrawl-00-master-design.md)
- [`01` — Phase 1: Foundation & Auth](docs/forgecrawl-01-phase1.md)
- [`02` — Phase 2: Puppeteer & Storage](docs/forgecrawl-02-phase2.md)
- [`03` — Phase 3: Job Queue & Crawling](docs/forgecrawl-03-phase3.md)
- [`04` — Phase 4: API Keys & Multi-User](docs/forgecrawl-04-phase4.md)
- [`05` — Phase 5: RAG & Advanced](docs/forgecrawl-05-phase5.md)
- [`06` — Security](docs/forgecrawl-06-security.md)
- [`11` — SQLite Auth](docs/forgecrawl-11-sqlite-auth.md)

## License

[MIT](LICENSE)

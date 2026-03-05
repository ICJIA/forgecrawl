<p align="center">
  <img src="assets/forgecrawl-banner.png?v=2" alt="ForgeCrawl — Web content forged into Markdown for LLMs" width="100%">
</p>

# ForgeCrawl

Self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption.

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
git clone https://github.com/ICJIA/forgecrawl
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
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate` | Run database migrations |

## Quick Start — Docker Compose

```bash
git clone https://github.com/ICJIA/forgecrawl
cd forgecrawl
docker compose up -d
# Visit http://localhost:5150
# Auth secret auto-generates if not set
```

## Quick Start — Bare Metal (PM2)

```bash
git clone https://github.com/ICJIA/forgecrawl
cd forgecrawl
pnpm install
cp .env.example .env
# Edit .env and set NUXT_AUTH_SECRET (min 32 chars)

pnpm build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

See [`ecosystem.config.cjs`](ecosystem.config.cjs) for PM2 tuning options.

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

> **Note:** The future marketing site (`packages/web`) *will* deploy to Netlify — it's static content with no server requirements.

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

ForgeCrawl includes a comprehensive test suite covering authentication, security, and scraping functionality. Tests run against a real built server (not mocks) for maximum confidence.

### Running tests

```bash
# Run all tests
pnpm test

# Run individual suites
pnpm test:health      # Health check endpoint
pnpm test:auth        # Auth: setup, login, API keys
pnpm test:security    # Security: middleware, SSRF, rate limiting, error sanitization, data isolation
pnpm test:scrape      # Scraping: fetch, cache, CRUD
```

### Test suites (81 tests)

| Suite | File | Tests | What it covers |
|-------|------|-------|----------------|
| Health | `01-health` | 6 | Status, version, database, setup state, no sensitive data leaks |
| Auth Setup | `02-auth-setup` | 6 | Validation, admin creation, permanent setup lockout |
| Auth Login | `03-auth-login` | 7 | Credential validation, cookie flags, no user enumeration, no password hash exposure |
| API Keys | `04-auth-api-keys` | 8 | Key creation (`fc_` prefix), listing (no hash exposure), Bearer token auth, revocation |
| Auth Middleware | `05-security-auth-middleware` | 10 | Public vs protected routes, session + Bearer auth, tampered JWT rejection |
| SSRF | `06-security-ssrf` | 18 | Private IPs, localhost, cloud metadata, protocol blocklist, DNS resolution |
| Rate Limiting | `07-security-rate-limit` | 4 | Login attempt throttling, case-insensitive email matching |
| Error Sanitization | `08-security-error-sanitization` | 4 | No server path leaks, generic error messages, no user enumeration |
| Scraping | `09-scrape` | 10 | URL validation, Markdown output, frontmatter, caching, CRUD operations |
| Data Isolation | `10-security-data-isolation` | 6 | Cross-user access blocked, 404 (not 403) for missing resources |

### How tests work

Tests use a custom global setup that:
1. Builds the Nuxt app for production
2. Starts the server as a child process on port 5199 with a clean test database
3. Runs all tests using `ofetch` against the real HTTP server
4. Tears down the server and cleans up test data

No mocks, no test doubles — every test hits the real API through HTTP.

## Phase 2: What's Next

Phase 2 adds JavaScript rendering and storage options:

- **Puppeteer integration** — shared browser instance with configurable concurrency for scraping SPAs and JS-heavy pages
- **Render mode toggle** — choose HTTP-only (fast) or Puppeteer (full JS) per scrape
- **`wait_for` selector** — wait for a specific CSS selector before extracting content
- **Browser crash recovery** — auto-restart on Puppeteer disconnect
- **Filesystem storage** — store raw HTML, Markdown, and metadata as files on disk (in addition to or instead of SQLite)
- **Storage interface abstraction** — clean swap between database, filesystem, or both
- **PDF extraction** — detect PDF content-type and extract text to Markdown
- **DOCX extraction** — detect DOCX and convert to Markdown via mammoth
- **Enhanced Markdown** — better handling of code blocks, tables, and nested structures
- **Scrape config UI** — toggle JS rendering, set wait selectors, choose storage mode

See [`docs/forgecrawl-02-phase2.md`](docs/forgecrawl-02-phase2.md) for the full Phase 2 specification.

## Documentation

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

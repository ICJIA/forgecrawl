# ForgeCrawl — LLM Build Prompt

**Version:** 2.0
**Date:** March 3, 2026

---

## Purpose

This is the master prompt to provide to an LLM (Claude) when beginning development of ForgeCrawl. It contains all context needed to start building Phase 1. Provide this prompt along with the Master Design Document and Phase 1 document.

---

## The Prompt

You are building ForgeCrawl, a self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption. This is a greenfield project.

### Project Context

ForgeCrawl is inspired by Firecrawl but is fully self-hosted with no public endpoints and no external service dependencies. It requires authentication for all operations. The database is SQLite (embedded, zero-config). Auth is built-in (bcrypt + JWT). The target deployment is Docker Compose on a DigitalOcean droplet, with bare-metal PM2 as an alternative.

### Tech Stack (Mandatory)

- **Framework:** Nuxt 4 (>=4.3.1) with Nitro server engine
- **UI:** Nuxt UI v4+ (must be properly integrated — CSS/styles must load correctly)
- **Package Manager:** pnpm (latest)
- **Runtime:** Node.js latest LTS
- **Database:** SQLite via better-sqlite3 (WAL mode)
- **ORM:** Drizzle ORM (SQLite driver, with Postgres driver available for optional Supabase upgrade)
- **Auth:** Built-in — bcrypt for password hashing, jose for JWT signing/verification
- **Session:** HTTP-only cookie with signed JWT (HS256, 7-day expiry)
- **Process Manager:** PM2 (bare-metal) or Docker Compose (recommended)
- **HTML Parsing:** cheerio
- **Content Extraction:** @mozilla/readability + jsdom
- **HTML to Markdown:** turndown + turndown-plugin-gfm
- **Build preset:** node-server (for PM2/Docker deployment)

### Architecture Rules

1. pnpm workspace monorepo: `packages/app` (scraper) + `packages/web` (marketing site)
2. **Nuxt 4 directory structure:** `app/` contains pages, components, composables, layouts, middleware, plugins, utils, assets. `server/` is at the package root (not inside `app/`). `shared/` for code used by both client and server.
3. SSR mode with node-server Nitro preset
4. All API routes under `packages/app/server/api/`
5. Server auth middleware protects ALL `/api/*` routes except `/api/health` and `/api/auth/setup`
6. `NUXT_AUTH_SECRET` env var (min 32 chars) signs all JWTs. Auto-generated on first Docker start if empty.
7. Database auto-creates on first run. No external services needed.
8. SQLite runs in WAL mode with `busy_timeout = 5000` and `foreign_keys = ON`
9. **`forgecrawl.config.ts`** (monorepo root) is the single source of truth for all public configuration (ports, timeouts, concurrency, storage mode, app metadata). Import via `toRuntimeConfig()` in `nuxt.config.ts`. Secrets go in `.env` only.
10. TypeScript throughout

### What You Are Building (Phase 1)

Phase 1 delivers:

**1. Monorepo Scaffold**
- pnpm workspace with `packages/app` and `packages/web`
- `packages/app`: Nuxt 4 project with Nuxt UI v4, node-server preset
- Root `pnpm-workspace.yaml`, root `package.json` with workspace scripts
- `docker-compose.yml` and `packages/app/Dockerfile` for containerized deployment
- `.env.example` with all variables (no Supabase credentials needed)
- `packages/app/ecosystem.config.cjs` for PM2 (bare-metal alternative)

**2. Database (SQLite + Drizzle ORM)**
- Schema defined in `packages/app/server/db/schema.ts` using Drizzle's `sqliteTable`
- Tables: `app_config`, `users`, `api_keys`, `scrape_jobs`, `scrape_results`
- Database initialization in `packages/app/server/db/index.ts`: creates SQLite file, sets WAL mode pragmas, runs Drizzle migrations on startup
- No external database setup required. First run creates `data/forgecrawl.sqlite`.

**3. Built-in Authentication**
- Password hashing: `packages/app/server/auth/password.ts` — bcrypt with 12 salt rounds
- JWT management: `packages/app/server/auth/jwt.ts` — jose library, HS256, 7-day expiry
- Session stored in HTTP-only, Secure (in production), SameSite=Lax cookie named `forgecrawl_session`
- Auth composable: `packages/app/app/composables/useAuth.ts`

**4. First-Run Admin Registration**
- Global client middleware checks `app_config` for `setup_complete`
- If not set, redirects ALL routes to `/setup`
- `/setup` page: email, password, confirm password, display name
- `POST /api/auth/setup`: validates input, hashes password with bcrypt, creates admin user row, sets `setup_complete` in `app_config`, issues JWT cookie
- After setup, `/api/auth/setup` returns 403 permanently
- Constant-time rejection: always hash even on invalid lookup to prevent timing attacks

**5. Login/Logout**
- `POST /api/auth/login`: validates email/password against `users` table, issues JWT cookie
- `POST /api/auth/logout`: clears session cookie
- `GET /api/auth/me`: returns current user from JWT payload
- Client middleware redirects to `/login` if no valid session

**6. Server Auth Middleware**
- `packages/app/server/middleware/auth.ts`
- Checks for API key header (`Authorization: Bearer bc_xxx`) first — validates against `api_keys` table using bcrypt comparison
- Falls back to session cookie — validates JWT signature and expiry
- Skips auth for: `/api/health`, `/api/auth/setup`, `/api/auth/login`
- Sets `event.context.user` with `{ id, email, role }` on success

**7. Basic Scraping Engine**
- `POST /api/scrape` accepts `{ url, config }`
- Validates URL (blocks private IPs, localhost, cloud metadata, non-HTTP protocols)
- Fetches via HTTP (no Puppeteer in Phase 1)
- Extracts with @mozilla/readability
- Converts with turndown + GFM plugin
- Stores job and result in SQLite via Drizzle ORM
- Returns `{ job_id, title, markdown, wordCount, metadata }`

**8. Dashboard UI**
- Main page: scrape form + recent scrapes table
- Markdown preview with copy to clipboard
- `/scrapes/[id]` detail page

**9. Health Check**
- `GET /api/health` returns status without auth (uptime, memory, SQLite connectivity)

**10. SSRF URL Validation**
- `packages/app/server/utils/url.ts`
- Blocks private IPs (10.x, 172.16-31.x, 192.168.x), loopback (127.x, ::1), link-local (169.254.x)
- Blocks cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- Blocks non-HTTP(S) protocols (file://, ftp://, gopher://, data:)
- Resolves DNS before fetching and checks resolved IP against blocklists
- Called by `POST /api/scrape` before any fetch operation

**11. Result Caching**
- `packages/app/server/engine/cache.ts`
- Returns cached result when same URL scraped within `NUXT_CACHE_TTL` seconds
- Response includes `"cached": true` on cache hit
- Bypass with `"bypass_cache": true` in request body
- `NUXT_CACHE_TTL=3600` (0 to disable)

**12. Login Rate Limiting**
- `packages/app/server/utils/login-limiter.ts`
- In-memory rate limiter: max 5 failed attempts per email per 15-minute window
- Returns HTTP 429 when exceeded, resets on successful login
- Called by `POST /api/auth/login`

**13. Docker Compose**
- `docker-compose.yml`: single `app` service, builds from `packages/app/Dockerfile`
- Dockerfile: multi-stage build (base + production), installs Chromium + fonts, uses pnpm, creates non-root user, includes HEALTHCHECK
- Data persisted via Docker volume at `/app/data`
- `NUXT_AUTH_SECRET` auto-generated in entrypoint if not provided

### File Structure

```
forgecrawl/
├── forgecrawl.config.ts             # Single source of truth for public config
├── pnpm-workspace.yaml
├── package.json
├── docker-compose.yml
├── .env                              # Secrets only (gitignored)
├── .env.example                      # Secret key templates (committed)
├── packages/
│   ├── app/                          # Nuxt 4 app
│   │   ├── nuxt.config.ts            # Imports from ../../forgecrawl.config.ts
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── ecosystem.config.cjs
│   │   ├── app/                      # Nuxt 4 srcDir
│   │   │   ├── app.vue
│   │   │   ├── pages/ (index, setup, login, scrapes/[id])
│   │   │   ├── components/ (ScrapeForm, MarkdownPreview)
│   │   │   ├── composables/ (useAuth)
│   │   │   ├── middleware/ (setup.global, auth)
│   │   │   └── assets/css/ (main.css)
│   │   ├── shared/                   # Code shared between app/ and server/
│   │   └── server/
│   │       ├── middleware/ (auth)
│   │       ├── api/ (health, scrape, auth/setup, auth/login, auth/logout, auth/me)
│   │       ├── engine/ (scraper, fetcher, extractor, converter, cache)
│   │       ├── db/ (index, schema, backend)
│   │       ├── auth/ (password, jwt)
│   │       └── utils/ (url validation, login-limiter)
│   └── web/ (marketing site, separate Nuxt app, Phase 5+)
└── data/ (created at runtime, contains forgecrawl.sqlite)
```

### Critical Security Requirements

- URL validation MUST block private IPs, localhost, cloud metadata, non-HTTP protocols
- URL validation MUST resolve DNS and check resolved IPs against private range blocklists
- Login rate limiting MUST enforce max 5 failed attempts per email per 15-minute window
- `NUXT_AUTH_SECRET` MUST be at least 32 random characters
- bcrypt with 12 salt rounds for ALL password hashing
- JWT in HTTP-only, Secure, SameSite=Lax cookie (NEVER localStorage)
- `/api/auth/setup` MUST atomically reject if setup already complete
- All `/api/*` routes MUST require authentication (except health, setup, and login)
- Constant-time password verification even on invalid email lookup
- SQLite file permissions 600 (owner read/write only)
- Never render scraped HTML directly without sanitization

### Configuration

**Public defaults** are defined in `forgecrawl.config.ts` (monorepo root) and imported by `nuxt.config.ts`. Do not duplicate these values in `.env` or elsewhere.

**Secrets** go in `.env` (gitignored). `.env.example` (committed) provides key templates:

```bash
# .env — secrets only
NUXT_AUTH_SECRET=              # Min 32 chars, signs JWTs. Auto-generated if empty.
NUXT_ENCRYPTION_KEY=           # AES-256-GCM key (Phase 5)
NUXT_ALERT_WEBHOOK=            # Discord/Slack webhook (optional)
```

Public config values (port, timeouts, storage mode, concurrency, etc.) are in `forgecrawl.config.ts`. The `nuxt.config.ts` imports them:

```typescript
// packages/app/nuxt.config.ts
import { config, toRuntimeConfig } from '../../forgecrawl.config'

export default defineNuxtConfig({
  compatibilityDate: '2025-03-01',
  future: { compatibilityVersion: 4 },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: toRuntimeConfig(),
  nitro: { preset: 'node-server' },
})
```

No Supabase credentials needed. No external database. No cloud accounts.

### Testing After Build

1. `pnpm --filter @forgecrawl/app dev` starts without errors
2. First visit redirects to `/setup`
3. Admin registration succeeds, JWT cookie is set
4. `/setup` blocked after registration (returns 403)
5. Login works, session persists across page reloads
6. Unauthenticated `POST /api/scrape` returns 401
7. Authenticated `POST /api/scrape` with URL returns clean Markdown
8. Scrape history shows in dashboard
9. `GET /api/health` returns 200 without auth
10. SSRF: `POST /api/scrape` with `http://127.0.0.1` returns 400
11. SSRF: `POST /api/scrape` with `http://169.254.169.254` returns 400
12. Caching: second scrape of same URL within TTL returns `"cached": true`
13. Login rate limit: 6th consecutive failed login returns 429
14. `pnpm --filter @forgecrawl/app build` succeeds
15. `docker compose up -d` builds and starts the container
16. SQLite file created at `data/forgecrawl.sqlite`

### Style Guidelines

- Use Nuxt UI components for all UI elements
- Clean, minimal dashboard aesthetic
- Mobile-responsive layout
- Monospace font for Markdown preview
- Loading states and error handling on all async operations

Begin by scaffolding the monorepo and implementing the database schema and first-run setup flow, then build outward from there.

---

## Usage Instructions

1. Start a new Claude conversation (or Claude Code session)
2. Paste this prompt
3. Attach the Master Design Document (00) for full architectural reference
4. Attach the Phase 1 document (01) for detailed implementation specs
5. Attach the SQLite Auth document (11) for database schema and auth implementation
6. Attach the Security Document (06) for SSRF and auth requirements
7. Let Claude scaffold the project and build iteratively

For subsequent phases, start a new conversation with this prompt (updated for the target phase), the Master Design Document, the target phase document, the Security Document, and any relevant code from previous phases.

---

## Phase Progression

When moving to the next phase, update the "What You Are Building" section to reference the next phase document. Always include the master design doc and security doc for context. The codebase from the previous phase becomes the starting point.

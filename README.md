# ForgeCrawl

Self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption.

## What It Does

Paste a URL, get clean Markdown back. ForgeCrawl fetches web pages (with full JavaScript rendering via Puppeteer), extracts the article content using Mozilla Readability, and converts it to Markdown with Turndown. Optionally splits output into token-aware chunks for RAG pipelines.

## Why ForgeCrawl?

[Firecrawl](https://github.com/mendableai/firecrawl) is an excellent, mature web scraping platform. If you need enterprise-scale crawling, managed infrastructure, or their cloud API, use Firecrawl — it's great at what it does.

ForgeCrawl is a different tool for a different audience. It's built for **solo developers and small teams** who want to self-host a web scraper without standing up a distributed system. Where Firecrawl is a production SaaS platform with 5+ Docker containers, Redis, RabbitMQ, and a recommended 16GB of RAM, ForgeCrawl is a single Node process you can deploy in minutes on a modest VPS.

### How They Compare

| | Firecrawl | ForgeCrawl |
|---|-----------|------------|
| **Target audience** | Teams, enterprises, SaaS users | Solo devs, small teams, self-hosters |
| **Architecture** | Distributed (5+ containers) | Single process |
| **Minimum RAM** | ~16 GB | 4 GB |
| **Setup time** | 30-60 min | ~5 min |
| **Admin UI** | None (API only) | Full dashboard (Nuxt UI) |
| **Database** | PostgreSQL (required) | SQLite (zero-config) |
| **Job queue** | Redis + RabbitMQ | SQLite-backed (no extra services) |
| **JS rendering** | Playwright (separate service) | Puppeteer (in-process) |
| **User management** | External / Supabase | Built-in with first-run setup |
| **RAG chunking** | Not included | Built-in token-aware chunking |
| **License** | AGPL-3.0 | MIT |
| **Monthly cost** | Free (self-host) or $16+/mo cloud | From $6/mo VPS (see [requirements](#vps-requirements)) |

### What ForgeCrawl Adds

- **First-run admin setup** — register your admin account in the browser, no config files
- **Browsable scrape history** — search, preview, re-export, and compare past results
- **Built-in RAG chunking** — token-aware splitting with heading hierarchy and overlap
- **Dual storage** — database, filesystem, or both
- **Zero-dependency queue** — SQLite transactions instead of Redis + RabbitMQ

### What ForgeCrawl Doesn't Try To Be

ForgeCrawl is not a Firecrawl replacement. It intentionally skips features that add complexity without serving the self-hosted use case: no billing system, no proxy infrastructure, no multi-region deployment, no AI extraction. It focuses on doing one thing well — turning web pages into clean Markdown on your own server.

## Features

- **Single-URL scraping** with HTTP or Puppeteer (JS rendering)
- **Site crawling** with depth limits, robots.txt compliance, rate limiting
- **Clean Markdown output** with YAML frontmatter and metadata
- **RAG chunking** with token-aware splitting, heading hierarchy, overlap
- **Built-in auth** (bcrypt + JWT) with first-run admin setup
- **API key access** for programmatic use
- **Multi-user** with per-user rate limiting and usage tracking
- **Login-gated scraping** via cookie injection or form-based login
- **PDF and DOCX** extraction
- **Export** as Markdown, JSON, JSONL, or zip
- **Full admin dashboard** built with Nuxt UI
- **SQLite** by default (zero-config, zero-cost)
- **Docker Compose** deployment (recommended) or bare-metal PM2

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Nuxt 4 (>=4.3.1) |
| UI | Nuxt UI 4+ |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Auth | Built-in (bcrypt + jose JWT) |
| JS Rendering | Puppeteer |
| Content Extraction | Mozilla Readability |
| HTML to Markdown | Turndown + GFM plugin |

## VPS Requirements

ForgeCrawl runs comfortably on modest hardware. The main constraint is Puppeteer/Chromium, which needs ~200-400MB per browser page for JavaScript rendering.

| | Minimum | Recommended |
|---|---------|-------------|
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 2 GB | 4 GB |
| **Storage** | 25 GB SSD | 50 GB SSD |
| **OS** | Ubuntu 22.04+ | Ubuntu 24.04 LTS |

**Can you go cheaper than $24/mo?** Yes. If you mostly scrape static pages (HTTP-only, no Puppeteer), a **$6/mo droplet** (1 vCPU / 1 GB) can work — but you'll need to limit Puppeteer concurrency to 1 page and expect occasional memory pressure on JS-heavy sites. A **$12/mo droplet** (1 vCPU / 2 GB) is the practical minimum for light Puppeteer use.

| DigitalOcean Plan | Specs | ForgeCrawl Use Case |
|---|---|---|
| **$6/mo** | 1 vCPU / 1 GB / 25 GB | HTTP-only scraping, no JS rendering |
| **$12/mo** | 1 vCPU / 2 GB / 50 GB | Light use, Puppeteer concurrency = 1 |
| **$24/mo** | 2 vCPU / 4 GB / 80 GB | General use, 2-3 concurrent Puppeteer pages |
| **$48/mo** | 4 vCPU / 8 GB / 160 GB | Heavy crawling, higher concurrency |

Adjust `puppeteer.concurrency` in `forgecrawl.config.ts` to match your server's available RAM. Each concurrent Puppeteer page adds ~200-400MB of memory overhead.

## Quick Start

### Docker Compose (recommended)

```bash
git clone https://github.com/cschweda/forgecrawl
cd forgecrawl
docker compose up -d
# Visit http://localhost:3000
# Register admin account on first run
```

### Bare Metal

```bash
git clone https://github.com/cschweda/forgecrawl
cd forgecrawl
pnpm install

# Install Chromium (Ubuntu/Debian)
sudo apt-get install -y chromium-browser fonts-liberation fonts-noto-cjk

cp .env.example .env
cd packages/app
pnpm build
pm2 start ecosystem.config.cjs
```

## Project Structure

```
forgecrawl/
├── forgecrawl.config.ts  # Single source of truth for public config
├── docker-compose.yml
├── .env.example          # Secret key templates (copy to .env)
├── pnpm-workspace.yaml
├── packages/
│   ├── app/              # Scraper application (Nuxt 4)
│   │   ├── app/          # Pages, components, composables (Nuxt 4 srcDir)
│   │   ├── server/       # API routes, engine, auth, DB
│   │   ├── shared/       # Code shared between app/ and server/
│   │   └── Dockerfile
│   └── web/              # Marketing site (Nuxt 4, static)
└── docs/                 # Design documents
```

## API Usage

```bash
# Scrape a URL
curl -X POST http://localhost:3000/api/scrape \
  -H "Authorization: Bearer bc_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Start a crawl
curl -X POST http://localhost:3000/api/crawl \
  -H "Authorization: Bearer bc_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "max_depth": 2, "max_pages": 50}'
```

## Development

```bash
# Prerequisites: Node.js 22+, pnpm 9+
pnpm install
pnpm dev:app    # Start scraper app in dev mode
pnpm dev:web    # Start marketing site in dev mode
```

## Configuration

Public configuration (ports, timeouts, storage mode, concurrency, etc.) is defined in `forgecrawl.config.ts` at the project root. This is the single source of truth — do not scatter defaults across `.env` or other files.

Secrets go in `.env` (gitignored). Copy `.env.example` to `.env` and fill in values:

```bash
NUXT_AUTH_SECRET=         # Min 32 chars, auto-generated if empty
NUXT_ENCRYPTION_KEY=      # AES-256-GCM key for site credentials (Phase 5)
NUXT_ALERT_WEBHOOK=       # Discord/Slack webhook (optional)
```

See `forgecrawl.config.ts` for all public defaults and `.env.example` for secret key templates.

## Documentation

Design documents are in the `docs/` directory:

- `00` — Master Design
- `01-05` — Phase implementation specs
- `06` — Security
- `07` — LLM Build Prompt
- `11` — SQLite Auth (authoritative schema)

## License

[MIT](LICENSE)

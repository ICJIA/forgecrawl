# ForgeCrawl — Monorepo Structure & Marketing Website

**Version:** 1.0
**Date:** March 3, 2026
**Applies to:** All phases (structural update to master design)

---

## 1. Overview

ForgeCrawl is structured as a **pnpm workspace monorepo** containing two packages: the scraper application and a marketing/documentation website. Both packages use the same core tech stack (Nuxt 4, Nuxt UI v4, pnpm).

---

## 2. Package Manager: pnpm

**pnpm is the package manager for all ForgeCrawl development.** This is non-negotiable and applies to every phase.

- pnpm workspaces manage the monorepo
- All install, build, dev, and lint commands use pnpm
- The lockfile is pnpm-lock.yaml (committed to version control)
- Node.js latest LTS is the runtime
- No yarn, no npm, no bun

```bash
# Install pnpm globally
corepack enable
corepack prepare pnpm@latest --activate

# Install all workspace dependencies
pnpm install

# Run a specific workspace
pnpm --filter @forgecrawl/app dev
pnpm --filter @forgecrawl/web dev

# Build all workspaces
pnpm -r build
```

---

## 3. Monorepo Structure

```
forgecrawl/
+-- pnpm-workspace.yaml
+-- package.json                    # Root workspace config
+-- .npmrc
+-- .gitignore
+-- README.md
+-- LICENSE                         # MIT
+--
+-- packages/
|   +-- app/                        # The scraper application
|   |   +-- package.json            # @forgecrawl/app
|   |   +-- nuxt.config.ts
|   |   +-- ecosystem.config.cjs    # PM2 config (production)
|   |   +-- .env.example
|   |   +-- app/
|   |   |   +-- pages/
|   |   |   +-- components/
|   |   |   +-- composables/
|   |   |   +-- middleware/
|   |   +-- server/
|   |   |   +-- middleware/
|   |   |   +-- api/
|   |   |   +-- engine/
|   |   |   +-- queue/
|   |   |   +-- storage/
|   |   |   +-- utils/
|   |   +-- data/                   # Filesystem storage (gitignored)
|   |
|   +-- web/                        # Marketing and documentation site
|       +-- package.json            # @forgecrawl/web
|       +-- nuxt.config.ts
|       +-- app/
|       |   +-- pages/
|       |   |   +-- index.vue       # Landing page
|       |   |   +-- features.vue    # Feature breakdown
|       |   |   +-- comparison.vue  # ForgeCrawl vs Firecrawl
|       |   |   +-- samples.vue     # Live Markdown samples
|       |   |   +-- docs/
|       |   |       +-- index.vue   # Getting started
|       |   |       +-- api.vue     # API reference
|       |   |       +-- deploy.vue  # Deployment guide
|       |   +-- components/
|       |   +-- content/            # Nuxt Content markdown files
|       |       +-- samples/
|       |           +-- example-com.md
|       |           +-- nuxt-docs.md
|       |           +-- github-readme.md
|       +-- public/
```

### Root Configuration Files

**pnpm-workspace.yaml:**
```yaml
packages:
  - 'packages/*'
```

**package.json (root):**
```json
{
  "name": "forgecrawl",
  "private": true,
  "scripts": {
    "dev:app": "pnpm --filter @forgecrawl/app dev",
    "dev:web": "pnpm --filter @forgecrawl/web dev",
    "build:app": "pnpm --filter @forgecrawl/app build",
    "build:web": "pnpm --filter @forgecrawl/web build",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## 4. Marketing Website: @forgecrawl/web

### 4.1 Purpose

A static Nuxt site explaining what ForgeCrawl is, why it exists, how it differs from Firecrawl, and showing real Markdown output samples. Deployable on Netlify, Vercel, or any static host.

### 4.2 Tech Stack

- Framework: Nuxt 4 (4.5+, static preset)
- UI: Nuxt UI v4
- Content: Nuxt Content v3
- Package Manager: pnpm (workspace)
- Deployment: Netlify (static) or any CDN

### 4.3 Pages

#### Landing Page (/)

**Headline:** "Turn any website into clean Markdown. Self-hosted. No Docker orchestra required."

**Subheadline:** "ForgeCrawl is a self-hosted web scraper that converts websites into LLM-ready Markdown with built-in RAG chunking, a full admin dashboard, and zero external dependencies beyond your database."

**Key differentiators (3 cards):**

1. **One Process, One Server** -- Firecrawl needs 5+ Docker containers, Redis, RabbitMQ, Playwright microservice, and a Go HTML-to-Markdown service. ForgeCrawl is a single Node process behind PM2. Deploy on a $24/mo DigitalOcean droplet.

2. **Admin Dashboard Included** -- Firecrawl is API-only with no UI. ForgeCrawl ships with a full Nuxt UI admin panel: scrape history, crawl progress, user management, API key management, storage statistics.

3. **RAG-Ready Output** -- Firecrawl gives you raw Markdown. ForgeCrawl optionally splits output into token-aware chunks with heading hierarchy, overlap, and position metadata. Feed directly into your RAG pipeline.

**Quick start code block:**
```bash
git clone https://github.com/youruser/forgecrawl
cd forgecrawl/packages/app
pnpm install
cp .env.example .env
pnpm build
pm2 start ecosystem.config.cjs
```

#### Features Page (/features)

Detailed breakdown of all features with visual examples: first-run setup, scraping engine, content extraction, Markdown quality, site crawling, RAG chunking, login-gated scraping, API keys, multi-user, configurable storage, and export formats.

#### Comparison Page (/comparison)

Side-by-side table comparing ForgeCrawl and Firecrawl across deployment complexity, resource requirements, setup time, admin UI, queue dependencies, RAG support, and licensing.

Includes narrative sections: "Why not just use Firecrawl?" and "When should you use Firecrawl instead?" for honest, balanced positioning.

#### Samples Page (/samples)

Live rendered examples of ForgeCrawl Markdown output from real websites. Each sample shows:

1. The source URL
2. The raw Markdown output (in a code block)
3. The rendered Markdown (as HTML)
4. The RAG chunk output (as JSON)

**Sample 1: example.com**

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

**Sample 2: Nuxt documentation page**

```markdown
---
title: "Introduction - Nuxt"
url: "https://nuxt.com/docs/getting-started/introduction"
scraped_at: "2026-03-03T12:00:00Z"
word_count: 847
source: "Nuxt"
scraper: "ForgeCrawl/1.0"
---

# Introduction

Nuxt is a free and open-source framework with an intuitive and extendable way to create type-safe, performant and production-grade full-stack web applications and websites with Vue.js.

## Automation and Conventions

Nuxt uses conventions and an opinionated directory structure to automate repetitive tasks and allow developers to focus on pushing features.

- **File-based routing:** define routes based on the structure of your pages/ directory
- **Code splitting:** Nuxt automatically splits your code into smaller chunks
- **Server-side rendering out of the box:** built-in SSR capabilities
- **Auto-imports:** write Vue composables and components in their respective directories
- **Data-fetching utilities:** composables for SSR-compatible data fetching
- **Zero-config TypeScript support:** auto-generated types and tsconfig.json
- **Configured build tools:** Vite by default with best-practices baked-in

## Server Engine

The Nuxt server engine Nitro unlocks new full-stack capabilities. In development, it uses Rollup and Node.js workers for your server code and context isolation.
```

**Sample 3: GitHub README (code-heavy)**

```markdown
---
title: "Vue.js - The Progressive JavaScript Framework"
url: "https://github.com/vuejs/core"
scraped_at: "2026-03-03T12:00:00Z"
word_count: 312
source: "GitHub"
scraper: "ForgeCrawl/1.0"
---

# Vue.js

The Progressive JavaScript Framework.

## Quick Start

- [Vue SFC Playground](https://play.vuejs.org)
- [StackBlitz](https://vite.new/vue)

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| vue | 3.5.x | Core framework |
| @vue/compiler-sfc | 3.5.x | SFC compiler |
| @vue/server-renderer | 3.5.x | SSR support |

## Contributing

Please read the Contributing Guide before making a pull request.

## License

MIT
```

**Sample 4: RAG chunked output**

```json
{
  "url": "https://nuxt.com/docs/getting-started/introduction",
  "title": "Introduction - Nuxt",
  "chunks": [
    {
      "index": 0,
      "content": "# Introduction\n\nNuxt is a free and open-source framework with an intuitive and extendable way to create type-safe, performant and production-grade full-stack web applications and websites with Vue.js.\n\nWe made everything so you can start writing .vue files from the beginning while enjoying hot module replacement in development and a performant application in production with server-side rendering by default.",
      "token_count": 68,
      "metadata": {
        "heading_hierarchy": ["Introduction"],
        "position": "start",
        "source_url": "https://nuxt.com/docs/getting-started/introduction",
        "chunk_of": 3,
        "has_overlap": false
      }
    },
    {
      "index": 1,
      "content": "## Automation and Conventions\n\nNuxt uses conventions and an opinionated directory structure to automate repetitive tasks and allow developers to focus on pushing features.\n\n- File-based routing: define routes based on the structure of your pages/ directory\n- Code splitting: Nuxt automatically splits your code into smaller chunks\n- Server-side rendering out of the box\n- Auto-imports: write Vue composables and components without importing them\n- Data-fetching utilities: composables for SSR-compatible data fetching\n- Zero-config TypeScript support\n- Configured build tools: Vite by default",
      "token_count": 112,
      "metadata": {
        "heading_hierarchy": ["Introduction", "Automation and Conventions"],
        "position": "middle",
        "source_url": "https://nuxt.com/docs/getting-started/introduction",
        "chunk_of": 3,
        "has_overlap": true
      }
    },
    {
      "index": 2,
      "content": "## Server Engine\n\nThe Nuxt server engine Nitro unlocks new full-stack capabilities. In development, it uses Rollup and Node.js workers for your server code and context isolation. It also generates your server API by reading files in server/api/ and server middleware from server/middleware/.",
      "token_count": 52,
      "metadata": {
        "heading_hierarchy": ["Introduction", "Server Engine"],
        "position": "end",
        "source_url": "https://nuxt.com/docs/getting-started/introduction",
        "chunk_of": 3,
        "has_overlap": true
      }
    }
  ]
}
```

#### Documentation Pages (/docs/*)

- **Getting Started** (/docs): Prerequisites, installation, first run (no external services needed)
- **API Reference** (/docs/api): All endpoints with request/response schemas and curl examples
- **Deployment Guide** (/docs/deploy): DigitalOcean droplet setup, Nginx, SSL, PM2

### 4.4 Website Nuxt Config

```typescript
// packages/web/nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-03-01',
  future: { compatibilityVersion: 4 },
  modules: ['@nuxt/ui', '@nuxt/content'],
  nitro: {
    preset: 'static',
  },
  app: {
    head: {
      title: 'ForgeCrawl - Self-Hosted Web Scraper for LLMs',
      meta: [
        { name: 'description', content: 'Turn any website into clean, LLM-ready Markdown. Self-hosted, authenticated, with built-in RAG chunking.' },
        { property: 'og:title', content: 'ForgeCrawl' },
        { property: 'og:description', content: 'Self-hosted web scraper for LLMs. Clean Markdown with RAG chunking.' },
      ],
    },
  },
})
```

---

## 5. Impact on Existing Phase Documents

### Changes to Master Design Doc

1. Project structure updated from single app to pnpm workspace monorepo
2. Package manager explicitly pnpm throughout with workspace commands
3. Build commands updated to use --filter syntax

### Changes to Phase 1

1. Bootstrap uses pnpm workspace init pattern
2. Dev command becomes pnpm --filter @forgecrawl/app dev

### Changes to LLM Build Prompt

Build prompt specifies monorepo structure and pnpm workspace setup. The marketing website can be built in parallel with any phase or deferred to after Phase 1.

---

## 6. Suggested Build Order

1. Phase 1: Build packages/app (foundation + auth + basic scraping)
2. Phase 1 parallel (optional): Scaffold packages/web with landing page
3. Phase 2-5: Continue app development
4. Post-Phase 2: Populate marketing site with real scrape samples
5. Post-Phase 4: Add API documentation to marketing site
6. Post-Phase 5: Final marketing site polish with RAG chunking examples

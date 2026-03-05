/**
 * forgecrawl.config.ts
 *
 * Single source of truth for all public project configuration.
 * Secret values (auth secrets, encryption keys, external API credentials)
 * belong in .env — never in this file.
 *
 * Import this config in nuxt.config.ts:
 *   import { config } from '../../forgecrawl.config'
 */

export const config = {
  /** Application metadata */
  app: {
    name: 'ForgeCrawl',
    version: '0.1.0',
    description:
      'Self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption.',
    author: 'cschweda',
    repo: 'https://github.com/cschweda/forgecrawl',
    license: 'MIT',
  },

  /** Server defaults */
  server: {
    port: 3000,
    host: '0.0.0.0',
  },

  /** Database */
  db: {
    /** 'sqlite' is the default and recommended backend */
    backend: 'sqlite' as const,
    /** SQLite WAL mode busy timeout in milliseconds */
    busyTimeout: 5000,
  },

  /** Storage — where scrape results are persisted */
  storage: {
    /** 'database' | 'filesystem' | 'both' */
    mode: 'both' as 'database' | 'filesystem' | 'both',
    /** Base directory for SQLite database and filesystem storage */
    dataDir: './data',
  },

  /** Scraping engine */
  scrape: {
    /** Page load timeout in milliseconds */
    timeout: 30000,
    /** User-Agent string sent with HTTP requests */
    userAgent: 'ForgeCrawl/1.0',
    /** Result cache TTL in seconds (0 to disable) */
    cacheTtl: 3600,
  },

  /** Puppeteer (headless Chromium) */
  puppeteer: {
    /** Max concurrent browser pages */
    concurrency: 3,
    /**
     * Path to Chromium binary — leave empty for auto-detection.
     * Docker sets this to /usr/bin/chromium-browser.
     */
    executablePath: '',
  },

  /** Authentication */
  auth: {
    /** bcrypt salt rounds */
    saltRounds: 12,
    /** JWT algorithm */
    algorithm: 'HS256' as const,
    /** Session cookie name */
    cookieName: 'forgecrawl_session',
    /** Session cookie max-age in seconds (7 days) */
    cookieMaxAge: 7 * 24 * 60 * 60,
  },

  /** Rate limiting */
  rateLimit: {
    /** Max failed login attempts per email before lockout */
    loginMaxAttempts: 5,
    /** Login lockout window in milliseconds (15 minutes) */
    loginWindowMs: 15 * 60 * 1000,
  },

  /** Crawling (Phase 3) */
  crawl: {
    /** Default max crawl depth */
    defaultMaxDepth: 2,
    /** Default max pages per crawl */
    defaultMaxPages: 50,
    /** Delay between requests in milliseconds */
    politenessDelay: 1000,
    /** Respect robots.txt by default */
    respectRobotsTxt: true,
  },

  /** RAG chunking (Phase 5) */
  chunking: {
    /** Default max tokens per chunk */
    defaultMaxTokens: 512,
    /** Token overlap between adjacent chunks */
    defaultOverlap: 50,
  },

  /** Alert webhook (Phase 5) — URL set via env var NUXT_ALERT_WEBHOOK */
  alerts: {
    webhookUrl: '',
  },
} as const

/** Helper to map config values into Nuxt runtimeConfig format */
export function toRuntimeConfig() {
  return {
    // Private (server-only) — secrets come from .env via NUXT_ prefix
    authSecret: '', // NUXT_AUTH_SECRET
    encryptionKey: '', // NUXT_ENCRYPTION_KEY
    storageMode: config.storage.mode,
    dataDir: config.storage.dataDir,
    dbBackend: config.db.backend,
    scrapeTimeout: config.scrape.timeout,
    scrapeUserAgent: config.scrape.userAgent,
    cacheTtl: config.scrape.cacheTtl,
    puppeteerConcurrency: config.puppeteer.concurrency,
    puppeteerExecutablePath: config.puppeteer.executablePath,
    alertWebhook: config.alerts.webhookUrl,
    public: {
      appName: config.app.name,
      appVersion: config.app.version,
    },
  }
}

/**
 * forgecrawl.config.ts — Single source of truth for all public configuration.
 *
 * This file controls every non-secret setting in ForgeCrawl. When you deploy,
 * these are the values baked into the build. You should never need to duplicate
 * these defaults in .env, nuxt.config.ts, or individual source files.
 *
 * SECRET VALUES (auth secrets, encryption keys, API credentials) belong in
 * .env — never in this file. See .env.example for the template.
 *
 * USAGE:
 *   In packages/app/nuxt.config.ts:
 *     import { config, toRuntimeConfig } from '../../forgecrawl.config'
 *
 *   Then set runtimeConfig: toRuntimeConfig()
 *
 * STRUCTURE:
 *   The file is organized into two sections:
 *     1. COMMON — Settings most users will want to review or change
 *     2. ADVANCED — Defaults that work for most deployments; change only
 *        if you understand the implications
 */

export const config = {

  // ═══════════════════════════════════════════════════════════════════════════
  //  COMMON SETTINGS
  //  Review these when setting up a new deployment. These are the values
  //  you're most likely to change based on your server and use case.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Application metadata.
   * "name" and "version" are displayed in the dashboard header and API responses.
   */
  app: {
    /** Displayed in the UI header and API responses */
    name: 'ForgeCrawl',

    /** Shown in the dashboard footer and health endpoint */
    version: '0.1.0',

    description:
      'Self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption.',
    author: 'cschweda',
    repo: 'https://github.com/cschweda/forgecrawl',
    license: 'MIT',
  },

  /**
   * Server — where the app listens.
   * For Docker deployments, leave these as-is (the container maps ports externally).
   * For bare-metal, change `port` if 5150 conflicts with another service.
   */
  server: {
    /** HTTP port. Override at runtime with the PORT env var if needed. */
    port: 5150,

    /**
     * Bind address. '0.0.0.0' listens on all interfaces (required for Docker).
     * Set to '127.0.0.1' if you only want localhost access (e.g., behind Nginx).
     */
    host: '0.0.0.0',
  },

  /**
   * Storage — where scrape results are saved.
   *
   *   'database'   — Everything in SQLite. Simple, easy to back up (one file).
   *   'filesystem'  — Raw HTML, Markdown, and chunks stored as files on disk.
   *                   Metadata still in SQLite for querying.
   *   'both'        — Metadata in SQLite + large content on disk. Best of both
   *                   worlds for most deployments. (DEFAULT)
   */
  storage: {
    mode: 'database' as 'database' | 'filesystem' | 'both',

    /**
     * Base directory for the SQLite database file and filesystem storage.
     * Relative paths are resolved from the Nuxt app root (packages/app/).
     * In Docker, this is mapped to a volume at /app/data.
     */
    dataDir: './data',
  },

  /**
   * Puppeteer — headless Chromium for JavaScript-rendered pages.
   * This is the biggest factor in RAM usage. Adjust concurrency to match
   * your server's available memory.
   *
   *   1 GB RAM → concurrency: 1 (or disable Puppeteer entirely)
   *   2 GB RAM → concurrency: 1-2
   *   4 GB RAM → concurrency: 2-3
   *   8 GB RAM → concurrency: 4-6
   *
   * Each concurrent page adds ~200-400MB of memory overhead.
   */
  puppeteer: {
    /** Max number of browser pages open at the same time */
    concurrency: 3,

    /**
     * Absolute path to the Chromium binary.
     * Leave empty ('') for auto-detection — Puppeteer will find the bundled
     * or system Chromium automatically. Docker sets this to /usr/bin/chromium-browser.
     * Only set this if auto-detection fails on your system.
     */
    executablePath: '',
  },

  /**
   * Scraping engine — controls how pages are fetched and cached.
   */
  scrape: {
    /**
     * How long to wait for a page to load before giving up (milliseconds).
     * 30 seconds is generous for most sites. Increase for very slow pages.
     */
    timeout: 30000,

    /**
     * User-Agent header sent with HTTP requests. Some sites block requests
     * without a recognized User-Agent. Change this if you're getting 403s.
     */
    userAgent: 'ForgeCrawl/1.0',

    /**
     * Result cache TTL in seconds. When the same URL is scraped again within
     * this window, the cached result is returned instead of re-fetching.
     * Set to 0 to disable caching entirely.
     *
     *   3600  = 1 hour (default)
     *   86400 = 24 hours
     *   0     = no caching
     */
    cacheTtl: 3600,
  },

  /**
   * Crawling — multi-page site crawls (Phase 3).
   * These are defaults; each crawl request can override them.
   */
  crawl: {
    /** How many links deep to follow from the starting URL (1 = just linked pages) */
    defaultMaxDepth: 2,

    /** Maximum total pages to scrape in a single crawl job */
    defaultMaxPages: 50,

    /**
     * Delay between requests in milliseconds. Keeps you from hammering
     * target servers. 1000ms (1 second) is a polite default.
     */
    politenessDelay: 1000,

    /** Whether to check and obey robots.txt before crawling. Leave this on. */
    respectRobotsTxt: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  ADVANCED SETTINGS
  //  The defaults below work well for most deployments. Only change these
  //  if you understand the security or performance implications.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Database — SQLite configuration.
   * SQLite is the default and recommended backend. It requires zero setup,
   * stores everything in a single file, and handles ForgeCrawl's workload
   * with ease. You almost certainly don't need to change these.
   */
  db: {
    /**
     * Database backend. 'sqlite' is the only fully supported option.
     * 'supabase' is an optional upgrade path — see docs/forgecrawl-11-sqlite-auth.md.
     */
    backend: 'sqlite' as const,

    /**
     * WAL mode busy timeout in milliseconds. When one process is writing,
     * other readers/writers wait up to this long before returning SQLITE_BUSY.
     * 5000ms is safe for all normal workloads. Don't lower this.
     */
    busyTimeout: 5000,
  },

  /**
   * Authentication — session and password hashing settings.
   * These are security-sensitive. Changing them can weaken auth or break
   * existing sessions. The defaults follow security best practices.
   */
  auth: {
    /**
     * bcrypt salt rounds. Higher = slower hashing = more resistant to brute force.
     * 12 is the widely accepted standard. Don't go below 10.
     * Going higher (e.g., 14) makes login noticeably slower with minimal security gain.
     */
    saltRounds: 12,

    /**
     * JWT signing algorithm. HS256 (HMAC-SHA256) is used with the NUXT_AUTH_SECRET
     * from .env. Don't change this unless you're migrating to asymmetric keys (RS256).
     */
    algorithm: 'HS256' as const,

    /**
     * Name of the HTTP-only session cookie. Changing this will log out all
     * existing users since their browsers still send the old cookie name.
     */
    cookieName: 'forgecrawl_session',

    /**
     * Session duration in seconds. Controls both JWT expiry and cookie maxAge.
     * After this, users must log in again. Shorter = more secure but more annoying.
     *
     *   604800   = 7 days
     *   1296000  = 15 days (default)
     *   2592000  = 30 days
     */
    sessionMaxAge: 15 * 24 * 60 * 60, // 15 days
  },

  /**
   * Rate limiting — brute-force protection for the login endpoint.
   * These limits apply per email address, not per IP.
   */
  rateLimit: {
    /**
     * Max failed login attempts before the account is temporarily locked.
     * After this many failures, the user gets HTTP 429 until the window resets.
     */
    loginMaxAttempts: 5,

    /**
     * How long the lockout lasts in milliseconds. After this window passes,
     * the failed attempt counter resets and the user can try again.
     * Default: 15 minutes (900000ms).
     */
    loginWindowMs: 15 * 60 * 1000, // 15 minutes
  },

  /**
   * RAG chunking — token-aware content splitting (Phase 5).
   * These are defaults; each scrape request can override them.
   */
  chunking: {
    /**
     * Maximum tokens per chunk. Most LLMs work well with 512-token chunks.
     * Larger chunks preserve more context but use more of the context window.
     * Smaller chunks are more precise for retrieval but may lose context.
     */
    defaultMaxTokens: 512,

    /**
     * Number of tokens duplicated between adjacent chunks. Overlap prevents
     * information from being lost at chunk boundaries. 50 tokens is a safe
     * default. Set to 0 for no overlap.
     */
    defaultOverlap: 50,
  },

  /**
   * Alerts — webhook notifications for errors and events (Phase 5).
   * The actual webhook URL is a secret and should be set via the
   * NUXT_ALERT_WEBHOOK environment variable in .env, not here.
   */
  alerts: {
    /** Placeholder — the real URL comes from .env at runtime */
    webhookUrl: '',
  },
} as const

// ═══════════════════════════════════════════════════════════════════════════
//  RUNTIME CONFIG HELPER
//  Maps the config above into the format Nuxt's runtimeConfig expects.
//  You shouldn't need to modify this unless you add new config keys.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates the runtimeConfig object for nuxt.config.ts.
 *
 * Secret values (authSecret, encryptionKey) are left as empty strings here.
 * Nuxt automatically fills them from .env at startup by matching the NUXT_
 * prefix (e.g., NUXT_AUTH_SECRET → runtimeConfig.authSecret).
 *
 * Usage in packages/app/nuxt.config.ts:
 *   import { toRuntimeConfig } from '../../forgecrawl.config'
 *   export default defineNuxtConfig({
 *     runtimeConfig: toRuntimeConfig(),
 *   })
 */
export function toRuntimeConfig() {
  return {
    // ── Secrets (populated from .env at runtime) ──────────────────────────
    authSecret: '',      // ← NUXT_AUTH_SECRET from .env
    encryptionKey: '',   // ← NUXT_ENCRYPTION_KEY from .env

    // ── Public defaults (from config above) ───────────────────────────────
    storageMode: config.storage.mode,
    dataDir: config.storage.dataDir,
    dbBackend: config.db.backend,
    scrapeTimeout: config.scrape.timeout,
    scrapeUserAgent: config.scrape.userAgent,
    cacheTtl: config.scrape.cacheTtl,
    puppeteerConcurrency: config.puppeteer.concurrency,
    puppeteerExecutablePath: config.puppeteer.executablePath,
    sessionMaxAge: config.auth.sessionMaxAge,
    alertWebhook: config.alerts.webhookUrl,

    // ── Client-visible values (safe to expose to the browser) ─────────────
    public: {
      appName: config.app.name,
      appVersion: config.app.version,
    },
  }
}

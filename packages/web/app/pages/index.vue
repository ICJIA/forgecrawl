<script setup lang="ts">
const colorMode = useColorMode()

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const userDomain = ref('your-server.example.com')
const apiBase = computed(() => `https://${userDomain.value || 'your-server.example.com'}`)

const features = [
  {
    icon: 'i-lucide-server',
    title: 'Self-Hosted',
    description: 'Your data never leaves your server. No third-party APIs, no usage tracking, no data sharing. You own everything.',
  },
  {
    icon: 'i-lucide-badge-dollar-sign',
    title: 'Free Forever',
    description: 'No monthly fees. No per-page pricing. No usage caps. No API keys to buy. Self-hosted on your own VPS — the only cost is your server.',
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Authenticated',
    description: 'Built-in user auth with bcrypt + JWT. API key support for CLI scripting. Rate limiting. SSRF protection.',
  },
  {
    icon: 'i-lucide-file-text',
    title: 'LLM-Ready Markdown',
    description: 'Clean Markdown with YAML frontmatter. Metadata, word counts, timestamps. Ready to paste into any LLM.',
  },
  {
    icon: 'i-lucide-zap',
    title: 'Zero Dependencies',
    description: 'SQLite database. No Redis, no Postgres, no message queue. One Docker command or PM2 start. That\'s it.',
  },
  {
    icon: 'i-lucide-refresh-cw',
    title: 'Smart Caching',
    description: 'Configurable result cache with TTL. Bypass on demand. Never scrape the same page twice unless you want to.',
  },
]

const securityFeatures = [
  { icon: 'i-lucide-shield', label: 'SSRF Protection', detail: 'Private IPs, localhost, cloud metadata, DNS re-validation on redirects' },
  { icon: 'i-lucide-lock', label: 'bcrypt + JWT', detail: '12-round password hashing, HTTP-only secure cookies, configurable session expiry' },
  { icon: 'i-lucide-key', label: 'API Key Auth', detail: 'SHA-256 hashed Bearer tokens (fc_...) for CLI and scripting' },
  { icon: 'i-lucide-timer', label: 'Rate Limiting', detail: '5 failed logins per email per 15-minute window' },
  { icon: 'i-lucide-eye-off', label: 'Error Sanitization', detail: 'No server paths, no stack traces, no user enumeration' },
  { icon: 'i-lucide-users', label: 'Data Isolation', detail: 'All queries scoped to authenticated user ID' },
]

const steps = [
  { step: '01', title: 'Deploy', description: 'Clone the repo. Run docker compose up or pm2 start. Register your admin account.' },
  { step: '02', title: 'Create an API Key', description: 'Log in to the web UI. Generate a Bearer token. Use it in scripts, curl, or any HTTP client.' },
  { step: '03', title: 'Scrape & Build', description: 'POST a URL, get clean Markdown back. Feed it to your RAG pipeline, fine-tuning dataset, or LLM prompt.' },
]

const endpoints = [
  {
    method: 'GET', path: '/api/health', auth: false, color: 'success' as const,
    description: 'Returns server health status and version info.',
    curl: 'curl {base}/api/health',
    response: `{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 84623
}`,
  },
  {
    method: 'POST', path: '/api/scrape', auth: true, color: 'info' as const,
    description: 'Scrape a URL and return clean Markdown with metadata. Send {"url": "https://..."} in the request body.',
    curl: `curl -X POST {base}/api/scrape \\
  -H "Authorization: Bearer $FC_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'`,
    response: `{
  "job_id": "c7f3a1b2-9e4d-4c8a-...",
  "title": "Example Domain",
  "markdown": "---\\ntitle: Example Domain\\n...\\n---\\n\\n# Example Domain\\n...",
  "rawHtml": "<!doctype html>...",
  "wordCount": 28,
  "metadata": {
    "url": "https://example.com",
    "canonical": null,
    "excerpt": "This domain is for use in...",
    "language": "en",
    "scrapedAt": "2026-03-05T14:22:08.431Z"
  },
  "cached": false
}`,
  },
  {
    method: 'GET', path: '/api/scrapes', auth: true, color: 'success' as const,
    description: 'List all scrape jobs for the authenticated user, ordered by most recent.',
    curl: `curl {base}/api/scrapes \\
  -H "Authorization: Bearer $FC_KEY"`,
    response: `[
  {
    "id": "c7f3a1b2-9e4d-4c8a-...",
    "url": "https://example.com",
    "status": "completed",
    "createdAt": "2026-03-05T14:22:07Z",
    "completedAt": "2026-03-05T14:22:08Z"
  },
  {
    "id": "a8d2e5f1-3b7c-4a9e-...",
    "url": "https://docs.acme.com/start",
    "status": "completed",
    "createdAt": "2026-03-05T14:20:01Z",
    "completedAt": "2026-03-05T14:20:03Z"
  }
]`,
  },
  {
    method: 'GET', path: '/api/scrapes/:id', auth: true, color: 'success' as const,
    description: 'Retrieve full results for a specific scrape job by ID.',
    curl: `curl {base}/api/scrapes/c7f3a1b2-9e4d-4c8a-... \\
  -H "Authorization: Bearer $FC_KEY"`,
    response: `{
  "id": "c7f3a1b2-9e4d-4c8a-...",
  "url": "https://example.com",
  "status": "completed",
  "title": "Example Domain",
  "markdown": "---\\ntitle: Example Domain\\n...---\\n\\n# Example Domain\\n...",
  "wordCount": 28,
  "metadata": { ... },
  "createdAt": "2026-03-05T14:22:07Z",
  "completedAt": "2026-03-05T14:22:08Z"
}`,
  },
  {
    method: 'DELETE', path: '/api/scrapes/:id', auth: true, color: 'error' as const,
    description: 'Delete a scrape job and its results permanently.',
    curl: `curl -X DELETE {base}/api/scrapes/c7f3a1b2-9e4d-4c8a-... \\
  -H "Authorization: Bearer $FC_KEY"`,
    response: `{
  "message": "Scrape job deleted"
}`,
  },
  {
    method: 'POST', path: '/api/auth/api-keys', auth: true, color: 'info' as const,
    description: 'Create a new API key for Bearer token authentication. The key is only shown once.',
    curl: `curl -X POST {base}/api/auth/api-keys \\
  -H "Authorization: Bearer $FC_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-script"}'`,
    response: `{
  "id": "e4f5a6b7-8c9d-4e0f-...",
  "name": "my-script",
  "key": "fc_a1b2c3d4e5f6...",
  "createdAt": "2026-03-05T14:25:00Z"
}`,
  },
  {
    method: 'GET', path: '/api/auth/api-keys', auth: true, color: 'success' as const,
    description: 'List all API keys for the authenticated user. Keys are masked for security.',
    curl: `curl {base}/api/auth/api-keys \\
  -H "Authorization: Bearer $FC_KEY"`,
    response: `[
  {
    "id": "e4f5a6b7-8c9d-4e0f-...",
    "name": "my-script",
    "lastFour": "f6a1",
    "createdAt": "2026-03-05T14:25:00Z",
    "lastUsedAt": "2026-03-05T15:10:33Z"
  }
]`,
  },
  {
    method: 'DELETE', path: '/api/auth/api-keys/:id', auth: true, color: 'error' as const,
    description: 'Revoke an API key permanently. It cannot be recovered.',
    curl: `curl -X DELETE {base}/api/auth/api-keys/e4f5a6b7-8c9d-4e0f-... \\
  -H "Authorization: Bearer $FC_KEY"`,
    response: `{
  "message": "API key revoked"
}`,
  },
]

const techStack = ['Nuxt 4', 'Vue 3', 'SQLite', 'Drizzle ORM', 'bcrypt', 'jose JWT', 'Readability', 'Turndown', 'Docker', 'PM2']

const markdownBenefits = [
  {
    icon: 'i-lucide-ruler',
    title: '~80% fewer tokens',
    description: 'A typical webpage is 50-200KB of HTML. After stripping nav, ads, scripts, and boilerplate, the Markdown is 2-10KB. That\'s 80-95% fewer tokens consumed by your LLM — which means lower cost and more room for actual context.',
  },
  {
    icon: 'i-lucide-focus',
    title: 'Signal, not noise',
    description: 'Raw HTML is full of <div>, <span>, class names, inline styles, tracking pixels, and aria attributes. None of that is content. Markdown strips it down to headings, paragraphs, lists, links, and code — exactly what the LLM needs to reason about.',
  },
  {
    icon: 'i-lucide-brain',
    title: 'Better LLM comprehension',
    description: 'LLMs are trained heavily on Markdown (GitHub, docs, README files). They parse Markdown structure natively — headings map to topics, lists map to enumeration, code blocks map to examples. HTML structure is ambiguous and model-dependent.',
  },
  {
    icon: 'i-lucide-tags',
    title: 'Structured metadata',
    description: 'ForgeCrawl adds YAML frontmatter with the source URL, title, description, scrape timestamp, and word count. This metadata is critical for RAG pipelines — you know where every chunk came from and when it was captured.',
  },
  {
    icon: 'i-lucide-repeat',
    title: 'Consistent format',
    description: 'Every website has different HTML structure. ForgeCrawl normalizes all of them into the same clean Markdown format — headings, paragraphs, lists, tables, code blocks. Your downstream pipeline handles one format, not thousands.',
  },
  {
    icon: 'i-lucide-git-compare',
    title: 'Diffable and versionable',
    description: 'Markdown diffs cleanly in git. HTML doesn\'t. If you\'re tracking content changes over time (regulatory pages, docs, policies), Markdown lets you see exactly what changed in a human-readable diff.',
  },
]

const userStories = [
  {
    icon: 'i-lucide-briefcase',
    role: 'Engineering Manager',
    color: 'text-(--color-orange-500)',
    quote: '"We needed web data for our AI features but couldn\'t send customer URLs to third-party APIs. ForgeCrawl runs on our own infra — compliance approved it in a day."',
    needs: ['Data stays on-premise', 'No per-page costs to budget', 'Simple Docker deploy for the team'],
  },
  {
    icon: 'i-lucide-code',
    role: 'Developer',
    color: 'text-(--color-orange-400)',
    quote: '"I was copy-pasting docs into ChatGPT and losing formatting every time. Now I hit one endpoint and get perfect Markdown with frontmatter. It\'s in my shell aliases."',
    needs: ['Clean API with Bearer auth', 'Markdown output ready for LLMs', 'curl-friendly — no SDK needed'],
  },
  {
    icon: 'i-lucide-clipboard-list',
    role: 'Project Manager',
    color: 'text-(--color-orange-500)',
    quote: '"Our content team archives 200+ policy pages a quarter. ForgeCrawl replaced a brittle Python script and a $400/mo SaaS subscription."',
    needs: ['Bulk scraping with caching', 'YAML metadata for organization', 'Free — no vendor lock-in'],
  },
  {
    icon: 'i-lucide-graduation-cap',
    role: 'Researcher',
    color: 'text-(--color-orange-400)',
    quote: '"I\'m building a RAG pipeline over government datasets. ForgeCrawl gives me structured Markdown with source URLs and timestamps — exactly what my embeddings need."',
    needs: ['Consistent output format', 'Source attribution in frontmatter', 'Self-hosted for IRB compliance'],
  },
  {
    icon: 'i-lucide-newspaper',
    role: 'Journalist',
    color: 'text-(--color-orange-500)',
    quote: '"I monitor 30+ agency newsrooms for breaking policy changes. ForgeCrawl lets me pull clean text on demand and diff it against last week\'s version — no more reading raw HTML in dev tools."',
    needs: ['On-demand scraping of public pages', 'Git-friendly Markdown for diffing', 'No third-party data sharing'],
  },
  {
    icon: 'i-lucide-book-open',
    role: 'Technical Writer',
    color: 'text-(--color-orange-400)',
    quote: '"We migrated 500 pages from a legacy CMS to a docs-as-code workflow. ForgeCrawl scraped every page into Markdown with frontmatter — saved us weeks of manual conversion."',
    needs: ['Bulk conversion to clean Markdown', 'Preserved headings, tables, and code blocks', 'YAML metadata for CMS import'],
  },
]
</script>

<template>
  <div class="min-h-screen bg-white text-(--color-neutral-900) dark:bg-(--color-neutral-950) dark:text-(--color-neutral-100) transition-colors duration-300">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/80 dark:bg-(--color-neutral-950)/80 backdrop-blur-lg">
      <div class="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
        <a href="#" class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-(--color-orange-400) to-(--color-orange-600) flex items-center justify-center text-white font-bold text-sm">
            FC
          </div>
          <span class="text-lg font-bold tracking-tight">ForgeCrawl</span>
        </a>

        <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-(--color-neutral-500)">
          <a href="#features" class="hover:text-(--color-orange-500) transition-colors">Features</a>
          <a href="#how-it-works" class="hover:text-(--color-orange-500) transition-colors">How It Works</a>
          <a href="#why-markdown" class="hover:text-(--color-orange-500) transition-colors">Why Markdown</a>
          <a href="#api" class="hover:text-(--color-orange-500) transition-colors">API</a>
          <a href="#security" class="hover:text-(--color-orange-500) transition-colors">Security</a>
          <a href="#why" class="hover:text-(--color-orange-500) transition-colors">Why</a>
        </nav>

        <div class="flex items-center gap-2">
          <UButton
            :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="toggleColorMode"
          />
          <UButton
            to="https://github.com/ICJIA/forgecrawl"
            target="_blank"
            icon="i-lucide-github"
            label="GitHub"
            color="neutral"
            variant="outline"
            size="sm"
          />
        </div>
      </div>
    </header>

    <main>
      <!-- Hero -->
      <section class="relative overflow-hidden">
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] bg-(--color-orange-500)/8 dark:bg-(--color-orange-500)/5" />
        </div>

        <div class="relative mx-auto max-w-6xl px-6 pt-20 pb-24">
          <!-- Banner -->
          <div class="mx-auto max-w-4xl mb-12 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-(--color-neutral-200) dark:ring-(--color-neutral-800)">
            <img src="/og-image.png" alt="ForgeCrawl — Web content forged into Markdown for LLMs" class="w-full" width="1280" height="640" />
          </div>

          <div class="text-center max-w-3xl mx-auto">
            <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Web content forged into
              <span class="bg-gradient-to-r from-(--color-orange-400) to-(--color-orange-600) bg-clip-text text-transparent">Markdown for LLMs</span>
            </h1>
            <p class="text-lg sm:text-xl text-(--color-neutral-500) leading-relaxed mb-6 max-w-2xl mx-auto">
              Self-hosted, authenticated web scraper that converts any webpage into clean, structured Markdown — optimized for RAG pipelines, fine-tuning, and LLM prompts.
            </p>

            <div class="inline-flex items-center gap-3 rounded-full border border-(--color-orange-500)/30 bg-(--color-orange-500)/5 px-5 py-2.5 mb-10">
              <UIcon name="i-lucide-badge-dollar-sign" class="text-(--color-orange-500) text-lg" />
              <span class="text-sm font-semibold">100% free &amp; self-hosted — no monthly fees, no usage limits, no API charges. You only pay for your own VPS.</span>
            </div>

            <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
              <UButton
                to="#get-started"
                label="Get Started"
                trailing-icon="i-lucide-arrow-right"
                size="xl"
                class="bg-gradient-to-r from-(--color-orange-500) to-(--color-orange-600) hover:from-(--color-orange-600) hover:to-(--color-orange-700) text-white shadow-lg"
              />
              <UButton
                to="https://github.com/ICJIA/forgecrawl"
                target="_blank"
                icon="i-lucide-github"
                label="View on GitHub"
                color="neutral"
                variant="outline"
                size="xl"
              />
            </div>
          </div>

          <!-- Install command -->
          <div class="mt-14 mx-auto max-w-xl">
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) px-5 py-4 font-mono text-sm text-(--color-neutral-600) dark:text-(--color-neutral-400)">
              <span class="text-(--color-orange-500)">$</span> git clone https://github.com/ICJIA/forgecrawl && docker compose up -d
            </div>
          </div>
        </div>
      </section>

      <!-- Glow separator -->
      <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, var(--color-orange-500), transparent); opacity: 0.4;" />

      <!-- Features -->
      <section id="features" class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-orange-500) mb-3">Features</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Everything you need. Nothing you don't.</h2>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 backdrop-blur-sm p-7 transition-all duration-300 hover:border-(--color-orange-400) dark:hover:border-(--color-orange-700) hover:shadow-lg"
          >
            <UIcon :name="feature.icon" class="text-3xl text-(--color-orange-500) mb-4" />
            <h3 class="text-lg font-bold mb-2">{{ feature.title }}</h3>
            <p class="text-sm leading-relaxed text-(--color-neutral-500)">{{ feature.description }}</p>
          </div>
        </div>
      </section>

      <!-- How It Works -->
      <section id="how-it-works" class="bg-(--color-neutral-50) dark:bg-(--color-neutral-900)/50 border-y border-(--color-neutral-200) dark:border-(--color-neutral-800)">
        <div class="mx-auto max-w-6xl px-6 py-24">
          <div class="text-center mb-16">
            <p class="text-sm font-semibold tracking-widest uppercase text-(--color-orange-500) mb-3">How It Works</p>
            <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Three steps to clean Markdown</h2>
          </div>

          <div class="grid md:grid-cols-3 gap-8">
            <div v-for="item in steps" :key="item.step" class="relative">
              <div class="text-6xl font-black text-(--color-orange-500)/10 mb-2 leading-none">{{ item.step }}</div>
              <h3 class="text-xl font-bold mb-3">{{ item.title }}</h3>
              <p class="text-(--color-neutral-500) leading-relaxed">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, var(--color-orange-500), transparent); opacity: 0.4;" />

      <!-- Why Markdown? -->
      <section id="why-markdown" class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-orange-500) mb-3">Why Markdown?</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">HTML is for browsers. Markdown is for LLMs.</h2>
          <p class="mt-4 text-(--color-neutral-500) max-w-2xl mx-auto">You could paste raw HTML into an LLM. But you'd be wasting tokens on noise, confusing the model with layout markup, and getting worse results. Here's why Markdown matters.</p>
        </div>

        <!-- Before/After comparison -->
        <div class="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 mb-12 max-w-6xl mx-auto items-start">
          <div class="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6">
            <div class="flex items-center gap-2 mb-4">
              <UIcon name="i-lucide-x-circle" class="text-red-500" />
              <span class="font-bold text-sm uppercase tracking-wider text-red-600 dark:text-red-400">Raw HTML — 41,823 bytes</span>
            </div>
            <div class="rounded-xl bg-white/80 dark:bg-(--color-neutral-950) border border-(--color-neutral-200) dark:border-(--color-neutral-800) p-4 font-mono text-xs leading-relaxed overflow-x-auto text-(--color-neutral-500)">
              <pre>&lt;!DOCTYPE html&gt;
&lt;html lang="en" dir="ltr" class="dark-mode js"&gt;
&lt;head&gt;
  &lt;meta charset="utf-8"&gt;
  &lt;meta name="viewport" content="width=device-width"&gt;
  &lt;title&gt;Getting Started | Acme Docs&lt;/title&gt;
  &lt;meta name="description" content="Quick start guide"&gt;
  &lt;meta property="og:title" content="Getting Started"&gt;
  &lt;meta property="og:image" content="/img/og.png"&gt;
  &lt;link rel="stylesheet" href="/css/main.a8f2c4.css"&gt;
  &lt;link rel="stylesheet" href="/css/vendor.3e91.css"&gt;
  &lt;link rel="stylesheet" href="/css/prism.f4a2.css"&gt;
  &lt;link rel="preconnect" href="https://fonts.gstatic.com"&gt;
  &lt;link rel="stylesheet" href="https://fonts.googleapis..."&gt;
  &lt;script defer src="/js/analytics.min.js"&gt;&lt;/script&gt;
  &lt;script&gt;window.__CONFIG__={"theme":"dark"}&lt;/script&gt;
  &lt;script&gt;!function(e,t){e.dataLayer=e.dataLayer||[]
    ;function n(){dataLayer.push(arguments)}n("js",
    new Date);n("config","G-XXXXXXXX")}()&lt;/script&gt;
&lt;/head&gt;
&lt;body class="antialiased min-h-screen bg-white"&gt;
  &lt;div id="__app"&gt;
    &lt;header class="sticky top-0 z-50 w-full border-b
      border-gray-200 bg-white/80 backdrop-blur"&gt;
      &lt;div class="mx-auto max-w-7xl px-4 sm:px-6"&gt;
        &lt;div class="flex h-16 items-center justify-between"&gt;
          &lt;a href="/" class="flex items-center gap-2"&gt;
            &lt;img src="/logo.svg" alt="Acme" width="32"&gt;
            &lt;span class="font-bold text-lg"&gt;Acme Docs&lt;/span&gt;
          &lt;/a&gt;
          &lt;nav class="hidden md:flex items-center gap-6"&gt;
            &lt;a href="/docs" class="text-sm font-medium
              text-gray-600 hover:text-gray-900"&gt;Docs&lt;/a&gt;
            &lt;a href="/api" class="text-sm font-medium
              text-gray-600 hover:text-gray-900"&gt;API&lt;/a&gt;
            &lt;a href="/blog" class="text-sm font-medium
              text-gray-600 hover:text-gray-900"&gt;Blog&lt;/a&gt;
            &lt;a href="/pricing" class="text-sm font-medium
              text-gray-600 hover:text-gray-900"&gt;Pricing&lt;/a&gt;
          &lt;/nav&gt;
          &lt;div class="flex items-center gap-3"&gt;
            &lt;button class="rounded-lg p-2 hover:bg-gray-100"
              aria-label="Toggle theme"&gt;
              &lt;svg class="h-5 w-5"&gt;...&lt;/svg&gt;
            &lt;/button&gt;
            &lt;a href="/login" class="rounded-lg bg-blue-600
              px-4 py-2 text-sm text-white"&gt;Sign In&lt;/a&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/header&gt;
    &lt;aside class="fixed left-0 top-16 w-64 border-r
      border-gray-200 overflow-y-auto h-[calc(100vh-4rem)]"&gt;
      &lt;nav class="p-4 space-y-1"&gt;
        &lt;a href="/docs/intro" class="block rounded-md px-3
          py-2 text-sm text-gray-600"&gt;Introduction&lt;/a&gt;
        &lt;a href="/docs/start" class="block rounded-md px-3
          py-2 text-sm font-medium bg-blue-50
          text-blue-700"&gt;Getting Started&lt;/a&gt;
        &lt;a href="/docs/config" class="block rounded-md px-3
          py-2 text-sm text-gray-600"&gt;Configuration&lt;/a&gt;
        &lt;a href="/docs/deploy" class="block rounded-md px-3
          py-2 text-sm text-gray-600"&gt;Deployment&lt;/a&gt;
      &lt;/nav&gt;
    &lt;/aside&gt;
    &lt;main class="ml-64 pt-16"&gt;
      &lt;article class="prose prose-blue max-w-none px-8 py-12"&gt;
        &lt;h1 id="getting-started"&gt;Getting Started&lt;/h1&gt;
        &lt;p&gt;Install the SDK to get started with Acme.&lt;/p&gt;
        &lt;h2 id="installation"&gt;Installation&lt;/h2&gt;
        &lt;p&gt;Run the following command:&lt;/p&gt;
        &lt;div class="code-block relative group"&gt;
          &lt;button class="absolute right-2 top-2 opacity-0
            group-hover:opacity-100 rounded bg-gray-700 px-2
            py-1 text-xs text-white"&gt;Copy&lt;/button&gt;
          &lt;pre class="language-bash"&gt;&lt;code&gt;npm install
            @acme/sdk&lt;/code&gt;&lt;/pre&gt;
        &lt;/div&gt;
        &lt;h2 id="configuration"&gt;Configuration&lt;/h2&gt;
        &lt;div class="overflow-x-auto"&gt;
          &lt;table class="min-w-full divide-y divide-gray-200"&gt;
            &lt;thead class="bg-gray-50"&gt;
              &lt;tr&gt;
                &lt;th class="px-4 py-3 text-left text-xs
                  font-medium uppercase text-gray-500"&gt;
                  Option&lt;/th&gt;
                &lt;th class="px-4 py-3 text-left text-xs
                  font-medium uppercase text-gray-500"&gt;
                  Default&lt;/th&gt;
                &lt;th class="px-4 py-3 text-left text-xs
                  font-medium uppercase text-gray-500"&gt;
                  Description&lt;/th&gt;
              &lt;/tr&gt;
            &lt;/thead&gt;
            &lt;tbody class="divide-y divide-gray-200"&gt;
              &lt;tr&gt;
                &lt;td class="px-4 py-3 text-sm"&gt;timeout&lt;/td&gt;
                &lt;td class="px-4 py-3 text-sm"&gt;30s&lt;/td&gt;
                &lt;td class="px-4 py-3 text-sm"&gt;Request
                  timeout&lt;/td&gt;
              &lt;/tr&gt;
              &lt;tr&gt;
                &lt;td class="px-4 py-3 text-sm"&gt;retries&lt;/td&gt;
                &lt;td class="px-4 py-3 text-sm"&gt;3&lt;/td&gt;
                &lt;td class="px-4 py-3 text-sm"&gt;Max retry
                  count&lt;/td&gt;
              &lt;/tr&gt;
            &lt;/tbody&gt;
          &lt;/table&gt;
        &lt;/div&gt;
      &lt;/article&gt;
    &lt;/main&gt;
    &lt;footer class="ml-64 border-t border-gray-200 px-8 py-6"&gt;
      &lt;div class="flex justify-between text-sm text-gray-500"&gt;
        &lt;span&gt;&amp;copy; 2026 Acme Inc.&lt;/span&gt;
        &lt;div class="flex gap-4"&gt;
          &lt;a href="/privacy"&gt;Privacy&lt;/a&gt;
          &lt;a href="/terms"&gt;Terms&lt;/a&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/footer&gt;
  &lt;/div&gt;
  &lt;script src="/js/vendor.8f3a.js"&gt;&lt;/script&gt;
  &lt;script src="/js/app.2c7e.js"&gt;&lt;/script&gt;
  &lt;script src="/js/prism.min.js"&gt;&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;</pre>
            </div>
          </div>

          <div class="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-6">
            <div class="flex items-center gap-2 mb-4">
              <UIcon name="i-lucide-check-circle" class="text-emerald-500" />
              <span class="font-bold text-sm uppercase tracking-wider text-emerald-600 dark:text-emerald-400">ForgeCrawl Markdown — 547 bytes</span>
            </div>
            <div class="rounded-xl bg-white/80 dark:bg-(--color-neutral-950) border border-(--color-neutral-200) dark:border-(--color-neutral-800) p-4 font-mono text-xs leading-relaxed overflow-x-auto text-(--color-neutral-500)">
              <pre>---
title: Getting Started
url: https://docs.acme.com/docs/start
description: Quick start guide
scraped_at: 2026-03-05T10:30:00Z
scraper: ForgeCrawl/1.0
word_count: 42
---

# Getting Started

Install the SDK to get started with Acme.

## Installation

Run the following command:

```bash
npm install @acme/sdk
```

## Configuration

| Option  | Default | Description     |
|---------|---------|-----------------|
| timeout | 30s     | Request timeout |
| retries | 3       | Max retry count |</pre>
            </div>
            <div class="mt-4 rounded-xl bg-emerald-100/50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
              <p class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 text-center">Same content. 98.7% smaller. Zero noise.</p>
            </div>
          </div>
        </div>

        <!-- Benefits grid -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div
            v-for="benefit in markdownBenefits"
            :key="benefit.title"
            class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 backdrop-blur-sm p-7 transition-all duration-300 hover:border-(--color-orange-400) dark:hover:border-(--color-orange-700)"
          >
            <UIcon :name="benefit.icon" class="text-2xl text-(--color-orange-500) mb-3" />
            <h3 class="font-bold mb-2">{{ benefit.title }}</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">{{ benefit.description }}</p>
          </div>
        </div>
      </section>

      <!-- API Section -->
      <section id="api" class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-orange-500) mb-3">API</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Built for automation</h2>
          <p class="mt-4 text-(--color-neutral-500) max-w-2xl mx-auto">
            Every action in ForgeCrawl is available through the REST API. Authenticate with a Bearer token and integrate with any workflow.
          </p>
        </div>

        <!-- Domain input -->
        <div class="max-w-2xl mx-auto mb-14 rounded-2xl border border-(--color-orange-500)/30 bg-(--color-orange-500)/5 p-8">
          <div class="flex items-center justify-center gap-2 mb-2">
            <UIcon name="i-lucide-globe" class="text-(--color-orange-500) text-xl" />
            <h3 class="text-lg font-bold">Your server, your domain</h3>
          </div>
          <p class="text-sm text-(--color-neutral-500) text-center mb-5">Enter your VPS domain below — every API example on this page updates in real time.</p>
          <div class="relative">
            <div class="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <span class="font-mono text-base text-(--color-neutral-400)">https://</span>
            </div>
            <input
              v-model="userDomain"
              type="text"
              placeholder="your-server.example.com"
              class="w-full rounded-xl border-2 border-(--color-orange-500)/40 bg-white dark:bg-(--color-neutral-900) pl-24 pr-5 py-4 font-mono text-lg text-(--color-orange-500) placeholder:text-(--color-neutral-400) focus:outline-none focus:ring-3 focus:ring-(--color-orange-500)/30 focus:border-(--color-orange-500) transition-all"
            />
          </div>
          <p class="text-xs text-(--color-neutral-400) text-center mt-3">ForgeCrawl is self-hosted — it runs on your infrastructure, not ours. No account needed.</p>
        </div>

        <div class="grid lg:grid-cols-2 gap-8">
          <div>
            <h3 class="text-sm font-semibold tracking-wider uppercase text-(--color-orange-500) mb-4">Scrape a page</h3>
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) p-5 font-mono text-sm leading-relaxed overflow-x-auto">
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-(--color-orange-500)">$</span> curl -X POST <span class="text-(--color-orange-500)">{{ apiBase }}</span>/api/scrape \
  -H <span class="text-emerald-600 dark:text-emerald-400">"Authorization: Bearer $FC_KEY"</span> \
  -H <span class="text-emerald-600 dark:text-emerald-400">"Content-Type: application/json"</span> \
  -d <span class="text-amber-600 dark:text-amber-400">'{"url": "https://example.com"}'</span></pre>
            </div>
          </div>

          <div>
            <h3 class="text-sm font-semibold tracking-wider uppercase text-(--color-orange-500) mb-4">Response</h3>
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) p-5 font-mono text-sm leading-relaxed overflow-x-auto max-h-[340px] overflow-y-auto">
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)">{
  <span class="text-sky-600 dark:text-sky-400">"job_id"</span>: <span class="text-amber-600 dark:text-amber-400">"c7f3a1b2-9e4d-4c8a-b5f6-2d1e0a3b4c5d"</span>,
  <span class="text-sky-600 dark:text-sky-400">"title"</span>: <span class="text-amber-600 dark:text-amber-400">"Example Domain"</span>,
  <span class="text-sky-600 dark:text-sky-400">"markdown"</span>: <span class="text-amber-600 dark:text-amber-400">"---\ntitle: Example Domain\nurl: https://example.com\nscraped_at: 2026-03-05T14:22:08Z\nscraper: ForgeCrawl/1.0\nword_count: 28\n---\n\n# Example Domain\n\nThis domain is for use in illustrative examples in\ndocuments. You may use this domain in literature\nwithout prior coordination or asking for permission.\n\n[More information...](https://www.iana.org/domains/example)"</span>,
  <span class="text-sky-600 dark:text-sky-400">"rawHtml"</span>: <span class="text-amber-600 dark:text-amber-400">"&lt;!doctype html&gt;\n&lt;html&gt;\n&lt;head&gt;\n  &lt;title&gt;Example Domain&lt;/title&gt;..."</span>,
  <span class="text-sky-600 dark:text-sky-400">"wordCount"</span>: <span class="text-violet-600 dark:text-violet-400">28</span>,
  <span class="text-sky-600 dark:text-sky-400">"metadata"</span>: {
    <span class="text-sky-600 dark:text-sky-400">"url"</span>: <span class="text-amber-600 dark:text-amber-400">"https://example.com"</span>,
    <span class="text-sky-600 dark:text-sky-400">"canonical"</span>: <span class="text-violet-600 dark:text-violet-400">null</span>,
    <span class="text-sky-600 dark:text-sky-400">"excerpt"</span>: <span class="text-amber-600 dark:text-amber-400">"This domain is for use in illustrative examples in documents."</span>,
    <span class="text-sky-600 dark:text-sky-400">"byline"</span>: <span class="text-violet-600 dark:text-violet-400">null</span>,
    <span class="text-sky-600 dark:text-sky-400">"siteName"</span>: <span class="text-violet-600 dark:text-violet-400">null</span>,
    <span class="text-sky-600 dark:text-sky-400">"language"</span>: <span class="text-amber-600 dark:text-amber-400">"en"</span>,
    <span class="text-sky-600 dark:text-sky-400">"ogImage"</span>: <span class="text-violet-600 dark:text-violet-400">null</span>,
    <span class="text-sky-600 dark:text-sky-400">"publishedTime"</span>: <span class="text-violet-600 dark:text-violet-400">null</span>,
    <span class="text-sky-600 dark:text-sky-400">"scrapedAt"</span>: <span class="text-amber-600 dark:text-amber-400">"2026-03-05T14:22:08.431Z"</span>
  },
  <span class="text-sky-600 dark:text-sky-400">"cached"</span>: <span class="text-violet-600 dark:text-violet-400">false</span>
}</pre>
            </div>
          </div>

          <div class="lg:col-span-2">
            <h3 class="text-sm font-semibold tracking-wider uppercase text-(--color-orange-500) mb-4">Node.js example</h3>
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) p-5 font-mono text-sm leading-relaxed overflow-x-auto">
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-violet-600 dark:text-violet-400">const</span> res = <span class="text-violet-600 dark:text-violet-400">await</span> <span class="text-sky-600 dark:text-sky-400">fetch</span>(<span class="text-amber-600 dark:text-amber-400">'<span class="text-(--color-orange-500)">{{ apiBase }}</span>/api/scrape'</span>, {
  method: <span class="text-amber-600 dark:text-amber-400">'POST'</span>,
  headers: {
    <span class="text-amber-600 dark:text-amber-400">'Authorization'</span>: <span class="text-amber-600 dark:text-amber-400">`Bearer ${process.env.FC_KEY}`</span>,
    <span class="text-amber-600 dark:text-amber-400">'Content-Type'</span>: <span class="text-amber-600 dark:text-amber-400">'application/json'</span>,
  },
  body: JSON.<span class="text-sky-600 dark:text-sky-400">stringify</span>({ url: <span class="text-amber-600 dark:text-amber-400">'https://example.com'</span> }),
})

<span class="text-violet-600 dark:text-violet-400">const</span> { markdown, title, wordCount } = <span class="text-violet-600 dark:text-violet-400">await</span> res.<span class="text-sky-600 dark:text-sky-400">json</span>()
console.<span class="text-sky-600 dark:text-sky-400">log</span>(<span class="text-amber-600 dark:text-amber-400">`Scraped "${title}" (${wordCount} words)`</span>)</pre>
            </div>
          </div>
        </div>

        <!-- Endpoints -->
        <div class="mt-12">
          <h3 class="text-sm font-semibold tracking-wider uppercase text-(--color-orange-500) mb-6">All endpoints</h3>
          <div class="space-y-3">
            <details
              v-for="ep in endpoints"
              :key="`${ep.method}-${ep.path}`"
              class="group rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) overflow-hidden"
            >
              <summary class="px-4 py-3 flex items-center gap-3 font-mono text-sm cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                <UIcon name="i-lucide-chevron-right" class="text-(--color-neutral-400) transition-transform group-open:rotate-90 shrink-0" />
                <UBadge :color="ep.color" variant="subtle" size="xs" :label="ep.method" class="font-bold" />
                <code class="text-(--color-neutral-500) truncate"><span class="text-(--color-orange-500)">{{ apiBase }}</span>{{ ep.path }}</code>
                <span class="ml-auto text-xs shrink-0" :class="ep.auth ? 'text-(--color-orange-500)' : 'text-(--color-neutral-400)'">
                  {{ ep.auth ? 'Bearer' : 'public' }}
                </span>
              </summary>
              <div class="border-t border-(--color-neutral-200) dark:border-(--color-neutral-800) px-4 py-4 space-y-3">
                <p class="text-sm text-(--color-neutral-500)">{{ ep.description }}</p>
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-(--color-neutral-400) mb-2">Request</p>
                  <div class="rounded-lg border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white dark:bg-(--color-neutral-950) p-4 font-mono text-xs leading-relaxed overflow-x-auto">
                    <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-(--color-orange-500)">$</span> {{ ep.curl.replaceAll('{base}', apiBase) }}</pre>
                  </div>
                </div>
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wider text-(--color-neutral-400) mb-2">Response</p>
                  <div class="rounded-lg border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white dark:bg-(--color-neutral-950) p-4 font-mono text-xs leading-relaxed overflow-x-auto max-h-[240px] overflow-y-auto">
                    <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)">{{ ep.response }}</pre>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>

      <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, var(--color-orange-500), transparent); opacity: 0.4;" />

      <!-- Security -->
      <section id="security" class="bg-(--color-neutral-50) dark:bg-(--color-neutral-900)/50 border-y border-(--color-neutral-200) dark:border-(--color-neutral-800)">
        <div class="mx-auto max-w-6xl px-6 py-24">
          <div class="text-center mb-16">
            <p class="text-sm font-semibold tracking-widest uppercase text-(--color-orange-500) mb-3">Security</p>
            <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Security is not an afterthought</h2>
            <p class="mt-4 text-(--color-neutral-500) max-w-2xl mx-auto">
              ForgeCrawl scrapes arbitrary URLs from the internet. Every layer is hardened against abuse.
            </p>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div
              v-for="item in securityFeatures"
              :key="item.label"
              class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 backdrop-blur-sm p-6 transition-all duration-300 hover:border-(--color-orange-400) dark:hover:border-(--color-orange-700)"
            >
              <div class="flex items-center gap-2 mb-3">
                <UIcon :name="item.icon" class="text-(--color-orange-500)" />
                <h3 class="font-bold text-sm">{{ item.label }}</h3>
              </div>
              <p class="text-sm text-(--color-neutral-500) leading-relaxed">{{ item.detail }}</p>
            </div>
          </div>

          <div class="mt-10 text-center">
            <p class="text-sm text-(--color-neutral-400)">
              81 integration tests covering auth, SSRF, rate limiting, error sanitization, and data isolation.
              <a href="#api" class="text-(--color-orange-500) hover:underline">Explore the API →</a>
            </p>
          </div>
        </div>
      </section>

      <!-- Get Started -->
      <section id="get-started" class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-orange-500) mb-3">Get Started</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Deploy in under a minute</h2>
          <p class="mt-4 text-(--color-neutral-500) max-w-2xl mx-auto">No sign-ups. No subscriptions. No usage limits. Clone, deploy, and scrape — forever free on your own server.</p>
        </div>

        <div class="grid lg:grid-cols-2 gap-8">
          <!-- Docker -->
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                <UIcon name="i-lucide-container" class="text-sky-600 dark:text-sky-400 text-lg" />
              </div>
              <h3 class="text-lg font-bold">Docker Compose</h3>
            </div>
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) p-5 font-mono text-sm leading-relaxed">
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-(--color-orange-500)">$</span> git clone https://github.com/ICJIA/forgecrawl
<span class="text-(--color-orange-500)">$</span> cd forgecrawl
<span class="text-(--color-orange-500)">$</span> docker compose up -d
<span class="text-(--color-neutral-400)"># Visit http://localhost:5150</span></pre>
            </div>
          </div>

          <!-- PM2 -->
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <UIcon name="i-lucide-server" class="text-emerald-600 dark:text-emerald-400 text-lg" />
              </div>
              <h3 class="text-lg font-bold">Bare Metal (PM2)</h3>
            </div>
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) p-5 font-mono text-sm leading-relaxed">
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-(--color-orange-500)">$</span> git clone https://github.com/ICJIA/forgecrawl
<span class="text-(--color-orange-500)">$</span> cd forgecrawl && pnpm install
<span class="text-(--color-orange-500)">$</span> cp .env.example .env
<span class="text-(--color-orange-500)">$</span> pnpm build && pm2 start ecosystem.config.cjs
<span class="text-(--color-neutral-400)"># Visit http://localhost:5150</span></pre>
            </div>
          </div>
        </div>

        <!-- Tech stack -->
        <div class="mt-16 text-center">
          <p class="text-sm font-semibold tracking-wider uppercase text-(--color-neutral-400) mb-6">Tech Stack</p>
          <div class="flex flex-wrap justify-center gap-3">
            <UBadge
              v-for="tech in techStack"
              :key="tech"
              :label="tech"
              color="neutral"
              variant="outline"
              size="lg"
            />
          </div>
        </div>
      </section>

      <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, var(--color-orange-500), transparent); opacity: 0.4;" />

      <!-- Use Cases -->
      <section class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-orange-500) mb-3">Use Cases</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Built for real workflows</h2>
        </div>

        <div class="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7 transition-all hover:border-(--color-orange-400) dark:hover:border-(--color-orange-700)">
            <UIcon name="i-lucide-database" class="text-(--color-orange-500) text-xl mb-3" />
            <h3 class="font-bold mb-2">RAG Pipelines</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">Scrape hundreds of pages from government, academic, or institutional sites. Get clean Markdown with metadata ready for vector embedding and retrieval.</p>
          </div>
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7 transition-all hover:border-(--color-orange-400) dark:hover:border-(--color-orange-700)">
            <UIcon name="i-lucide-message-square" class="text-(--color-orange-500) text-xl mb-3" />
            <h3 class="font-bold mb-2">LLM Context</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">Grab a long technical doc or policy page and paste the Markdown directly into Claude, GPT, or any LLM prompt. No more broken formatting.</p>
          </div>
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7 transition-all hover:border-(--color-orange-400) dark:hover:border-(--color-orange-700)">
            <UIcon name="i-lucide-archive" class="text-(--color-orange-500) text-xl mb-3" />
            <h3 class="font-bold mb-2">Content Archiving</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">Archive blog posts, support docs, or product pages as Markdown with YAML frontmatter preserving dates, authors, and URLs.</p>
          </div>
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7 transition-all hover:border-(--color-orange-400) dark:hover:border-(--color-orange-700)">
            <UIcon name="i-lucide-brain" class="text-(--color-orange-500) text-xl mb-3" />
            <h3 class="font-bold mb-2">Training Data</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">Generate consistently formatted Markdown suitable for fine-tuning or embedding generation from any public website.</p>
          </div>
        </div>
      </section>

      <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, var(--color-orange-500), transparent); opacity: 0.4;" />

      <!-- Why Do I Need This? -->
      <section id="why" class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-orange-500) mb-3">Why Do I Need This?</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Real people. Real problems. One tool.</h2>
          <p class="mt-4 text-(--color-neutral-500) max-w-2xl mx-auto">Whether you're building AI products, managing content pipelines, or doing research — if you need clean web data, ForgeCrawl replaces fragile scripts and expensive SaaS.</p>
        </div>

        <div class="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div
            v-for="story in userStories"
            :key="story.role"
            class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-8 transition-all hover:border-(--color-orange-400) dark:hover:border-(--color-orange-700) flex flex-col"
          >
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-xl bg-(--color-orange-500)/10 flex items-center justify-center">
                <UIcon :name="story.icon" :class="story.color" class="text-xl" />
              </div>
              <span class="font-bold text-lg">{{ story.role }}</span>
            </div>

            <blockquote class="text-sm italic text-(--color-neutral-500) leading-relaxed mb-5 flex-1">
              {{ story.quote }}
            </blockquote>

            <ul class="space-y-2">
              <li v-for="need in story.needs" :key="need" class="flex items-start gap-2 text-sm">
                <UIcon name="i-lucide-check" class="text-(--color-orange-500) mt-0.5 shrink-0" />
                <span>{{ need }}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-(--color-neutral-200) dark:border-(--color-neutral-800)">
      <div class="mx-auto max-w-6xl px-6 py-12">
        <div class="flex flex-col md:flex-row items-center justify-between gap-6">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-md bg-gradient-to-br from-(--color-orange-400) to-(--color-orange-600) flex items-center justify-center text-white font-bold text-xs">
              FC
            </div>
            <span class="text-sm text-(--color-neutral-500)">
              ForgeCrawl — MIT License © 2026
            </span>
          </div>
          <div class="flex items-center gap-6 text-sm text-(--color-neutral-500)">
            <a href="https://github.com/ICJIA/forgecrawl" target="_blank" rel="noopener" class="hover:text-(--color-orange-500) transition-colors">GitHub</a>
            <a href="#why-markdown" class="hover:text-(--color-orange-500) transition-colors">Why Markdown</a>
            <a href="#api" class="hover:text-(--color-orange-500) transition-colors">API Reference</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

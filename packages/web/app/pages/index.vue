<script setup lang="ts">
const colorMode = useColorMode()

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const features = [
  {
    icon: 'i-lucide-server',
    title: 'Self-Hosted',
    description: 'Your data never leaves your server. No third-party APIs, no usage tracking, no data sharing. You own everything.',
  },
  {
    icon: 'i-lucide-badge-dollar-sign',
    title: 'Free Forever',
    description: 'No per-page pricing. No API keys to buy. Scrape as much as you want on your own infrastructure.',
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
  { method: 'GET', path: '/api/health', auth: false, color: 'success' as const },
  { method: 'POST', path: '/api/scrape', auth: true, color: 'info' as const },
  { method: 'GET', path: '/api/scrapes', auth: true, color: 'success' as const },
  { method: 'GET', path: '/api/scrapes/:id', auth: true, color: 'success' as const },
  { method: 'DELETE', path: '/api/scrapes/:id', auth: true, color: 'error' as const },
  { method: 'POST', path: '/api/auth/api-keys', auth: true, color: 'info' as const },
  { method: 'GET', path: '/api/auth/api-keys', auth: true, color: 'success' as const },
  { method: 'DELETE', path: '/api/auth/api-keys/:id', auth: true, color: 'error' as const },
]

const techStack = ['Nuxt 4', 'Vue 3', 'SQLite', 'Drizzle ORM', 'bcrypt', 'jose JWT', 'Readability', 'Turndown', 'Docker', 'PM2']
</script>

<template>
  <div class="min-h-screen bg-white text-(--color-neutral-900) dark:bg-(--color-neutral-950) dark:text-(--color-neutral-100) transition-colors duration-300">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/80 dark:bg-(--color-neutral-950)/80 backdrop-blur-lg">
      <div class="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
        <a href="#" class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-(--color-forge-400) to-(--color-forge-600) flex items-center justify-center text-white font-bold text-sm">
            FC
          </div>
          <span class="text-lg font-bold tracking-tight">ForgeCrawl</span>
        </a>

        <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-(--color-neutral-500)">
          <a href="#features" class="hover:text-(--color-forge-500) transition-colors">Features</a>
          <a href="#how-it-works" class="hover:text-(--color-forge-500) transition-colors">How It Works</a>
          <a href="#api" class="hover:text-(--color-forge-500) transition-colors">API</a>
          <a href="#security" class="hover:text-(--color-forge-500) transition-colors">Security</a>
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
          <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[120px] bg-(--color-forge-500)/8 dark:bg-(--color-forge-500)/5" />
        </div>

        <div class="relative mx-auto max-w-6xl px-6 pt-20 pb-24">
          <!-- Banner -->
          <div class="mx-auto max-w-4xl mb-12 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-(--color-neutral-200) dark:ring-(--color-neutral-800)">
            <img src="/og-image.png" alt="ForgeCrawl — Web content forged into Markdown for LLMs" class="w-full" width="1280" height="640" />
          </div>

          <div class="text-center max-w-3xl mx-auto">
            <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              Web content forged into
              <span class="bg-gradient-to-r from-(--color-forge-400) to-(--color-forge-600) bg-clip-text text-transparent">Markdown for LLMs</span>
            </h1>
            <p class="text-lg sm:text-xl text-(--color-neutral-500) leading-relaxed mb-10 max-w-2xl mx-auto">
              Self-hosted, authenticated web scraper that converts any webpage into clean, structured Markdown — optimized for RAG pipelines, fine-tuning, and LLM prompts.
            </p>

            <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
              <UButton
                to="#get-started"
                label="Get Started"
                trailing-icon="i-lucide-arrow-right"
                size="xl"
                class="bg-gradient-to-r from-(--color-forge-500) to-(--color-forge-600) hover:from-(--color-forge-600) hover:to-(--color-forge-700) text-white shadow-lg"
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
              <span class="text-(--color-forge-500)">$</span> git clone https://github.com/ICJIA/forgecrawl && docker compose up -d
            </div>
          </div>
        </div>
      </section>

      <!-- Glow separator -->
      <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, var(--color-forge-500), transparent); opacity: 0.4;" />

      <!-- Features -->
      <section id="features" class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-forge-500) mb-3">Features</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Everything you need. Nothing you don't.</h2>
        </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 backdrop-blur-sm p-7 transition-all duration-300 hover:border-(--color-forge-400) dark:hover:border-(--color-forge-700) hover:shadow-lg"
          >
            <UIcon :name="feature.icon" class="text-3xl text-(--color-forge-500) mb-4" />
            <h3 class="text-lg font-bold mb-2">{{ feature.title }}</h3>
            <p class="text-sm leading-relaxed text-(--color-neutral-500)">{{ feature.description }}</p>
          </div>
        </div>
      </section>

      <!-- How It Works -->
      <section id="how-it-works" class="bg-(--color-neutral-50) dark:bg-(--color-neutral-900)/50 border-y border-(--color-neutral-200) dark:border-(--color-neutral-800)">
        <div class="mx-auto max-w-6xl px-6 py-24">
          <div class="text-center mb-16">
            <p class="text-sm font-semibold tracking-widest uppercase text-(--color-forge-500) mb-3">How It Works</p>
            <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Three steps to clean Markdown</h2>
          </div>

          <div class="grid md:grid-cols-3 gap-8">
            <div v-for="item in steps" :key="item.step" class="relative">
              <div class="text-6xl font-black text-(--color-forge-500)/10 mb-2 leading-none">{{ item.step }}</div>
              <h3 class="text-xl font-bold mb-3">{{ item.title }}</h3>
              <p class="text-(--color-neutral-500) leading-relaxed">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- API Section -->
      <section id="api" class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-forge-500) mb-3">API</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Built for automation</h2>
          <p class="mt-4 text-(--color-neutral-500) max-w-2xl mx-auto">
            Every action in ForgeCrawl is available through the REST API. Authenticate with a Bearer token and integrate with any workflow.
          </p>
        </div>

        <div class="grid lg:grid-cols-2 gap-8">
          <div>
            <h3 class="text-sm font-semibold tracking-wider uppercase text-(--color-forge-500) mb-4">Scrape a page</h3>
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) p-5 font-mono text-sm leading-relaxed overflow-x-auto">
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-(--color-forge-500)">$</span> curl -X POST http://localhost:5150/api/scrape \
  -H <span class="text-emerald-600 dark:text-emerald-400">"Authorization: Bearer $FC_KEY"</span> \
  -H <span class="text-emerald-600 dark:text-emerald-400">"Content-Type: application/json"</span> \
  -d <span class="text-amber-600 dark:text-amber-400">'{"url": "https://example.com"}'</span></pre>
            </div>
          </div>

          <div>
            <h3 class="text-sm font-semibold tracking-wider uppercase text-(--color-forge-500) mb-4">Response</h3>
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) p-5 font-mono text-sm leading-relaxed overflow-x-auto">
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)">{
  <span class="text-sky-600 dark:text-sky-400">"job_id"</span>: <span class="text-amber-600 dark:text-amber-400">"a1b2c3..."</span>,
  <span class="text-sky-600 dark:text-sky-400">"title"</span>: <span class="text-amber-600 dark:text-amber-400">"Example Domain"</span>,
  <span class="text-sky-600 dark:text-sky-400">"markdown"</span>: <span class="text-amber-600 dark:text-amber-400">"---\ntitle: Example Domain\n..."</span>,
  <span class="text-sky-600 dark:text-sky-400">"wordCount"</span>: <span class="text-violet-600 dark:text-violet-400">42</span>,
  <span class="text-sky-600 dark:text-sky-400">"cached"</span>: <span class="text-violet-600 dark:text-violet-400">false</span>
}</pre>
            </div>
          </div>

          <div class="lg:col-span-2">
            <h3 class="text-sm font-semibold tracking-wider uppercase text-(--color-forge-500) mb-4">Node.js example</h3>
            <div class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) p-5 font-mono text-sm leading-relaxed overflow-x-auto">
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-violet-600 dark:text-violet-400">const</span> res = <span class="text-violet-600 dark:text-violet-400">await</span> <span class="text-sky-600 dark:text-sky-400">fetch</span>(<span class="text-amber-600 dark:text-amber-400">'http://localhost:5150/api/scrape'</span>, {
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
          <h3 class="text-sm font-semibold tracking-wider uppercase text-(--color-forge-500) mb-6">All endpoints</h3>
          <div class="grid sm:grid-cols-2 gap-3">
            <div
              v-for="ep in endpoints"
              :key="`${ep.method}-${ep.path}`"
              class="rounded-xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-(--color-neutral-50) dark:bg-(--color-neutral-950) px-4 py-3 flex items-center gap-3 font-mono text-sm"
            >
              <UBadge :color="ep.color" variant="subtle" size="xs" :label="ep.method" class="font-bold" />
              <code class="text-(--color-neutral-500)">{{ ep.path }}</code>
              <span class="ml-auto text-xs" :class="ep.auth ? 'text-(--color-forge-500)' : 'text-(--color-neutral-400)'">
                {{ ep.auth ? 'Bearer' : 'public' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, var(--color-forge-500), transparent); opacity: 0.4;" />

      <!-- Security -->
      <section id="security" class="bg-(--color-neutral-50) dark:bg-(--color-neutral-900)/50 border-y border-(--color-neutral-200) dark:border-(--color-neutral-800)">
        <div class="mx-auto max-w-6xl px-6 py-24">
          <div class="text-center mb-16">
            <p class="text-sm font-semibold tracking-widest uppercase text-(--color-forge-500) mb-3">Security</p>
            <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Security is not an afterthought</h2>
            <p class="mt-4 text-(--color-neutral-500) max-w-2xl mx-auto">
              ForgeCrawl scrapes arbitrary URLs from the internet. Every layer is hardened against abuse.
            </p>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div
              v-for="item in securityFeatures"
              :key="item.label"
              class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 backdrop-blur-sm p-6 transition-all duration-300 hover:border-(--color-forge-400) dark:hover:border-(--color-forge-700)"
            >
              <div class="flex items-center gap-2 mb-3">
                <UIcon :name="item.icon" class="text-(--color-forge-500)" />
                <h3 class="font-bold text-sm">{{ item.label }}</h3>
              </div>
              <p class="text-sm text-(--color-neutral-500) leading-relaxed">{{ item.detail }}</p>
            </div>
          </div>

          <div class="mt-10 text-center">
            <p class="text-sm text-(--color-neutral-400)">
              81 integration tests covering auth, SSRF, rate limiting, error sanitization, and data isolation.
              <a href="https://github.com/ICJIA/forgecrawl#testing" target="_blank" rel="noopener" class="text-(--color-forge-500) hover:underline">View test details →</a>
            </p>
          </div>
        </div>
      </section>

      <!-- Get Started -->
      <section id="get-started" class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-forge-500) mb-3">Get Started</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Deploy in under a minute</h2>
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
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-(--color-forge-500)">$</span> git clone https://github.com/ICJIA/forgecrawl
<span class="text-(--color-forge-500)">$</span> cd forgecrawl
<span class="text-(--color-forge-500)">$</span> docker compose up -d
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
              <pre class="text-(--color-neutral-600) dark:text-(--color-neutral-400)"><span class="text-(--color-forge-500)">$</span> git clone https://github.com/ICJIA/forgecrawl
<span class="text-(--color-forge-500)">$</span> cd forgecrawl && pnpm install
<span class="text-(--color-forge-500)">$</span> cp .env.example .env
<span class="text-(--color-forge-500)">$</span> pnpm build && pm2 start ecosystem.config.cjs
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

      <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, var(--color-forge-500), transparent); opacity: 0.4;" />

      <!-- Use Cases -->
      <section class="mx-auto max-w-6xl px-6 py-24">
        <div class="text-center mb-16">
          <p class="text-sm font-semibold tracking-widest uppercase text-(--color-forge-500) mb-3">Use Cases</p>
          <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Built for real workflows</h2>
        </div>

        <div class="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7 transition-all hover:border-(--color-forge-400) dark:hover:border-(--color-forge-700)">
            <UIcon name="i-lucide-database" class="text-(--color-forge-500) text-xl mb-3" />
            <h3 class="font-bold mb-2">RAG Pipelines</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">Scrape hundreds of pages from government, academic, or institutional sites. Get clean Markdown with metadata ready for vector embedding and retrieval.</p>
          </div>
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7 transition-all hover:border-(--color-forge-400) dark:hover:border-(--color-forge-700)">
            <UIcon name="i-lucide-message-square" class="text-(--color-forge-500) text-xl mb-3" />
            <h3 class="font-bold mb-2">LLM Context</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">Grab a long technical doc or policy page and paste the Markdown directly into Claude, GPT, or any LLM prompt. No more broken formatting.</p>
          </div>
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7 transition-all hover:border-(--color-forge-400) dark:hover:border-(--color-forge-700)">
            <UIcon name="i-lucide-archive" class="text-(--color-forge-500) text-xl mb-3" />
            <h3 class="font-bold mb-2">Content Archiving</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">Archive blog posts, support docs, or product pages as Markdown with YAML frontmatter preserving dates, authors, and URLs.</p>
          </div>
          <div class="rounded-2xl border border-(--color-neutral-200) dark:border-(--color-neutral-800) bg-white/70 dark:bg-(--color-neutral-900)/70 p-7 transition-all hover:border-(--color-forge-400) dark:hover:border-(--color-forge-700)">
            <UIcon name="i-lucide-brain" class="text-(--color-forge-500) text-xl mb-3" />
            <h3 class="font-bold mb-2">Training Data</h3>
            <p class="text-sm text-(--color-neutral-500) leading-relaxed">Generate consistently formatted Markdown suitable for fine-tuning or embedding generation from any public website.</p>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-(--color-neutral-200) dark:border-(--color-neutral-800)">
      <div class="mx-auto max-w-6xl px-6 py-12">
        <div class="flex flex-col md:flex-row items-center justify-between gap-6">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-md bg-gradient-to-br from-(--color-forge-400) to-(--color-forge-600) flex items-center justify-center text-white font-bold text-xs">
              FC
            </div>
            <span class="text-sm text-(--color-neutral-500)">
              ForgeCrawl — MIT License © 2026
            </span>
          </div>
          <div class="flex items-center gap-6 text-sm text-(--color-neutral-500)">
            <a href="https://github.com/ICJIA/forgecrawl" target="_blank" rel="noopener" class="hover:text-(--color-forge-500) transition-colors">GitHub</a>
            <a href="https://github.com/ICJIA/forgecrawl#documentation" target="_blank" rel="noopener" class="hover:text-(--color-forge-500) transition-colors">Docs</a>
            <a href="https://github.com/ICJIA/forgecrawl#api" target="_blank" rel="noopener" class="hover:text-(--color-forge-500) transition-colors">API Reference</a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

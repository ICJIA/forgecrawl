<script setup lang="ts">
const { user, logout } = useAuth()

const url = ref('')
const loading = ref(false)
const error = ref('')
const result = ref<any>(null)
const sitemapInfo = ref<{ url: string; count: number } | null>(null)

function normalizeUrl(input: string): string {
  let val = input.trim()
  if (!val) return val
  if (!/^https?:\/\//i.test(val)) {
    val = 'https://' + val
  }
  return val
}

const { data: scrapes, refresh: refreshScrapes } = await useFetch('/api/scrapes')

async function onScrape() {
  const normalizedUrl = normalizeUrl(url.value)
  if (!normalizedUrl) return
  error.value = ''
  result.value = null
  sitemapInfo.value = null
  loading.value = true

  try {
    const data = await $fetch('/api/scrape', {
      method: 'POST',
      body: { url: normalizedUrl },
    })
    result.value = data
    url.value = ''
    await refreshScrapes()

    // Check for sitemap in the background
    checkSitemap(normalizedUrl)
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Scrape failed'
  } finally {
    loading.value = false
  }
}

async function checkSitemap(scrapedUrl: string) {
  try {
    const data = await $fetch<{ found: boolean; sitemapUrl: string; urlCount: number }>('/api/sitemap-check', {
      method: 'POST',
      body: { url: scrapedUrl },
    })
    if (data.found && data.urlCount > 0) {
      sitemapInfo.value = { url: data.sitemapUrl, count: data.urlCount }
    }
  } catch {}
}

async function deleteScrape(jobId: string, e: Event) {
  e.preventDefault()
  e.stopPropagation()
  try {
    await $fetch(`/api/scrapes/${jobId}`, { method: 'DELETE' })
    await refreshScrapes()
  } catch {}
}

async function onLogout() {
  await logout()
  await navigateTo('/login')
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

const columns = [
  { key: 'url', label: 'URL' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Date' },
  { key: 'actions', label: '' },
]
</script>

<template>
  <div class="min-h-screen bg-gray-950">
    <!-- Header -->
    <header class="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold text-orange-500">ForgeCrawl</h1>
          <span class="text-xs text-gray-600 font-mono hidden sm:inline">v0.1.0</span>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-400">{{ user?.email }}</span>
          <UButton variant="ghost" size="sm" @click="onLogout">Logout</UButton>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <!-- Scrape Form -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Scrape a URL</h2>
        </template>
        <form @submit.prevent="onScrape" class="flex gap-3">
          <UInput
            v-model="url"
            placeholder="https://example.com/article"
            class="flex-1"
            size="lg"
          />
          <UButton type="submit" :loading="loading" size="lg">
            Scrape
          </UButton>
        </form>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          class="mt-4"
        />
      </UCard>

      <!-- Result Preview -->
      <UCard v-if="result">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold">{{ result.title }}</h2>
              <p class="text-sm text-gray-400">
                {{ result.wordCount }} words
                <span v-if="result.cached" class="ml-2 text-orange-400">(cached)</span>
              </p>
            </div>
            <UButton
              variant="outline"
              size="sm"
              @click="navigator.clipboard.writeText(result.markdown)"
            >
              Copy Markdown
            </UButton>
          </div>
        </template>
        <div class="prose dark:prose-invert max-w-none">
          <pre class="whitespace-pre-wrap font-mono text-sm bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">{{ result.markdown }}</pre>
        </div>
      </UCard>

      <!-- Sitemap Detection -->
      <UAlert
        v-if="sitemapInfo"
        color="info"
        variant="subtle"
        icon="i-lucide-map"
        class="cursor-default"
      >
        <template #title>Sitemap detected</template>
        <template #description>
          Found <strong>{{ sitemapInfo.count }}</strong> URLs in
          <a :href="sitemapInfo.url" target="_blank" rel="noopener" class="underline text-orange-400 hover:text-orange-300">{{ sitemapInfo.url }}</a>.
          Multi-page crawling will be available in a future update.
        </template>
      </UAlert>

      <!-- Recent Scrapes -->
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Recent Scrapes</h2>
        </template>

        <div v-if="!scrapes?.jobs?.length" class="text-center py-8 text-gray-500">
          No scrapes yet. Enter a URL above to get started.
        </div>

        <div v-else class="divide-y divide-gray-800">
          <NuxtLink
            v-for="job in scrapes.jobs"
            :key="job.id"
            :to="`/scrapes/${job.id}`"
            class="flex items-center justify-between py-3 px-2 hover:bg-gray-900 rounded-lg transition-colors"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate">{{ job.url }}</p>
              <p class="text-xs text-gray-500">{{ formatDate(job.createdAt) }}</p>
            </div>
            <div class="flex items-center gap-2 ml-4">
              <UBadge
                :color="job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'warning'"
                variant="subtle"
              >
                {{ job.status }}
              </UBadge>
              <UButton
                variant="ghost"
                color="error"
                size="xs"
                icon="i-lucide-trash-2"
                @click="deleteScrape(job.id, $event)"
              />
            </div>
          </NuxtLink>
        </div>
      </UCard>
    </main>
  </div>
</template>

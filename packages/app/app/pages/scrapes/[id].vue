<script setup lang="ts">
const route = useRoute()
const { user, logout } = useAuth()

const { data, error: fetchError } = await useFetch(`/api/scrapes/${route.params.id}`)

const showRaw = ref(false)
const copied = ref(false)

async function copyMarkdown() {
  if (data.value?.result?.markdown) {
    await navigator.clipboard.writeText(data.value.result.markdown)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function downloadMarkdown() {
  if (!data.value?.result?.markdown) return
  const title = data.value.result.title || 'scrape'
  const filename = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase() + '.md'
  const blob = new Blob([data.value.result.markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function deleteScrape() {
  await $fetch(`/api/scrapes/${route.params.id}`, { method: 'DELETE' })
  await navigateTo('/')
}

async function onLogout() {
  await logout()
  await navigateTo('/login')
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}
</script>

<template>
  <div class="min-h-screen bg-gray-950">
    <!-- Header -->
    <header class="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <NuxtLink to="/">
            <UButton variant="ghost" size="sm">Back</UButton>
          </NuxtLink>
          <h1 class="text-xl font-bold text-orange-500">Scrape Detail</h1>
          <UButton
            variant="ghost"
            color="error"
            size="sm"
            icon="i-lucide-trash-2"
            @click="deleteScrape"
          >
            Delete
          </UButton>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-400">{{ user?.email }}</span>
          <UButton variant="ghost" size="sm" @click="onLogout">Logout</UButton>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <UAlert
        v-if="fetchError"
        color="error"
        variant="subtle"
        :title="fetchError.data?.message || 'Failed to load scrape'"
      />

      <template v-if="data">
        <!-- Job Info -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">{{ data.result?.title || 'Untitled' }}</h2>
              <UBadge
                :color="data.job.status === 'completed' ? 'success' : data.job.status === 'failed' ? 'error' : 'warning'"
                variant="subtle"
              >
                {{ data.job.status }}
              </UBadge>
            </div>
          </template>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500">URL:</span>
              <a :href="data.job.url" target="_blank" rel="noopener" class="ml-2 text-orange-400 hover:text-orange-300 hover:underline break-all">
                {{ data.job.url }}
              </a>
            </div>
            <div>
              <span class="text-gray-500">Word Count:</span>
              <span class="ml-2">{{ data.result?.wordCount || 0 }}</span>
            </div>
            <div>
              <span class="text-gray-500">Started:</span>
              <span class="ml-2">{{ formatDate(data.job.startedAt) }}</span>
            </div>
            <div>
              <span class="text-gray-500">Completed:</span>
              <span class="ml-2">{{ formatDate(data.job.completedAt) }}</span>
            </div>
            <div v-if="data.result?.metadata?.byline">
              <span class="text-gray-500">Author:</span>
              <span class="ml-2">{{ data.result.metadata.byline }}</span>
            </div>
            <div v-if="data.result?.metadata?.siteName">
              <span class="text-gray-500">Site:</span>
              <span class="ml-2">{{ data.result.metadata.siteName }}</span>
            </div>
          </div>

          <UAlert
            v-if="data.job.errorMessage"
            color="error"
            variant="subtle"
            :title="data.job.errorMessage"
            class="mt-4"
          />
        </UCard>

        <!-- Markdown Output -->
        <UCard v-if="data.result?.markdown">
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Markdown Output</h2>
              <div class="flex gap-2">
                <UButton
                  variant="outline"
                  size="sm"
                  @click="showRaw = !showRaw"
                >
                  {{ showRaw ? 'Show Markdown' : 'Show Raw HTML' }}
                </UButton>
                <UButton
                  variant="outline"
                  size="sm"
                  @click="downloadMarkdown"
                >
                  Download .md
                </UButton>
                <UButton
                  variant="outline"
                  size="sm"
                  @click="copyMarkdown"
                >
                  {{ copied ? 'Copied!' : 'Copy' }}
                </UButton>
              </div>
            </div>
          </template>

          <pre
            v-if="!showRaw"
            class="whitespace-pre-wrap font-mono text-sm bg-gray-900 p-4 rounded-lg overflow-auto max-h-[600px]"
          >{{ data.result.markdown }}</pre>

          <pre
            v-else
            class="whitespace-pre-wrap font-mono text-xs bg-gray-900 p-4 rounded-lg overflow-auto max-h-[600px]"
          >{{ data.result.rawHtml || 'Raw HTML not stored' }}</pre>
        </UCard>
      </template>
    </main>
  </div>
</template>

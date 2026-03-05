import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    dir: 'tests',
    testTimeout: 60000,
    hookTimeout: 120000,
    globalSetup: ['./tests/setup/global-setup.ts'],
    // Run test files sequentially — they share a server and database
    fileParallelism: false,
    // Ensure alphabetical file ordering (tests are numbered 01-10)
    sequence: {
      sequencer: class {
        async shard(files: any[]) { return files }
        async sort(files: any[]) {
          return [...files].sort((a: any, b: any) => {
            const pathA = typeof a === 'string' ? a : a[1] || a.id || ''
            const pathB = typeof b === 'string' ? b : b[1] || b.id || ''
            return String(pathA).localeCompare(String(pathB))
          })
        }
      } as any,
    },
    env: {
      NUXT_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long-for-jwt',
    },
  },
})

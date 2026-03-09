import { getSqlite } from '../db'

export default defineNitroPlugin(() => {
  let isShuttingDown = false

  const shutdown = (signal: string) => {
    if (isShuttingDown) return
    isShuttingDown = true

    console.log(`[ForgeCrawl] ${signal} received, shutting down...`)

    try {
      const sqlite = getSqlite()
      if (sqlite?.open) {
        sqlite.close()
        console.log('[ForgeCrawl] Database connection closed')
      }
    } catch (err) {
      console.warn('[ForgeCrawl] Error during shutdown DB close:', err)
    }

    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
})

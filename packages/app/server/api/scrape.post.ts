import { getDb } from '../db'
import { scrapeJobs, scrapeResults } from '../db/schema'
import { scrape } from '../engine/scraper'
import { getCachedResult } from '../engine/cache'
import { validateUrlWithDns } from '../utils/url'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)

  if (!body.url) {
    throw createError({ statusCode: 400, message: 'URL is required' })
  }

  // Validate URL (SSRF protection)
  const url = await validateUrlWithDns(body.url)

  const config = useRuntimeConfig()

  // Check cache unless bypass requested
  if (!body.bypass_cache) {
    const cached = getCachedResult(url, config.cacheTtl as number)
    if (cached) {
      return {
        job_id: cached.jobId,
        title: cached.title,
        markdown: cached.markdown,
        wordCount: cached.wordCount,
        metadata: cached.metadata,
        cached: true,
        cached_at: cached.createdAt,
      }
    }
  }

  const db = getDb()
  const jobId = crypto.randomUUID()

  // Create job record
  db.insert(scrapeJobs).values({
    id: jobId,
    userId: user.id,
    url,
    status: 'running',
    jobType: 'single',
    config: body.config || {},
    startedAt: new Date().toISOString(),
  }).run()

  try {
    const result = await scrape(url, body.config || {})

    // Store result
    db.insert(scrapeResults).values({
      jobId,
      url,
      title: result.title,
      markdown: result.markdown,
      rawHtml: result.rawHtml,
      wordCount: result.wordCount,
      metadata: result.metadata,
    }).run()

    // Update job status
    db.update(scrapeJobs).set({
      status: 'completed',
      completedAt: new Date().toISOString(),
    }).where(eq(scrapeJobs.id, jobId)).run()

    return {
      job_id: jobId,
      ...result,
      cached: false,
    }
  } catch (err: any) {
    db.update(scrapeJobs).set({
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date().toISOString(),
    }).where(eq(scrapeJobs.id, jobId)).run()

    // Sanitize error message — only pass through known safe error types
    const safeMessages = ['Unsupported content type', 'Invalid URL', 'Blocked', 'Could not extract content']
    const isSafe = safeMessages.some(prefix => err.message?.startsWith(prefix))
    throw createError({
      statusCode: 500,
      message: isSafe ? err.message : 'Scrape failed. Check the URL and try again.',
    })
  }
})

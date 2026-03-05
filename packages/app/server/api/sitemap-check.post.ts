import { validateUrlWithDns } from '../utils/url'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body.url) {
    throw createError({ statusCode: 400, message: 'URL required' })
  }

  let origin: string
  try {
    origin = new URL(body.url).origin
  } catch {
    return { found: false, sitemapUrl: null, urlCount: 0 }
  }

  const sitemapUrl = `${origin}/sitemap.xml`

  // SSRF protection — validate before fetching
  try {
    await validateUrlWithDns(sitemapUrl)
  } catch {
    return { found: false, sitemapUrl, urlCount: 0 }
  }

  try {
    const response = await $fetch.raw(sitemapUrl, {
      timeout: 5000,
      redirect: 'manual',
      responseType: 'text',
    })

    // If redirected, re-validate the target URL for SSRF
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return { found: false, sitemapUrl, urlCount: 0 }
      const resolvedUrl = new URL(location, sitemapUrl).href
      await validateUrlWithDns(resolvedUrl)
      // Re-fetch from validated redirect target
      const redirected = await $fetch.raw(resolvedUrl, {
        timeout: 5000,
        redirect: 'manual',
        responseType: 'text',
      })
      const ct = redirected.headers.get('content-type') || ''
      const txt = (redirected._data as string) || ''
      if (!ct.includes('xml') && !txt.includes('<urlset') && !txt.includes('<sitemapindex')) {
        return { found: false, sitemapUrl, urlCount: 0 }
      }
      const count = (txt.match(/<loc>/gi) || []).length
      return { found: true, sitemapUrl: resolvedUrl, urlCount: count }
    }

    const contentType = response.headers.get('content-type') || ''
    const text = (response._data as string) || ''

    if (!contentType.includes('xml') && !text.includes('<urlset') && !text.includes('<sitemapindex')) {
      return { found: false, sitemapUrl, urlCount: 0 }
    }

    // Count <loc> entries
    const urlCount = (text.match(/<loc>/gi) || []).length

    return { found: true, sitemapUrl, urlCount }
  } catch {
    return { found: false, sitemapUrl, urlCount: 0 }
  }
})

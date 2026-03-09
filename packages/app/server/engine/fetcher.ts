import { validateUrlWithDns } from '../utils/url'

const MAX_REDIRECTS = 10

export async function fetchPage(url: string, redirectCount = 0): Promise<string> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error('Too many redirects')
  }

  const config = useRuntimeConfig()

  const response = await $fetch.raw(url, {
    headers: {
      'User-Agent': config.scrapeUserAgent,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: config.scrapeTimeout,
    redirect: 'manual',
    responseType: 'text',
  })

  // Handle redirects with SSRF re-validation
  const status = response.status
  if (status >= 300 && status < 400) {
    const location = response.headers.get('location')
    if (!location) throw new Error('Redirect with no Location header')
    const resolvedUrl = new URL(location, url).href
    await validateUrlWithDns(resolvedUrl)
    return fetchPage(resolvedUrl, redirectCount + 1)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error(`Unsupported content type: ${contentType}`)
  }

  return response._data as string
}

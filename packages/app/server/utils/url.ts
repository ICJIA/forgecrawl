import { resolve } from 'dns/promises'

const BLOCKED_HOSTS = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '[::1]',
  'metadata.google.internal',
  'metadata.internal',
])

const BLOCKED_IP_RANGES = [
  /^127\./,                             // Loopback
  /^10\./,                              // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./,        // Private Class B
  /^192\.168\./,                        // Private Class C
  /^169\.254\./,                        // Link-local / cloud metadata
  /^0\./,                               // Current network
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // Shared address space
  /^::1$/,                              // IPv6 loopback
  /^::ffff:127\./i,                     // IPv4-mapped loopback
  /^::ffff:10\./i,                      // IPv4-mapped private A
  /^::ffff:172\.(1[6-9]|2\d|3[01])\./i, // IPv4-mapped private B
  /^::ffff:192\.168\./i,               // IPv4-mapped private C
  /^::ffff:169\.254\./i,               // IPv4-mapped link-local
  /^f[cd]/i,                            // IPv6 private
  /^fe80/i,                             // IPv6 link-local
]

export function validateUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid URL' })
  }

  // Block non-HTTP(S) protocols
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw createError({
      statusCode: 400,
      message: `Blocked protocol: ${url.protocol}. Only http: and https: are allowed.`,
    })
  }

  // Block known dangerous hostnames
  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(hostname)) {
    throw createError({ statusCode: 400, message: 'Blocked host' })
  }

  // Block cloud metadata IP directly in URL
  if (hostname === '169.254.169.254') {
    throw createError({ statusCode: 400, message: 'Blocked: cloud metadata endpoint' })
  }

  return url.href
}

export async function validateUrlWithDns(input: string): Promise<string> {
  const href = validateUrl(input)
  const url = new URL(href)

  // Resolve DNS and check resolved IP against blocklists
  try {
    const addresses = await resolve(url.hostname)
    for (const addr of addresses) {
      if (BLOCKED_IP_RANGES.some(pattern => pattern.test(addr))) {
        throw createError({
          statusCode: 400,
          message: 'URL resolves to a blocked IP range',
        })
      }
    }
  } catch (err: any) {
    if (err.statusCode) throw err // Re-throw our own errors
    // DNS resolution failure — block to prevent SSRF bypass via DNS outage
    throw createError({
      statusCode: 400,
      message: 'Could not resolve hostname',
    })
  }

  return href
}

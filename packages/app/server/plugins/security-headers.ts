export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
    setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
    setHeader(event, 'X-XSS-Protection', '0')
    setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    setHeader(event, 'Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  })
})

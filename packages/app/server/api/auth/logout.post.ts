export default defineEventHandler((event) => {
  deleteCookie(event, 'forgecrawl_session', {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  return { success: true }
})

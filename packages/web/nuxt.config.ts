export default defineNuxtConfig({
  future: { compatibilityVersion: 4 },
  compatibilityDate: '2025-05-01',

  modules: ['@nuxt/ui'],

  css: ['~/assets/css/main.css'],

  // Static site generation for Netlify
  nitro: {
    preset: 'static',
  },

  ui: {
    theme: {
      colors: ['forge'],
    },
  },

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'ForgeCrawl — Self-hosted web scraper for LLMs',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption. Free, secure, and ready to deploy.' },
        { name: 'author', content: 'cschweda' },

        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://forgecrawl.com' },
        { property: 'og:title', content: 'ForgeCrawl — Self-hosted web scraper for LLMs' },
        { property: 'og:description', content: 'Self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption. Free, secure, and ready to deploy.' },
        { property: 'og:image', content: 'https://forgecrawl.com/og-image.png' },
        { property: 'og:image:width', content: '1280' },
        { property: 'og:image:height', content: '640' },

        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'ForgeCrawl — Self-hosted web scraper for LLMs' },
        { name: 'twitter:description', content: 'Self-hosted, authenticated web scraper that converts website content into clean Markdown optimized for LLM consumption.' },
        { name: 'twitter:image', content: 'https://forgecrawl.com/og-image.png' },
      ],
      link: [
        { rel: 'canonical', href: 'https://forgecrawl.com' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap' },
      ],
    },
  },
})

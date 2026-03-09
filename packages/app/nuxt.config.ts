import { config, toRuntimeConfig } from '../../forgecrawl.config'

export default defineNuxtConfig({
  compatibilityDate: '2025-03-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: toRuntimeConfig(),
  devServer: {
    port: config.server.port,
  },
  nitro: {
    preset: 'node-server',
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },
  ui: {
    theme: {
      colors: ['orange'],
    },
  },
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap' },
      ],
    },
  },
})

// Значения из привычных переменных (TELEGRAM_BOT_TOKEN, …) подхватываются на старте сервера
// в server/utils/config.ts; NUXT_* по-прежнему перекрывают их (Task 3.9.2).
export default defineNuxtConfig({
  compatibilityDate: '2026-05-01',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    // Dev-витрины (/dev/**, например атомы v3) не попадают в production-сборку: маршрут не создаётся.
    (_options, nuxt) => {
      if (nuxt.options.dev) return
      nuxt.hook('pages:extend', (pages) => {
        for (let i = pages.length - 1; i >= 0; i--) {
          if (pages[i]!.path === '/dev' || pages[i]!.path.startsWith('/dev/')) pages.splice(i, 1)
        }
      })
    },
  ],
  css: ['~/assets/css/landing-fonts.css', '~/assets/css/main.css', '~/assets/css/atoms-v3.css'],
  tailwindcss: { cssPath: false },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Volley Time',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#FBF8F0' },
      ],
      // SDK Telegram Mini App: без него window.Telegram отсутствует (Task 8.8.1)
      script: [{ src: 'https://telegram.org/js/telegram-web-app.js' }],
      // iOS ignores SVG touch icons: the apple-touch-icon is a 180px PNG rendered from the SVG mark.
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo/vt-favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '180x180', href: '/logo/vt-apple-touch-icon.png' },
        {
          rel: 'apple-touch-icon',
          type: 'image/png',
          sizes: '180x180',
          href: '/logo/vt-apple-touch-icon.png',
        },
      ],
    },
  },
  routeRules: {
    // Mini App — SPA mode (Telegram WebApp)
    '/m/**': { ssr: false },
    // Private organizer cabinet uses the same client-side session flow without Telegram.
    '/app': { ssr: false },
    '/app/**': { ssr: false },
  },
  // OpenAPI новых ресурсов (ADR v3): defineRouteMeta в обработчиках. Спецификация и Swagger UI
  // отдаются только в dev (/_openapi.json, /_swagger, /_scalar); в production-сборке маршрутов нет.
  nitro: { experimental: { openAPI: true } },
  runtimeConfig: {
    betterAuthSecret: '',
    telegramBotToken: '',
    botInternalUrl: '',
    botInternalSecret: '',
    public: {
      betterAuthUrl: '',
      // публичные значения: из окружения сборки/dev; в production перекрываются NUXT_PUBLIC_* (9.9.5)
      telegramBotUsername: (process.env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, ''),
      webUrl: process.env.WEB_URL ?? '',
      miniAppBaseUrl: '',
    },
  },
})

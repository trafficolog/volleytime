// Значения из привычных переменных (TELEGRAM_BOT_TOKEN, …) подхватываются на старте сервера
// в server/utils/config.ts; NUXT_* по-прежнему перекрывают их (Task 3.9.2).
export default defineNuxtConfig({
  compatibilityDate: '2026-05-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
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
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500&display=swap',
        },
      ],
    },
  },
  routeRules: {
    // Mini App — SPA mode (Telegram WebApp)
    '/m/**': { ssr: false },
  },
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

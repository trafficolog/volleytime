---
id: '3.4.1'
phase: '3'
epic: '3.4'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - FE
  - DEVOPS
depends_on:
  - '3.1.3'
estimated_hours: '2'
tags:
  - nuxt
  - tailwind
  - frontend
---

# Task 3.4.1: Nuxt 4 init + Tailwind + layout

## Цель

Создать `apps/web` через Nuxt 4 скаффолдинг, настроить Tailwind CSS, базовый layout. Пока без auth UI (это 3.4.2).

## Контекст

`apps/web` — основной фронтенд платформы. Nuxt 4 даёт SSR + SPA-mode + Nitro server routes. Tailwind — для стилей.

## Что должно быть сделано

1. **Создать Nuxt 4 проект внутри `apps/web`:**

   ```bash
   # ВНИМАНИЕ: использовать pnpm и НЕ git init заново
   cd apps/web
   pnpm dlx nuxi@latest init . --packageManager pnpm --gitInit false
   ```

2. **Обновить `apps/web/package.json`:**

   ```json
   {
     "name": "@volley-time/web",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "scripts": {
       "dev": "nuxt dev",
       "build": "nuxt build",
       "preview": "nuxt preview",
       "typecheck": "nuxt typecheck",
       "lint": "eslint .",
       "test": "vitest run"
     },
     "dependencies": {
       "@volley-time/auth": "workspace:*",
       "@volley-time/db": "workspace:*",
       "@volley-time/shared": "workspace:*"
     }
   }
   ```

3. **Установить Tailwind:**

   ```bash
   pnpm -F @volley-time/web add -D @nuxtjs/tailwindcss
   ```

4. **`apps/web/nuxt.config.ts`:**

   ```ts
   export default defineNuxtConfig({
     compatibilityDate: '2026-05-01',
     devtools: { enabled: true },
     modules: ['@nuxtjs/tailwindcss'],
     runtimeConfig: {
       betterAuthSecret: '', // BETTER_AUTH_SECRET
       telegramBotToken: '', // TELEGRAM_BOT_TOKEN
       public: {
         betterAuthUrl: '', // BETTER_AUTH_URL
         telegramBotUsername: '', // TELEGRAM_BOT_USERNAME
       },
     },
     typescript: {
       strict: true,
       typeCheck: true,
     },
     routeRules: {
       '/m/**': { ssr: false }, // Mini App routes — client-only
     },
   })
   ```

5. **`apps/web/tailwind.config.ts`:**

   ```ts
   import type { Config } from 'tailwindcss'

   export default {
     content: ['./components/**/*.{vue,ts}', './pages/**/*.vue', './layouts/**/*.vue', './app.vue'],
     theme: {
       extend: {
         colors: {
           // Brand colors
           brand: {
             50: '#fef2f2',
             500: '#ef4444',
             600: '#dc2626',
           },
         },
       },
     },
   } satisfies Config
   ```

6. **`apps/web/app.vue`:**

   ```vue
   <template>
     <NuxtLayout>
       <NuxtPage />
     </NuxtLayout>
   </template>
   ```

7. **`apps/web/layouts/default.vue`** — базовый layout с header:

   ```vue
   <template>
     <div class="min-h-screen bg-gray-50">
       <header class="bg-white border-b">
         <div class="container mx-auto px-4 py-3 flex items-center justify-between">
           <NuxtLink to="/" class="font-bold text-lg">🏐 Volley Time</NuxtLink>
           <nav>
             <NuxtLink to="/login" class="text-sm text-gray-600 hover:text-gray-900"
               >Войти</NuxtLink
             >
           </nav>
         </div>
       </header>
       <main class="container mx-auto px-4 py-8">
         <slot />
       </main>
     </div>
   </template>
   ```

8. **`apps/web/layouts/miniapp.vue`** — layout для Mini App (без header, full-screen):

   ```vue
   <template>
     <div class="min-h-screen bg-white">
       <slot />
     </div>
   </template>
   ```

9. **`apps/web/pages/index.vue`** — стартовая страница:
   ```vue
   <template>
     <div class="max-w-2xl mx-auto text-center py-16">
       <h1 class="text-4xl font-bold mb-4">🏐 Volley Time</h1>
       <p class="text-lg text-gray-600 mb-8">
         Платформа для организаторов любительских спортивных событий
       </p>
       <div class="flex gap-3 justify-center">
         <NuxtLink
           to="/login"
           class="px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
         >
           Войти по email
         </NuxtLink>
         <a
           :href="telegramBotLink"
           class="px-6 py-3 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
         >
           Открыть в Telegram
         </a>
       </div>
     </div>
   </template>

   <script setup lang="ts">
   const config = useRuntimeConfig()
   const telegramBotLink = computed(() => `https://t.me/${config.public.telegramBotUsername}`)
   </script>
   ```

## Критерии приёмки

- ✅ `pnpm -F @volley-time/web dev` поднимает Nuxt на `localhost:3000`
- ✅ `localhost:3000` показывает welcome-страницу с двумя кнопками
- ✅ Tailwind работает: цвета, отступы, layout
- ✅ `routeRules['/m/**'].ssr = false` — Mini App SPA mode
- ✅ `pnpm -F @volley-time/web typecheck` проходит
- ✅ Зависимости от `@volley-time/auth`, `@volley-time/db`, `@volley-time/shared` через workspace
- ✅ Hot Module Reload работает при изменении .vue файлов

## Подсказки

- **Nuxt 4 compatibility:** установи `compatibilityDate: '2026-05-01'` чтобы получить актуальные features.
- **`runtimeConfig`:** Nuxt автоматически читает env-переменные с префиксом `NUXT_*`. Например, `NUXT_BETTER_AUTH_SECRET` → `runtimeConfig.betterAuthSecret`. Но удобнее тестировать с явным маппингом.
- **TypeScript:** `nuxt typecheck` использует vue-tsc — медленнее чем tsc, но проверяет .vue файлы.
- **Если Nuxt не видит `@volley-time/db`** — проверь, что в `apps/web/package.json` пакет указан как dependency с `workspace:*`.

## Не делать

- ❌ Не делать страницы login/verify/m — это 3.4.2 и 3.4.3
- ❌ Не подключать дополнительные модули (Pinia, i18n, image) — не нужно в Phase 3
- ❌ Не настраивать sitemap / robots — не Phase 3
- ❌ Не делать favicon / og-images
- ❌ Не подключать @nuxt/ui — Tailwind handrolled

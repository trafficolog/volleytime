---
id: '3.4.3'
phase: '3'
epic: '3.4'
status: done
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; находки ревью закрыты эпиком 3.9.'
roles:
  - FE
  - BACK
depends_on:
  - '3.4.1'
  - '3.3.3'
estimated_hours: '1-2'
tags:
  - nuxt
  - miniapp
  - telegram
---

# Task 3.4.3: Mini App entrypoint с initData auth

## Цель

Создать `/m/index.vue` — entrypoint Mini App. При открытии — Telegram передаёт `initData`, фронтенд отправляет на сервер, сервер валидирует, создаёт session, возвращает user info.

## Контекст

Mini App — это веб-страница, открытая в Telegram через WebApp API. Telegram передаёт `window.Telegram.WebApp.initData` — query-string с `user`, `auth_date`, `hash`. Без правильной валидации (3.3.3) — небезопасно.

## Что должно быть сделано

1. **`apps/web/server/api/auth/telegram.post.ts`:**

   ```ts
   import { authenticateViaTelegram } from '@volley-time/auth/telegram'
   import { auth } from '@volley-time/auth'

   export default defineEventHandler(async (event) => {
     const body = await readBody<{ initData: string }>(event)
     if (!body?.initData) {
       throw createError({ statusCode: 400, statusMessage: 'initData required' })
     }

     const config = useRuntimeConfig()
     const result = await authenticateViaTelegram(body.initData, config.telegramBotToken)

     // Создаём session через better-auth
     const session = await auth.api.createSession({ userId: result.userId })
     setCookie(event, 'auth_session', session.token, {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'lax',
       maxAge: 30 * 24 * 60 * 60, // 30 days
       path: '/',
     })

     return { success: true, isNewUser: result.isNewUser }
   })
   ```

2. **`apps/web/composables/useTelegram.ts`:**

   ```ts
   declare global {
     interface Window {
       Telegram?: {
         WebApp?: {
           initData: string
           initDataUnsafe: any
           expand: () => void
           ready: () => void
           themeParams: Record<string, string>
           MainButton: any
         }
       }
     }
   }

   export function useTelegram() {
     const isAvailable = computed(() => process.client && !!window.Telegram?.WebApp)

     function getWebApp() {
       if (!isAvailable.value) return null
       return window.Telegram!.WebApp!
     }

     async function authenticate() {
       const tg = getWebApp()
       if (!tg) throw new Error('Not running in Telegram WebApp')
       const data = await $fetch<{ success: boolean; isNewUser: boolean }>('/api/auth/telegram', {
         method: 'POST',
         body: { initData: tg.initData },
       })
       return data
     }

     return { isAvailable, getWebApp, authenticate }
   }
   ```

3. **`apps/web/pages/m/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen flex items-center justify-center p-4">
         <div v-if="loading" class="text-center">
           <div
             class="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"
           ></div>
           <p class="text-gray-600">Авторизация…</p>
         </div>
         <div v-else-if="error" class="text-center max-w-sm">
           <p class="text-red-600 font-medium mb-2">Ошибка авторизации</p>
           <p class="text-sm text-gray-600">{{ error }}</p>
         </div>
         <div v-else-if="user" class="text-center max-w-sm">
           <h1 class="text-2xl font-bold mb-2">Привет, {{ user.name }}!</h1>
           <p class="text-gray-600 mb-4">
             {{ isNewUser ? 'Аккаунт создан.' : 'Добро пожаловать обратно.' }}
           </p>
           <p class="text-sm text-gray-500">Phase 3 готов. Phase 4 добавит организации.</p>
         </div>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ layout: false }) // используем кастомный layout

   const { isAvailable, getWebApp, authenticate } = useTelegram()
   const { user, fetchSession } = useAuth()
   const loading = ref(true)
   const error = ref('')
   const isNewUser = ref(false)

   onMounted(async () => {
     try {
       if (!isAvailable.value) {
         error.value = 'Откройте эту страницу из Telegram-бота'
         loading.value = false
         return
       }

       const tg = getWebApp()
       tg?.ready()
       tg?.expand()

       const result = await authenticate()
       isNewUser.value = result.isNewUser
       await fetchSession()
     } catch (e: any) {
       error.value = e?.statusMessage ?? e?.message ?? 'Не удалось войти'
     } finally {
       loading.value = false
     }
   })
   </script>
   ```

4. **`apps/web/app.vue`** — добавить Telegram WebApp script:
   ```vue
   <template>
     <NuxtLayout>
       <NuxtPage />
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   useHead({
     script: [{ src: 'https://telegram.org/js/telegram-web-app.js', tagPosition: 'head' }],
   })
   </script>
   ```

## Критерии приёмки

- ✅ Открытие `/m/` в обычном браузере → сообщение «Откройте из Telegram»
- ✅ Открытие `/m/` через Telegram-бот → авторизация работает
- ✅ После успешного auth — видно имя пользователя
- ✅ `isNewUser` корректно показывает, был ли user новый
- ✅ Cookie `auth_session` установлен после auth
- ✅ Если повторить открытие — переходит сразу к welcome (не loading)
- ✅ `routeRules['/m/**'].ssr = false` действует — нет SSR ошибок с `window.Telegram`

## Подсказки

- **Тестирование Mini App в dev:** Можно использовать ngrok или Cloudflare Tunnel чтобы пробросить localhost наружу, и подключить как Mini App URL у бота через BotFather.
- **`tg.ready()` и `tg.expand()`** — стандартные методы Telegram WebApp. ready отправляет «я готов», expand разворачивает на весь экран.
- **Theme params** — `tg.themeParams.bg_color`, `tg.themeParams.text_color` — для адаптации стилей к теме Telegram. В Phase 3 не реализуем, в Phase 8 — обязательно.
- **Если `process.client` deprecated** — используй `import.meta.client`.

## Не делать

- ❌ Не делать полноценный Mini App UI — это Phase 8
- ❌ Не подключать `@telegram-apps/sdk` — нативного `window.Telegram.WebApp` достаточно для Phase 3
- ❌ Не оптимизировать первоначальную загрузку — Phase 9
- ❌ Не делать offline support / PWA — лишнее

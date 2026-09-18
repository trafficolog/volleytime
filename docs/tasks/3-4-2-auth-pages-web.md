---
id: '3.4.2'
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
  - '3.3.2'
estimated_hours: '2'
tags:
  - nuxt
  - auth
  - frontend
---

# Task 3.4.2: Веб-страницы auth (login, verify)

## Цель

Создать страницы `/login` и `/verify`, composable `useAuth()`, middleware `auth`. Реализовать через better-auth API.

## Контекст

В этой задаче пользователь может полностью пройти flow:

1. Открыть `/login`
2. Ввести email
3. Получить 6-значный код (в console.log — Phase 3 dev)
4. Ввести код на `/verify`
5. После успешной авторизации — редирект на `/` (или originally requested page)

## Что должно быть сделано

1. **`apps/web/server/api/auth/[...auth].ts`** — better-auth handler:

   ```ts
   import { auth } from '@volley-time/auth'

   export default defineEventHandler((event) => {
     return auth.handler(toWebRequest(event))
   })
   ```

   (детали зависят от better-auth API)

2. **`apps/web/composables/useAuth.ts`:**

   ```ts
   import type { User } from '@volley-time/db'

   export interface AuthState {
     user: User | null
     loading: boolean
   }

   export function useAuth() {
     const user = useState<User | null>('auth.user', () => null)
     const loading = useState<boolean>('auth.loading', () => false)

     async function fetchSession() {
       loading.value = true
       try {
         const data = await $fetch<{ user: User | null }>('/api/auth/session')
         user.value = data.user
       } catch {
         user.value = null
       } finally {
         loading.value = false
       }
     }

     async function sendCode(email: string) {
       await $fetch('/api/auth/send-code', { method: 'POST', body: { email } })
     }

     async function verifyCode(email: string, code: string) {
       const data = await $fetch<{ user: User }>('/api/auth/verify', {
         method: 'POST',
         body: { email, code },
       })
       user.value = data.user
       return data
     }

     async function logout() {
       await $fetch('/api/auth/logout', { method: 'POST' })
       user.value = null
       await navigateTo('/')
     }

     return { user, loading, fetchSession, sendCode, verifyCode, logout }
   }
   ```

3. **`apps/web/middleware/auth.ts`:**

   ```ts
   export default defineNuxtRouteMiddleware(async (to) => {
     const { user, fetchSession } = useAuth()
     if (!user.value) await fetchSession()
     if (!user.value) {
       return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
     }
   })
   ```

4. **`apps/web/pages/login.vue`:**

   ```vue
   <template>
     <div class="max-w-md mx-auto py-12">
       <h1 class="text-2xl font-bold mb-6">Вход</h1>
       <form @submit.prevent="onSubmit" class="space-y-4">
         <div>
           <label class="block text-sm font-medium mb-1">Email</label>
           <input
             v-model="email"
             type="email"
             required
             class="w-full border rounded-lg px-3 py-2"
             :disabled="loading"
           />
         </div>
         <button
           type="submit"
           class="w-full bg-brand-500 text-white py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50"
           :disabled="loading || !email"
         >
           {{ loading ? 'Отправка…' : 'Получить код' }}
         </button>
         <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
       </form>
     </div>
   </template>

   <script setup lang="ts">
   const { sendCode } = useAuth()
   const email = ref('')
   const loading = ref(false)
   const error = ref('')

   async function onSubmit() {
     loading.value = true
     error.value = ''
     try {
       await sendCode(email.value)
       await navigateTo(`/verify?email=${encodeURIComponent(email.value)}`)
     } catch (e: any) {
       error.value = e?.statusMessage ?? 'Не удалось отправить код'
     } finally {
       loading.value = false
     }
   }
   </script>
   ```

5. **`apps/web/pages/verify.vue`:**

   ```vue
   <template>
     <div class="max-w-md mx-auto py-12">
       <h1 class="text-2xl font-bold mb-2">Введите код</h1>
       <p class="text-sm text-gray-600 mb-6">Код отправлен на {{ email }}</p>
       <form @submit.prevent="onSubmit" class="space-y-4">
         <input
           v-model="code"
           type="text"
           inputmode="numeric"
           pattern="[0-9]{6}"
           maxlength="6"
           required
           class="w-full border rounded-lg px-3 py-2 text-center text-2xl tracking-widest font-mono"
           :disabled="loading"
           placeholder="000000"
         />
         <button
           type="submit"
           class="w-full bg-brand-500 text-white py-2 rounded-lg disabled:opacity-50"
           :disabled="loading || code.length !== 6"
         >
           {{ loading ? 'Проверка…' : 'Войти' }}
         </button>
         <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
       </form>
     </div>
   </template>

   <script setup lang="ts">
   const route = useRoute()
   const { verifyCode } = useAuth()
   const email = computed(() => route.query.email as string)
   const code = ref('')
   const loading = ref(false)
   const error = ref('')

   async function onSubmit() {
     loading.value = true
     error.value = ''
     try {
       await verifyCode(email.value, code.value)
       const redirect = (route.query.redirect as string) ?? '/'
       await navigateTo(redirect)
     } catch (e: any) {
       error.value = e?.statusMessage ?? 'Неверный код'
     } finally {
       loading.value = false
     }
   }
   </script>
   ```

6. **`apps/web/server/plugins/auth-init.ts`** — стартовая инициализация:
   ```ts
   import { auth } from '@volley-time/auth'

   export default defineNitroPlugin(() => {
     // Trigger any one-time init for better-auth
     console.log('Auth initialized:', !!auth)
   })
   ```

## Критерии приёмки

- ✅ `/login` рендерится, форма работает
- ✅ После submit → редирект на `/verify?email=...`
- ✅ Код приходит в console.log dev-сервера
- ✅ `/verify` принимает код → создаёт сессию → редирект на `/`
- ✅ После авторизации в header может появиться имя пользователя (если уже добавлен в `default.vue`)
- ✅ Middleware `auth` блокирует анонимный доступ к protected pages (тестируется в Phase 4)
- ✅ Неверный код 5 раз → блокировка
- ✅ Повторный send-code в 60 сек → ошибка 429

## Подсказки

- **better-auth `toWebRequest`:** Nuxt server routes возвращают Node IncomingMessage, нужно сконвертировать в стандартный Request. Это утилита Nitro.
- **useState vs useFetch:** для auth.user используй `useState` (shared across components). useFetch — для одноразовых запросов.
- **Inputmode numeric** для кода — мобильная клавиатура покажет цифры.
- **Auto-submit при вводе 6 цифр:** опционально, можно добавить watcher.

## Не делать

- ❌ Не делать registration form отдельно — login сам создаёт user при первом успешном verify
- ❌ Не делать «remember me» checkbox — better-auth session — 30 дней по умолчанию
- ❌ Не делать password recovery — нет паролей
- ❌ Не делать UI для linking — Phase 3 только API (3.3.4)

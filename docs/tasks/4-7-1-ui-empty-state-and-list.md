---
id: '4.7.1'
phase: '4'
epic: '4.7'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-17
status_note: 'Реализовано в v0.1.0; открытые находки ревью — эпик 4.9.'
roles:
  - FE
depends_on:
  - '4.1.3'
estimated_hours: '1-2'
tags:
  - ui
  - nuxt
  - mini-app
---

# Task 4.7.1: Empty state + список организаций

## Цель

Заменить заглушку `/m/index.vue` из Phase 3 на полноценный экран: если у user'а нет org — empty state с двумя CTA, если есть — список с переключателем активной org.

## Контекст

Это первый экран, который user видит после регистрации. Дизайн: https://volleytime.trafficolog.ru/mini-app.php

Решение 4: empty state, без forced onboarding. Решение 5: multi-org с переключателем.

## Что должно быть сделано

1. **Composable `apps/web/composables/useOrganizations.ts`:**

   ```ts
   import type { Organization, OrganizationMember } from '@volley-time/db'

   export function useOrganizations() {
     const orgs = useState<Organization[]>('orgs.list', () => [])
     const currentOrgId = useState<number | null>('orgs.current', () => null)
     const loading = useState<boolean>('orgs.loading', () => false)

     async function fetchAll() {
       loading.value = true
       try {
         const data = await $fetch<{ organizations: Organization[] }>('/api/organizations')
         orgs.value = data.organizations
         // Restore selection from localStorage or pick first
         const saved = process.client ? localStorage.getItem('current_org_id') : null
         const savedId = saved ? Number(saved) : null
         if (savedId && orgs.value.some((o) => o.id === savedId)) {
           currentOrgId.value = savedId
         } else if (orgs.value.length > 0) {
           currentOrgId.value = orgs.value[0]!.id
         } else {
           currentOrgId.value = null
         }
       } finally {
         loading.value = false
       }
     }

     function setCurrentOrg(orgId: number) {
       currentOrgId.value = orgId
       if (process.client) {
         localStorage.setItem('current_org_id', String(orgId))
       }
     }

     const currentOrg = computed(() => orgs.value.find((o) => o.id === currentOrgId.value) ?? null)

     return { orgs, currentOrg, currentOrgId, loading, fetchAll, setCurrentOrg }
   }
   ```

2. **`apps/web/pages/m/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen flex flex-col">
         <header class="px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
           <h1 class="text-lg font-bold">🏐 Volley Time</h1>
         </header>

         <main class="flex-1 px-4 py-6">
           <div v-if="loading" class="flex justify-center py-12">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>

           <!-- Empty state -->
           <div v-else-if="orgs.length === 0" class="text-center py-12">
             <div class="text-6xl mb-4">🏐</div>
             <h2 class="text-xl font-bold mb-2">Добро пожаловать!</h2>
             <p class="text-gray-600 mb-8 max-w-sm mx-auto">
               У тебя пока нет организаций. Создай свою или присоединись по приглашению.
             </p>
             <div class="space-y-3 max-w-xs mx-auto">
               <NuxtLink
                 to="/m/orgs/new"
                 class="block w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600"
               >
                 Создать организацию
               </NuxtLink>
               <button
                 type="button"
                 class="block w-full border border-gray-300 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-50"
                 @click="showInviteHelp = true"
               >
                 У меня есть приглашение
               </button>
             </div>
             <div v-if="showInviteHelp" class="mt-6 text-sm text-gray-500 max-w-sm mx-auto">
               Открой ссылку, которую тебе прислал организатор — вида
               <code class="bg-gray-100 px-1 rounded">t.me/volleytime_bot?start=org_...</code>
             </div>
           </div>

           <!-- List of organizations -->
           <div v-else>
             <h2 class="text-lg font-semibold mb-4">Мои организации</h2>
             <div class="space-y-2">
               <NuxtLink
                 v-for="org in orgs"
                 :key="org.id"
                 :to="`/m/orgs/${org.id}`"
                 class="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
                 :class="{ 'border-blue-500 bg-blue-50': org.id === currentOrgId }"
                 @click="setCurrentOrg(org.id)"
               >
                 <div class="font-medium">{{ org.name }}</div>
                 <div v-if="org.city" class="text-sm text-gray-500 mt-1">📍 {{ org.city }}</div>
               </NuxtLink>
             </div>

             <NuxtLink
               to="/m/orgs/new"
               class="mt-4 block text-center py-3 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-300 hover:text-blue-600"
             >
               + Создать новую организацию
             </NuxtLink>
           </div>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const { orgs, currentOrgId, loading, fetchAll, setCurrentOrg } = useOrganizations()
   const showInviteHelp = ref(false)

   await fetchAll()
   </script>
   ```

3. **Switcher component для использования в org-pages** (`apps/web/components/OrgSwitcher.vue`):
   ```vue
   <template>
     <div v-if="orgs.length > 1" class="relative">
       <button
         type="button"
         class="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
         @click="open = !open"
       >
         <span>{{ currentOrg?.name }}</span>
         <span class="text-gray-400">▼</span>
       </button>
       <div
         v-if="open"
         class="absolute top-full left-0 mt-1 w-56 bg-white border rounded-lg shadow-lg z-20"
       >
         <button
           v-for="org in orgs"
           :key="org.id"
           type="button"
           class="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
           :class="{ 'bg-blue-50 font-medium': org.id === currentOrgId }"
           @click="onSelect(org.id)"
         >
           {{ org.name }}
         </button>
       </div>
     </div>
   </template>

   <script setup lang="ts">
   const { orgs, currentOrg, currentOrgId, setCurrentOrg } = useOrganizations()
   const open = ref(false)
   const router = useRouter()

   function onSelect(orgId: number) {
     setCurrentOrg(orgId)
     open.value = false
     router.push(`/m/orgs/${orgId}`)
   }
   </script>
   ```

## Критерии приёмки

- ✅ Composable `useOrganizations` инкапсулирует state list + currentOrg
- ✅ Empty state с двумя CTA, текст помощи появляется по клику
- ✅ Список org показывает name + city, current выделен
- ✅ Кликом на org устанавливается `currentOrgId` и сохраняется в localStorage
- ✅ Selection восстанавливается при перезагрузке (через localStorage)
- ✅ Если saved orgId недействителен (org удалён / left) — fallback на первый org
- ✅ Switcher компонент показывается только если orgs > 1
- ✅ Loading spinner пока запрос
- ✅ Mobile-first layout (320-768px ширина)
- ✅ Использует синий primary (Tailwind `blue-500`)

## Подсказки

- **`process.client`** для localStorage — иначе SSR упадёт (`window is not defined`). В Nuxt 4 — `import.meta.client`.
- **`definePageMeta({ middleware: ['auth'] })`** — middleware из Phase 3 (3.4.2) проверяет auth.
- **`layout: false`** — отключает default layout, используем кастомный (без header основного).
- **Switcher как компонент** — переиспользуется на других страницах org.

## Не делать

- ❌ Не делать transitions / animations — performance важнее
- ❌ Не подключать UI-библиотеки
- ❌ Не делать infinite scroll на orgs (обычно их < 5)
- ❌ Не показывать archived orgs (API уже фильтрует)

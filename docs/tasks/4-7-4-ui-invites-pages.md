---
id: '4.7.4'
phase: '4'
epic: '4.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - FE
depends_on:
  - '4.7.3'
  - '4.4.3'
estimated_hours: '2'
tags:
  - ui
  - invites
  - mini-app
---

# Task 4.7.4: Invites manager + accept invite page

## Цель

Страницы:

- `/m/orgs/[orgId]/invites` — список invites, кнопка «создать»
- `/m/invites/[token]` — accept invite (видна без membership в org, но с auth)

## Контекст

Invite-ссылки — единственный способ пригласить людей (invite-first). Manager для owner + accept-страница для приглашённого. Дизайн — из референсов.

## Что должно быть сделано

1. **Composable `apps/web/composables/useInvites.ts`:**

   ```ts
   export function useInvites(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const invites = ref<any[]>([])
     const loading = ref(false)

     async function fetchAll() {
       loading.value = true
       try {
         const data = await $fetch<any>(`/api/organizations/${orgIdRef.value}/invites`)
         invites.value = data.invites
       } finally {
         loading.value = false
       }
     }

     async function create(params: {
       roleToAssign?: string
       defaultMemberStatus?: 'active' | 'pending'
       maxUses?: number | null
       expiresInDays?: number
     }) {
       const data = await $fetch<any>(`/api/organizations/${orgIdRef.value}/invites`, {
         method: 'POST',
         body: params,
       })
       await fetchAll()
       return data
     }

     async function revoke(inviteId: number) {
       await $fetch(`/api/organizations/${orgIdRef.value}/invites/${inviteId}`, {
         method: 'PATCH',
         body: { isRevoked: true },
       })
       await fetchAll()
     }

     return { invites, loading, fetchAll, create, revoke }
   }
   ```

2. **`apps/web/pages/m/orgs/[orgId]/invites/index.vue`** — список + создание:

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header
           class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center justify-between"
         >
           <div class="flex items-center gap-3">
             <button type="button" @click="$router.back()" class="text-blue-500">←</button>
             <h1 class="text-lg font-semibold">Приглашения</h1>
           </div>
           <button
             type="button"
             class="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm"
             @click="showCreate = true"
           >
             + Создать
           </button>
         </header>

         <main class="px-4 py-4">
           <div v-if="loading" class="py-12 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>

           <div v-else-if="invites.length === 0" class="text-center py-12 text-gray-500">
             Нет приглашений.<br />Создай ссылку, чтобы пригласить игроков.
           </div>

           <ul v-else class="space-y-3">
             <li v-for="inv in invites" :key="inv.id" class="bg-white border rounded-lg p-3">
               <div class="flex items-start justify-between gap-2">
                 <div class="flex-1 min-w-0">
                   <div class="text-xs text-gray-500 mb-1">
                     {{ inv.usesCount }}/{{ inv.maxUses ?? '∞' }} использований
                     <span v-if="inv.expiresAt"> · до {{ formatDate(inv.expiresAt) }}</span>
                   </div>
                   <div class="font-mono text-xs break-all bg-gray-50 px-2 py-1 rounded">
                     {{ inv.deeplinkUrl }}
                   </div>
                   <span v-if="inv.isRevoked" class="inline-block mt-1 text-xs text-red-600"
                     >⊘ Отозвано</span
                   >
                 </div>
                 <div class="flex flex-col gap-1 shrink-0">
                   <button
                     type="button"
                     class="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                     @click="copyLink(inv.deeplinkUrl)"
                   >
                     Копировать
                   </button>
                   <button
                     v-if="!inv.isRevoked"
                     type="button"
                     class="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50"
                     @click="onRevoke(inv.id)"
                   >
                     Отозвать
                   </button>
                 </div>
               </div>
             </li>
           </ul>
         </main>

         <!-- Create sheet -->
         <div
           v-if="showCreate"
           class="fixed inset-0 bg-black/50 z-30 flex items-end justify-center"
           @click="showCreate = false"
         >
           <div class="bg-white rounded-t-2xl w-full max-w-md p-6" @click.stop>
             <h2 class="text-lg font-semibold mb-4">Новое приглашение</h2>
             <form @submit.prevent="onCreate" class="space-y-4">
               <div>
                 <label class="block text-sm font-medium mb-1">Срок действия</label>
                 <select
                   v-model.number="form.expiresInDays"
                   class="w-full border rounded px-3 py-2"
                 >
                   <option :value="1">1 день</option>
                   <option :value="7">7 дней</option>
                   <option :value="30">30 дней</option>
                   <option :value="0">Без срока</option>
                 </select>
               </div>
               <div>
                 <label class="block text-sm font-medium mb-1">Макс. использований</label>
                 <select v-model.number="form.maxUses" class="w-full border rounded px-3 py-2">
                   <option :value="0">Без лимита</option>
                   <option :value="1">1</option>
                   <option :value="10">10</option>
                   <option :value="50">50</option>
                 </select>
               </div>
               <div class="flex gap-2">
                 <button
                   type="button"
                   class="flex-1 border py-2 rounded-lg"
                   @click="showCreate = false"
                 >
                   Отмена
                 </button>
                 <button
                   type="submit"
                   class="flex-1 bg-blue-500 text-white py-2 rounded-lg"
                   :disabled="creating"
                 >
                   Создать
                 </button>
               </div>
             </form>
           </div>
         </div>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const orgId = computed(() => Number(route.params.orgId))
   const { invites, loading, fetchAll, create, revoke } = useInvites(orgId)

   const showCreate = ref(false)
   const creating = ref(false)
   const form = ref({ expiresInDays: 7, maxUses: 0 })

   await fetchAll()

   async function onCreate() {
     creating.value = true
     try {
       await create({
         expiresInDays: form.value.expiresInDays || undefined,
         maxUses: form.value.maxUses || null,
       })
       showCreate.value = false
     } finally {
       creating.value = false
     }
   }

   async function onRevoke(id: number) {
     if (!confirm('Отозвать приглашение? Кто уже использовал — останутся.')) return
     await revoke(id)
   }

   function copyLink(url: string) {
     navigator.clipboard.writeText(url)
   }
   function formatDate(s: string) {
     return new Date(s).toLocaleDateString('ru-RU')
   }
   </script>
   ```

3. **`apps/web/pages/m/invites/[token].vue`** — accept page:
   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen flex items-center justify-center p-4">
         <div v-if="loading" class="text-center">
           <div
             class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"
           ></div>
           <p class="text-gray-600">Загрузка приглашения…</p>
         </div>

         <div v-else-if="error" class="text-center max-w-sm">
           <div class="text-5xl mb-4">⊘</div>
           <h1 class="text-xl font-bold mb-2">Приглашение недействительно</h1>
           <p class="text-gray-600 text-sm">{{ error }}</p>
           <NuxtLink to="/m/" class="inline-block mt-6 text-blue-500"
             >Перейти в приложение →</NuxtLink
           >
         </div>

         <div v-else-if="preview && accepted" class="text-center max-w-sm">
           <div class="text-5xl mb-4">✓</div>
           <h1 class="text-xl font-bold mb-2">Готово!</h1>
           <p class="text-gray-600 text-sm mb-6">
             {{
               preview.defaultMemberStatus === 'pending'
                 ? 'Заявка отправлена. Организатор её рассмотрит.'
                 : `Ты участник «${preview.organization.name}»`
             }}
           </p>
           <NuxtLink
             :to="`/m/orgs/${preview.organization.id}`"
             class="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg"
           >
             Перейти в организацию
           </NuxtLink>
         </div>

         <div v-else-if="preview" class="max-w-sm w-full">
           <div class="text-center mb-6">
             <div class="text-4xl mb-3">🏐</div>
             <h1 class="text-xl font-bold">{{ preview.organization.name }}</h1>
             <p v-if="preview.organization.city" class="text-sm text-gray-500 mt-1">
               📍 {{ preview.organization.city }}
             </p>
             <p v-if="preview.organization.description" class="text-sm text-gray-600 mt-3">
               {{ preview.organization.description }}
             </p>
           </div>

           <div
             v-if="preview.defaultMemberStatus === 'pending'"
             class="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded mb-4"
           >
             ⚠️ После присоединения организатор подтвердит заявку.
           </div>

           <button
             type="button"
             class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
             :disabled="accepting"
             @click="onAccept"
           >
             {{ accepting ? 'Принимаем…' : 'Присоединиться' }}
           </button>
           <p v-if="acceptError" class="mt-3 text-sm text-red-600">{{ acceptError }}</p>
         </div>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const token = String(route.params.token)
   const { fetchAll: refetchOrgs, setCurrentOrg } = useOrganizations()

   const loading = ref(true)
   const error = ref('')
   const preview = ref<any>(null)
   const accepting = ref(false)
   const acceptError = ref('')
   const accepted = ref(false)

   async function fetchPreview() {
     try {
       const data = await $fetch<any>(`/api/invites/preview/${encodeURIComponent(token)}`)
       preview.value = data.preview
     } catch (e: any) {
       error.value = e?.data?.statusMessage ?? 'Приглашение не найдено или истекло'
     } finally {
       loading.value = false
     }
   }

   async function onAccept() {
     accepting.value = true
     acceptError.value = ''
     try {
       await $fetch('/api/invites/accept', { method: 'POST', body: { token } })
       accepted.value = true
       await refetchOrgs()
       if (preview.value?.organization?.id) setCurrentOrg(preview.value.organization.id)
     } catch (e: any) {
       acceptError.value = e?.data?.statusMessage ?? 'Не удалось принять приглашение'
     } finally {
       accepting.value = false
     }
   }

   await fetchPreview()
   </script>
   ```

## Критерии приёмки

- ✅ `/m/orgs/[orgId]/invites` — список с usesCount, expiresAt, deeplink URL
- ✅ Кнопка «Создать» открывает sheet (expiresInDays, maxUses)
- ✅ «Копировать» работает через `navigator.clipboard`
- ✅ Revoke с confirm; revoked invites помечены
- ✅ `/m/invites/[token]` показывает preview (требует auth для accept)
- ✅ Для pending org — warning о подтверждении
- ✅ Accept → success screen → переход на org
- ✅ Ошибки (revoked/expired/exhausted) показываются понятно

## Подсказки

- **navigator.clipboard.writeText** — требует HTTPS в production (в Telegram Mini App — ОК).
- **Sheet снизу** — типичный паттерн Telegram. На desktop тоже работает.
- **encodeURIComponent(token)** на всякий случай, хотя nanoid URL-safe.

## Не делать

- ❌ Не делать QR-код в Phase 4 — Phase 8+
- ❌ Не делать редактирование invite после создания
- ❌ Не делать field-level role selector в Phase 4 (всегда player) — расширим в Phase 5

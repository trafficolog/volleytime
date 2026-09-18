---
id: '4.7.5'
phase: '4'
epic: '4.7'
status: in_progress
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: dashboard, audit API и archive API реализованы; Mini App routes /audit и /settings отсутствуют. Реальный repository gap, требуется отдельный SDD/TDD fix либо явный descoping."
roles:
  - FE
depends_on:
  - '4.7.4'
  - '4.6.3'
estimated_hours: '2'
tags:
  - ui
  - audit
  - settings
---

# Task 4.7.5: Dashboard + audit log + settings + archive

## Цель

Финализировать Phase 4 UI:

- `/m/orgs/[orgId]` — dashboard со ссылками на sub-страницы
- `/m/orgs/[orgId]/audit` — audit log с pagination
- `/m/orgs/[orgId]/settings` — настройки + archive

## Контекст

Финал UI Phase 4: dashboard-хаб, журнал действий, настройки с archive. Завершает набор экранов организации перед добавлением событий в Phase 5.

## Что должно быть сделано

1. **`apps/web/pages/m/orgs/[orgId]/index.vue`** — dashboard:

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <NuxtLink to="/m/" class="text-blue-500">←</NuxtLink>
           <h1 class="text-lg font-semibold truncate flex-1">{{ org?.name }}</h1>
         </header>

         <main v-if="org" class="px-4 py-4 space-y-3">
           <div v-if="org.description" class="text-sm text-gray-600 bg-gray-50 p-3 rounded">
             {{ org.description }}
           </div>

           <div class="grid grid-cols-2 gap-3">
             <NuxtLink
               :to="`/m/orgs/${org.id}/members`"
               class="bg-white border rounded-lg p-4 hover:border-blue-300"
             >
               <div class="text-2xl mb-1">👥</div>
               <div class="font-medium">Участники</div>
             </NuxtLink>
             <NuxtLink
               v-if="canInvite"
               :to="`/m/orgs/${org.id}/invites`"
               class="bg-white border rounded-lg p-4 hover:border-blue-300"
             >
               <div class="text-2xl mb-1">🔗</div>
               <div class="font-medium">Приглашения</div>
             </NuxtLink>
             <NuxtLink
               v-if="canViewAudit"
               :to="`/m/orgs/${org.id}/audit`"
               class="bg-white border rounded-lg p-4 hover:border-blue-300"
             >
               <div class="text-2xl mb-1">📜</div>
               <div class="font-medium">Журнал</div>
             </NuxtLink>
             <NuxtLink
               v-if="canManage"
               :to="`/m/orgs/${org.id}/settings`"
               class="bg-white border rounded-lg p-4 hover:border-blue-300"
             >
               <div class="text-2xl mb-1">⚙️</div>
               <div class="font-medium">Настройки</div>
             </NuxtLink>
           </div>

           <div
             class="bg-gray-50 border border-dashed rounded-lg p-4 text-center text-sm text-gray-500"
           >
             События и абонементы появятся в следующем обновлении
           </div>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const orgId = Number(route.params.orgId)
   const org = ref<any>(null)
   const myMember = ref<any>(null)

   const data = await $fetch<any>(`/api/organizations/${orgId}`)
   org.value = data.organization
   myMember.value = data.myMember

   const canManage = computed(() => myMember.value?.role === 'owner')
   const canInvite = computed(() => myMember.value?.role === 'owner')
   const canViewAudit = computed(() => myMember.value?.role === 'owner')
   </script>
   ```

2. **`apps/web/pages/m/orgs/[orgId]/audit/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <button type="button" @click="$router.back()" class="text-blue-500">←</button>
           <h1 class="text-lg font-semibold">Журнал</h1>
         </header>

         <main class="px-4 py-4">
           <div v-if="loading && entries.length === 0" class="py-12 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>

           <ul v-else-if="entries.length > 0" class="space-y-2">
             <li v-for="e in entries" :key="e.id" class="bg-white border rounded-lg p-3">
               <div class="flex items-start justify-between gap-2">
                 <div class="flex-1">
                   <div class="text-sm font-medium">{{ actionLabel(e.action) }}</div>
                   <div class="text-xs text-gray-500 mt-1">
                     {{ entityLabel(e.entityType) }} #{{ e.entityId }}
                   </div>
                   <details v-if="e.oldValue || e.newValue" class="mt-2 text-xs">
                     <summary class="text-blue-500 cursor-pointer">Подробнее</summary>
                     <pre class="mt-1 p-2 bg-gray-50 rounded overflow-x-auto">{{
                       JSON.stringify({ old: e.oldValue, new: e.newValue }, null, 2)
                     }}</pre>
                   </details>
                 </div>
                 <div class="text-xs text-gray-400 shrink-0">{{ formatTime(e.createdAt) }}</div>
               </div>
             </li>
           </ul>

           <div v-else class="text-center py-12 text-gray-500">Журнал пуст</div>

           <button
             v-if="pagination.hasMore"
             type="button"
             class="w-full mt-4 py-2 border rounded-lg text-sm"
             @click="loadMore"
           >
             Показать ещё
           </button>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const orgId = Number(route.params.orgId)
   const entries = ref<any[]>([])
   const pagination = ref({ total: 0, limit: 50, offset: 0, hasMore: false })
   const loading = ref(false)

   async function fetchPage(offset = 0) {
     loading.value = true
     try {
       const data = await $fetch<any>(`/api/organizations/${orgId}/audit`, {
         query: { offset, limit: 50 },
       })
       if (offset === 0) entries.value = data.entries
       else entries.value.push(...data.entries)
       pagination.value = data.pagination
     } finally {
       loading.value = false
     }
   }

   async function loadMore() {
     await fetchPage(pagination.value.offset + pagination.value.limit)
   }

   function actionLabel(a: string): string {
     return (
       {
         'organization.created': 'Организация создана',
         'organization.updated': 'Настройки обновлены',
         'organization.archived': 'Организация архивирована',
         'member.invited': 'Приглашение создано',
         'member.joined': 'Участник присоединился',
         'member.left': 'Участник покинул',
         'member.blocked': 'Участник заблокирован',
         'member.unblocked': 'Участник разблокирован',
         'member.role_changed': 'Роль изменена',
         'member.kicked': 'Участник удалён',
         'invite.created': 'Создана invite-ссылка',
         'invite.revoked': 'Invite отозвана',
         'invite.used': 'Invite использован',
       }[a] ?? a
     )
   }
   function entityLabel(t: string): string {
     return { organization: 'Организация', member: 'Участник', invite: 'Приглашение' }[t] ?? t
   }
   function formatTime(s: string) {
     return new Date(s).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
   }

   await fetchPage()
   </script>
   ```

3. **`apps/web/pages/m/orgs/[orgId]/settings/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <button type="button" @click="$router.back()" class="text-blue-500">←</button>
           <h1 class="text-lg font-semibold">Настройки</h1>
         </header>

         <main v-if="org" class="px-4 py-6">
           <form @submit.prevent="onSave" class="space-y-4">
             <div>
               <label class="block text-sm font-medium mb-1">Название</label>
               <input
                 v-model="form.name"
                 type="text"
                 required
                 class="w-full border rounded-lg px-3 py-2"
                 :disabled="saving"
               />
             </div>
             <div>
               <label class="block text-sm font-medium mb-1">Город</label>
               <input
                 v-model="form.city"
                 type="text"
                 class="w-full border rounded-lg px-3 py-2"
                 :disabled="saving"
               />
             </div>
             <div>
               <label class="block text-sm font-medium mb-1">Описание</label>
               <textarea
                 v-model="form.description"
                 rows="3"
                 class="w-full border rounded-lg px-3 py-2"
                 :disabled="saving"
               ></textarea>
             </div>
             <div>
               <label class="block text-sm font-medium mb-2">Приём участников</label>
               <div class="space-y-2">
                 <label class="flex items-center gap-2">
                   <input v-model="form.defaultMemberStatus" type="radio" value="active" />
                   <span>Сразу принимать</span>
                 </label>
                 <label class="flex items-center gap-2">
                   <input v-model="form.defaultMemberStatus" type="radio" value="pending" />
                   <span>С подтверждением</span>
                 </label>
               </div>
             </div>

             <button
               type="submit"
               class="w-full bg-blue-500 text-white py-3 rounded-lg font-medium disabled:opacity-50"
               :disabled="saving"
             >
               {{ saving ? 'Сохранение…' : 'Сохранить' }}
             </button>
             <p v-if="saveError" class="text-sm text-red-600">{{ saveError }}</p>
             <p v-if="saved" class="text-sm text-green-600">Сохранено ✓</p>
           </form>

           <hr class="my-8 border-gray-200" />

           <div class="border border-red-200 rounded-lg p-4 bg-red-50">
             <h3 class="font-medium mb-1">Архивировать организацию</h3>
             <p class="text-sm text-gray-600 mb-3">
               Организация перестанет быть видимой для участников. Данные сохранятся.
             </p>
             <button
               type="button"
               class="w-full border border-red-300 text-red-700 py-2 rounded-lg hover:bg-red-100"
               :disabled="archiving"
               @click="onArchive"
             >
               {{ archiving ? 'Архивирование…' : 'Архивировать' }}
             </button>
           </div>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const router = useRouter()
   const orgId = Number(route.params.orgId)
   const { fetchAll: refetchOrgs } = useOrganizations()

   const org = ref<any>(null)
   const form = ref({
     name: '',
     city: '',
     description: '',
     defaultMemberStatus: 'active' as 'active' | 'pending',
   })
   const saving = ref(false)
   const saved = ref(false)
   const saveError = ref('')
   const archiving = ref(false)

   const data = await $fetch<any>(`/api/organizations/${orgId}`)
   org.value = data.organization
   form.value = {
     name: data.organization.name,
     city: data.organization.city ?? '',
     description: data.organization.description ?? '',
     defaultMemberStatus: data.organization.defaultMemberStatus,
   }

   async function onSave() {
     saving.value = true
     saved.value = false
     saveError.value = ''
     try {
       await $fetch(`/api/organizations/${orgId}`, {
         method: 'PATCH',
         body: {
           name: form.value.name,
           city: form.value.city || null,
           description: form.value.description || null,
           defaultMemberStatus: form.value.defaultMemberStatus,
         },
       })
       saved.value = true
       await refetchOrgs()
     } catch (e: any) {
       saveError.value = e?.data?.statusMessage ?? 'Не удалось сохранить'
     } finally {
       saving.value = false
     }
   }

   async function onArchive() {
     if (!confirm('Архивировать организацию? Это действие можно отменить только через поддержку.'))
       return
     archiving.value = true
     try {
       await $fetch(`/api/organizations/${orgId}/archive`, { method: 'POST' })
       await refetchOrgs()
       router.push('/m/')
     } catch (e: any) {
       saveError.value = e?.data?.statusMessage ?? 'Не удалось архивировать'
     } finally {
       archiving.value = false
     }
   }
   </script>
   ```

4. **Web версии** (`/orgs/[orgId]/...`) — те же страницы с layout `default`. В Phase 4 можно сделать упрощённо (переиспользовать компоненты или сослаться на Mini App-разметку с другим layout).

## Критерии приёмки

- ✅ Dashboard `/m/orgs/[orgId]` показывает плитки навигации согласно правам (canX)
- ✅ Player видит только «Участники» (без Invites/Audit/Settings)
- ✅ Owner видит все плитки
- ✅ Audit log: список с pagination («Показать ещё»), human-readable action labels
- ✅ Audit показывает old/new значения через collapsible details
- ✅ Settings: форма с name/city/description/defaultMemberStatus
- ✅ Save обновляет org + refetch
- ✅ Archive с confirm → редирект на `/m/`
- ✅ Все деструктивные действия с confirm
- ✅ Mobile-first

## Подсказки

- **Permission-based навигация:** плитки скрываются через `v-if="canX"`. Это UX-удобство, но реальная защита — на API (tenant middleware + permission checks).
- **Audit pagination:** «Показать ещё» добавляет к существующему списку (offset += limit).
- **`<details>/<summary>`** — нативный collapsible, без JS. Удобно для old/new JSON.

## Не делать

- ❌ Не делать undelete/restore archived в UI — через поддержку (Phase 14+)
- ❌ Не делать фильтры audit по action/user в Phase 4 UI — API поддерживает, UI добавим в Phase 14+
- ❌ Не делать change slug UI — Phase 11+
- ❌ Не делать transfer ownership UI — Phase 11+

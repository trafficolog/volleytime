---
id: '4.7.3'
phase: '4'
epic: '4.7'
status: done
sync_state: synced
last_reviewed: 2026-09-18
status_note: "Reconciled 2026-09-18: реализация v0.1.0 и hardening эпика 4.9 подтверждены кодом и review evidence; открытых repository-level находок по карточке нет."
roles:
  - FE
depends_on:
  - '4.7.2'
  - '4.2.3'
estimated_hours: '2'
tags:
  - ui
  - members
  - mini-app
---

# Task 4.7.3: Members list + member card

## Цель

Страницы `/m/orgs/[orgId]/members` (список) и `/m/orgs/[orgId]/members/[memberId]` (карточка) — управление составом.

## Контекст

Управление составом — ключевая функция организатора. Список с табами по статусу + карточка с действиями (роль, block/unblock, leave). Дизайн — из референсов Mini App.

## Что должно быть сделано

1. **Composable `apps/web/composables/useMembers.ts`:**

   ```ts
   interface MemberWithUser {
     id: number
     organizationId: number
     userId: number
     role: 'owner' | 'organizer' | 'assistant' | 'player'
     status: 'active' | 'pending' | 'blocked' | 'left' | 'rejected'
     joinedAt: string | null
     user: {
       id: number
       name: string | null
       email: string | null
       telegramUsername: string | null
     }
   }

   export function useMembers(orgId: Ref<number> | number) {
     const orgIdRef = isRef(orgId) ? orgId : ref(orgId)
     const members = ref<MemberWithUser[]>([])
     const loading = ref(false)

     async function fetchList(statuses: string[] = ['active', 'pending']) {
       loading.value = true
       try {
         const data = await $fetch<{ members: MemberWithUser[] }>(
           `/api/organizations/${orgIdRef.value}/members`,
           { query: { statuses: statuses.join(',') } },
         )
         members.value = data.members
       } finally {
         loading.value = false
       }
     }

     async function updateRole(memberId: number, role: string) {
       const data = await $fetch<{ member: MemberWithUser }>(
         `/api/organizations/${orgIdRef.value}/members/${memberId}`,
         { method: 'PATCH', body: { role } },
       )
       return data.member
     }

     async function block(memberId: number) {
       return $fetch<{ member: MemberWithUser }>(
         `/api/organizations/${orgIdRef.value}/members/${memberId}`,
         { method: 'PATCH', body: { status: 'blocked' } },
       )
     }

     async function unblock(memberId: number) {
       return $fetch<{ member: MemberWithUser }>(
         `/api/organizations/${orgIdRef.value}/members/${memberId}`,
         { method: 'PATCH', body: { status: 'active' } },
       )
     }

     async function leave() {
       // Нужно знать memberId текущего user — берётся отдельным запросом или из organization.members
       throw new Error('Implement: get my memberId, then DELETE')
     }

     return { members, loading, fetchList, updateRole, block, unblock, leave }
   }
   ```

2. **`apps/web/pages/m/orgs/[orgId]/members/index.vue`:**

   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <button type="button" @click="$router.back()" class="text-blue-500">←</button>
           <h1 class="text-lg font-semibold">Участники</h1>
         </header>

         <main class="px-4 py-4">
           <!-- Filter tabs -->
           <div class="flex gap-2 mb-4">
             <button
               v-for="tab in tabs"
               :key="tab.id"
               type="button"
               class="px-3 py-1 text-sm rounded-full border"
               :class="
                 filterStatuses === tab.value
                   ? 'bg-blue-500 text-white border-blue-500'
                   : 'bg-white text-gray-700 border-gray-200'
               "
               @click="setFilter(tab.value)"
             >
               {{ tab.label }}
             </button>
           </div>

           <div v-if="loading" class="py-12 flex justify-center">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
           </div>

           <div v-else-if="members.length === 0" class="text-center py-12 text-gray-500">
             Нет участников в этой категории
           </div>

           <ul v-else class="space-y-2">
             <li v-for="m in members" :key="m.id">
               <NuxtLink
                 :to="`/m/orgs/${orgId}/members/${m.id}`"
                 class="block bg-white border rounded-lg p-3 hover:border-blue-300"
               >
                 <div class="flex items-center justify-between">
                   <div>
                     <div class="font-medium">{{ m.user.name || `User ${m.userId}` }}</div>
                     <div class="text-xs text-gray-500 mt-1">
                       <span v-if="m.role === 'owner'" class="text-orange-600">👑 Owner</span>
                       <span v-else-if="m.role === 'organizer'">Organizer</span>
                       <span v-else>Player</span>
                       · {{ statusLabel(m.status) }}
                     </div>
                   </div>
                   <span class="text-gray-400">›</span>
                 </div>
               </NuxtLink>
             </li>
           </ul>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const orgId = computed(() => Number(route.params.orgId))
   const { members, loading, fetchList } = useMembers(orgId)

   const tabs = [
     { id: 'active', label: 'Активные', value: ['active'] },
     { id: 'pending', label: 'Заявки', value: ['pending'] },
     { id: 'blocked', label: 'Заблокированные', value: ['blocked'] },
   ]
   const filterStatuses = ref<string[]>(['active'])

   function setFilter(statuses: string[]) {
     filterStatuses.value = statuses
     fetchList(statuses)
   }

   function statusLabel(status: string): string {
     return (
       {
         active: 'активный',
         pending: 'ждёт подтверждения',
         blocked: 'заблокирован',
         left: 'покинул',
         rejected: 'отклонён',
       }[status] ?? status
     )
   }

   await fetchList(filterStatuses.value)
   </script>
   ```

3. **`apps/web/pages/m/orgs/[orgId]/members/[memberId].vue`:**
   ```vue
   <template>
     <NuxtLayout name="miniapp">
       <div class="min-h-screen">
         <header class="px-4 py-3 border-b bg-white sticky top-0 z-10 flex items-center gap-3">
           <button type="button" @click="$router.back()" class="text-blue-500">←</button>
           <h1 class="text-lg font-semibold">Участник</h1>
         </header>

         <main v-if="member" class="px-4 py-6">
           <div class="bg-white border rounded-lg p-4 mb-4">
             <div class="text-xl font-semibold mb-1">{{ member.user.name }}</div>
             <div class="text-sm text-gray-500" v-if="member.user.telegramUsername">
               @{{ member.user.telegramUsername }}
             </div>
             <div class="mt-3 flex gap-2">
               <span class="px-2 py-1 text-xs rounded bg-gray-100">
                 {{ roleLabel(member.role) }}
               </span>
               <span class="px-2 py-1 text-xs rounded" :class="statusColor(member.status)">
                 {{ statusLabel(member.status) }}
               </span>
             </div>
           </div>

           <!-- Owner actions -->
           <div v-if="canManage && member.userId !== currentUserId" class="space-y-3">
             <!-- Role -->
             <div class="bg-white border rounded-lg p-4">
               <div class="text-sm font-medium mb-2">Роль</div>
               <select
                 v-model="selectedRole"
                 @change="onRoleChange"
                 class="w-full border rounded px-3 py-2"
                 :disabled="loading || member.role === 'owner'"
               >
                 <option value="player">Player</option>
                 <option value="organizer">Organizer</option>
                 <option value="assistant">Assistant</option>
               </select>
               <p v-if="member.role === 'owner'" class="text-xs text-gray-500 mt-1">
                 Owner нельзя разжаловать
               </p>
             </div>

             <!-- Block / Unblock -->
             <button
               v-if="member.status === 'active'"
               type="button"
               class="w-full border border-red-300 text-red-600 py-2 rounded-lg hover:bg-red-50"
               :disabled="loading"
               @click="onBlock"
             >
               Заблокировать
             </button>
             <button
               v-else-if="member.status === 'blocked'"
               type="button"
               class="w-full border border-green-300 text-green-600 py-2 rounded-lg hover:bg-green-50"
               :disabled="loading"
               @click="onUnblock"
             >
               Разблокировать
             </button>
           </div>

           <!-- Self leave -->
           <div v-if="member.userId === currentUserId && member.role !== 'owner'" class="mt-4">
             <button
               type="button"
               class="w-full border border-red-300 text-red-600 py-2 rounded-lg hover:bg-red-50"
               :disabled="loading"
               @click="onLeave"
             >
               Покинуть организацию
             </button>
           </div>

           <p v-if="error" class="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
             {{ error }}
           </p>
         </main>
       </div>
     </NuxtLayout>
   </template>

   <script setup lang="ts">
   definePageMeta({ middleware: ['auth'], layout: false })

   const route = useRoute()
   const router = useRouter()
   const orgId = Number(route.params.orgId)
   const memberId = Number(route.params.memberId)
   const { user: authUser } = useAuth()
   const currentUserId = computed(() => authUser.value?.id)

   const member = ref<any>(null)
   const myMember = ref<any>(null)
   const loading = ref(false)
   const error = ref('')
   const selectedRole = ref<string>('player')

   async function fetchMember() {
     const data = await $fetch<any>(`/api/organizations/${orgId}/members/${memberId}`)
     member.value = data.member
     selectedRole.value = data.member.role
   }

   async function fetchMyMember() {
     const orgData = await $fetch<any>(`/api/organizations/${orgId}`)
     myMember.value = orgData.myMember
   }

   const canManage = computed(() => myMember.value?.role === 'owner')

   async function onRoleChange() {
     if (!member.value) return
     loading.value = true
     error.value = ''
     try {
       const data = await $fetch<any>(`/api/organizations/${orgId}/members/${memberId}`, {
         method: 'PATCH',
         body: { role: selectedRole.value },
       })
       member.value = data.member
     } catch (e: any) {
       error.value = e?.data?.statusMessage ?? 'Не удалось изменить роль'
       selectedRole.value = member.value.role
     } finally {
       loading.value = false
     }
   }

   async function onBlock() {
     if (!confirm('Заблокировать участника?')) return
     loading.value = true
     try {
       const data = await $fetch<any>(`/api/organizations/${orgId}/members/${memberId}`, {
         method: 'PATCH',
         body: { status: 'blocked' },
       })
       member.value = data.member
     } catch (e: any) {
       error.value = e?.data?.statusMessage ?? 'Ошибка'
     } finally {
       loading.value = false
     }
   }

   async function onUnblock() {
     loading.value = true
     try {
       const data = await $fetch<any>(`/api/organizations/${orgId}/members/${memberId}`, {
         method: 'PATCH',
         body: { status: 'active' },
       })
       member.value = data.member
     } catch (e: any) {
       error.value = e?.data?.statusMessage ?? 'Ошибка'
     } finally {
       loading.value = false
     }
   }

   async function onLeave() {
     if (!confirm('Покинуть организацию? Вы перестанете видеть события и абонементы.')) return
     loading.value = true
     try {
       await $fetch(`/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' })
       router.push('/m/')
     } catch (e: any) {
       error.value = e?.data?.statusMessage ?? 'Ошибка'
     } finally {
       loading.value = false
     }
   }

   function roleLabel(role: string) {
     return (
       { owner: '👑 Owner', organizer: 'Organizer', assistant: 'Assistant', player: 'Player' }[
         role
       ] ?? role
     )
   }
   function statusLabel(status: string) {
     return (
       {
         active: 'Активный',
         pending: 'Ждёт подтверждения',
         blocked: 'Заблокирован',
         left: 'Покинул',
         rejected: 'Отклонён',
       }[status] ?? status
     )
   }
   function statusColor(status: string) {
     return (
       {
         active: 'bg-green-50 text-green-700',
         pending: 'bg-yellow-50 text-yellow-700',
         blocked: 'bg-red-50 text-red-700',
         left: 'bg-gray-50 text-gray-700',
         rejected: 'bg-gray-50 text-gray-700',
       }[status] ?? 'bg-gray-50 text-gray-700'
     )
   }

   await Promise.all([fetchMember(), fetchMyMember()])
   </script>
   ```

## Критерии приёмки

- ✅ `/m/orgs/[orgId]/members` — список с табами (Активные / Заявки / Заблокированные)
- ✅ Клик на member → переход на карточку
- ✅ Карточка показывает name, telegram, role, status
- ✅ Owner видит UI для изменения роли (select) и block/unblock
- ✅ Player видит только свою карточку + кнопку «Покинуть»
- ✅ Owner не может разжаловать сам себя (UI это enforced + API возвращает 400)
- ✅ Confirm dialogs для деструктивных действий
- ✅ После leave → редирект на `/m/`

## Подсказки

- **`useAuth()`** из Phase 3 даёт текущего user через composable.
- **`myMember` из endpoint GET /api/organizations/:orgId** — он уже возвращается tenant middleware (см. 4.1.3).
- **`confirm()`** — стандартный browser dialog. В Phase 8+ заменим на красивый modal.

## Не делать

- ❌ Не делать поиск по members (фильтр по name) — Phase 5+
- ❌ Не делать pagination — Phase 5+ когда members > 50
- ❌ Не делать bulk actions
- ❌ Не делать messaging кнопку — пока нет внутреннего chat

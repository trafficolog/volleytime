<script setup lang="ts">
import type { OrganizationMember } from '@volley-time/db'
import type { MemberRow } from '~/composables/useOrganizations'
import { ROLE_LABELS, displayName, label } from '~/utils/labels'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { members, loading, error, fetch } = useMembers(orgId)
const { confirm } = useTelegram()

const { data: orgData } = await useFetch<{ myMember: OrganizationMember }>(
  () => `/api/organizations/${orgId.value}`,
)
const me = computed(() => orgData.value?.myMember ?? null)
const isManager = computed(
  () => me.value?.status === 'active' && ['owner', 'organizer'].includes(me.value.role),
)

type Segment = 'active' | 'pending' | 'blocked'
const segment = ref<Segment>('active')
const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'active', label: 'Активные' },
  { id: 'pending', label: 'Заявки' },
  { id: 'blocked', label: 'Заблокированные' },
]
const pendingCount = ref(0)

async function load() {
  await fetch([segment.value])
  if (isManager.value && segment.value !== 'pending') {
    const data = await $fetch<{ members: MemberRow[] }>(
      `/api/organizations/${orgId.value}/members`,
      { query: { statuses: 'pending' } },
    ).catch(() => ({ members: [] }))
    pendingCount.value = data.members.length
  } else if (segment.value === 'pending') {
    pendingCount.value = members.value.length
  }
}
await load()
watch(segment, load)

const ROLE_TONE: Record<string, 'solid' | 'flame' | 'default'> = {
  owner: 'solid',
  organizer: 'flame',
}

/** Может ли текущий пользователь модерировать участника (зеркало политики canModerate). */
function canModerate(m: MemberRow): boolean {
  if (!isManager.value || !me.value || m.role === 'owner' || m.user.id === me.value.userId)
    return false
  return me.value.role === 'owner' || m.role === 'player' || m.role === 'assistant'
}

const busy = ref<number | null>(null)
const actionError = ref('')
const sheetFor = ref<MemberRow | null>(null)
const sheetOpen = computed({
  get: () => sheetFor.value !== null,
  set: (v) => {
    if (!v) sheetFor.value = null
  },
})

async function act(m: MemberRow, action: 'approve' | 'reject' | 'block' | 'unblock') {
  if (action === 'block' && !(await confirm(`Заблокировать ${displayName(m.user)}?`))) return
  busy.value = m.id
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/members/${m.id}/${action}`, { method: 'POST' })
    sheetFor.value = null
    await load()
  } catch (e) {
    actionError.value = apiErrorMessage(e)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="min-h-screen pb-20">
    <VtMiniHeader title="Игроки" :back="`/m/orgs/${orgId}`">
      <template v-if="isManager" #right>
        <NuxtLink
          :to="`/m/orgs/${orgId}/invite`"
          class="vt-btn vt-btn--ghost vt-btn--sm !px-2"
          aria-label="Пригласить"
        >
          <VtIcon name="plus" :size="16" />
        </NuxtLink>
      </template>
    </VtMiniHeader>

    <div v-if="isManager" class="px-4 pt-2 flex gap-1" role="tablist">
      <button
        v-for="s in SEGMENTS"
        :key="s.id"
        type="button"
        role="tab"
        :aria-selected="segment === s.id"
        class="vt-btn vt-btn--sm flex-1 !rounded-full"
        :class="segment === s.id ? 'vt-btn--ink' : 'text-vt-mute-2'"
        @click="segment = s.id"
      >
        {{ s.label }}
        <span
          v-if="s.id === 'pending' && pendingCount > 0"
          class="text-[10px] px-1.5 rounded-full"
          :class="segment === s.id ? 'bg-white/20' : 'bg-vt-amber text-[#0e0e10]'"
          >{{ pendingCount }}</span
        >
      </button>
    </div>

    <main class="px-4 py-3">
      <p v-if="actionError" class="mb-3 text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>
      <p v-if="segment === 'pending'" class="text-[12.5px] text-vt-mute-2 px-1 pb-3">
        Заявки на вступление по приглашению. Примите, чтобы открыть доступ к событиям.
      </p>

      <SkeletonList v-if="loading" :count="4" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <EmptyState
        v-else-if="members.length === 0"
        icon="users"
        :title="
          segment === 'pending'
            ? 'Новых заявок нет'
            : segment === 'blocked'
              ? 'Заблокированных нет'
              : 'В составе пока никого'
        "
      />

      <ul v-else-if="segment === 'pending'" class="space-y-2.5">
        <li v-for="m in members" :key="m.id" class="vt-card p-3.5 flex items-center gap-3">
          <VtAvatar :name="displayName(m.user)" :src="m.user.image" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold truncate">{{ displayName(m.user) }}</div>
            <div class="text-[11.5px] text-vt-mute-2">заявка по приглашению</div>
          </div>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            :disabled="busy === m.id"
            @click="act(m, 'reject')"
          >
            Отклонить
          </button>
          <button
            type="button"
            class="vt-btn vt-btn--primary vt-btn--sm"
            :disabled="busy === m.id"
            @click="act(m, 'approve')"
          >
            Принять
          </button>
        </li>
      </ul>

      <ul v-else class="vt-card overflow-hidden divide-y divide-[var(--vt-stroke)]">
        <li v-for="m in members" :key="m.id">
          <component
            :is="canModerate(m) ? 'button' : 'div'"
            :type="canModerate(m) ? 'button' : undefined"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 text-left"
            :aria-label="canModerate(m) ? `Действия: ${displayName(m.user)}` : undefined"
            @click="canModerate(m) && (sheetFor = m)"
          >
            <VtAvatar :name="displayName(m.user)" :src="m.user.image" />
            <div class="flex-1 min-w-0">
              <div class="text-[13.5px] font-semibold truncate">{{ displayName(m.user) }}</div>
              <div v-if="m.user.telegramUsername && m.user.name" class="text-[11px] text-vt-mute-2">
                @{{ m.user.telegramUsername }}
              </div>
            </div>
            <VtChip :tone="ROLE_TONE[m.role] ?? 'default'">{{ label(ROLE_LABELS, m.role) }}</VtChip>
            <VtIcon v-if="canModerate(m)" name="more" :size="14" class="text-vt-mute" />
          </component>
        </li>
      </ul>
    </main>

    <VtSheet v-model="sheetOpen" :title="sheetFor ? displayName(sheetFor.user) : ''">
      <div v-if="sheetFor" class="flex flex-col gap-2">
        <button
          v-if="sheetFor.status === 'blocked'"
          type="button"
          class="vt-btn vt-btn--primary vt-btn--full"
          :disabled="busy === sheetFor.id"
          @click="act(sheetFor, 'unblock')"
        >
          Разблокировать
        </button>
        <button
          v-else
          type="button"
          class="vt-btn vt-btn--danger vt-btn--full"
          :disabled="busy === sheetFor.id"
          @click="act(sheetFor, 'block')"
        >
          Заблокировать
        </button>
      </div>
    </VtSheet>
  </div>
</template>

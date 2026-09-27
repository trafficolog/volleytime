<script setup lang="ts">
import type { OrganizationMember } from '@volley-time/db'

import type { MemberRow } from '~/composables/useOrganizations'
import { desktopMemberActions, type DesktopMemberAction } from '~/utils/desktop-member-actions'
import { isLiveDesktopRoute } from '~/utils/desktop-org-ui'
import { ROLE_LABELS, displayName, label } from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

type Segment = 'active' | 'pending' | 'blocked'
const segments: { id: Segment; label: string }[] = [
  { id: 'active', label: 'В составе' },
  { id: 'pending', label: 'Заявки' },
  { id: 'blocked', label: 'Заблокированные' },
]
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const path = computed(() => `/app/orgs/${orgId.value}/members`)
const { data: orgData } = await useFetch<{ myMember: OrganizationMember }>(
  () => `/api/organizations/${orgId.value}`,
  { key: () => `desktop-members-org-${orgId.value}` },
)
const actor = computed(() => orgData.value?.myMember ?? null)
const segment = ref<Segment>('active')
const members = ref<MemberRow[]>([])
const loading = ref(false)
const error = ref('')
const actionError = ref('')
const busy = ref(false)
const selectedRoles = reactive<Record<number, 'organizer' | 'assistant' | 'player'>>({})
let generation = 0
let alive = true

function actions(member: MemberRow): DesktopMemberAction[] {
  return desktopMemberActions(actor.value, {
    role: member.role,
    status: member.status,
    userId: member.user.id,
  })
}

async function load() {
  const token = ++generation
  const targetOrgId = orgId.value
  const targetSegment = segment.value
  loading.value = true
  error.value = ''
  members.value = []
  try {
    const result = await $fetch<{ members: MemberRow[] }>(
      `/api/organizations/${targetOrgId}/members`,
      { query: { statuses: targetSegment } },
    )
    if (
      !alive ||
      token !== generation ||
      orgId.value !== targetOrgId ||
      segment.value !== targetSegment
    )
      return
    members.value = result.members
    for (const member of result.members) {
      if (member.role !== 'owner') selectedRoles[member.id] = member.role
    }
  } catch (cause) {
    if (
      !alive ||
      token !== generation ||
      orgId.value !== targetOrgId ||
      segment.value !== targetSegment
    )
      return
    error.value = apiErrorMessage(cause, 'Не удалось загрузить участников')
  } finally {
    if (alive && token === generation) loading.value = false
  }
}

watch(
  [orgId, segment],
  () => {
    void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  alive = false
  generation++
})

async function act(member: MemberRow, action: DesktopMemberAction) {
  if (busy.value || !actions(member).includes(action)) return
  const targetOrgId = orgId.value
  const expectedPath = path.value
  const targetSegment = segment.value
  const targetRole = selectedRoles[member.id]
  if (action === 'changeRole' && (!targetRole || targetRole === member.role)) return
  const prompt =
    action === 'changeRole'
      ? `Изменить роль ${displayName(member.user)} на «${label(ROLE_LABELS, targetRole ?? '')}»?`
      : action === 'block'
        ? `Заблокировать ${displayName(member.user)}?`
        : action === 'reject'
          ? `Отклонить заявку ${displayName(member.user)}?`
          : action === 'unblock'
            ? `Разблокировать ${displayName(member.user)}?`
            : `Принять заявку ${displayName(member.user)}?`
  if (!window.confirm(prompt)) return
  if (!alive || !isLiveDesktopRoute(route.path, expectedPath) || orgId.value !== targetOrgId) return
  if (!actions(member).includes(action) || busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    if (action === 'changeRole') {
      await $fetch(`/api/organizations/${targetOrgId}/members/${member.id}`, {
        method: 'PATCH',
        body: { role: targetRole },
      })
    } else {
      await $fetch(`/api/organizations/${targetOrgId}/members/${member.id}/${action}`, {
        method: 'POST',
      })
    }
    if (
      alive &&
      isLiveDesktopRoute(route.path, expectedPath) &&
      orgId.value === targetOrgId &&
      segment.value === targetSegment
    )
      await load()
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      actionError.value = apiErrorMessage(cause, 'Не удалось выполнить действие')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="vt-desktop-dashboard space-y-5">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">Игроки</h1>
        <p class="text-vt-mute-2">Состав, заявки и доступ участников.</p>
      </div>
      <NuxtLink :to="`/app/orgs/${orgId}/invite`" class="vt-btn vt-btn--primary"
        >Пригласить</NuxtLink
      >
    </header>

    <div class="vt-desktop-events__filters" aria-label="Статус участников">
      <button
        v-for="item in segments"
        :key="item.id"
        type="button"
        class="vt-btn vt-btn--sm"
        :class="segment === item.id ? 'vt-btn--ink' : 'vt-btn--ghost'"
        :aria-pressed="segment === item.id"
        @click="segment = item.id"
      >
        {{ item.label }}
      </button>
    </div>
    <p v-if="actionError" role="alert" class="text-vt-rose-ink">{{ actionError }}</p>
    <SkeletonList v-if="loading" :count="3" />
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
    <ul v-else class="vt-desktop-members__list">
      <li v-for="member in members" :key="member.id" class="vt-card vt-desktop-members__row">
        <div class="vt-desktop-members__person">
          <VtAvatar :name="displayName(member.user)" :src="member.user.image" />
          <div>
            <strong>{{ displayName(member.user) }}</strong>
            <small v-if="member.user.telegramUsername">@{{ member.user.telegramUsername }}</small>
          </div>
          <VtChip
            :tone="
              member.role === 'owner' ? 'solid' : member.role === 'organizer' ? 'flame' : 'default'
            "
            >{{ label(ROLE_LABELS, member.role) }}</VtChip
          >
        </div>
        <div v-if="actions(member).length" class="vt-desktop-members__actions">
          <template v-if="actions(member).includes('changeRole')">
            <label class="sr-only" :for="`member-role-${member.id}`"
              >Роль: {{ displayName(member.user) }}</label
            >
            <select
              :id="`member-role-${member.id}`"
              v-model="selectedRoles[member.id]"
              class="vt-field"
              :disabled="busy"
            >
              <option value="player">Игрок</option>
              <option value="assistant">Помощник</option>
              <option value="organizer">Организатор</option>
            </select>
            <button
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              :disabled="busy || selectedRoles[member.id] === member.role"
              @click="act(member, 'changeRole')"
            >
              Сохранить роль
            </button>
          </template>
          <button
            v-for="action in actions(member).filter((item) => item !== 'changeRole')"
            :key="action"
            type="button"
            class="vt-btn vt-btn--sm"
            :class="action === 'block' || action === 'reject' ? 'vt-btn--danger' : 'vt-btn--ghost'"
            :disabled="busy"
            @click="act(member, action)"
          >
            {{
              action === 'approve'
                ? 'Принять'
                : action === 'reject'
                  ? 'Отклонить'
                  : action === 'block'
                    ? 'Заблокировать'
                    : 'Разблокировать'
            }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

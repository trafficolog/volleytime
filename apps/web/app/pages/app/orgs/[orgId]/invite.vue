<script setup lang="ts">
import type { InviteLink, OrganizationMember } from '@volley-time/db'
import { formatDay } from '@volley-time/shared'

import { isLiveDesktopRoute } from '~/utils/desktop-org-ui'
import { ROLE_LABELS, label } from '~/utils/labels'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

type InviteRow = InviteLink & { deeplinkUrl: string }
const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const path = computed(() => `/app/orgs/${orgId.value}/invite`)
const { tz } = useOrgTimezone(orgId)
const { data: orgData } = await useFetch<{ myMember: OrganizationMember }>(
  () => `/api/organizations/${orgId.value}`,
  { key: () => `desktop-invite-org-${orgId.value}` },
)
const actor = computed(() => orgData.value?.myMember ?? null)
const isOwner = computed(() => actor.value?.status === 'active' && actor.value.role === 'owner')
const canInvite = computed(
  () => actor.value?.status === 'active' && ['owner', 'organizer'].includes(actor.value.role),
)
const invites = ref<InviteRow[]>([])
const loading = ref(false)
const loadError = ref('')
const error = ref('')
const formError = ref('')
const copiedId = ref<number | null>(null)
const busy = ref(false)
const form = reactive({
  roleToAssign: 'player' as 'player' | 'organizer' | 'assistant',
  maxUses: '' as string,
  expiresInDays: '7' as string,
  defaultMemberStatus: '' as '' | 'active' | 'pending',
})
let generation = 0
let alive = true

async function load() {
  if (!canInvite.value) return
  const token = ++generation
  const targetOrgId = orgId.value
  loading.value = true
  loadError.value = ''
  error.value = ''
  invites.value = []
  try {
    const result = await $fetch<{ invites: InviteRow[] }>(
      `/api/organizations/${targetOrgId}/invites`,
    )
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    invites.value = result.invites
  } catch (cause) {
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить приглашения')
  } finally {
    if (alive && token === generation) loading.value = false
  }
}

watch(
  [orgId, canInvite],
  () => {
    generation++
    invites.value = []
    void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  alive = false
  generation++
})

function isActive(invite: InviteRow) {
  return (
    !invite.isRevoked &&
    (!invite.expiresAt || new Date(invite.expiresAt).getTime() > Date.now()) &&
    (invite.maxUses === null || invite.usesCount < invite.maxUses)
  )
}

function canMutate(targetOrgId: number, expectedPath: string) {
  return (
    alive &&
    canInvite.value &&
    !busy.value &&
    orgId.value === targetOrgId &&
    isLiveDesktopRoute(route.path, expectedPath)
  )
}

async function create() {
  const targetOrgId = orgId.value
  const expectedPath = path.value
  if (!canMutate(targetOrgId, expectedPath)) return
  if (!isOwner.value) form.roleToAssign = 'player'
  if (form.roleToAssign !== 'player' && !isOwner.value) return
  busy.value = true
  formError.value = ''
  try {
    await $fetch(`/api/organizations/${targetOrgId}/invites`, {
      method: 'POST',
      body: {
        roleToAssign: form.roleToAssign,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiresInDays: form.expiresInDays ? Number(form.expiresInDays) : undefined,
        defaultMemberStatus: form.defaultMemberStatus || undefined,
      },
    })
    if (alive && orgId.value === targetOrgId && isLiveDesktopRoute(route.path, expectedPath))
      await load()
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      formError.value = apiErrorMessage(cause, 'Не удалось создать ссылку')
  } finally {
    busy.value = false
  }
}

async function copy(invite: InviteRow) {
  copiedId.value = null
  error.value = ''
  try {
    await navigator.clipboard.writeText(invite.deeplinkUrl)
    copiedId.value = invite.id
  } catch {
    error.value = 'Не удалось скопировать ссылку. Выделите её и скопируйте вручную.'
  }
}

async function revoke(invite: InviteRow) {
  const targetOrgId = orgId.value
  const expectedPath = path.value
  if (!canMutate(targetOrgId, expectedPath)) return
  if (!window.confirm('Отозвать ссылку? По ней больше нельзя будет вступить.')) return
  if (!canMutate(targetOrgId, expectedPath)) return
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/organizations/${targetOrgId}/invites/${invite.id}/revoke`, {
      method: 'POST',
    })
    if (alive && orgId.value === targetOrgId && isLiveDesktopRoute(route.path, expectedPath))
      await load()
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      error.value = apiErrorMessage(cause, 'Не удалось отозвать ссылку')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="vt-desktop-form-page space-y-5">
    <NuxtLink :to="`/app/orgs/${orgId}/members`" class="vt-btn vt-btn--ghost vt-btn--sm"
      >← К игрокам</NuxtLink
    >
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">Приглашения</h1>
        <p class="text-vt-mute-2">Ссылки откроют действующего бота Volley Time в Telegram.</p>
      </div>
    </header>
    <EmptyState
      v-if="!canInvite"
      icon="users"
      title="Недостаточно прав"
      description="Приглашать могут владелец и организатор группы."
    />
    <template v-else>
      <form class="vt-card vt-desktop-form-page__card space-y-4" @submit.prevent="create">
        <h2>Новая ссылка</h2>
        <div v-if="isOwner">
          <label class="vt-label" for="desktop-invite-role">Роль</label>
          <select
            id="desktop-invite-role"
            v-model="form.roleToAssign"
            class="vt-field"
            :disabled="busy"
          >
            <option value="player">Игрок</option>
            <option value="assistant">Помощник</option>
            <option value="organizer">Организатор</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="vt-label" for="desktop-invite-max">Лимит вступлений</label>
            <input
              id="desktop-invite-max"
              v-model="form.maxUses"
              class="vt-field"
              type="number"
              min="1"
              step="1"
              placeholder="Без лимита"
              :disabled="busy"
            />
          </div>
          <div>
            <label class="vt-label" for="desktop-invite-days">Срок, дней</label>
            <input
              id="desktop-invite-days"
              v-model="form.expiresInDays"
              class="vt-field"
              type="number"
              min="1"
              max="365"
              step="1"
              placeholder="Без срока"
              :disabled="busy"
            />
          </div>
        </div>
        <div>
          <label class="vt-label" for="desktop-invite-status">Новый участник</label>
          <select
            id="desktop-invite-status"
            v-model="form.defaultMemberStatus"
            class="vt-field"
            :disabled="busy"
          >
            <option value="">Как в настройках группы</option>
            <option value="active">Сразу в составе</option>
            <option value="pending">После одобрения</option>
          </select>
        </div>
        <p v-if="formError" role="alert" class="text-vt-rose-ink">{{ formError }}</p>
        <button type="submit" class="vt-btn vt-btn--primary" :disabled="busy">
          {{ busy ? 'Создаём…' : 'Создать ссылку' }}
        </button>
      </form>

      <section class="space-y-3" aria-labelledby="desktop-invites-title">
        <h2 id="desktop-invites-title">Ссылки группы</h2>
        <p v-if="error" role="alert" class="text-vt-rose-ink">{{ error }}</p>
        <SkeletonList v-if="loading" :count="2" />
        <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />
        <EmptyState v-else-if="invites.length === 0" icon="send" title="Ссылок пока нет" />
        <ul v-else class="space-y-3">
          <li v-for="invite in invites" :key="invite.id" class="vt-card p-4 space-y-3">
            <div class="vt-desktop-members__person">
              <VtChip :tone="invite.roleToAssign === 'player' ? 'default' : 'flame'">{{
                label(ROLE_LABELS, invite.roleToAssign)
              }}</VtChip>
              <span>{{ isActive(invite) ? 'Активна' : 'Неактивна' }}</span>
              <span class="text-vt-mute-2"
                >{{ invite.usesCount
                }}{{ invite.maxUses === null ? ' вступили' : ` из ${invite.maxUses}` }} ·
                {{ invite.expiresAt ? `до ${formatDay(invite.expiresAt, tz)}` : 'без срока' }}</span
              >
            </div>
            <label class="vt-label" :for="`desktop-invite-link-${invite.id}`"
              >Ссылка для Telegram</label
            >
            <input
              :id="`desktop-invite-link-${invite.id}`"
              class="vt-field"
              readonly
              :value="invite.deeplinkUrl"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <div class="vt-desktop-members__actions">
              <button
                type="button"
                class="vt-btn vt-btn--ghost vt-btn--sm"
                :disabled="busy"
                @click="copy(invite)"
              >
                {{ copiedId === invite.id ? 'Скопировано' : 'Копировать' }}
              </button>
              <button
                v-if="isActive(invite)"
                type="button"
                class="vt-btn vt-btn--danger vt-btn--sm"
                :disabled="busy"
                @click="revoke(invite)"
              >
                Отозвать
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

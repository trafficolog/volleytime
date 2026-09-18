<script setup lang="ts">
import type { InviteLink, OrganizationMember } from '@volley-time/db'
import { buildShareUrl, formatDay } from '@volley-time/shared'
import { ROLE_LABELS, label } from '~/utils/labels'
definePageMeta({ layout: 'miniapp-org', middleware: ['auth'] })

type InviteRow = InviteLink & { deeplinkUrl: string }

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const { tz } = useOrgTimezone(orgId)
const { confirm } = useTelegram()

const { data: orgData } = await useFetch<{
  organization: { name: string; defaultMemberStatus: 'active' | 'pending' }
  myMember: OrganizationMember
}>(() => `/api/organizations/${orgId.value}`)
const me = computed(() => orgData.value?.myMember ?? null)
const canInvite = computed(
  () => me.value?.status === 'active' && ['owner', 'organizer'].includes(me.value.role),
)
const isOwner = computed(() => me.value?.role === 'owner' && me.value.status === 'active')

const invites = ref<InviteRow[]>([])
const loading = ref(false)
const loadError = ref('')

async function load() {
  if (!canInvite.value) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await $fetch<{ invites: InviteRow[] }>(`/api/organizations/${orgId.value}/invites`)
    invites.value = data.invites
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось загрузить приглашения')
  } finally {
    loading.value = false
  }
}
await load()

const now = Date.now()
const isActive = (i: InviteRow) =>
  !i.isRevoked &&
  (!i.expiresAt || new Date(i.expiresAt).getTime() > now) &&
  (i.maxUses === null || i.usesCount < i.maxUses)
const activeInvites = computed(() => invites.value.filter(isActive))

// форма
const showForm = ref(false)
const form = reactive({
  roleToAssign: 'player' as 'player' | 'organizer' | 'assistant',
  maxUses: '' as string,
  expiresInDays: '7' as string,
  defaultMemberStatus: '' as '' | 'active' | 'pending',
})
const creating = ref(false)
const formError = ref('')

async function create() {
  creating.value = true
  formError.value = ''
  try {
    await $fetch(`/api/organizations/${orgId.value}/invites`, {
      method: 'POST',
      body: {
        roleToAssign: form.roleToAssign,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiresInDays: form.expiresInDays ? Number(form.expiresInDays) : undefined,
        defaultMemberStatus: form.defaultMemberStatus || undefined,
      },
    })
    showForm.value = false
    await load()
  } catch (e) {
    formError.value = apiErrorMessage(e, 'Не удалось создать ссылку')
  } finally {
    creating.value = false
  }
}

const copiedId = ref<number | null>(null)
async function copy(i: InviteRow) {
  await navigator.clipboard.writeText(i.deeplinkUrl)
  copiedId.value = i.id
  setTimeout(() => (copiedId.value = null), 1500)
}
function share(i: InviteRow) {
  const url = buildShareUrl(
    i.deeplinkUrl,
    `Присоединяйся к «${orgData.value?.organization.name}» в Volley Time`,
  )
  const tg = window.Telegram?.WebApp as { openTelegramLink?: (u: string) => void } | undefined
  if (tg?.openTelegramLink) tg.openTelegramLink(url)
  else window.open(url, '_blank', 'noopener')
}
const revoking = ref<number | null>(null)
async function revoke(i: InviteRow) {
  if (!(await confirm('Отозвать ссылку? По ней больше нельзя будет вступить.'))) return
  revoking.value = i.id
  try {
    await $fetch(`/api/organizations/${orgId.value}/invites/${i.id}/revoke`, { method: 'POST' })
    await load()
  } catch (e) {
    loadError.value = apiErrorMessage(e, 'Не удалось отозвать ссылку')
  } finally {
    revoking.value = null
  }
}

function usage(i: InviteRow) {
  return i.maxUses === null ? `${i.usesCount} вступили` : `${i.usesCount} из ${i.maxUses}`
}
function expiry(i: InviteRow) {
  if (!i.expiresAt) return 'бессрочно'
  return `до ${formatDay(i.expiresAt, tz.value)}`
}
</script>

<template>
  <div class="min-h-screen pb-20">
    <VtMiniHeader title="Пригласить игроков" :back="`/m/orgs/${orgId}`" />
    <main class="px-4 py-4 space-y-4">
      <EmptyState
        v-if="!canInvite"
        icon="users"
        title="Приглашать могут организаторы"
        description="Попросите организатора группы прислать вам ссылку для друга."
      />
      <template v-else>
        <p class="text-sm text-vt-mute-2">
          Отправьте ссылку в чат группы — игрок откроет бота и вступит в пару касаний.
        </p>

        <button
          v-if="!showForm"
          type="button"
          class="vt-btn vt-btn--primary vt-btn--full"
          @click="showForm = true"
        >
          <VtIcon name="plus" :size="16" /> Новая ссылка
        </button>

        <form v-else class="vt-card p-4 space-y-3" @submit.prevent="create">
          <div v-if="isOwner">
            <label class="vt-label" for="role">Роль</label>
            <select id="role" v-model="form.roleToAssign" class="vt-field">
              <option value="player">Игрок</option>
              <option value="assistant">Помощник</option>
              <option value="organizer">Организатор</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="vt-label" for="max">Лимит вступлений</label>
              <input
                id="max"
                v-model="form.maxUses"
                class="vt-field"
                inputmode="numeric"
                placeholder="без лимита"
              />
            </div>
            <div>
              <label class="vt-label" for="days">Срок, дней</label>
              <input
                id="days"
                v-model="form.expiresInDays"
                class="vt-field"
                inputmode="numeric"
                placeholder="бессрочно"
              />
            </div>
          </div>
          <div>
            <label class="vt-label" for="status">Новые участники</label>
            <select id="status" v-model="form.defaultMemberStatus" class="vt-field">
              <option value="">Как в настройках группы</option>
              <option value="active">Сразу в составе</option>
              <option value="pending">После одобрения</option>
            </select>
          </div>
          <p v-if="formError" class="text-sm text-vt-rose-ink" role="alert">{{ formError }}</p>
          <div class="flex gap-2">
            <button type="button" class="vt-btn vt-btn--ghost flex-1" @click="showForm = false">
              Отмена
            </button>
            <button type="submit" class="vt-btn vt-btn--primary flex-1" :disabled="creating">
              {{ creating ? 'Создаём…' : 'Создать' }}
            </button>
          </div>
        </form>

        <h2 class="vt-cap">Активные ссылки</h2>
        <p v-if="loadError" class="text-sm text-vt-rose-ink" role="alert">{{ loadError }}</p>
        <SkeletonList v-if="loading" :count="2" />
        <EmptyState
          v-else-if="activeInvites.length === 0"
          icon="send"
          title="Активных ссылок нет"
          description="Создайте ссылку, чтобы пригласить игроков"
        />
        <ul v-else class="space-y-2.5">
          <li v-for="i in activeInvites" :key="i.id" class="vt-card p-3.5">
            <div class="flex items-center gap-2 flex-wrap">
              <VtChip :tone="i.roleToAssign === 'player' ? 'default' : 'flame'">
                {{ label(ROLE_LABELS, i.roleToAssign) }}
              </VtChip>
              <VtChip v-if="i.defaultMemberStatus === 'pending'" tone="amber">с одобрением</VtChip>
              <span class="text-xs text-vt-mute-2 vt-num">{{ usage(i) }} · {{ expiry(i) }}</span>
            </div>
            <div class="vt-mono text-[11.5px] text-vt-mute-2 mt-2 break-all">
              {{ i.deeplinkUrl }}
            </div>
            <div class="flex gap-2 mt-3">
              <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm flex-1" @click="copy(i)">
                <VtIcon name="copy" :size="14" />
                {{ copiedId === i.id ? 'Скопировано' : 'Копировать' }}
              </button>
              <button
                type="button"
                class="vt-btn vt-btn--primary vt-btn--sm flex-1"
                @click="share(i)"
              >
                <VtIcon name="tg" :size="14" /> Поделиться
              </button>
              <button
                type="button"
                class="vt-btn vt-btn--danger vt-btn--sm"
                :disabled="revoking === i.id"
                aria-label="Отозвать ссылку"
                @click="revoke(i)"
              >
                <VtIcon name="trash" :size="14" />
              </button>
            </div>
          </li>
        </ul>
      </template>
    </main>
  </div>
</template>

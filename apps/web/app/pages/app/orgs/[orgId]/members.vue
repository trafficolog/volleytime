<script setup lang="ts">
import type { OrganizationMember } from '@volley-time/db'
import { formatDay, type PlayersStatsPeriod } from '@volley-time/shared'

import type { MemberRow } from '~/composables/useOrganizations'
import {
  canBlockExcludedMember,
  canExcludeMember,
  desktopMemberActions,
  type DesktopMemberAction,
} from '~/utils/desktop-member-actions'
import { isLiveDesktopRoute } from '~/utils/desktop-org-ui'
import {
  activityView,
  debtView,
  playerStatsPeriodLabel,
  subscriptionView,
} from '~/utils/desktop-players-stats'
import {
  PLAYER_FETCH_STATUSES,
  PLAYER_TABS,
  canAssignLevelTo,
  countPlayerTabs,
  filterPlayers,
  pickPlayerInvite,
  playersSubtitle,
  searchPlayers,
  type PlayersTab,
} from '~/utils/desktop-players'
import { ROLE_LABELS, displayName, label } from '~/utils/labels'
import {
  LEVEL_FILTER_ALL,
  levelFilterOptions,
  levelTitle,
  type PlayerLevelView,
} from '~/utils/player-level'
import { positionTitle } from '~/utils/player-position'

definePageMeta({ layout: 'desktop-org', middleware: ['auth'] })

type InviteRow = {
  roleToAssign: string
  isRevoked: boolean
  expiresAt: string | null
  maxUses: number | null
  usesCount: number
  deeplinkUrl: string
  type: string
  defaultMemberStatus: string
}

/** Исключённый игрок (21.2.24): участник в `left` + кто, когда и почему исключил. */
type ExcludedRow = MemberRow & {
  excludedAt: string
  excludedBy: { id: number; name: string | null; telegramUsername: string | null } | null
  reason: string | null
}

const route = useRoute()
const orgId = computed(() => Number(route.params.orgId))
const path = computed(() => `/app/orgs/${orgId.value}/members`)
const { tz } = useOrgTimezone(orgId)
const { data: orgData } = await useFetch<{
  myMember: OrganizationMember
  organization?: { defaultMemberStatus?: string }
}>(() => `/api/organizations/${orgId.value}`, { key: () => `desktop-members-org-${orgId.value}` })
const { data: levelsData } = await useFetch<{ levels: PlayerLevelView[] }>('/api/levels', {
  key: 'player-levels',
})
const levels = computed(() => levelsData.value?.levels ?? [])
const levelOptions = computed(() => levelFilterOptions(levels.value))
const actor = computed(() => orgData.value?.myMember ?? null)
const canManage = computed(
  () => actor.value?.status === 'active' && ['owner', 'organizer'].includes(actor.value.role),
)

const tab = ref<PlayersTab>('all')
const query = ref('')
const levelFilter = ref(LEVEL_FILTER_ALL)
const members = ref<MemberRow[]>([])
const excluded = ref<ExcludedRow[]>([])
/** Окно посещаемости ответа API; есть только у управляющего (агрегаты 21.2.20). */
const statsPeriod = ref<PlayersStatsPeriod | null>(null)
const showStats = computed(() => canManage.value && statsPeriod.value !== null)
const loading = ref(false)
const error = ref('')
const actionError = ref('')
const levelError = ref('')
const positionError = ref('')
const inviteNotice = ref('')
const excludeError = ref('')
const busy = ref(false)
const selectedId = ref<number | null>(null)
const selectedRoles = reactive<Record<number, 'organizer' | 'assistant' | 'player'>>({})
let generation = 0
let alive = true

const counts = computed(() => ({
  ...countPlayerTabs(members.value),
  excluded: excluded.value.length,
}))
const tabs = computed(() => PLAYER_TABS.filter((t) => t.id !== 'excluded' || canManage.value))
const subtitle = computed(() => playersSubtitle(counts.value))
const visible = computed<MemberRow[]>(() =>
  tab.value === 'excluded'
    ? searchPlayers(excluded.value, query.value)
    : filterPlayers(members.value, {
        tab: tab.value,
        query: query.value,
        level: levelFilter.value,
      }),
)
const excludedTab = computed(() => tab.value === 'excluded')
function excludedRow(member: MemberRow): ExcludedRow {
  return member as ExcludedRow
}
const selected = computed(() => members.value.find((m) => m.id === selectedId.value) ?? null)
const drawerOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) selectedId.value = null
  },
})

function actions(member: MemberRow): DesktopMemberAction[] {
  return desktopMemberActions(actor.value, {
    role: member.role,
    status: member.status,
    userId: member.user.id,
  })
}

watch(selectedId, () => {
  excludeError.value = ''
})

function memberTarget(member: MemberRow) {
  return { role: member.role, status: member.status, userId: member.user.id }
}

function canSetLevel(member: MemberRow): boolean {
  return canManage.value && canAssignLevelTo(member.status)
}

async function load() {
  const token = ++generation
  const targetOrgId = orgId.value
  loading.value = true
  error.value = ''
  members.value = []
  excluded.value = []
  statsPeriod.value = null
  selectedId.value = null
  try {
    // агрегаты игроков (посещаемость, абонемент, долг) запрашивает только управляющий
    // исключённые: отдельный запрос параллельно, статус `left` включает и вышедших добровольно (21.2.24)
    const [result, excludedResult] = await Promise.all([
      $fetch<{ members: MemberRow[]; statsPeriod?: PlayersStatsPeriod }>(
        `/api/organizations/${targetOrgId}/members`,
        {
          query: {
            statuses: PLAYER_FETCH_STATUSES.join(','),
            ...(canManage.value ? { stats: '1' } : {}),
          },
        },
      ),
      canManage.value
        ? $fetch<{ members: ExcludedRow[] }>(`/api/organizations/${targetOrgId}/members/excluded`)
        : Promise.resolve({ members: [] as ExcludedRow[] }),
    ])
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    members.value = result.members
    excluded.value = excludedResult.members
    statsPeriod.value = result.statsPeriod ?? null
    for (const member of result.members) {
      if (member.role !== 'owner') selectedRoles[member.id] = member.role
    }
  } catch (cause) {
    if (!alive || token !== generation || orgId.value !== targetOrgId) return
    error.value = apiErrorMessage(cause, 'Не удалось загрузить участников')
  } finally {
    if (alive && token === generation) loading.value = false
  }
}

watch(
  orgId,
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
    if (alive && isLiveDesktopRoute(route.path, expectedPath) && orgId.value === targetOrgId)
      await load()
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      actionError.value = apiErrorMessage(cause, 'Не удалось выполнить действие')
  } finally {
    busy.value = false
  }
}

/** «Удалить из группы» (21.2.21): подтверждение с последствиями — в карточке игрока. */
async function exclude(member: MemberRow, reason: string, block = false) {
  if (busy.value || !canExcludeMember(actor.value, memberTarget(member))) return
  const targetOrgId = orgId.value
  const expectedPath = path.value
  busy.value = true
  excludeError.value = ''
  actionError.value = ''
  inviteNotice.value = ''
  try {
    const result = await $fetch<{ cancelledBookings: number; paidSeats: number }>(
      `/api/organizations/${targetOrgId}/members/${member.id}/exclude`,
      {
        method: 'POST',
        body: { ...(reason ? { reason } : {}), ...(block ? { block: true } : {}) },
      },
    )
    if (!alive || !isLiveDesktopRoute(route.path, expectedPath) || orgId.value !== targetOrgId)
      return
    inviteNotice.value =
      `${displayName(member.user)} ${block ? 'удалён из группы и заблокирован' : 'удалён из группы'}. Отменено записей: ${result.cancelledBookings}.` +
      (result.paidSeats > 0
        ? ` Оплаченных мест: ${result.paidSeats}. Деньги вернуть нужно вручную.`
        : '')
    await load()
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      excludeError.value = apiErrorMessage(cause, 'Не удалось удалить из группы')
  } finally {
    busy.value = false
  }
}

async function setLevel(member: MemberRow, level: string | null) {
  if (busy.value || !canSetLevel(member) || level === member.level) return
  const targetOrgId = orgId.value
  const expectedPath = path.value
  busy.value = true
  levelError.value = ''
  try {
    const result = await $fetch<{ member: { level: string | null } }>(
      `/api/organizations/${targetOrgId}/members/${member.id}/level`,
      { method: 'PATCH', body: { level } },
    )
    if (alive && isLiveDesktopRoute(route.path, expectedPath) && orgId.value === targetOrgId) {
      const row = members.value.find((m) => m.id === member.id)
      if (row) row.level = result.member.level
    }
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      levelError.value = apiErrorMessage(cause, 'Не удалось назначить уровень')
  } finally {
    busy.value = false
  }
}

async function setPosition(member: MemberRow, position: string | null) {
  if (busy.value || !canSetLevel(member) || position === (member.position ?? null)) return
  const targetOrgId = orgId.value
  const expectedPath = path.value
  busy.value = true
  positionError.value = ''
  try {
    const result = await $fetch<{ member: { position: string | null } }>(
      `/api/organizations/${targetOrgId}/members/${member.id}/position`,
      { method: 'PATCH', body: { position } },
    )
    if (alive && isLiveDesktopRoute(route.path, expectedPath) && orgId.value === targetOrgId) {
      const row = members.value.find((m) => m.id === member.id)
      if (row) row.position = result.member.position
    }
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      positionError.value = apiErrorMessage(cause, 'Не удалось задать амплуа')
  } finally {
    busy.value = false
  }
}

/** «Заблокировать» исключённого игрока из вкладки «Исключённые» (21.2.24). */
async function blockExcluded(member: MemberRow) {
  if (busy.value || !canBlockExcludedMember(actor.value, memberTarget(member))) return
  if (
    !window.confirm(`Заблокировать ${displayName(member.user)}? Вернуться по ссылке он не сможет.`)
  )
    return
  const targetOrgId = orgId.value
  const expectedPath = path.value
  busy.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/organizations/${targetOrgId}/members/${member.id}/block`, { method: 'POST' })
    if (alive && isLiveDesktopRoute(route.path, expectedPath) && orgId.value === targetOrgId)
      await load()
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      actionError.value = apiErrorMessage(cause, 'Не удалось заблокировать')
  } finally {
    busy.value = false
  }
}

function openCard(member: MemberRow) {
  levelError.value = ''
  positionError.value = ''
  selectedId.value = member.id
}

/** Копирует действующую invite-ссылку для игроков; если её нет — создаёт обычную на 7 дней. */
async function copyInviteLink() {
  if (busy.value || !canManage.value) return
  const targetOrgId = orgId.value
  const expectedPath = path.value
  busy.value = true
  inviteNotice.value = ''
  actionError.value = ''
  try {
    const { invites } = await $fetch<{ invites: InviteRow[] }>(
      `/api/organizations/${targetOrgId}/invites`,
    )
    const defaultStatus = orgData.value?.organization?.defaultMemberStatus ?? 'active'
    let url = pickPlayerInvite(invites, defaultStatus)?.deeplinkUrl
    const isNew = !url
    if (!url) {
      const created = await $fetch<{ deeplinkUrl: string }>(
        `/api/organizations/${targetOrgId}/invites`,
        { method: 'POST', body: { roleToAssign: 'player', expiresInDays: 7 } },
      )
      url = created.deeplinkUrl
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      if (isNew && alive && isLiveDesktopRoute(route.path, expectedPath))
        actionError.value =
          'Новая ссылка создана, но скопировать её не удалось. Скопируйте её на странице приглашений.'
      else throw new Error('clipboard')
      return
    }
    if (alive && isLiveDesktopRoute(route.path, expectedPath) && orgId.value === targetOrgId)
      inviteNotice.value = isNew
        ? 'Создана новая ссылка на 7 дней и скопирована'
        : 'Invite-ссылка скопирована'
  } catch (cause) {
    if (alive && isLiveDesktopRoute(route.path, expectedPath))
      actionError.value = apiErrorMessage(cause, 'Не удалось скопировать invite-ссылку')
  } finally {
    busy.value = false
  }
}

function joinedLabel(member: MemberRow): string {
  const date = member.joinedAt ?? member.createdAt
  return formatDay(date, tz.value)
}

const EMPTY_TITLES: Record<PlayersTab, string> = {
  all: 'Игроков пока нет',
  active: 'В составе пока никого',
  pending: 'Новых заявок нет',
  guest: 'Гостей нет',
  blocked: 'Заблокированных нет',
  excluded: 'Исключённых нет',
}
const filtered = computed(() => query.value.trim() !== '' || levelFilter.value !== LEVEL_FILTER_ALL)
</script>

<template>
  <section class="vt-desktop-dashboard space-y-5">
    <header class="vt-desktop-dashboard__heading">
      <div>
        <p class="vt-cap">Управление группой</p>
        <h1 tabindex="-1">Игроки</h1>
        <p class="text-vt-mute-2">{{ loading ? 'Загружаем состав…' : subtitle }}</p>
      </div>
      <div class="vt-desktop-members__actions">
        <button
          v-if="canManage"
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          :disabled="busy"
          @click="copyInviteLink"
        >
          <VtIcon name="copy" :size="14" /> Скопировать invite-link
        </button>
        <NuxtLink :to="`/app/orgs/${orgId}/invite`" class="vt-btn vt-btn--primary vt-btn--sm"
          ><VtIcon name="plus" :size="14" /> Пригласить</NuxtLink
        >
      </div>
    </header>

    <div class="vt-desktop-events__filters" role="group" aria-label="Статус участников">
      <button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        class="vt-btn vt-btn--sm"
        :class="tab === item.id ? 'vt-btn--ink' : 'vt-btn--ghost'"
        :aria-pressed="tab === item.id"
        @click="tab = item.id"
      >
        {{ item.label }}
        <span
          class="vt-desktop-members__count"
          :data-attention="item.id === 'pending' && counts.pending > 0"
          >{{ counts[item.id] }}</span
        >
      </button>
    </div>

    <div class="vt-desktop-events__filters">
      <div>
        <label class="sr-only" for="players-search">Поиск игрока</label>
        <input
          id="players-search"
          v-model="query"
          class="vt-field"
          type="search"
          placeholder="Имя или @username"
          autocomplete="off"
        />
      </div>
      <div>
        <label class="sr-only" for="players-level">Уровень</label>
        <select id="players-level" v-model="levelFilter" class="vt-field">
          <option v-for="option in levelOptions" :key="option.value" :value="option.value">
            {{ option.value === LEVEL_FILTER_ALL ? 'Любой уровень' : option.label }}
          </option>
        </select>
      </div>
    </div>

    <p v-if="inviteNotice" role="status" class="text-vt-mute-2">{{ inviteNotice }}</p>
    <p v-if="actionError" role="alert" class="text-vt-rose-ink">{{ actionError }}</p>
    <SkeletonList v-if="loading" :count="3" />
    <ErrorState v-else-if="error" :message="error" @retry="load" />
    <EmptyState
      v-else-if="visible.length === 0"
      icon="users"
      :title="filtered ? 'Никого не нашли' : EMPTY_TITLES[tab]"
    />
    <div v-else class="vt-card vt-desktop-members__table-wrap">
      <table class="vt-desktop-members__table">
        <thead>
          <tr>
            <th scope="col" class="vt-cap">Игрок</th>
            <th scope="col" class="vt-cap">Телеграм</th>
            <th scope="col" class="vt-cap">Амплуа</th>
            <th scope="col" class="vt-cap">Роль</th>
            <template v-if="excludedTab">
              <th scope="col" class="vt-cap">Исключён</th>
              <th scope="col" class="vt-cap">Кем</th>
              <th scope="col" class="vt-cap">Причина</th>
            </template>
            <template v-else-if="showStats">
              <th scope="col" class="vt-cap" :title="playerStatsPeriodLabel(statsPeriod!)">
                Активность
              </th>
              <th scope="col" class="vt-cap">Абонемент</th>
              <th scope="col" class="vt-cap">Задолженность</th>
            </template>
            <th scope="col" class="vt-cap"><span class="sr-only">Действия</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="member in visible" :key="member.id">
            <td>
              <div class="vt-desktop-members__person">
                <VtAvatar :name="displayName(member.user)" :src="member.user.image" />
                <div>
                  <button
                    type="button"
                    class="vt-desktop-members__name"
                    :aria-label="`Открыть карточку: ${displayName(member.user)}`"
                    @click="openCard(member)"
                  >
                    {{ displayName(member.user) }}
                  </button>
                  <small>{{
                    levelTitle(member.level, levels)
                      ? `уровень ${levelTitle(member.level, levels)}`
                      : 'уровень не назначен'
                  }}</small>
                </div>
              </div>
            </td>
            <td class="vt-mono">
              <template v-if="member.user.telegramUsername"
                ><VtIcon name="tg" :size="11" /> @{{ member.user.telegramUsername }}</template
              >
              <span v-else class="text-vt-mute-2">—</span>
            </td>
            <td>
              <template v-if="positionTitle(member.position)">{{
                positionTitle(member.position)
              }}</template>
              <span v-else class="text-vt-mute-2">—</span>
            </td>
            <td>
              <VtChip
                :tone="
                  member.role === 'owner'
                    ? 'solid'
                    : member.role === 'organizer'
                      ? 'flame'
                      : 'default'
                "
                >{{ label(ROLE_LABELS, member.role) }}</VtChip
              >
              <VtChip
                v-if="member.status !== 'active'"
                :tone="member.status === 'pending' ? 'amber' : 'default'"
                >{{
                  member.status === 'pending'
                    ? 'Заявка'
                    : member.status === 'guest'
                      ? 'Гость'
                      : member.status === 'left'
                        ? 'Исключён'
                        : 'Заблокирован'
                }}</VtChip
              >
            </td>
            <template v-if="excludedTab">
              <td data-col="excluded-at">{{ formatDay(excludedRow(member).excludedAt, tz) }}</td>
              <td data-col="excluded-by">
                <template v-if="excludedRow(member).excludedBy">{{
                  displayName(excludedRow(member).excludedBy!)
                }}</template>
                <span v-else class="text-vt-mute-2">—</span>
              </td>
              <td data-col="excluded-reason">
                <template v-if="excludedRow(member).reason">{{
                  excludedRow(member).reason
                }}</template>
                <span v-else class="text-vt-mute-2">—</span>
              </td>
            </template>
            <template v-else-if="showStats && member.stats">
              <td data-col="activity">
                <strong>{{ activityView(member.stats, tz).visits }}</strong>
                <small class="text-vt-mute-2">{{ activityView(member.stats, tz).last }}</small>
              </td>
              <td data-col="subscription">
                <template v-if="subscriptionView(member.stats, tz)">
                  <strong>{{ subscriptionView(member.stats, tz)!.label }}</strong>
                  <small class="text-vt-mute-2">{{
                    subscriptionView(member.stats, tz)!.hint
                  }}</small>
                </template>
                <span v-else class="text-vt-mute-2">—</span>
              </td>
              <td data-col="debt">
                <template v-if="debtView(member.stats)">
                  <strong class="text-vt-rose-ink">{{ debtView(member.stats)!.label }}</strong>
                  <small class="text-vt-mute-2">{{ debtView(member.stats)!.hint }}</small>
                </template>
                <span v-else class="text-vt-mute-2">—</span>
              </td>
            </template>
            <td v-if="excludedTab">
              <button
                v-if="canBlockExcludedMember(actor, memberTarget(member))"
                type="button"
                class="vt-btn vt-btn--danger vt-btn--sm"
                data-testid="excluded-block"
                :disabled="busy"
                :aria-label="`Заблокировать: ${displayName(member.user)}`"
                @click="blockExcluded(member)"
              >
                Заблокировать
              </button>
            </td>
            <td v-else>
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
                  :class="
                    action === 'block' || action === 'reject' ? 'vt-btn--danger' : 'vt-btn--ghost'
                  "
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
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DesktopPlayerDrawer
      v-model="drawerOpen"
      :member="selected"
      :levels="levels"
      :joined="selected ? joinedLabel(selected) : ''"
      :can-set-level="selected ? canSetLevel(selected) : false"
      :actions="selected ? actions(selected) : []"
      :busy="busy"
      :level-error="levelError"
      :position-error="positionError"
      :can-exclude="selected ? canExcludeMember(actor, memberTarget(selected)) : false"
      :exclude-error="excludeError"
      :stats-period="showStats ? statsPeriod : null"
      :timezone="tz"
      @act="(action) => selected && act(selected, action)"
      @set-level="(level) => selected && setLevel(selected, level)"
      @set-position="(position) => selected && setPosition(selected, position)"
      @exclude="(reason, block) => selected && exclude(selected, reason, block)"
    />
  </section>
</template>

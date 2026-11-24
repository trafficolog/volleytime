<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import SettingsTeamRoster from './SettingsTeamRoster.vue'
import TeamSeriesDialog from './TeamSeriesDialog.vue'

import VtAlert from '~/components/vt/Alert.vue'
import VtIcon from '~/components/vt/Icon.vue'
import VtPopover, { type VtPopoverItem } from '~/components/vt/Popover.vue'
import VtSegment from '~/components/vt/Segment.vue'
import { apiErrorMessage } from '~/utils/api-error'
import { SETTING_IMPACT } from '~/utils/group-settings'
import type { OrgProfile, SettingsController } from '~/utils/group-settings-controller'
import {
  MATRIX_CELL_LABELS,
  TEAM_MATRIX,
  TEAM_MATRIX_ROLES,
  formatHistoryWhen,
  historyLine,
  teamRows,
  type RoleHistoryEntry,
  type TeamMember,
  type TeamMenuKey,
  type TeamRow,
} from '~/utils/team-settings'

/**
 * Команда (W-17, 30.1.2): таблица ролей и приёма оплаты, приглашение в команду на 24 часа, матрица
 * «Что доступно роли» и история смены ролей. Раздел видит только владелец. Передача владения идёт
 * через «Опасную зону». Ниже остаётся настройка «Новые участники» (21.2.2).
 */
const props = withDefaults(
  defineProps<{
    org: OrgProfile
    base: string
    canEdit: boolean
    controller: SettingsController
    /** Группа: нужна для запросов команды; без неё работает только блок «Новые участники». */
    orgId?: number
    timeZone?: string
  }>(),
  { orgId: undefined, timeZone: 'Europe/Minsk' },
)
const emit = defineEmits<{
  toast: [message: string, tone: 'ok' | 'danger']
  openSection: [key: 'danger']
}>()

const ALL_STATUSES = 'active,pending,guest,blocked,left,rejected'
const HISTORY_LIMIT = 20

const members = ref<TeamMember[]>([])
const loading = ref(false)
const loadError = ref('')
const history = ref<RoleHistoryEntry[]>([])
const historyError = ref('')
const busyIds = ref<number[]>([])
const removing = ref<TeamRow | null>(null)
const removeOpen = ref(false)
const seriesFor = ref<TeamRow | null>(null)
const seriesOpen = ref(false)
const inviteMenuOpen = ref(false)
const inviting = ref(false)
const inviteLink = ref('')

const api = computed(() => (props.orgId === undefined ? null : `/api/organizations/${props.orgId}`))
const rows = computed(() => teamRows(members.value))
const names = computed(() => ({
  byMemberId: new Map(members.value.map((m) => [m.id, m.user.name?.trim() || 'Участник'])),
  byUserId: new Map(members.value.map((m) => [m.user.id, m.user.name?.trim() || 'Участник'])),
}))
const historyLines = computed(() => {
  const now = new Date()
  return history.value.map((entry) => ({
    id: entry.id,
    when: formatHistoryWhen(entry.createdAt, now, props.timeZone),
    text: historyLine(entry, names.value),
  }))
})

async function loadMembers() {
  if (!api.value) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await $fetch<{ members: TeamMember[] }>(
      `${api.value}/members?statuses=${ALL_STATUSES}`,
    )
    members.value = data.members
  } catch (cause) {
    loadError.value = apiErrorMessage(cause, 'Не удалось загрузить команду')
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  if (!api.value) return
  try {
    const data = await $fetch<{ entries: RoleHistoryEntry[] }>(
      `${api.value}/audit?action=member.role_changed&entityType=member&limit=${HISTORY_LIMIT}`,
    )
    history.value = data.entries
    historyError.value = ''
  } catch (cause) {
    historyError.value = apiErrorMessage(cause, 'Не удалось загрузить историю')
  }
}

onMounted(() => {
  void loadMembers()
  void loadHistory()
})

const toast = (message: string, tone: 'ok' | 'danger' = 'ok') => emit('toast', message, tone)

/** PATCH …/members/{id}: роль и/или флаг оплаты; ответ сервера заменяет строку. */
async function patchMember(
  row: TeamRow,
  body: { role?: 'organizer' | 'coach' | 'player'; canAcceptPayment?: boolean },
  failure: string,
): Promise<boolean> {
  if (!api.value || busyIds.value.includes(row.id)) return false
  busyIds.value = [...busyIds.value, row.id]
  try {
    const data = await $fetch<{ member: Partial<TeamMember> }>(`${api.value}/members/${row.id}`, {
      method: 'PATCH',
      body,
    })
    members.value = members.value.map((m) =>
      m.id === row.id ? { ...m, ...data.member, user: m.user, leads: m.leads } : m,
    )
    void loadHistory()
    return true
  } catch (cause) {
    toast(apiErrorMessage(cause, failure), 'danger')
    return false
  } finally {
    busyIds.value = busyIds.value.filter((id) => id !== row.id)
  }
}

async function onPayment(row: TeamRow, value: boolean) {
  const ok = await patchMember(row, { canAcceptPayment: value }, 'Не удалось изменить приём оплаты')
  if (ok) {
    toast(
      value
        ? `${row.name} принимает оплату · подтверждения пойдут в кассу с именем тренера`
        : `${row.name} больше не принимает оплату`,
    )
  }
}

async function changeRole(row: TeamRow, role: 'organizer' | 'coach') {
  const ok = await patchMember(row, { role }, 'Не удалось изменить роль')
  if (ok) toast(`${row.name} · роль изменена · записано в историю`)
}

function onSelect(row: TeamRow, key: TeamMenuKey) {
  if (key === 'transfer') emit('openSection', 'danger')
  else if (key === 'makeOrganizer') void changeRole(row, 'organizer')
  else if (key === 'makeCoach') void changeRole(row, 'coach')
  else if (key === 'assignSeries') {
    seriesFor.value = row
    seriesOpen.value = true
  } else if (key === 'remove') {
    removing.value = row
    removeOpen.value = true
  }
}

async function confirmRemove() {
  const row = removing.value
  if (!row) return
  const ok = await patchMember(row, { role: 'player' }, 'Не удалось убрать из команды')
  if (ok) toast(`${row.name} теперь игрок`)
  removing.value = null
}

const INVITE_ITEMS: VtPopoverItem[] = [
  { key: 'coach', label: 'Пригласить тренером' },
  { key: 'organizer', label: 'Пригласить организатором' },
]

/** Ссылка в команду: одно вступление, действует сутки (24 ч), вступивший сразу в составе. */
async function invite(item: VtPopoverItem) {
  if (!api.value || inviting.value) return
  inviting.value = true
  inviteLink.value = ''
  try {
    const data = await $fetch<{ deeplinkUrl: string }>(`${api.value}/invites`, {
      method: 'POST',
      body: {
        roleToAssign: item.key,
        expiresInDays: 1,
        maxUses: 1,
        defaultMemberStatus: 'active',
      },
    })
    try {
      await navigator.clipboard.writeText(data.deeplinkUrl)
      toast('Ссылка-приглашение в команду скопирована · действует 24 ч')
    } catch {
      inviteLink.value = data.deeplinkUrl
      toast('Ссылка создана, но не скопировалась: скопируйте её вручную', 'danger')
    }
  } catch (cause) {
    toast(apiErrorMessage(cause, 'Не удалось создать приглашение'), 'danger')
  } finally {
    inviting.value = false
  }
}

function chooseStatus(value: string) {
  if (!props.canEdit) return
  if (value === props.org.defaultMemberStatus) return
  void props.controller.setMemberStatus(value as OrgProfile['defaultMemberStatus'])
}
</script>

<template>
  <div class="vt-settings-stack">
    <template v-if="orgId !== undefined">
      <section class="vt-card vt-settings-card" aria-labelledby="team-title">
        <div class="vt-settings-card__head">
          <div>
            <h2 id="team-title" class="vt-settings-card__title">Команда</h2>
            <p class="vt-settings-hint vt-team-lead">
              Кто управляет группой и ведёт тренировки. Роли действуют только в этой группе. Любой
              из команды может записываться на игры как игрок.
            </p>
          </div>
          <VtPopover
            v-if="canEdit"
            v-model="inviteMenuOpen"
            align="right"
            label="Пригласить в команду"
            :items="INVITE_ITEMS"
            @select="invite"
          >
            <template #trigger="{ toggle, attrs }">
              <button
                type="button"
                v-bind="attrs"
                class="vt-btn vt-btn--primary vt-btn--sm"
                :disabled="inviting"
                @click="toggle"
              >
                <VtIcon name="plus" :size="14" /> Пригласить
              </button>
            </template>
          </VtPopover>
        </div>
        <div v-if="inviteLink" class="vt-settings-copy">
          <input
            class="vt-field"
            readonly
            :value="inviteLink"
            aria-label="Ссылка-приглашение в команду"
            @focus="($event.target as HTMLInputElement).select()"
          />
        </div>

        <p v-if="loading && rows.length === 0" role="status" class="vt-settings-hint">
          Загружаем команду…
        </p>
        <div v-else-if="loadError" class="vt-settings-load-error">
          <p role="alert" class="vt-settings-error vt-settings-error--form">{{ loadError }}</p>
          <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="loadMembers">
            Повторить
          </button>
        </div>
        <SettingsTeamRoster
          v-else
          :rows="rows"
          :time-zone="timeZone"
          :busy-ids="busyIds"
          @payment="onPayment"
          @select="onSelect"
        />
      </section>

      <section class="vt-card vt-settings-card" aria-labelledby="team-matrix-title">
        <h2 id="team-matrix-title" class="vt-settings-card__title">Что доступно роли</h2>
        <div class="vt-team-scroll">
          <table class="vt-team-table vt-team-matrix">
            <thead>
              <tr>
                <th scope="col"><span class="sr-only">Возможность</span></th>
                <th v-for="role in TEAM_MATRIX_ROLES" :key="role" scope="col" class="vt-cap">
                  {{ role }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in TEAM_MATRIX" :key="row.title">
                <th scope="row">{{ row.title }}</th>
                <td v-for="(cell, i) in row.cells" :key="i" :data-cell="cell">
                  <span
                    v-if="cell === 'yes'"
                    class="vt-team-dot"
                    role="img"
                    :aria-label="MATRIX_CELL_LABELS.yes"
                  />
                  <span
                    v-else-if="cell === 'no'"
                    class="vt-team-muted"
                    :aria-label="MATRIX_CELL_LABELS.no"
                    >—</span
                  >
                  <span v-else class="vt-team-note">{{ MATRIX_CELL_LABELS[cell] }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="vt-card vt-settings-card" aria-labelledby="team-history-title">
        <h2 id="team-history-title" class="vt-settings-card__title">История изменений</h2>
        <p v-if="historyError" role="alert" class="vt-settings-error vt-settings-error--form">
          {{ historyError }}
        </p>
        <p v-else-if="historyLines.length === 0" class="vt-settings-hint">
          Изменений ролей пока не было.
        </p>
        <ul v-else class="vt-settings-list">
          <li
            v-for="line in historyLines"
            :key="line.id"
            class="vt-settings-list__item vt-team-history"
          >
            <span class="vt-mono vt-team-history__when">{{ line.when }}</span>
            <span>{{ line.text }}</span>
          </li>
        </ul>
      </section>
    </template>

    <section class="vt-card vt-settings-card">
      <h2 class="vt-settings-card__title">Новые участники</h2>
      <div class="vt-settings-field">
        <VtSegment
          :model-value="org.defaultMemberStatus"
          :readonly="!canEdit"
          label="Новые участники"
          :options="[
            {
              value: 'active',
              label: 'Сразу в составе',
              disabled: controller.isPending('defaultMemberStatus'),
            },
            {
              value: 'pending',
              label: 'После одобрения',
              disabled: controller.isPending('defaultMemberStatus'),
            },
          ]"
          @update:model-value="chooseStatus"
        />
        <p class="vt-settings-hint">{{ SETTING_IMPACT.defaultMemberStatus }}</p>
      </div>
      <p class="vt-settings-hint">
        Игроков и заявки ведёт страница «Игроки»; ссылки для игроков создаются на странице
        «Приглашения».
      </p>
      <div class="vt-settings-actions vt-settings-actions--start">
        <NuxtLink :to="`${base}/members`" class="vt-btn vt-btn--ghost vt-btn--sm">Игроки</NuxtLink>
        <NuxtLink :to="`${base}/invite`" class="vt-btn vt-btn--ghost vt-btn--sm">
          Приглашения
        </NuxtLink>
      </div>
    </section>

    <VtAlert
      v-model="removeOpen"
      :title="`Убрать ${removing?.name ?? ''} из команды?`"
      body="Человек останется в группе игроком и потеряет доступ организатора или тренера. События, где он был назначен тренером, останутся без действующего тренера."
      confirm-label="Убрать"
      danger
      @confirm="confirmRemove"
    />
    <TeamSeriesDialog
      v-if="orgId !== undefined"
      v-model="seriesOpen"
      :org-id="orgId"
      :member="seriesFor"
      :members="members"
      :time-zone="timeZone"
      @toast="toast"
      @assigned="loadMembers"
    />
  </div>
</template>

<script setup lang="ts">
import type { PlatformRole, PlatformStaffList, PlatformStaffMember } from '@volley-time/shared'
import { PLATFORM_ROLES } from '@volley-time/shared'
import { computed, onMounted, ref } from 'vue'

import StaffDialog, { type StaffDialogResult } from '~/components/root/StaffDialog.vue'
import VtAvatar from '~/components/vt/Avatar.vue'
import VtChip from '~/components/vt/Chip.vue'
import VtIcon from '~/components/vt/Icon.vue'
import VtPopover, { type VtPopoverItem } from '~/components/vt/Popover.vue'
import { PERMISSION_ROWS, permissionCell, roleInfo } from '~/utils/root-team'

/**
 * «Настройки → Команда & роли» (29.3.1, R-15): члены команды платформы, приглашение, смена роли,
 * удаление и матрица прав по ролям. Доступно только Owner: сервер проверяет роль на каждом запросе.
 */
const props = defineProps<{ selfId: number }>()
const emit = defineEmits<{ 'self-changed': [reason: 'role' | 'removed'] }>()

const API = '/api/platform/staff'
const toast = useToast()

const members = ref<PlatformStaffMember[] | null>(null)
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    members.value = (await $fetch<PlatformStaffList>(API)).members
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(() => void load())

const LAST_OWNER_HINT = 'Последнего Owner нельзя понизить или удалить'

/** Единственный Owner: сервер откажет (409), поэтому действия над ним недоступны сразу. */
const soleOwnerId = computed(() => {
  const owners = (members.value ?? []).filter((m) => m.role === 'owner')
  return owners.length === 1 ? owners[0]!.userId : null
})

function menuFor(member: PlatformStaffMember): VtPopoverItem[] {
  const locked = member.userId === soleOwnerId.value
  const hint = locked ? LAST_OWNER_HINT : undefined
  return [
    { key: 'role', label: 'Изменить роль', disabled: locked, hint },
    {
      key: 'remove',
      label: 'Удалить из команды',
      tone: 'danger',
      separator: true,
      disabled: locked,
      hint,
    },
  ]
}

const menuOpenId = ref<number | null>(null)
const dialogOpen = ref(false)
const dialogKind = ref<'invite' | 'role' | 'remove'>('invite')
const target = ref<PlatformStaffMember | null>(null)

function openDialog(kind: 'invite' | 'role' | 'remove', member: PlatformStaffMember | null) {
  dialogKind.value = kind
  target.value = member
  dialogOpen.value = true
}

function onSelect(member: PlatformStaffMember, item: VtPopoverItem) {
  openDialog(item.key === 'remove' ? 'remove' : 'role', member)
}

function onDone(result: StaffDialogResult) {
  const list = members.value ?? []
  if (result.kind === 'invite') {
    members.value = [...list, result.member]
    toast.show(`В команде: ${result.member.name}`)
  } else if (result.kind === 'role') {
    members.value = list.map((m) => (m.userId === result.member.userId ? result.member : m))
    toast.show(`${result.member.name}: ${roleInfo(result.member.role).label}`)
    if (result.member.userId === props.selfId) emit('self-changed', 'role')
  } else {
    const gone = list.find((m) => m.userId === result.userId)
    members.value = list.filter((m) => m.userId !== result.userId)
    toast.show(`Удалено из команды: ${gone?.name ?? ''}`)
    if (result.userId === props.selfId) emit('self-changed', 'removed')
  }
}

const contact = (m: PlatformStaffMember) =>
  m.email ?? (m.telegramUsername ? `@${m.telegramUsername}` : '—')
const since = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Europe/Minsk' })
const roles = computed<readonly PlatformRole[]>(() => PLATFORM_ROLES)
const TONES: Record<PlatformRole, 'solid' | 'flame' | 'amber' | 'grass' | 'default'> = {
  owner: 'solid',
  admin: 'flame',
  finance: 'amber',
  moderator: 'default',
  support: 'grass',
  analyst: 'default',
}
</script>

<template>
  <section class="vt-card vt-root-billing__card vt-root-team" aria-labelledby="settings-team">
    <p v-if="loading && !members" class="vt-root-billing__hint">Загружаем команду…</p>
    <ErrorState
      v-else-if="failed && !members"
      message="Не удалось загрузить команду"
      @retry="load()"
    />
    <template v-else>
      <header class="vt-root-team__head">
        <div>
          <h2 id="settings-team">Команда платформы</h2>
          <p class="vt-root-billing__hint">
            Одна роль на человека · 2FA обязательна для всех · каждое действие — в аудит
          </p>
        </div>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          data-testid="staff-invite"
          @click="openDialog('invite', null)"
        >
          <VtIcon name="plus" :size="13" /> Пригласить
        </button>
      </header>

      <div class="vt-team-scroll">
        <table class="vt-team-table">
          <thead>
            <tr>
              <th scope="col" class="vt-cap">Человек</th>
              <th scope="col" class="vt-cap">Роль</th>
              <th scope="col" class="vt-cap">Пригласил</th>
              <th scope="col" class="vt-team-table__actions">
                <span class="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.userId" :data-testid="`staff-row-${m.userId}`">
              <td>
                <span class="vt-team-person">
                  <VtAvatar :name="m.name" size="sm" />
                  <span class="vt-root-team__who">
                    <span class="vt-team-person__name">
                      {{ m.name }}
                      <VtChip v-if="m.userId === selfId">вы</VtChip>
                    </span>
                    <span class="vt-mono vt-team-muted">{{ contact(m) }}</span>
                  </span>
                </span>
              </td>
              <td>
                <VtChip :tone="TONES[m.role]">{{ roleInfo(m.role).label }}</VtChip>
              </td>
              <td>
                <span class="vt-root-team__who">
                  <span>{{ m.invitedBy?.name ?? '—' }}</span>
                  <span class="vt-team-muted">с {{ since(m.createdAt) }}</span>
                </span>
              </td>
              <td class="vt-team-table__actions">
                <VtPopover
                  :model-value="menuOpenId === m.userId"
                  align="right"
                  fixed
                  :label="`Действия: ${m.name}`"
                  :items="menuFor(m)"
                  @update:model-value="(v: boolean) => (menuOpenId = v ? m.userId : null)"
                  @select="(item) => onSelect(m, item)"
                >
                  <template #trigger="{ toggle, attrs }">
                    <button
                      type="button"
                      v-bind="attrs"
                      class="vt-btn vt-btn--ghost vt-btn--sm"
                      :aria-label="`Действия с ${m.name}`"
                      @click="toggle"
                    >
                      <VtIcon name="more" :size="16" />
                    </button>
                  </template>
                </VtPopover>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="vt-root-team__matrix">
        <div class="vt-root-team__matrix-head">
          <h3 class="vt-cap">Матрица ролей</h3>
          <span class="vt-team-muted">Разделы без доступа скрыты из меню</span>
        </div>
        <div class="vt-team-scroll">
          <table class="vt-team-table vt-team-matrix" aria-label="Матрица ролей">
            <thead>
              <tr>
                <th scope="col" class="vt-cap">Право</th>
                <th v-for="r in roles" :key="r" scope="col" class="vt-cap">
                  {{ roleInfo(r).label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in PERMISSION_ROWS" :key="row.label">
                <th scope="row">{{ row.label }}</th>
                <td v-for="r in roles" :key="r">
                  <template v-for="cell in [permissionCell(row, r)]" :key="cell">
                    <template v-if="cell === 'full'">
                      <VtIcon name="check" :size="14" class="vt-root-team__ok" />
                      <span class="sr-only">есть</span>
                    </template>
                    <span v-else-if="cell === 'none'" class="vt-team-muted">
                      —<span class="sr-only">нет</span>
                    </span>
                    <span v-else class="vt-team-muted">{{
                      cell === 'view' ? 'просмотр' : cell
                    }}</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <StaffDialog
      v-model="dialogOpen"
      :kind="dialogKind"
      :member="target"
      @done="onDone"
      @stale="load()"
    />
  </section>
</template>

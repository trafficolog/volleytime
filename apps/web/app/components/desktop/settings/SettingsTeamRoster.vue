<script setup lang="ts">
import { ref } from 'vue'

import VtAvatar from '~/components/vt/Avatar.vue'
import VtChip from '~/components/vt/Chip.vue'
import VtIcon from '~/components/vt/Icon.vue'
import VtPopover, { type VtPopoverItem } from '~/components/vt/Popover.vue'
import VtToggle from '~/components/vt/Toggle.vue'
import { ROLE_LABELS } from '~/utils/labels'
import {
  leadsLines,
  teamMenuItems,
  type TeamMenuKey,
  type TeamRole,
  type TeamRow,
} from '~/utils/team-settings'

/**
 * Таблица команды (W-17, 30.1.2): человек, роли, что ведёт, приём оплаты (переключатель только у
 * тренера) и меню действий. Только отображение: запросы и подтверждения — у `SettingsTeam`.
 */
defineProps<{ rows: TeamRow[]; timeZone: string; busyIds: number[] }>()
const emit = defineEmits<{
  payment: [row: TeamRow, value: boolean]
  select: [row: TeamRow, key: TeamMenuKey]
}>()

const ROLE_TONES: Record<string, 'solid' | 'flame' | 'grass' | 'default'> = {
  owner: 'solid',
  organizer: 'flame',
  coach: 'grass',
  player: 'default',
}

const menuOpenId = ref<number | null>(null)

const isCoach = (role: TeamRole) => role === 'coach'

function onSelect(row: TeamRow, item: VtPopoverItem) {
  emit('select', row, item.key as TeamMenuKey)
}
</script>

<template>
  <div class="vt-team-scroll">
    <table class="vt-team-table">
      <thead>
        <tr>
          <th scope="col" class="vt-cap">Человек</th>
          <th scope="col" class="vt-cap">Роли</th>
          <th scope="col" class="vt-cap">Ведёт</th>
          <th scope="col" class="vt-cap">Приём оплаты</th>
          <th scope="col" class="vt-team-table__actions"><span class="sr-only">Действия</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" :data-role="row.role">
          <td>
            <span class="vt-team-person">
              <VtAvatar :name="row.name" :src="row.image" size="sm" />
              <span class="vt-team-person__name">{{ row.name }}</span>
            </span>
          </td>
          <td>
            <span class="vt-team-roles">
              <VtChip v-for="role in row.roles" :key="role" :tone="ROLE_TONES[role] ?? 'default'">
                {{ ROLE_LABELS[role] ?? role }}
              </VtChip>
            </span>
          </td>
          <td>
            <div class="vt-team-leads">
              <span
                v-for="line in leadsLines(row.role, row.leads, timeZone)"
                :key="line"
                :class="{ 'vt-team-muted': line === '—' }"
                >{{ line }}</span
              >
            </div>
          </td>
          <td>
            <span v-if="isCoach(row.role)" class="vt-team-pay">
              <VtToggle
                :model-value="row.canAcceptPayment"
                :label="`Приём оплаты · ${row.name}`"
                :disabled="busyIds.includes(row.id)"
                @update:model-value="(value: boolean) => emit('payment', row, value)"
              />
              <span class="vt-team-muted">{{ row.canAcceptPayment ? 'разрешено' : 'нет' }}</span>
            </span>
            <span v-else class="vt-team-muted">по роли</span>
          </td>
          <td class="vt-team-table__actions">
            <VtPopover
              :model-value="menuOpenId === row.id"
              align="right"
              fixed
              :label="`Действия: ${row.name}`"
              :items="teamMenuItems(row.role)"
              @update:model-value="(v: boolean) => (menuOpenId = v ? row.id : null)"
              @select="(item) => onSelect(row, item)"
            >
              <template #trigger="{ toggle, attrs }">
                <button
                  type="button"
                  v-bind="attrs"
                  class="vt-btn vt-btn--ghost vt-btn--sm"
                  :aria-label="`Действия с участником ${row.name}`"
                  :disabled="busyIds.includes(row.id)"
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
</template>

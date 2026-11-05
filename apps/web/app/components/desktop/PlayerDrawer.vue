<script setup lang="ts">
import type { MemberRow } from '~/composables/useOrganizations'
import type { DesktopMemberAction } from '~/utils/desktop-member-actions'
import { telegramChatUrl } from '~/utils/desktop-players'
import { MEMBER_STATUS_LABELS, ROLE_LABELS, displayName, label } from '~/utils/labels'
import type { PlayerLevelView } from '~/utils/player-level'
import { PLAYER_POSITIONS, positionTitle } from '~/utils/player-position'

/**
 * Карточка игрока (W-06): боковая панель с профилем, уровнем и модерацией.
 * Точка расширения: слот `stats` — статистика игрока (Активность / Абонемент / Задолженность)
 * появится вместе с API статистики игроков (отдельная карточка).
 */
const open = defineModel<boolean>({ default: false })
const props = defineProps<{
  member: MemberRow | null
  levels: PlayerLevelView[]
  /** Дата вступления, уже отформатированная в часовом поясе группы. */
  joined: string
  /** Может ли текущий пользователь менять уровень (владелец/организатор, статус допускает). */
  canSetLevel: boolean
  /** Допустимые модерационные действия над участником. */
  actions: DesktopMemberAction[]
  busy: boolean
  levelError: string
  positionError?: string
}>()
const emit = defineEmits<{
  act: [action: DesktopMemberAction]
  setLevel: [level: string | null]
  setPosition: [position: string | null]
}>()

const moderation = computed(() => props.actions.filter((a) => a !== 'changeRole'))
const chatUrl = computed(() => telegramChatUrl(props.member?.user.telegramUsername))
const levelValue = computed(() => props.member?.level ?? '')

const ACTION_LABELS: Record<Exclude<DesktopMemberAction, 'changeRole'>, string> = {
  approve: 'Принять',
  reject: 'Отклонить',
  block: 'Заблокировать',
  unblock: 'Разблокировать',
}

const positionValue = computed(() => props.member?.position ?? '')

function onLevel(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('setLevel', value === '' ? null : value)
}

function onPosition(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('setPosition', value === '' ? null : value)
}
</script>

<template>
  <VtSheet id="vt-player-drawer" v-model="open" :title="member ? displayName(member.user) : ''">
    <div v-if="member" class="vt-player-drawer">
      <div class="vt-player-drawer__head">
        <VtAvatar :name="displayName(member.user)" :src="member.user.image" size="lg" />
        <div>
          <p v-if="member.user.telegramUsername" class="vt-player-drawer__handle">
            @{{ member.user.telegramUsername }}
          </p>
          <VtChip
            :tone="
              member.role === 'owner' ? 'solid' : member.role === 'organizer' ? 'flame' : 'default'
            "
            >{{ label(ROLE_LABELS, member.role) }}</VtChip
          >
        </div>
      </div>

      <dl class="vt-player-drawer__facts">
        <div>
          <dt>Статус</dt>
          <dd>{{ label(MEMBER_STATUS_LABELS, member.status) }}</dd>
        </div>
        <div>
          <dt>В группе с</dt>
          <dd>{{ joined }}</dd>
        </div>
      </dl>

      <div>
        <label v-if="canSetLevel" class="vt-label" for="player-drawer-level">Уровень</label>
        <p v-else class="vt-label">Уровень</p>
        <select
          v-if="canSetLevel"
          id="player-drawer-level"
          class="vt-field"
          :value="levelValue"
          :disabled="busy"
          @change="onLevel"
        >
          <option value="">Не назначен</option>
          <option v-for="level in levels" :key="level.code" :value="level.code">
            {{ level.title }}
          </option>
        </select>
        <p v-else class="vt-player-drawer__value">
          {{ levels.find((l) => l.code === member?.level)?.title ?? 'Не назначен' }}
        </p>
        <p v-if="levelError" role="alert" class="text-vt-rose-ink">{{ levelError }}</p>
      </div>

      <div>
        <label v-if="canSetLevel" class="vt-label" for="player-drawer-position">Амплуа</label>
        <p v-else class="vt-label">Амплуа</p>
        <select
          v-if="canSetLevel"
          id="player-drawer-position"
          class="vt-field"
          :value="positionValue"
          :disabled="busy"
          @change="onPosition"
        >
          <option value="">Не задано</option>
          <option v-for="position in PLAYER_POSITIONS" :key="position.code" :value="position.code">
            {{ position.title }}
          </option>
        </select>
        <p v-else class="vt-player-drawer__value">
          {{ positionTitle(member?.position) ?? 'Не задано' }}
        </p>
        <p v-if="positionError" role="alert" class="text-vt-rose-ink">{{ positionError }}</p>
      </div>

      <!-- Статистика игрока: активность, абонемент, задолженность — отдельная карточка. -->
      <slot name="stats" :member="member" />

      <div class="vt-player-drawer__actions">
        <a
          v-if="chatUrl"
          :href="chatUrl"
          class="vt-btn vt-btn--ghost vt-btn--sm"
          target="_blank"
          rel="noopener noreferrer"
          >Написать в Telegram</a
        >
        <button
          v-for="action in moderation"
          :key="action"
          type="button"
          class="vt-btn vt-btn--sm"
          :class="action === 'block' || action === 'reject' ? 'vt-btn--danger' : 'vt-btn--ghost'"
          :disabled="busy"
          @click="emit('act', action)"
        >
          {{ ACTION_LABELS[action] }}
        </button>
      </div>
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="open = false">
        Закрыть
      </button>
    </div>
  </VtSheet>
</template>

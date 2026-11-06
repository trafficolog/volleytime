<script setup lang="ts">
import type { PlayersStatsPeriod } from '@volley-time/shared'

import type { MemberRow } from '~/composables/useOrganizations'
import type { DesktopMemberAction } from '~/utils/desktop-member-actions'
import { telegramChatUrl } from '~/utils/desktop-players'
import {
  activityView,
  debtView,
  playerStatsPeriodLabel,
  subscriptionView,
} from '~/utils/desktop-players-stats'
import { MEMBER_STATUS_LABELS, ROLE_LABELS, displayName, label } from '~/utils/labels'
import type { PlayerLevelView } from '~/utils/player-level'
import { PLAYER_POSITIONS, positionTitle } from '~/utils/player-position'

/**
 * Карточка игрока (W-06): боковая панель с профилем, уровнем и модерацией.
 * Статистика игрока (21.2.20: активность, абонемент, задолженность) показывается управляющему,
 * если `member.stats` пришла из API; слот `stats` переопределяет блок.
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
  /** Можно ли исключить игрока из группы (21.2.21): владелец/организатор, не владелец и не он сам. */
  canExclude?: boolean
  /** Ошибка исключения (ответ API). */
  excludeError?: string
  /** Период посещаемости ответа API (локальные даты группы); без него подпись периода не рисуется. */
  statsPeriod?: PlayersStatsPeriod | null
  /** Часовой пояс группы для дат статистики. */
  timezone?: string
}>()
const emit = defineEmits<{
  act: [action: DesktopMemberAction]
  setLevel: [level: string | null]
  setPosition: [position: string | null]
  exclude: [reason: string]
}>()

/** Подтверждение исключения: последствия перечислены до действия (21.2.21). */
const confirmingExclude = ref(false)
const excludeReason = ref('')
watch(
  () => props.member?.id,
  () => {
    confirmingExclude.value = false
    excludeReason.value = ''
  },
)

function confirmExclude() {
  emit('exclude', excludeReason.value.trim())
}

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

const tz = computed(() => props.timezone ?? 'Europe/Minsk')
const activity = computed(() =>
  props.member?.stats ? activityView(props.member.stats, tz.value) : null,
)
const subscription = computed(() =>
  props.member?.stats ? subscriptionView(props.member.stats, tz.value) : null,
)
const debt = computed(() => (props.member?.stats ? debtView(props.member.stats) : null))

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

      <slot name="stats" :member="member">
        <section
          v-if="member.stats && activity"
          class="vt-player-drawer__stats"
          aria-label="Статистика"
        >
          <p v-if="statsPeriod" class="vt-cap">
            Статистика · {{ playerStatsPeriodLabel(statsPeriod) }}
          </p>
          <dl class="vt-player-drawer__facts">
            <div>
              <dt>Тренировок</dt>
              <dd data-stat="visits">{{ member.stats.attendance.visits }}</dd>
            </div>
            <div>
              <dt>Посещаемость</dt>
              <dd data-stat="rate">{{ activity.rate }}</dd>
            </div>
            <div>
              <dt>Неявки</dt>
              <dd data-stat="no-shows">{{ member.stats.attendance.noShows }}</dd>
            </div>
            <div>
              <dt>Отмены</dt>
              <dd data-stat="cancellations">{{ member.stats.attendance.cancellations }}</dd>
            </div>
            <div>
              <dt>Последний визит</dt>
              <dd data-stat="last">{{ activity.lastDate }}</dd>
            </div>
            <div>
              <dt>Абонемент</dt>
              <dd data-stat="subscription">
                <template v-if="subscription"
                  >{{ subscription.label }} <small>{{ subscription.hint }}</small></template
                >
                <template v-else>—</template>
              </dd>
            </div>
            <div>
              <dt>Задолженность</dt>
              <dd data-stat="debt" :data-debt="debt !== null">
                <template v-if="debt"
                  >{{ debt.label }} <small>{{ debt.hint }}</small></template
                >
                <template v-else>Нет</template>
              </dd>
            </div>
          </dl>
        </section>
      </slot>

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
      <section
        v-if="canExclude"
        class="vt-player-drawer__exclude"
        aria-label="Удаление из группы"
        data-testid="player-exclude"
      >
        <button
          v-if="!confirmingExclude"
          type="button"
          class="vt-btn vt-btn--danger vt-btn--sm"
          :disabled="busy"
          @click="confirmingExclude = true"
        >
          Удалить из группы
        </button>
        <div v-else>
          <p class="vt-label">Удалить {{ displayName(member.user) }} из группы?</p>
          <ul class="vt-player-drawer__consequences">
            <li>Будущие записи игрока отменятся, места освободятся, очередь сдвинется.</li>
            <li>Оплаченные места автоматически не возвращаются: деньги нужно вернуть вручную.</li>
            <li>
              Игрок будет снят с листов ожидания, его неиспользованные ссылки-приглашения отзовутся.
            </li>
            <li>Абонемент останется за игроком и заработает снова, если он вернётся.</li>
            <li>Долг и ожидающие оплаты останутся в кассе, ничего не списывается.</li>
            <li>
              Игрок получит уведомление. Это не блокировка: вернуться можно по новому приглашению.
            </li>
          </ul>
          <label class="vt-label" for="player-drawer-exclude-reason">Причина (для журнала)</label>
          <input
            id="player-drawer-exclude-reason"
            v-model="excludeReason"
            class="vt-field"
            type="text"
            maxlength="500"
            :disabled="busy"
          />
          <div class="vt-player-drawer__actions">
            <button
              type="button"
              class="vt-btn vt-btn--danger vt-btn--sm"
              :disabled="busy"
              @click="confirmExclude"
            >
              Удалить из группы
            </button>
            <button
              type="button"
              class="vt-btn vt-btn--ghost vt-btn--sm"
              :disabled="busy"
              @click="confirmingExclude = false"
            >
              Отмена
            </button>
          </div>
        </div>
        <p v-if="excludeError" role="alert" class="text-vt-rose-ink">{{ excludeError }}</p>
      </section>
      <button type="button" class="vt-btn vt-btn--ghost vt-btn--sm" @click="open = false">
        Закрыть
      </button>
    </div>
  </VtSheet>
</template>

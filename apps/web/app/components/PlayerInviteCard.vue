<script setup lang="ts">
import { computed } from 'vue'

import { displayName } from '~/utils/labels'
import {
  inviteExpiryLabel,
  inviteSentLabel,
  organizerLine,
  type InviteAccessView,
  type InviteState,
} from '~/utils/player-invite'

/**
 * Запись по приглашению (M-08, 20.4.7, D-06): четыре состояния события «по приглашению» —
 * «без приглашения», «запрос отправлен», «приглашён», «ссылка просрочена» — по четырём экранам,
 * утверждённым владельцем 2026-10-20. Карточка и кнопки; запросы к API и часы — на странице.
 * Кнопка «Записаться» для приглашённого игрока — обычная кнопка записи страницы события.
 */
const props = defineProps<{
  /** Что рисовать: карточку состояния или кнопки (в макете между ними — состав); по умолчанию всё. */
  part?: 'card' | 'actions'
  state: InviteState
  access: InviteAccessView
  tz: string
  now: Date
  busy?: boolean
  /** Куда ведёт «Другие события группы». */
  eventsHref: string
}>()
const emit = defineEmits<{ request: []; withdraw: [] }>()

const steps = computed(() => [
  {
    title: 'Запрос отправлен',
    hint: props.access.request
      ? inviteSentLabel(props.access.request.createdAt, props.now, props.tz)
      : '',
    done: true,
  },
  { title: 'Организатор рассматривает', hint: 'обычно отвечает за несколько часов', done: false },
  { title: 'Ответ придёт в бот', hint: 'и появится здесь', done: false },
])
const expiry = computed(() =>
  props.access.invite?.expiresAt
    ? inviteExpiryLabel(props.access.invite.expiresAt, props.tz)
    : null,
)
const inviterName = computed(() =>
  props.access.invite?.inviter ? displayName(props.access.invite.inviter) : 'Организатор',
)
const inviteHow = computed(() =>
  props.access.invite?.source === 'request'
    ? 'по вашему запросу'
    : props.access.invite?.source === 'previous'
      ? 'по прежнему приглашению'
      : 'по личной ссылке',
)
</script>

<template>
  <div class="space-y-3" data-invite-card :data-invite-state="state">
    <template v-if="part !== 'actions'">
      <section
        v-if="state === 'none'"
        class="vt-card flex items-start gap-2.5 p-3.5"
        aria-labelledby="invite-title"
      >
        <VtIcon name="lock" :size="14" class="shrink-0 mt-0.5 text-vt-mute-2" />
        <div class="min-w-0">
          <h3 id="invite-title" class="text-[13px] font-semibold">Запись по приглашению</h3>
          <p class="text-xs text-vt-mute-2 mt-1">
            Организатор сам решает, кто играет в этот раз. Отправьте запрос — ответ придёт в бот.
          </p>
        </div>
      </section>

      <section
        v-else-if="state === 'requested'"
        class="vt-card p-4"
        role="status"
        aria-labelledby="invite-title"
      >
        <h3 id="invite-title" class="vt-cap text-vt-mute-2">Ваш запрос</h3>
        <ol class="mt-3 space-y-2.5">
          <li
            v-for="(step, i) in steps"
            :key="step.title"
            class="flex items-start gap-2.5"
            :aria-current="i === 0 ? 'step' : undefined"
          >
            <span
              class="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
              :class="step.done ? 'bg-vt-amber' : 'bg-vt-stroke'"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <p class="text-[13px] font-semibold" :class="step.done ? '' : 'text-vt-ink-3'">
                {{ step.title }}
              </p>
              <p v-if="step.hint" class="text-[11px] text-vt-mute-2">{{ step.hint }}</p>
            </div>
          </li>
        </ol>
        <div class="vt-divider my-3" />
        <div class="flex items-center gap-2 min-w-0">
          <VtAvatar
            size="sm"
            :name="displayName(access.organizer ?? {})"
            :src="access.organizer?.image"
          />
          <span class="text-[13px] truncate">{{ organizerLine(access.organizer) }}</span>
        </div>
      </section>

      <section
        v-else-if="state === 'invited'"
        class="vt-card p-4"
        role="status"
        aria-labelledby="invite-title"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <VtAvatar size="sm" :name="inviterName" :src="access.invite?.inviter?.image" />
          <div class="min-w-0 flex-1">
            <h3 id="invite-title" class="text-[13px] font-semibold truncate">
              {{ inviterName }} пригласил вас
            </h3>
            <p class="text-[11px] text-vt-mute-2">{{ inviteHow }}</p>
          </div>
          <VtIcon name="check" :size="16" class="shrink-0 text-vt-grass-ink" />
        </div>
        <p class="text-xs text-vt-mute-2 mt-3">
          Ссылка одноразовая<template v-if="expiry">
            и действует до <b class="text-vt-ink">{{ expiry }}</b></template
          >. Место не держится, пока вы не запишетесь.
        </p>
      </section>

      <section
        v-else
        class="vt-card flex items-start gap-2.5 p-3.5 invite-expired"
        role="alert"
        aria-labelledby="invite-title"
      >
        <VtIcon name="clock" :size="14" class="shrink-0 mt-0.5" />
        <div class="min-w-0">
          <h3 id="invite-title" class="text-[13px] font-semibold">Ссылка больше не действует</h3>
          <p class="text-xs mt-1 invite-expired__text">
            <template v-if="expiry">Срок приглашения истёк {{ expiry }}. </template>Попросите новое
            — организатор получит запрос в бот.
          </p>
        </div>
      </section>
    </template>

    <template v-if="part !== 'card'">
      <button
        v-if="state === 'none' || state === 'expired'"
        type="button"
        class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full"
        :disabled="busy"
        data-invite-request
        @click="emit('request')"
      >
        {{ state === 'expired' ? 'Запросить новое приглашение' : 'Запросить приглашение' }}
      </button>
      <template v-else-if="state === 'requested'">
        <button
          type="button"
          class="vt-btn vt-btn--primary vt-btn--lg vt-btn--full flex justify-between"
          disabled
          aria-disabled="true"
        >
          <span>Записаться</span><span class="vt-mono text-xs">после ответа</span>
        </button>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--full"
          :disabled="busy"
          data-invite-withdraw
          @click="emit('withdraw')"
        >
          Отозвать запрос
        </button>
      </template>
      <NuxtLink
        v-if="state === 'expired'"
        :to="eventsHref"
        class="vt-btn vt-btn--ghost vt-btn--full"
      >
        Другие события группы
      </NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.invite-expired {
  background: var(--vt-rose-soft);
  color: var(--vt-rose-ink);
}

.invite-expired__text {
  color: var(--vt-rose-ink);
  opacity: 0.85;
}
</style>

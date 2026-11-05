<script setup lang="ts">
import { COLLECTION_METHOD_LABELS, collectionDeadlineLabel } from '~/utils/collections'
import { collectionProgress } from '~/utils/desktop-collections'
import { displayName, formatMoneyRu } from '~/utils/labels'
import {
  collectionActions,
  collectionRemaining,
  splitContributions,
  type ManagedCollection,
  type ManagedContribution,
} from '~/utils/organizer-collections'

/**
 * Управление сбором (21.1.5, `OrgContribManage`): прогресс, обещания «ждут подтверждения»
 * (подтвердить / отклонить), внёсшие и меню «⋯» (изменить, опубликовать, завершить, отменить).
 * API — 21.2.4; «Напомнить», «В чат» и «Экспорт» без API в карточку не входят (бэклог 21.4.1).
 * При выключенном `COLLECTIONS_ENABLED` правка и публикация скрыты, остальное работает.
 */
const props = defineProps<{
  orgId: number
  collection: ManagedCollection
  contributions: ManagedContribution[]
  flagOn: boolean
  tz: string
  back: string
}>()
const emit = defineEmits<{ changed: [] }>()

const { confirm, haptic } = useTelegram()
const toast = useToast()
// Запрос без типизированных маршрутов Nuxt: на путях с шаблонными литералами они упираются в
// предел глубины типов компилятора.
const send = (suffix: string, method: 'POST' | 'PATCH', body?: unknown): Promise<unknown> =>
  ($fetch as unknown as (url: string, init: object) => Promise<unknown>)(
    `/api/organizations/${props.orgId}/collections/${props.collection.id}${suffix}`,
    body === undefined ? { method } : { method, body },
  )
const now = new Date()
const menuOpen = ref(false)
const busy = ref<string | null>(null)
const actionError = ref('')

const actions = computed(() => collectionActions(props.collection, props.flagOn))
const hasMenu = computed(
  () =>
    actions.value.edit || actions.value.publish || actions.value.complete || actions.value.cancel,
)
const parts = computed(() => splitContributions(props.contributions))
const progress = computed(() => collectionProgress(props.collection))
const remaining = computed(() => collectionRemaining(props.collection))
const deadline = computed(() => collectionDeadlineLabel(props.collection.deadlineAt, props.tz, now))
const sub = computed(() => {
  const c = props.collection
  const state =
    c.status === 'draft'
      ? 'черновик'
      : c.status === 'completed'
        ? 'завершён'
        : c.status === 'cancelled'
          ? 'отменён'
          : deadline.value?.date
  return [state, progress.value === null ? null : `${progress.value}%`].filter(Boolean).join(' · ')
})
const money = (minor: number) => formatMoneyRu(minor, props.collection.currency)
const who = (c: ManagedContribution) => displayName(c.user)

async function run(key: string, request: () => Promise<unknown>, success: string, failure: string) {
  if (busy.value) return
  busy.value = key
  actionError.value = ''
  try {
    await request()
    haptic('success')
    toast.show(success)
    emit('changed')
  } catch (e) {
    haptic('error')
    const code = apiErrorCode(e)
    // устаревший экран: обещание уже обработано или сбор закрыт — показываем причину и перечитываем
    if (code === 'payment.not_pending') {
      actionError.value = 'Обещание уже обработано — список обновлён'
      emit('changed')
    } else if (code === 'collection.not_active') {
      actionError.value = 'Сбор уже закрыт — экран обновлён'
      emit('changed')
    } else if (code === 'collection.not_found') {
      actionError.value = 'Сбор не найден'
    } else {
      actionError.value = apiErrorMessage(e, failure)
    }
  } finally {
    busy.value = null
  }
}

function confirmPledge(c: ManagedContribution) {
  void run(
    `confirm-${c.id}`,
    () => send(`/contributions/${c.id}/confirm`, 'POST'),
    `Подтверждено · ${who(c)} · +${money(c.amount)}`,
    'Не удалось подтвердить взнос',
  )
}

async function rejectPledge(c: ManagedContribution) {
  if (busy.value) return
  const ok = await confirm(
    `Отклонить обещание ${who(c)} на ${money(c.amount)}? Игрок получит уведомление, касса не изменится.`,
  )
  if (!ok) return
  await run(
    `reject-${c.id}`,
    () => send(`/contributions/${c.id}/reject`, 'POST'),
    `Отклонено · ${who(c)}`,
    'Не удалось отклонить взнос',
  )
}

async function publish() {
  menuOpen.value = false
  await run(
    'publish',
    () => send('', 'PATCH', { status: 'active' }),
    'Сбор опубликован',
    'Не удалось опубликовать сбор',
  )
}

async function complete() {
  menuOpen.value = false
  const ok = await confirm(
    'Завершить сбор? Новые взносы будут закрыты, собранное останется в кассе.',
  )
  if (!ok) return
  await run(
    'complete',
    () => send('/complete', 'POST'),
    'Сбор завершён',
    'Не удалось завершить сбор',
  )
}

async function cancel() {
  menuOpen.value = false
  const ok = await confirm(
    'Отменить сбор? Ожидающие обещания будут отклонены, подтверждённые взносы останутся в кассе.',
  )
  if (!ok) return
  await run('cancel', () => send('/cancel', 'POST'), 'Сбор отменён', 'Не удалось отменить сбор')
}

const menuItemClass =
  'flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-vt-stroke/40 focus-visible:outline-2'
</script>

<template>
  <div class="min-h-screen pb-6">
    <VtMiniHeader :title="collection.title" :sub="sub || undefined" :back="back">
      <template v-if="hasMenu" #right>
        <button
          type="button"
          class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44"
          aria-label="Действия со сбором"
          aria-haspopup="dialog"
          aria-controls="organizer-collection-menu"
          :aria-expanded="menuOpen"
          @click="menuOpen = true"
        >
          <VtIcon name="more" :size="18" />
        </button>
      </template>
    </VtMiniHeader>

    <main class="px-4 pb-4 pt-2">
      <p v-if="actionError" class="pb-2 text-sm text-vt-rose-ink" role="alert">{{ actionError }}</p>

      <section class="vt-card !p-4" aria-label="Итоги сбора">
        <div class="flex items-baseline justify-between gap-2">
          <span class="vt-mono font-display text-[28px] font-bold leading-none">{{
            money(collection.collected)
          }}</span>
          <span v-if="collection.targetAmount !== null" class="text-xs text-vt-mute-2"
            >цель {{ money(collection.targetAmount) }}</span
          >
        </div>
        <div
          v-if="progress !== null"
          class="vt-meter mt-2.5 h-2"
          role="meter"
          aria-label="Собрано"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <i
            :style="{
              width: `${progress}%`,
              background: collection.status === 'completed' ? 'var(--vt-grass)' : undefined,
            }"
          />
        </div>
        <dl class="mt-3.5 flex gap-4">
          <div>
            <dt class="vt-cap text-vt-mute-2">внесли</dt>
            <dd class="vt-mono mt-1 text-base font-semibold text-vt-grass-ink">
              {{ money(collection.collected) }}
            </dd>
          </div>
          <div>
            <dt class="vt-cap text-vt-mute-2">обещано</dt>
            <dd class="vt-mono mt-1 text-base font-semibold text-vt-amber-ink">
              +{{ money(collection.pledged) }}
            </dd>
          </div>
          <div v-if="remaining !== null">
            <dt class="vt-cap text-vt-mute-2">осталось</dt>
            <dd class="vt-mono mt-1 text-base font-semibold">{{ money(remaining) }}</dd>
          </div>
        </dl>
      </section>

      <section class="px-1 pt-3" aria-label="О сборе">
        <p v-if="collection.description" class="text-sm leading-normal text-vt-ink-3">
          {{ collection.description }}
        </p>
        <p v-if="collection.status === 'draft'" class="mt-2 text-xs text-vt-mute-2">
          Черновик: игроки сбор не видят.
        </p>
      </section>

      <section class="mt-4" aria-labelledby="org-pledges-title">
        <div class="mx-1 mb-2.5 flex items-baseline justify-between">
          <h2 id="org-pledges-title" class="vt-cap text-vt-mute-2">Обещали · ждут подтверждения</h2>
          <VtChip tone="amber" data-pledges-count>{{ parts.pending.length }}</VtChip>
        </div>
        <div class="vt-card overflow-hidden !p-0">
          <p
            v-if="!parts.pending.length"
            class="px-6 py-6 text-center text-sm text-vt-mute-2"
            data-no-pledges
          >
            {{ actions.decide ? 'Все обещания подтверждены' : 'Обещаний нет' }}
          </p>
          <ul v-else class="divide-y divide-vt-stroke" aria-label="Ожидающие обещания">
            <li
              v-for="p in parts.pending"
              :key="p.id"
              class="flex items-center gap-2.5 px-3 py-2.5"
              data-pledge
            >
              <VtAvatar :name="who(p)" :src="p.user.image" size="sm" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{{ who(p) }}</div>
                <div class="text-[11px] text-vt-mute-2">
                  обещал {{ COLLECTION_METHOD_LABELS[p.method as 'cash' | 'transfer'] ?? '' }}
                </div>
              </div>
              <span class="vt-mono text-sm font-semibold">{{ money(p.amount) }}</span>
              <template v-if="actions.decide">
                <button
                  type="button"
                  class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44"
                  :aria-label="`Отклонить обещание ${who(p)}`"
                  :disabled="busy !== null"
                  @click="rejectPledge(p)"
                >
                  <VtIcon name="close" :size="14" />
                </button>
                <button
                  type="button"
                  class="vt-btn vt-btn--primary vt-btn--sm vt-hit-44"
                  :aria-label="`Подтвердить взнос ${who(p)}`"
                  :disabled="busy !== null"
                  @click="confirmPledge(p)"
                >
                  <VtIcon name="check" :size="14" />
                </button>
              </template>
            </li>
          </ul>
        </div>
      </section>

      <section class="mt-5" aria-labelledby="org-paid-title">
        <h2 id="org-paid-title" class="vt-cap mx-1 mb-2.5 text-vt-mute-2">
          Внесли · {{ parts.paid.length }}
        </h2>
        <p v-if="!parts.paid.length" class="vt-card px-4 py-4 text-sm text-vt-mute-2">
          Подтверждённых взносов пока нет
        </p>
        <ul v-else class="vt-card divide-y divide-vt-stroke overflow-hidden !p-0">
          <li
            v-for="p in parts.paid"
            :key="p.id"
            class="flex items-center gap-2.5 px-3 py-2.5 grayscale"
            data-paid
          >
            <VtIcon name="check" :size="14" class="text-vt-grass-ink" />
            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ who(p) }}</span>
            <span class="vt-mono text-xs font-semibold text-vt-grass-ink"
              >+{{ money(p.amount) }}</span
            >
          </li>
        </ul>
      </section>
    </main>

    <VtSheet v-if="hasMenu" id="organizer-collection-menu" v-model="menuOpen" title="Сбор">
      <div class="grid gap-1">
        <NuxtLink
          v-if="actions.edit"
          :to="`${back}/${collection.id}/edit`"
          :class="menuItemClass"
          @click="menuOpen = false"
        >
          Изменить сбор
        </NuxtLink>
        <button v-if="actions.publish" type="button" :class="menuItemClass" @click="publish">
          Опубликовать
        </button>
        <button v-if="actions.complete" type="button" :class="menuItemClass" @click="complete">
          Завершить сбор
        </button>
        <button
          v-if="actions.cancel"
          type="button"
          :class="[menuItemClass, 'text-vt-rose-ink']"
          @click="cancel"
        >
          Отменить сбор
        </button>
      </div>
    </VtSheet>
  </div>
</template>

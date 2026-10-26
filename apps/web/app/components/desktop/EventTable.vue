<script setup lang="ts">
import { formatTime } from '@volley-time/shared'

import type { EventListItem } from '~/components/EventCard.vue'
import { paymentsCellOf, type ChatLinkState, type RowAction } from '~/utils/event-row'
import { eventStateOf, waitlistPeopleLabel } from '~/utils/status-model'

/**
 * Таблица событий кабинета (W-03): дата · тренировка · зал · состав · оплаты · статус (20.5.4, 20.5.8)
 * и меню строки ⋯. Действия выполняет страница: таблица сообщает о выбранном пункте.
 */
const props = withDefaults(
  defineProps<{
    events: EventListItem[]
    timeZone: string
    base: string
    /** Привязка чата группы: от неё зависит пункт «В чат группы». */
    chat?: ChatLinkState
    /** Событие, над которым выполняется действие: его меню заблокировано. */
    busyId?: number | null
  }>(),
  { chat: () => ({ kind: 'unknown' }), busyId: null },
)
defineEmits<{ action: [action: RowAction, event: EventListItem] }>()

const dateFormat = computed(
  () =>
    new Intl.DateTimeFormat('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      timeZone: props.timeZone,
    }),
)
const now = computed(() => new Date())
const cells = computed(() => new Map(props.events.map((e) => [e.id, paymentsCellOf(e)])))

function dateParts(event: EventListItem) {
  const parts = dateFormat.value.formatToParts(new Date(event.startsAt))
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return {
    day: `${part('weekday')} ${part('day')}`,
    sub: `${part('month')} · ${formatTime(event.startsAt, props.timeZone)}`,
  }
}
const venueOf = (event: EventListItem) => event.venue?.name ?? event.locationText ?? '—'
const dimmed = (event: EventListItem) => eventStateOf(event, now.value) !== null
</script>

<template>
  <div class="vt-card vt-desktop-table">
    <table aria-label="Список событий">
      <thead>
        <tr>
          <th scope="col" class="vt-cap">Дата</th>
          <th scope="col" class="vt-cap">Тренировка</th>
          <th scope="col" class="vt-cap">Зал</th>
          <th scope="col" class="vt-cap">Состав</th>
          <th scope="col" class="vt-cap">Оплаты</th>
          <th scope="col" class="vt-cap">Статус</th>
          <th scope="col" class="vt-desktop-table__actions">
            <span class="sr-only">Действия</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="event in events" :key="event.id" :class="{ 'is-dim': dimmed(event) }">
          <td>
            <div class="vt-desktop-table__day">{{ dateParts(event).day }}</div>
            <div class="vt-mono vt-desktop-table__sub">{{ dateParts(event).sub }}</div>
          </td>
          <th scope="row" class="vt-desktop-table__title">
            <NuxtLink :to="`${base}/events/${event.id}`">{{ event.title }}</NuxtLink>
            <VtChip v-if="event.pricing?.mode === 'split'" tone="flame">делёж суммы</VtChip>
          </th>
          <td class="vt-desktop-table__venue">{{ venueOf(event) }}</td>
          <td>
            <VtSeatsMini
              :taken="event.taken"
              :capacity="event.capacity"
              :event="event"
              :width="90"
            />
            <div v-if="event.waitlist" class="vt-desktop-table__sub">
              {{ waitlistPeopleLabel(event.waitlist) }}
            </div>
          </td>
          <td>
            <div class="vt-mono vt-desktop-table__paid">
              <template v-if="cells.get(event.id)!.paid">{{ cells.get(event.id)!.paid }}</template>
              <span v-else class="vt-desktop-table__sub">—</span>
              <span v-if="cells.get(event.id)!.pending" class="vt-desktop-table__pending">{{
                cells.get(event.id)!.pending
              }}</span>
            </div>
            <div v-if="cells.get(event.id)!.share" class="vt-mono vt-desktop-table__sub">
              {{ cells.get(event.id)!.share }}
            </div>
          </td>
          <td>
            <VtStateChip :event="event" :now="now" />
            <span v-if="!dimmed(event)" class="vt-desktop-table__sub">Запись открыта</span>
          </td>
          <td class="vt-desktop-table__actions">
            <DesktopEventRowMenu
              :event="event"
              :chat="chat"
              :busy="busyId === event.id"
              @action="(action) => $emit('action', action, event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

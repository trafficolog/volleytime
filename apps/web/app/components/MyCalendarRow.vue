<script setup lang="ts">
import { plural } from '~/utils/group-schedule'
import type { MyCalendarItem } from '~/utils/my-calendar'
import { OVERLAP_LABEL } from '~/utils/status-model'

/** Строка игры в общем календаре игрока (23.2.2, M-10): время, название, точка и имя группы, чип; отменённая игра (23.2.4) приглушена и помечена «Отменена». */
const props = defineProps<{ item: MyCalendarItem }>()
const to = computed(
  () => `/m/orgs/${props.item.event.organizationId}/events/${props.item.event.id}`,
)
const place = computed(() => props.item.event.venue?.name ?? props.item.event.locationText ?? '')
const seats = computed(
  () => `${props.item.freeSeats} ${plural(props.item.freeSeats, 'место', 'места', 'мест')}`,
)
</script>

<template>
  <NuxtLink :to="to" class="mycal-row" :class="{ 'mycal-row--dim': item.past || item.cancelled }">
    <div class="mycal-row__time">
      <div class="vt-mono text-[15px] font-bold leading-none">{{ item.timeFrom }}</div>
      <div class="vt-mono mt-1 text-[10px] text-vt-mute-2">{{ item.timeTo }}</div>
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-[15px] font-bold">{{ item.event.title }}</div>
      <div class="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-vt-mute-2">
        <i class="mycal-dot" :style="{ '--dot': item.color }" aria-hidden="true" />
        <span class="mycal-row__group shrink-0 font-semibold text-vt-ink-3">{{
          item.group.name
        }}</span>
        <span v-if="place" class="truncate">· {{ place }}</span>
      </div>
    </div>
    <span class="shrink-0">
      <span v-if="item.cancelled" class="vt-chip vt-chip--state" data-state="cancelled"
        >Отменена</span
      >
      <span v-else-if="item.clash" class="vt-chip vt-chip--amber" data-state="overlap">{{
        OVERLAP_LABEL.toLowerCase()
      }}</span>
      <VtMyChip v-else-if="item.participation" :booking="item.event.myBooking" />
      <span v-else class="vt-chip vt-chip--state" data-state="seats">{{ seats }}</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.mycal-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 0;
}
.mycal-row--dim {
  opacity: 0.6;
}
.mycal-row__time {
  width: 46px;
  flex-shrink: 0;
}
.mycal-row__group {
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mycal-dot {
  display: block;
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--dot);
}
</style>

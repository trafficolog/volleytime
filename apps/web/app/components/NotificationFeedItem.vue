<script setup lang="ts">
import type { NotificationTone, NotificationView } from '~/utils/notification-feed'

/** Карточка уведомления ленты игрока (20.4.9, M-13): иконка по типу, заголовок, время, текст. */
const props = defineProps<{
  view: NotificationView
  time: string
  read: boolean
}>()
const emit = defineEmits<{ open: [] }>()

const TONES: Record<NotificationTone, { background: string; color: string }> = {
  flame: { background: 'var(--vt-accent-soft)', color: 'var(--vt-flame-deep)' },
  grass: { background: 'var(--vt-grass-soft)', color: 'var(--vt-grass)' },
  amber: { background: 'var(--vt-amber-soft)', color: 'var(--vt-amber-ink)' },
  rose: { background: 'var(--vt-rose-soft)', color: 'var(--vt-rose)' },
  ink: { background: 'var(--vt-bone-2)', color: 'var(--vt-ink-3)' },
}
const tone = computed(() => TONES[props.view.tone])
</script>

<template>
  <NuxtLink
    :to="view.to"
    data-notification
    :data-read="read"
    class="vt-card relative !flex items-start gap-3 px-3.5 py-3"
    :class="read ? 'grayscale' : ''"
    @click="emit('open')"
  >
    <span
      v-if="!read"
      data-unread-dot
      class="absolute right-3.5 top-3.5 h-[7px] w-[7px] rounded-full bg-vt-flame"
      aria-hidden="true"
    />
    <span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-chip)]"
      :style="tone"
      aria-hidden="true"
    >
      <VtIcon :name="view.icon" :size="18" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="flex items-baseline justify-between gap-2">
        <span class="text-[15px] font-semibold leading-tight"
          ><span v-if="!read" class="sr-only">Новое. </span>{{ view.title }}</span
        >
        <span class="vt-mono shrink-0 pr-3 text-[10px] text-vt-mute-2">{{ time }}</span>
      </span>
      <span class="mt-1 block break-words text-sm leading-snug text-vt-mute-2">{{
        view.body
      }}</span>
    </span>
  </NuxtLink>
</template>

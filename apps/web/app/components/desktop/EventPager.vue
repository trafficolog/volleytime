<script setup lang="ts">
import { eventPageCount } from '~/utils/event-list-query'

/** Подвал списка событий (21.2.10): «Показано N из M» и переходы по страницам. */
const props = defineProps<{ shown: number; total: number; page: number }>()
const emit = defineEmits<{ page: [page: number] }>()
const pages = computed(() => eventPageCount(props.total))
</script>

<template>
  <div class="vt-desktop-events__pager text-vt-mute-2">
    <span role="status">Показано {{ shown }} из {{ total }}</span>
    <nav aria-label="Страницы списка событий" class="vt-desktop-events__filters">
      <span class="text-sm">Страница {{ page }} из {{ pages }}</span>
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        aria-label="Предыдущая страница"
        :disabled="page <= 1"
        @click="emit('page', page - 1)"
      >
        <VtIcon name="chevron-l" :size="14" />
      </button>
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm"
        aria-label="Следующая страница"
        :disabled="page >= pages"
        @click="emit('page', page + 1)"
      >
        <VtIcon name="chevron-r" :size="14" />
      </button>
    </nav>
  </div>
</template>

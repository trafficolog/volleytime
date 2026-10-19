<script setup lang="ts">
/** Общая страница ошибки в стиле дизайн-системы (Task 8.8.9). */
const props = defineProps<{ error: { statusCode?: number; statusMessage?: string } }>()

const isNotFound = computed(() => props.error?.statusCode === 404)
// 429 — лимит запросов (публичная страница события, 20.6.1)
const isTooMany = computed(() => props.error?.statusCode === 429)
const title = computed(() =>
  isTooMany.value
    ? 'Слишком много запросов'
    : isNotFound.value
      ? 'Страница не найдена'
      : 'Что-то пошло не так',
)
const description = computed(() =>
  isTooMany.value
    ? 'Подождите минуту и обновите страницу.'
    : isNotFound.value
      ? 'Возможно, ссылка устарела или экран переехал.'
      : 'Попробуйте обновить экран. Если не помогает — откройте приложение заново из чата с ботом.',
)
</script>

<template>
  <div class="min-h-screen bg-vt-paper text-vt-ink flex items-center justify-center px-5">
    <EmptyState icon="alert" :title="title" :description="description">
      <template #action>
        <button
          type="button"
          class="vt-btn vt-btn--primary"
          @click="clearError({ redirect: '/m/' })"
        >
          На главный экран
        </button>
      </template>
    </EmptyState>
  </div>
</template>

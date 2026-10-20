<script setup lang="ts">
/**
 * Ссылка на страницу «Оплаты» (20.5.3): пункта в меню кабинета нет (решение владельца 2026-10-20),
 * страница доступна из обзора и из блока оплат карточки события. Фильтра по событию у страницы нет.
 */
defineProps<{ orgId: number }>()
</script>

<template>
  <NuxtLink :to="`/app/orgs/${orgId}/payments`" class="vt-btn vt-btn--ghost vt-btn--sm">
    Все оплаты
  </NuxtLink>
</template>

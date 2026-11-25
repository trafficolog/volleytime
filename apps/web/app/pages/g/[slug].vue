<script setup lang="ts">
/** Прежний адрес страницы группы `/g/<slug>` (24.1.2); действующий — `/{город}/{группа}` (24.2.1). */
const route = useRoute()
const slug = String(route.params.slug ?? '')
</script>

<template>
  <PublicGroupRoute :slug="slug" :path="`/g/${slug}`" />
</template>

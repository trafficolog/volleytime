<script setup lang="ts">
/** Страница группы `/{город}/{группа}` (24.2.1, D-26): город — slug справочника, группа — slug. */
const route = useRoute()
const city = String(route.params.city ?? '')
const slug = String(route.params.group ?? '')
</script>

<template>
  <PublicGroupRoute :slug="slug" :path="`/${city}/${slug}`" />
</template>

<script setup lang="ts">
/** Каталог города вне справочника `/volleyball/<город>` (24.1.2); город справочника — `/<город>` (24.2.1). */
const route = useRoute()
const city = String(route.params.city ?? '')
</script>

<template>
  <CityCatalogRoute :city="city" :path="`/volleyball/${encodeURIComponent(city)}`" />
</template>

<script setup lang="ts">
/** Каталог «Волейбол в городе {город}» по адресу `/<город>` (24.2.1): город — slug справочника. */
const route = useRoute()
const city = String(route.params.city ?? '')
</script>

<template>
  <CityCatalogRoute :city="city" :path="`/${city}`" />
</template>

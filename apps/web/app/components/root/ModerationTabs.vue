<script setup lang="ts">
/** Разделы «Страницы групп» (24.1.3): каталог городов и жалобы — отдельные маршруты. */
defineProps<{ active: 'pages' | 'page-complaints'; newComplaints?: number | null }>()
</script>

<template>
  <nav class="vt-mod-tabs" aria-label="Разделы модерации">
    <NuxtLink
      to="/root/pages"
      :aria-current="active === 'pages' ? 'page' : undefined"
      data-testid="mod-tab-pages"
    >
      Каталог городов
    </NuxtLink>
    <NuxtLink
      to="/root/page-complaints"
      :aria-current="active === 'page-complaints' ? 'page' : undefined"
      data-testid="mod-tab-complaints"
    >
      Жалобы
      <span v-if="newComplaints" class="vt-chip vt-chip--rose vt-mod-tabs__count">
        {{ newComplaints }}<span class="sr-only"> новых</span>
      </span>
    </NuxtLink>
  </nav>
</template>

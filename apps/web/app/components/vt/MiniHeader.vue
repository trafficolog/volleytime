<script setup lang="ts">
/**
 * Шапка экрана Mini App. `back` — путь «назад» для браузера: в Telegram работает системная
 * BackButton (плагин telegram-shell, Task 20.4.1), своя кнопка скрывается.
 */
defineProps<{ title: string; sub?: string; back?: string }>()
const { nativeBack } = useTelegram()
</script>

<template>
  <header class="vt-miniheader">
    <div class="flex items-center gap-2.5 min-w-0">
      <NuxtLink
        v-if="back && !nativeBack"
        :to="back"
        class="vt-btn vt-btn--ghost vt-btn--sm vt-hit-44 !px-2"
        aria-label="Назад"
      >
        <VtIcon name="chevron-l" :size="16" />
      </NuxtLink>
      <div class="min-w-0">
        <slot name="title">
          <h1 class="text-base font-semibold truncate">{{ title }}</h1>
        </slot>
        <p v-if="sub" class="text-[11.5px] text-vt-mute-2 mt-0.5 truncate">{{ sub }}</p>
      </div>
    </div>
    <slot name="right" />
  </header>
</template>

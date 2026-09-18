<script setup lang="ts">
/**
 * Шапка экрана Mini App. `back` — путь «назад»: в Telegram используется системная
 * BackButton, своя кнопка скрывается (Task 8.8.7).
 */
const props = defineProps<{ title: string; sub?: string; back?: string }>()
const { isTelegram, useBackButton } = useTelegram()
const useNativeBack = computed(() => isTelegram.value && !!props.back)

let cleanup: (() => void) | undefined
onMounted(() => {
  if (useNativeBack.value && props.back) {
    cleanup = useBackButton(() => navigateTo(props.back!))
  }
})
onUnmounted(() => cleanup?.())
</script>

<template>
  <header class="vt-miniheader">
    <div class="flex items-center gap-2.5 min-w-0">
      <NuxtLink
        v-if="back"
        :to="back"
        class="vt-btn vt-btn--ghost vt-btn--sm !px-2"
        aria-label="Назад"
      >
        <VtIcon name="chevron-l" :size="16" />
      </NuxtLink>
      <div class="min-w-0">
        <h1 class="text-base font-semibold truncate">{{ title }}</h1>
        <p v-if="sub" class="text-[11.5px] text-vt-mute-2 mt-0.5 truncate">{{ sub }}</p>
      </div>
    </div>
    <slot name="right" />
  </header>
</template>

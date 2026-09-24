<script setup lang="ts">
import { useId } from 'vue'

import { nextSheetFocus } from '~/utils/sheet-focus'

/** Нижний лист (bottom sheet) для выбора действия. */
const open = defineModel<boolean>({ default: false })
defineProps<{ title?: string }>()
const titleId = useId()
const panel = ref<HTMLElement | null>(null)
let focusBeforeOpen: HTMLElement | null = null
let appRoot: HTMLElement | null = null
let wasInert = false

const focusableSelector =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function restoreBackground() {
  if (appRoot && !wasInert) appRoot.removeAttribute('inert')
  appRoot = null
  focusBeforeOpen?.focus()
  focusBeforeOpen = null
}

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  if (!isOpen) {
    await nextTick()
    restoreBackground()
    return
  }
  focusBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null
  appRoot = document.getElementById('__nuxt')
  wasInert = appRoot?.hasAttribute('inert') ?? false
  appRoot?.setAttribute('inert', '')
  await nextTick()
  panel.value?.querySelector<HTMLElement>(focusableSelector)?.focus()
  if (document.activeElement === focusBeforeOpen) panel.value?.focus()
})

onUnmounted(restoreBackground)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
  }
  if (event.key !== 'Tab' || !panel.value) return
  const focusables = Array.from(panel.value.querySelectorAll<HTMLElement>(focusableSelector))
  if (!focusables.length) {
    event.preventDefault()
    panel.value.focus()
    return
  }
  const target = nextSheetFocus(focusables, document.activeElement, event.shiftKey)
  if (!target) return
  event.preventDefault()
  target.focus()
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
      :aria-label="title ? undefined : 'Выбор действия'"
      @keydown="onKeydown"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/40"
        aria-label="Закрыть"
        @click="open = false"
      />
      <div
        ref="panel"
        tabindex="-1"
        class="relative w-full rounded-t-2xl bg-vt-paper border-t border-vt-stroke p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] overscroll-contain"
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-vt-stroke-2" aria-hidden="true" />
        <h2 v-if="title" :id="titleId" class="text-base font-semibold mb-3">{{ title }}</h2>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

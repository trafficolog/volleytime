<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useId, watch } from 'vue'

/** Нижний лист (bottom sheet) для выбора действия. */
const open = defineModel<boolean>({ default: false })
const props = defineProps<{ title?: string; id?: string }>()
const dialogRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const fallbackId = useId()
const headingId = computed(() => `${props.id ?? fallbackId}-title`)
const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
let trigger: HTMLElement | null = null
const previousInert = new Map<HTMLElement, boolean>()

function panelControls(): HTMLElement[] {
  return [...(panelRef.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])].filter(
    (element) => element.tabIndex >= 0 && !element.closest('[hidden], [inert]'),
  )
}

function restoreBackground() {
  for (const [element, wasInert] of previousInert) element.inert = wasInert
  previousInert.clear()
}

function restoreFocus() {
  restoreBackground()
  if (trigger?.isConnected) trigger.focus()
  trigger = null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
    return
  }
  if (event.key !== 'Tab') return

  const controls = panelControls()
  if (controls.length === 0) {
    event.preventDefault()
    panelRef.value?.focus()
    return
  }
  const first = controls[0]!
  const last = controls[controls.length - 1]!
  if (
    event.shiftKey &&
    (document.activeElement === first || !panelRef.value?.contains(document.activeElement))
  ) {
    event.preventDefault()
    last.focus()
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !panelRef.value?.contains(document.activeElement))
  ) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  open,
  async (isOpen) => {
    if (typeof document === 'undefined') return
    if (!isOpen) {
      await nextTick()
      restoreFocus()
      return
    }

    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (!open.value || !dialogRef.value) return
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === dialogRef.value) continue
      previousInert.set(child, child.inert)
      child.inert = true
    }
    const firstControl = panelControls()[0] ?? panelRef.value
    firstControl?.focus()
  },
  { immediate: true, flush: 'post' },
)

onUnmounted(restoreFocus)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      :id="id"
      ref="dialogRef"
      class="fixed inset-0 z-40 flex items-end"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? headingId : undefined"
      :aria-label="title ? undefined : 'Действия'"
      @keydown="onKeydown"
    >
      <button
        type="button"
        tabindex="-1"
        class="absolute inset-0 bg-black/40"
        aria-label="Закрыть"
        @click="open = false"
      />
      <div
        ref="panelRef"
        tabindex="-1"
        class="relative z-10 w-full max-h-[100dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-vt-paper border-t border-vt-stroke p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-vt-stroke-2" aria-hidden="true" />
        <h2 v-if="title" :id="headingId" class="text-base font-semibold mb-3">{{ title }}</h2>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

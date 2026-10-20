<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import CabinetSearch from './CabinetSearch.vue'

/**
 * Поиск за иконкой в топбаре кабинета (20.5.3, W-01): выезжает по клику или Ctrl/⌘+K,
 * закрывается крестиком, Esc и кликом вне. Сам поиск — CabinetSearch (20.5.2).
 */
defineProps<{ orgId: number; timeZone: string }>()

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const expanded = ref(false)

async function openSearch() {
  expanded.value = true
  await nextTick()
  const field = root.value?.querySelector<HTMLInputElement>('input')
  field?.focus()
  field?.select()
}

function closeSearch(returnFocus = true) {
  if (!expanded.value) return
  expanded.value = false
  if (returnFocus) nextTick(() => trigger.value?.focus())
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || !('tagName' in el)) return false
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
    el.isContentEditable ||
    el.getAttribute('contenteditable') === 'true'
  )
}

/** Esc в два шага: сначала закрывается выдача (это делает CabinetSearch), затем само поле. */
function onEsc() {
  if (root.value?.querySelector('#cabinet-search-panel')) return
  closeSearch()
}

function onGlobalKey(e: KeyboardEvent) {
  if (isEditable(e.target)) return
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    void openSearch()
  }
}

function onOutside(e: MouseEvent) {
  if (expanded.value && root.value && !root.value.contains(e.target as Node)) closeSearch(false)
}

function onPanelClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a')) closeSearch(false)
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKey)
  document.addEventListener('mousedown', onOutside)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
  document.removeEventListener('mousedown', onOutside)
})
</script>

<template>
  <div ref="root" class="vt-cabinet-search-toggle" :data-expanded="expanded" @keydown.esc="onEsc">
    <button
      ref="trigger"
      type="button"
      class="vt-btn vt-btn--ghost vt-btn--sm vt-cabinet-search-toggle__trigger"
      :aria-label="expanded ? 'Закрыть поиск' : 'Открыть поиск'"
      :aria-controls="expanded ? 'cabinet-search-slot' : undefined"
      title="Поиск (Ctrl K)"
      :aria-expanded="expanded"
      @click="expanded ? closeSearch() : openSearch()"
    >
      <VtIcon name="search" :size="18" />
    </button>
    <div
      v-if="expanded"
      id="cabinet-search-slot"
      class="vt-cabinet-search-toggle__slot"
      @click="onPanelClick"
    >
      <CabinetSearch :org-id="orgId" :time-zone="timeZone" />
      <button
        type="button"
        class="vt-btn vt-btn--ghost vt-btn--sm vt-cabinet-search-toggle__close"
        aria-label="Закрыть поиск"
        @click="closeSearch()"
      >
        <VtIcon name="close" :size="16" />
      </button>
    </div>
  </div>
</template>

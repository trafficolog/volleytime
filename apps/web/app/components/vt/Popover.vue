<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

/** Меню-поповер (веб, 210 px): role=menu, стрелки, Esc / клик вне закрывают, фокус возвращается. */
export interface VtPopoverItem {
  key: string
  label: string
  tone?: 'danger'
  shortcut?: string
  disabled?: boolean
}

const open = defineModel<boolean>({ default: false })
withDefaults(defineProps<{ items: VtPopoverItem[]; label?: string; align?: 'left' | 'right' }>(), {
  align: 'right',
})
const emit = defineEmits<{ select: [item: VtPopoverItem] }>()

const uid = useId()
const root = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuId = `${uid}-menu`

function entries(): HTMLElement[] {
  return [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])]
}

function close(refocus = true) {
  open.value = false
  if (refocus) root.value?.querySelector<HTMLElement>('[data-vt-popover-trigger]')?.focus()
}

function pick(item: VtPopoverItem) {
  emit('select', item)
  close()
}

function onKeydown(event: KeyboardEvent) {
  const list = entries()
  const i = list.indexOf(document.activeElement as HTMLElement)
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (event.key === 'Tab') {
    close(false)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    list[(i + 1) % list.length]?.focus()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    list[(i - 1 + list.length) % list.length]?.focus()
  } else if (event.key === 'Home') {
    event.preventDefault()
    list[0]?.focus()
  } else if (event.key === 'End') {
    event.preventDefault()
    list[list.length - 1]?.focus()
  }
}

function onDocPointer(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close(false)
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  entries()[0]?.focus()
})

onMounted(() => document.addEventListener('mousedown', onDocPointer))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocPointer))
</script>

<template>
  <div ref="root" class="vt-popover-root">
    <slot
      name="trigger"
      :open="open"
      :toggle="() => (open = !open)"
      :attrs="{
        'data-vt-popover-trigger': '',
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
      }"
    />
    <div
      v-if="open"
      :id="menuId"
      ref="menu"
      class="vt-popover"
      :class="`vt-popover--${align}`"
      role="menu"
      :aria-label="label"
      @keydown="onKeydown"
    >
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="vt-popover__item"
        :class="{ 'vt-popover__item--danger': item.tone === 'danger' }"
        role="menuitem"
        :disabled="item.disabled"
        @click="pick(item)"
      >
        <span class="vt-popover__label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="vt-popover__shortcut">{{ item.shortcut }}</span>
      </button>
    </div>
  </div>
</template>

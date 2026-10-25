<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

/** Меню-поповер (веб, 210 px): role=menu, стрелки, Esc / клик вне закрывают, фокус возвращается. */
export interface VtPopoverItem {
  key: string
  label: string
  tone?: 'danger'
  shortcut?: string
  disabled?: boolean
  /** Разделитель перед пунктом: опасное действие отделено от остальных (20.5.8). */
  separator?: boolean
  /** Пояснение под названием, например почему пункт недоступен. */
  hint?: string
}

const open = defineModel<boolean>({ default: false })
const props = withDefaults(
  defineProps<{
    items: VtPopoverItem[]
    label?: string
    align?: 'left' | 'right'
    /**
     * Меню поверх окна (`position: fixed`), а не в потоке: в таблице с прокруткой `overflow` обрезал бы
     * его. Закрывается при прокрутке и изменении размера окна; снизу не помещается — открывается вверх.
     */
    fixed?: boolean
  }>(),
  { align: 'right', fixed: false },
)
const emit = defineEmits<{ select: [item: VtPopoverItem] }>()

const uid = useId()
const root = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const menuId = `${uid}-menu`
const triggerAttrs = computed(() => ({
  'data-vt-popover-trigger': '',
  'aria-haspopup': 'menu' as const,
  'aria-expanded': open.value,
  'aria-controls': open.value ? menuId : undefined,
}))

const fixedStyle = ref<Record<string, string>>({})

function place() {
  const anchor = root.value?.getBoundingClientRect()
  if (!props.fixed || !anchor) return
  const height = menu.value?.offsetHeight ?? 0
  const below = anchor.bottom + 6
  const flip = below + height > window.innerHeight && anchor.top - 6 - height >= 0
  fixedStyle.value = {
    top: `${flip ? anchor.top - 6 - height : below}px`,
    ...(props.align === 'right'
      ? { right: `${document.documentElement.clientWidth - anchor.right}px` }
      : { left: `${anchor.left}px` }),
  }
}

function onViewportChange(event?: Event) {
  if (!open.value || !props.fixed) return
  // прокрутка самого меню (длинный список) его не закрывает
  if (event?.target instanceof Node && menu.value?.contains(event.target)) return
  close(false)
}

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
  place()
  await nextTick()
  place()
  entries()[0]?.focus()
})

onMounted(() => {
  document.addEventListener('mousedown', onDocPointer)
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocPointer)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <div ref="root" class="vt-popover-root">
    <slot name="trigger" :open="open" :toggle="() => (open = !open)" :attrs="triggerAttrs" />
    <div
      v-if="open"
      :id="menuId"
      ref="menu"
      class="vt-popover"
      :class="[`vt-popover--${align}`, { 'vt-popover--fixed': fixed }]"
      :style="fixed ? fixedStyle : undefined"
      role="menu"
      :aria-label="label"
      @keydown="onKeydown"
    >
      <template v-for="item in items" :key="item.key">
        <div v-if="item.separator" class="vt-popover__sep" role="separator" />
        <button
          type="button"
          class="vt-popover__item"
          :class="{ 'vt-popover__item--danger': item.tone === 'danger' }"
          role="menuitem"
          :disabled="item.disabled"
          @click="pick(item)"
        >
          <span class="vt-popover__label">
            {{ item.label }}
            <span v-if="item.hint" class="vt-popover__hint">{{ item.hint }}</span>
          </span>
          <span v-if="item.shortcut" class="vt-popover__shortcut">{{ item.shortcut }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

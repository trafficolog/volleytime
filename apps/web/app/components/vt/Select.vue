<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

/** Свой выпадающий список (веб, не нативный select): listbox + aria-activedescendant. */
export interface VtSelectOption {
  value: string
  label: string
  sub?: string
  disabled?: boolean
}

const model = defineModel<string>({ required: true })
const props = defineProps<{
  options: VtSelectOption[]
  label?: string
  placeholder?: string
  disabled?: boolean
}>()

const uid = useId()
const root = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const active = ref(-1)
let typed = ''
let typedTimer: ReturnType<typeof setTimeout> | undefined

const listId = `${uid}-list`
const optionId = (i: number) => `${uid}-opt-${i}`
const selected = computed(() => props.options.find((o) => o.value === model.value))
const activeId = computed(() =>
  open.value && active.value >= 0 ? optionId(active.value) : undefined,
)

function enabledFrom(start: number, step: 1 | -1): number {
  const n = props.options.length
  for (let i = start; i >= 0 && i < n; i += step) if (!props.options[i]!.disabled) return i
  return -1
}

function openList() {
  if (props.disabled) return
  open.value = true
  const idx = props.options.findIndex((o) => o.value === model.value && !o.disabled)
  active.value = idx >= 0 ? idx : enabledFrom(0, 1)
}

function closeList(refocus = true) {
  open.value = false
  active.value = -1
  if (refocus) button.value?.focus()
}

function choose(i: number) {
  const option = props.options[i]
  if (!option || option.disabled) return
  model.value = option.value
  closeList()
}

function move(to: number) {
  if (to >= 0) active.value = to
}

function typeahead(key: string, from: number): number {
  typed += key.toLowerCase()
  clearTimeout(typedTimer)
  typedTimer = setTimeout(() => (typed = ''), 600)
  const n = props.options.length
  const startOffset = typed.length === 1 ? 1 : 0
  for (let k = 0; k < n; k++) {
    const i = (from + startOffset + k + n) % n
    const o = props.options[i]!
    if (!o.disabled && o.label.toLowerCase().startsWith(typed)) return i
  }
  return -1
}

function isPrintable(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  const { key } = event
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
      event.preventDefault()
      openList()
    } else if (isPrintable(event)) {
      // Закрытый список: typeahead меняет значение, как у нативного select.
      const i = typeahead(
        key,
        props.options.findIndex((o) => o.value === model.value),
      )
      if (i >= 0) model.value = props.options[i]!.value
    }
    return
  }
  switch (key) {
    case 'ArrowDown':
      event.preventDefault()
      move(enabledFrom(active.value + 1, 1))
      break
    case 'ArrowUp':
      event.preventDefault()
      move(enabledFrom(active.value - 1, -1))
      break
    case 'Home':
      event.preventDefault()
      move(enabledFrom(0, 1))
      break
    case 'End':
      event.preventDefault()
      move(enabledFrom(props.options.length - 1, -1))
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      choose(active.value)
      break
    case 'Escape':
      event.preventDefault()
      closeList()
      break
    case 'Tab':
      closeList(false)
      break
    default:
      if (isPrintable(event)) {
        const i = typeahead(key, active.value)
        if (i >= 0) active.value = i
      }
  }
}

function onDocPointer(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) closeList(false)
}

onMounted(() => document.addEventListener('mousedown', onDocPointer))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocPointer)
  clearTimeout(typedTimer)
})

watch(active, async () => {
  await nextTick()
  if (activeId.value)
    document.getElementById(activeId.value)?.scrollIntoView?.({ block: 'nearest' })
})
</script>

<template>
  <div ref="root" class="vt-select">
    <button
      ref="button"
      type="button"
      class="vt-field vt-select__button"
      :class="{ 'vt-select__button--open': open }"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="activeId"
      :aria-label="label"
      :disabled="disabled"
      @click="open ? closeList() : openList()"
      @keydown="onKeydown"
    >
      <span class="vt-select__value" :class="{ 'vt-select__value--empty': !selected }">
        {{ selected?.label ?? placeholder ?? '' }}
      </span>
      <svg
        class="vt-select__chevron"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <ul v-show="open" :id="listId" class="vt-select__list" role="listbox" :aria-label="label">
      <li
        v-for="(o, i) in options"
        :id="optionId(i)"
        :key="o.value"
        role="option"
        class="vt-select__option"
        :class="{
          'vt-select__option--active': i === active,
          'vt-select__option--selected': o.value === model,
        }"
        :aria-selected="o.value === model"
        :aria-disabled="o.disabled || undefined"
        @mousedown.prevent
        @mouseenter="!o.disabled && (active = i)"
        @click="choose(i)"
      >
        <span class="vt-select__text">
          {{ o.label }}
          <span v-if="o.sub" class="vt-select__sub">{{ o.sub }}</span>
        </span>
        <svg
          v-if="o.value === model"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--vt-flame)"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m5 12 5 5 9-11" />
        </svg>
      </li>
    </ul>
  </div>
</template>

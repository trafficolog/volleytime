<script setup lang="ts">
import { ref } from 'vue'

/** Сегмент-пилюля (WSeg) и чипы выбора: radiogroup с roving tabindex. */
export interface VtSegmentOption {
  value: string
  label: string
  disabled?: boolean
}

const model = defineModel<string>({ required: true })
const props = withDefaults(
  defineProps<{
    options: VtSegmentOption[]
    label: string
    variant?: 'segment' | 'chips'
    /** Только чтение: пункты в фокусе и озвучиваются, значение не меняется. */
    readonly?: boolean
  }>(),
  { variant: 'segment' },
)

const root = ref<HTMLElement | null>(null)

// Порядок ref-ов из v-for не гарантирован: ищем кнопки по DOM.
function buttonAt(i: number): HTMLButtonElement | undefined {
  return root.value?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[i]
}

function tabbable(i: number): boolean {
  const current = props.options.findIndex((o) => o.value === model.value && !o.disabled)
  if (current >= 0) return i === current
  return i === props.options.findIndex((o) => !o.disabled)
}

function onKeydown(event: KeyboardEvent, from: number) {
  const n = props.options.length
  const { key } = event
  if (props.readonly) return
  let i: number
  if (key === 'Home') i = props.options.findIndex((o) => !o.disabled)
  else if (key === 'End') i = props.options.findLastIndex((o) => !o.disabled)
  else if (
    key === 'ArrowRight' ||
    key === 'ArrowDown' ||
    key === 'ArrowLeft' ||
    key === 'ArrowUp'
  ) {
    const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1
    i = from
    for (let k = 0; k < n; k++) {
      i = (i + step + n) % n
      if (!props.options[i]!.disabled) break
    }
  } else return
  event.preventDefault()
  const option = props.options[i]
  if (!option || option.disabled) return
  model.value = option.value
  buttonAt(i)?.focus()
}
</script>

<template>
  <div
    ref="root"
    class="vt-seg"
    :class="`vt-seg--${variant}`"
    role="radiogroup"
    :aria-label="label"
    :aria-readonly="readonly || undefined"
  >
    <button
      v-for="(o, i) in options"
      :key="o.value"
      type="button"
      class="vt-seg__item"
      role="radio"
      :aria-checked="o.value === model"
      :tabindex="tabbable(i) ? 0 : -1"
      :disabled="o.disabled"
      :aria-disabled="readonly || undefined"
      @click="!readonly && (model = o.value)"
      @keydown="onKeydown($event, i)"
    >
      {{ o.label }}
    </button>
  </div>
</template>

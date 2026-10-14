<script setup lang="ts">
import { nextTick, onUnmounted, ref, useId, watch } from 'vue'

/** Модальное подтверждение по центру (до 360 px): role=alertdialog, ловушка фокуса. */
const open = defineModel<boolean>({ default: false })
const props = withDefaults(
  defineProps<{
    title: string
    body?: string
    confirmLabel: string
    cancelLabel?: string
    danger?: boolean
  }>(),
  { cancelLabel: 'Отмена' },
)
const emit = defineEmits<{ confirm: [] }>()

const uid = useId()
const titleId = `${uid}-title`
const bodyId = `${uid}-body`
const dialog = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const cancelBtn = ref<HTMLButtonElement | null>(null)
let trigger: HTMLElement | null = null
const previousInert = new Map<HTMLElement, boolean>()

function controls(): HTMLElement[] {
  return [...(panel.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
}

function restore() {
  for (const [element, wasInert] of previousInert) element.inert = wasInert
  previousInert.clear()
  if (trigger?.isConnected) trigger.focus()
  trigger = null
}

function confirm() {
  emit('confirm')
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
    return
  }
  if (event.key !== 'Tab') return
  const list = controls()
  const first = list[0]
  const last = list[list.length - 1]
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  const inside = panel.value?.contains(active)
  // Фокус на самой панели (клик по тексту) или вне неё: возвращаем в цикл кнопок.
  const atEdge = !inside || active === panel.value
  if (event.shiftKey && (active === first || atEdge)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || atEdge)) {
    event.preventDefault()
    first.focus()
  }
}

// Клик по тексту внутри панели или по пустому месту уводит фокус на body: Esc и Tab перестали бы
// доходить до диалога. Возвращаем фокус на панель.
function onFocusout(event: FocusEvent) {
  if (event.relatedTarget) return
  queueMicrotask(() => {
    if (!open.value || !dialog.value?.isConnected) return
    const active = document.activeElement
    if (!active || active === document.body) panel.value?.focus()
  })
}

watch(
  open,
  async (isOpen) => {
    if (typeof document === 'undefined') return
    if (!isOpen) {
      await nextTick()
      restore()
      return
    }
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (!open.value || !dialog.value) return
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === dialog.value) continue
      // Live-регион тостов должен оставаться доступным скринридеру поверх диалога.
      if (child.hasAttribute('data-vt-toast-host')) continue
      previousInert.set(child, child.inert)
      child.inert = true
    }
    // Безопасный выбор по умолчанию — «Отмена», даже у опасного действия.
    cancelBtn.value?.focus()
  },
  { immediate: true, flush: 'post' },
)

onUnmounted(restore)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="dialog"
      class="vt-alert-root"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="props.body ? bodyId : undefined"
      @keydown="onKeydown"
      @focusout="onFocusout"
    >
      <div class="vt-alert-scrim" aria-hidden="true" @click="open = false" />
      <div ref="panel" class="vt-alert" tabindex="-1">
        <h2 :id="titleId" class="vt-alert__title">{{ title }}</h2>
        <p v-if="body" :id="bodyId" class="vt-alert__body">{{ body }}</p>
        <div class="vt-alert__actions">
          <button
            ref="cancelBtn"
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm"
            @click="open = false"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="vt-btn vt-btn--sm"
            :class="danger ? 'vt-btn--rose' : 'vt-btn--ink'"
            @click="confirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

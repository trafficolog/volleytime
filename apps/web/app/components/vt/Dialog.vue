<script setup lang="ts">
import { nextTick, onUnmounted, ref, useId, watch } from 'vue'

import VtIcon from './Icon.vue'

/**
 * Модальное окно с формой (24.1.3): заголовок, подзаголовок, тело и подвал. В отличие от VtAlert
 * не закрывается само на «подтвердить»: форма сама решает, когда закрыть (ошибка сервера
 * остаётся видна). Ловушка фокуса, Esc, фон недоступен (`inert`), фокус возвращается на кнопку.
 */
const open = defineModel<boolean>({ default: false })
const props = withDefaults(
  defineProps<{
    title: string
    sub?: string
    /** `md` — 460 px, `lg` — 760 px (форма с превью сообщения). */
    size?: 'md' | 'lg'
    /** Не закрывать по Esc и клику по фону (идёт запрос). */
    busy?: boolean
  }>(),
  { sub: '', size: 'md', busy: false },
)

const uid = useId()
const titleId = `${uid}-title`
const subId = `${uid}-sub`
const dialog = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
let trigger: HTMLElement | null = null
const previousInert = new Map<HTMLElement, boolean>()

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function controls(): HTMLElement[] {
  return [...(panel.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

function close() {
  if (props.busy) return
  open.value = false
}

function restore() {
  for (const [element, wasInert] of previousInert) element.inert = wasInert
  previousInert.clear()
  if (trigger?.isConnected) trigger.focus()
  trigger = null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const list = controls()
  const first = list[0]
  const last = list[list.length - 1]
  if (!first || !last) {
    event.preventDefault()
    panel.value?.focus()
    return
  }
  const active = document.activeElement
  const atEdge = !panel.value?.contains(active) || active === panel.value
  if (event.shiftKey && (active === first || atEdge)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || atEdge)) {
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
      restore()
      return
    }
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (!open.value || !dialog.value) return
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === dialog.value) continue
      // Live-регион тостов остаётся доступным скринридеру поверх окна.
      if (child.hasAttribute('data-vt-toast-host')) continue
      previousInert.set(child, child.inert)
      child.inert = true
    }
    const autofocus = panel.value?.querySelector<HTMLElement>('[data-autofocus]')
    ;(autofocus ?? panel.value)?.focus()
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
      class="vt-dialog-root"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="sub ? subId : undefined"
      @keydown="onKeydown"
    >
      <div class="vt-dialog-scrim" aria-hidden="true" @click="close" />
      <div ref="panel" class="vt-dialog" :class="`vt-dialog--${size}`" tabindex="-1">
        <header class="vt-dialog__head">
          <div>
            <h2 :id="titleId" class="vt-dialog__title">{{ title }}</h2>
            <p v-if="sub" :id="subId" class="vt-dialog__sub">{{ sub }}</p>
          </div>
          <button
            type="button"
            class="vt-btn vt-btn--ghost vt-btn--sm vt-dialog__close"
            aria-label="Закрыть"
            :disabled="busy"
            @click="close"
          >
            <VtIcon name="close" :size="14" />
          </button>
        </header>
        <div class="vt-dialog__body"><slot /></div>
        <footer v-if="$slots.footer" class="vt-dialog__foot"><slot name="footer" /></footer>
      </div>
    </div>
  </Teleport>
</template>

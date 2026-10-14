import { readonly, ref } from 'vue'

export type ToastTone = 'ok' | 'danger'
export interface ToastState {
  id: number
  message: string
  tone: ToastTone
}

/** Время показа тоста, мс (reference-v3: 2,4 с). */
export const TOAST_DURATION_MS = 2400

const current = ref<ToastState | null>(null)
let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined

/** Один активный тост: новый заменяет предыдущий и перезапускает таймер. */
export function useToast() {
  function dismiss() {
    clearTimeout(timer)
    current.value = null
  }
  function show(message: string, tone: ToastTone = 'ok') {
    // Состояние модуля общее для всех запросов SSR: на сервере тосты не показываем.
    if (typeof window === 'undefined') return
    clearTimeout(timer)
    current.value = { id: ++seq, message, tone }
    timer = setTimeout(dismiss, TOAST_DURATION_MS)
  }
  return { current: readonly(current), show, dismiss }
}

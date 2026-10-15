/**
 * Навигация «назад» Mini App (Task 20.4.1): куда ведёт системная BackButton Telegram
 * с любого экрана и как закрываются наложения (лист, диалог) до ухода с экрана.
 * Чистые функции без Telegram/Nuxt — покрыты юнит-тестами.
 */

function normalize(raw: string): string {
  const path = (raw.split(/[?#]/)[0] ?? '').replace(/\/+$/, '')
  return path || '/'
}

/** Экран-родитель или `null` для корней (там системная кнопка — «Закрыть»). */
export function miniAppBackTarget(raw: string): string | null {
  const path = normalize(raw)
  if (path === '/m' || path === '/m/orgs') return null
  if (!path.startsWith('/m/')) return null
  // Вход по приглашению — отдельная точка входа, «назад» = закрыть Mini App.
  if (path.startsWith('/m/invite/')) return null
  // Корни вкладок (игрок: Главная/Абонементы/Профиль; организатор: События/Игроки/Касса/Оплаты):
  // как в tab-приложениях Telegram, «назад» нет; в другую группу — через переключатель в шапке.
  if (/^\/m\/orgs\/\d+(\/(subscriptions|profile|members|cashbox|payments))?$/.test(path))
    return null
  if (/^\/m\/orgs\/\d+\/events\/[^/]+\/edit$/.test(path)) return path.replace(/\/edit$/, '/manage')
  return path.slice(0, path.lastIndexOf('/'))
}

/** Формы нельзя «открывать заново» историей: после отправки возвращаемся к родителю. */
export function isFormRoute(raw: string): boolean {
  const path = normalize(raw)
  return (
    path === '/m/orgs/create' ||
    /^\/m\/orgs\/\d+\/events\/new$/.test(path) ||
    /^\/m\/orgs\/\d+\/events\/[^/]+\/edit$/.test(path)
  )
}

interface Overlay {
  close: () => void
}

const overlays: Overlay[] = []
const listeners = new Set<() => void>()

function notify() {
  for (const listener of [...listeners]) listener()
}

/** Открытое наложение перехватывает «назад» первым; возвращает функцию снятия. */
export function registerBackOverlay(close: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const overlay: Overlay = { close }
  overlays.push(overlay)
  notify()
  return () => {
    const index = overlays.indexOf(overlay)
    if (index === -1) return
    overlays.splice(index, 1)
    notify()
  }
}

export function overlayCount(): number {
  return overlays.length
}

/** Закрывает верхнее наложение. `false` — наложений нет. */
export function closeTopBackOverlay(): boolean {
  const top = overlays[overlays.length - 1]
  if (!top) return false
  top.close()
  return true
}

export function subscribeBackOverlays(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

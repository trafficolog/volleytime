import type { FeatureEventKind, PlayerFeature } from '@volley-time/shared'

/**
 * Событие функции игрока для аналитики (23.1.2, D-25). Сервер пишет одно событие вида на игрока,
 * функцию и сутки, поэтому звать можно на каждом открытии экрана. Ошибка не мешает экрану.
 */
export function trackFeatureEvent(feature: PlayerFeature, kind: FeatureEventKind): void {
  $fetch('/api/me/feature-events', { method: 'POST', body: { feature, kind } }).catch(
    () => undefined,
  )
}

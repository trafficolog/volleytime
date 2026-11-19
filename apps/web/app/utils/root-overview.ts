import type {
  PlatformGateKey,
  PlatformGateMetric,
  PlatformOverview,
  PlatformWeekCounter,
} from '@volley-time/shared'

import { pluralRu } from '~/utils/desktop-players'

/**
 * Что делает страница `/root` с ошибкой загрузки обзора. Сессия клиента не несёт `isRootAdmin`
 * (better-auth отдаёт только базовые поля пользователя), поэтому доступ решают сервер: 403 страницы
 * (`server/middleware/root-pages.ts`) и 401/403 API. 403 при переходе внутри приложения — страница
 * ошибки 403, 401 (сессия истекла) — на вход.
 */
export function rootOverviewFailure(status: number | undefined): 'forbidden' | 'login' | 'failed' {
  if (status === 403) return 'forbidden'
  if (status === 401) return 'login'
  return 'failed'
}

export interface RootNavItem {
  key: string
  label: string
  icon: string
  /** `null` — экран ещё не реализован (соседние карточки 22.x): пункт неактивен. */
  to: string | null
}

/** Разделы Root Admin по референсу 4b; ссылку получает пункт, когда его экран появился. */
export function rootNavItems(): RootNavItem[] {
  return [
    { key: 'overview', label: 'Обзор платформы', icon: 'chart', to: '/root' },
    { key: 'organizations', label: 'Организации', icon: 'home', to: '/root/organizations' },
    { key: 'users', label: 'Пользователи', icon: 'users', to: '/root/users' },
    { key: 'billing', label: 'Баланс и тарифы', icon: 'card', to: '/root/billing' },
    { key: 'audit', label: 'Аудит', icon: 'clock', to: '/root/audit' },
    { key: 'settings', label: 'Настройки', icon: 'settings', to: null },
  ]
}

export function weekDeltaLabel(counter: PlatformWeekCounter): {
  text: string
  direction: 'up' | 'down' | 'flat'
} {
  const diff = counter.current - counter.previous
  if (diff > 0) return { text: `+${diff} к прошлой неделе`, direction: 'up' }
  if (diff < 0) return { text: `−${-diff} к прошлой неделе`, direction: 'down' }
  return { text: 'без изменений к прошлой неделе', direction: 'flat' }
}

const GATE_LABELS: Record<PlatformGateKey, string> = {
  activeOrganizers: 'Активные организаторы за 30 дней',
  retention4weeks: 'Ретеншн: 4 недели подряд',
  totalEvents: 'Событий создано',
  totalBookings: 'Записей всего',
}

export interface GateMetricView {
  key: PlatformGateKey
  label: string
  valueText: string
  targetText: string
  percent: number
  state: 'reached' | 'progress' | 'risk'
  statusText: string
}

export function gateMetricView(metric: PlatformGateMetric): GateMetricView {
  const percent =
    metric.target > 0 ? Math.min(100, Math.round((metric.value / metric.target) * 100)) : 0
  const state = metric.reached ? 'reached' : metric.value === 0 ? 'risk' : 'progress'
  return {
    key: metric.key,
    label: GATE_LABELS[metric.key],
    valueText: `${metric.value} / ${metric.target}`,
    targetText: `цель: ${metric.target}`,
    percent,
    state,
    statusText: { reached: 'цель достигнута', progress: 'на пути', risk: 'нет данных' }[state],
  }
}

const MIN_BAR_HEIGHT = 4

export function bookingBars(
  daily: PlatformOverview['bookingsDaily'],
): { date: string; count: number; height: number; today: boolean }[] {
  const max = Math.max(1, ...daily.map((d) => d.count))
  return daily.map((d, i) => ({
    ...d,
    height: Math.max(MIN_BAR_HEIGHT, Math.round((d.count / max) * 100)),
    today: i === daily.length - 1,
  }))
}

export function rootOverviewView(overview: PlatformOverview) {
  const { northStar, week } = overview
  return {
    subtitle: `${northStar.registered} ${pluralRu(northStar.registered, 'организация', 'организации', 'организаций')}`,
    northStar: {
      value: northStar.activeThisWeek,
      delta: weekDeltaLabel({
        current: northStar.activeThisWeek,
        previous: northStar.activePreviousWeek,
      }),
      caption: `из ${northStar.registered} зарегистрированных`,
    },
    events: { value: week.events.current, delta: weekDeltaLabel(week.events) },
    bookings: { value: week.bookings.current, delta: weekDeltaLabel(week.bookings) },
    bars: bookingBars(overview.bookingsDaily),
    bookingsTotal14d: overview.bookingsDaily.reduce((sum, d) => sum + d.count, 0),
    gate: overview.gate.map(gateMetricView),
    reachedCount: overview.gate.filter((m) => m.reached).length,
  }
}

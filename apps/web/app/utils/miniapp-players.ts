import type { MemberRow } from '~/composables/useOrganizations'
import { PLAYER_FETCH_STATUSES, type PlayersTab } from '~/utils/desktop-players'

/** Mini App организатора (M-24, 21.1.3): вкладки и сводка списка игроков; цифры даёт API (21.2.20). */

/** Все статусы одним запросом, как в кабинете; «вышел» и «отклонён» в списке не показываются. */
export const MINIAPP_FETCH_STATUSES = PLAYER_FETCH_STATUSES

export type MiniappPlayersTab = Extract<PlayersTab, 'active' | 'pending' | 'all'>

export const MINIAPP_PLAYER_TABS: { id: MiniappPlayersTab; label: string }[] = [
  { id: 'active', label: 'Активные' },
  { id: 'pending', label: 'Заявки' },
  { id: 'all', label: 'Все' },
]

export interface PlayersSummary {
  active: number
  withSubscription: number | null
  withDebt: number | null
}

/**
 * Плитки сводки над списком: активные игроки, из них с действующим абонементом и с долгом.
 * Считаются по готовым агрегатам API (те же правила, что в кабинете); без агрегатов (`stats` не
 * пришли) плитки абонементов и долга — `null`.
 */
export function playersSummary(members: readonly MemberRow[]): PlayersSummary {
  const active = members.filter((m) => m.status === 'active')
  const hasStats = active.every((m) => m.stats !== undefined)
  return {
    active: active.length,
    withSubscription: hasStats ? active.filter((m) => m.stats!.subscription !== null).length : null,
    withDebt: hasStats
      ? active.filter((m) => m.stats!.debt.amount > 0 || m.stats!.debt.seats > 0).length
      : null,
  }
}

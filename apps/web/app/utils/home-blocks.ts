import type { PlayerFeature, PlayerFeatures } from '@volley-time/shared'

/**
 * Контракт блоков «Сегодня» на главной игрока (23.2.1, M-03).
 *
 * Блок виден, только если выполнены оба условия: включён хотя бы один из его флагов личных
 * функций (`GET /api/me/features`, 23.1.1) И у него есть данные. Без данных блок не рисуется, а
 * заголовок «Сегодня» не показывается, пока нет ни одного блока: пустых заголовков не бывает.
 * Моковых данных и заглушек нет: источники данных появляются в карточках самих блоков.
 *
 * Как подключить блок (карточки 25.1.1, 25.1.2, 26.1.1, 26.1.2, 26.1.4, 26.1.5):
 * 1. Сузить тип слота в `HomeBlockDataMap` до формы данных блока (сейчас `unknown`).
 * 2. Положить загруженные данные в `homeBlockData` на `pages/m/orgs/[orgId]/index.vue`
 *    (ключ блока); пока источника нет, слот отсутствует (`undefined`/`null`) и блок скрыт.
 * 3. Передать содержимое блока в слот `HomeTodayBlocks` с именем блока. Заголовок блока рисует
 *    сам блок внутри слота: общий компонент рисует только «Сегодня».
 *
 * Флаги блока: `flags` — «любой из». В `VisibleHomeBlock.flags` попадают только включённые, чтобы
 * блок с двумя флагами («После игры»: `self`, `mvp`) показывал лишь включённые части.
 */
export type HomeBlockId = 'teams' | 'warmup' | 'afterGame' | 'coach' | 'wrapped'

/** Форма данных блока. Каждая карточка блока заменяет `unknown` своим типом. */
export interface HomeBlockDataMap {
  /** 26.1.2: составы команд на ближайшую игру. */
  teams: unknown
  /** 25.1.1: разминка перед игрой. */
  warmup: unknown
  /** 25.1.2 (оценка формы) и 26.1.1 (голосование MVP): блок «После игры». */
  afterGame: unknown
  /** 26.1.4: неделя тренера. */
  coach: unknown
  /** 26.1.5: итоги сезона. */
  wrapped: unknown
}

/** Данные блоков главной; отсутствующий ключ, `null` и пустой массив значат «данных нет». */
export type HomeBlockData = { [K in HomeBlockId]?: HomeBlockDataMap[K] | null }

export interface HomeBlockSpec {
  id: HomeBlockId
  /** Блок доступен, если включён любой из флагов. */
  flags: readonly PlayerFeature[]
}

/** Порядок массива — порядок блоков на экране (макет M-03). */
export const HOME_BLOCKS: readonly HomeBlockSpec[] = [
  { id: 'teams', flags: ['teams'] },
  { id: 'warmup', flags: ['warmup'] },
  { id: 'afterGame', flags: ['self', 'mvp'] },
  { id: 'coach', flags: ['coach'] },
  { id: 'wrapped', flags: ['wrapped'] },
]

export interface VisibleHomeBlock {
  id: HomeBlockId
  /** Только включённые флаги блока. */
  flags: PlayerFeature[]
  data: unknown
}

function hasData(value: unknown): boolean {
  if (value === undefined || value === null) return false
  return !(Array.isArray(value) && value.length === 0)
}

/** Блоки «Сегодня», которые нужно показать: флаг включён и данные есть. */
export function visibleHomeBlocks(
  features: PlayerFeatures,
  data: HomeBlockData,
): VisibleHomeBlock[] {
  const result: VisibleHomeBlock[] = []
  for (const spec of HOME_BLOCKS) {
    const flags = spec.flags.filter((flag) => features[flag])
    const slot = data[spec.id]
    if (flags.length === 0 || !hasData(slot)) continue
    result.push({ id: spec.id, flags, data: slot })
  }
  return result
}

/** Ссылка «Лишнее на главной?» на экран «Что показывать» (23.2.3). */
export const homeFeaturesLink = (orgId: number) => `/m/orgs/${orgId}/features`

/**
 * Показывается, пока включена хотя бы одна функция: в режиме «Только игры» выключать на главной
 * нечего.
 */
export const showHomeFeaturesLink = (features: PlayerFeatures) =>
  Object.values(features).some(Boolean)

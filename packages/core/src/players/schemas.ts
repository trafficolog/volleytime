import { resolveReportPeriod } from '@volley-time/shared'
import { z } from 'zod'

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')

/**
 * Запрос списка игроков с агрегатами (21.2.20): `stats=1` включает их (только управляющим);
 * `from`/`to` — период посещаемости в датах группы, оба сразу или ни одного (по умолчанию —
 * последние 90 дней). Период — как у отчётов: не длиннее года.
 */
export const PlayersStatsQuery = z
  .object({
    stats: z
      .enum(['0', '1'])
      .optional()
      .transform((v) => v === '1'),
    from: LocalDate.optional(),
    to: LocalDate.optional(),
  })
  .refine((p) => (p.from === undefined) === (p.to === undefined), {
    message: 'Период: укажите обе даты или ни одной',
    path: ['to'],
  })
  .refine((p) => !p.from || !p.to || resolveReportPeriod(p.from, p.to, 'UTC') !== null, {
    message: 'Период: даты ГГГГ-ММ-ДД, начало не позже конца, не длиннее года',
    path: ['to'],
  })
export type PlayersStatsQuery = z.infer<typeof PlayersStatsQuery>

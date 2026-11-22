import { db as defaultDb, featureEvents, sql } from '@volley-time/db'
import {
  cohortMetric,
  FEATURE_ANALYTICS_MIN_COHORT,
  FEATURE_ANALYTICS_WINDOWS,
  FEATURE_EVENTS_RETENTION_DAYS,
  FeatureEventInput,
  PLAYER_FEATURES,
  type FeatureAnalyticsReport,
  type PlayerFeature,
} from '@volley-time/shared'

import { assertRootAdmin } from '../permissions/root'
import { getDb, type ServiceContext } from '../shared/context'

const DAY_MS = 86_400_000

/** Запись — занятое место, как в обзоре платформы (22.1.1): очередь и отмены не считаются. */
const COUNTED_BOOKING_STATUSES = sql.raw(`('pending_payment', 'confirmed', 'attended', 'no_show')`)

const iso = (d: Date) => d.toISOString()
const daysBefore = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS)

/**
 * Игроки платформы: активное участие хотя бы в одной живой группе (не архивной и не удалённой).
 * Знаменатель доли выключивших и когорты частоты записей.
 */
const PLAYERS_CTE = sql`players AS (
  SELECT DISTINCT m.user_id FROM organization_members m
  JOIN organizations o ON o.id = m.organization_id
  WHERE m.status = 'active' AND o.status <> 'archived' AND o.deleted_at IS NULL
)`

type Row = Record<string, unknown>
const num = (v: unknown) => Number(v ?? 0)
const byFeature = (rows: readonly Row[]) => new Map(rows.map((r) => [String(r.feature), r]))
const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null)

/**
 * Аналитика функций игрока (23.1.2, P-14, решение D-25). Приём событий принадлежит игроку и
 * дедуплицируется по суткам UTC; отчёт — только Root Admin и только агрегаты по платформе:
 * ни игроки, ни группы в ответ не попадают, когорта меньше 10 скрывается.
 */
export const featureAnalyticsService = {
  /**
   * Записать событие функции. Одно событие вида на игрока, функцию и сутки UTC: повтор не пишется
   * (`recorded: false`), поэтому частые открытия не раздувают таблицу и не нужен отдельный лимит.
   */
  async record(
    ctx: ServiceContext,
    input: unknown,
    now: Date = new Date(),
  ): Promise<{ recorded: boolean }> {
    const data = FeatureEventInput.parse(input)
    const rows = await getDb(ctx)
      .insert(featureEvents)
      .values({
        userId: ctx.userId,
        feature: data.feature,
        kind: data.kind,
        day: iso(now).slice(0, 10),
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: featureEvents.id })
    return { recorded: rows.length > 0 }
  },

  async report(ctx: ServiceContext, now: Date = new Date()): Promise<FeatureAnalyticsReport> {
    await assertRootAdmin(ctx)
    const db = getDb(ctx)
    const { activeDays, retentionDays, frequencyDays } = FEATURE_ANALYTICS_WINDOWS
    const activeFrom = iso(daysBefore(now, activeDays))
    const cohortFrom = iso(daysBefore(now, 2 * retentionDays))
    const cohortTo = iso(daysBefore(now, retentionDays))
    const frequencyFrom = iso(daysBefore(now, frequencyDays))
    const until = iso(now)
    const retentionWindow = sql.raw(`interval '${retentionDays} days'`)

    const [totals, disabled, active, retention] = await Promise.all([
      // все игроки и их записи за окно частоты
      db.execute(sql`WITH ${PLAYERS_CTE},
        bk AS (
          SELECT user_id, count(*)::int AS n FROM bookings
          WHERE status IN ${COUNTED_BOOKING_STATUSES}
            AND created_at >= ${frequencyFrom}::timestamptz AND created_at < ${until}::timestamptz
          GROUP BY user_id
        )
        SELECT count(*)::int AS players, coalesce(sum(bk.n), 0)::int AS bookings
        FROM players p LEFT JOIN bk ON bk.user_id = p.user_id`),
      // выключившие функцию игроки и их записи за окно частоты
      db.execute(sql`WITH ${PLAYERS_CTE},
        bk AS (
          SELECT user_id, count(*)::int AS n FROM bookings
          WHERE status IN ${COUNTED_BOOKING_STATUSES}
            AND created_at >= ${frequencyFrom}::timestamptz AND created_at < ${until}::timestamptz
          GROUP BY user_id
        )
        SELECT uf.feature, count(*)::int AS players, coalesce(sum(bk.n), 0)::int AS bookings
        FROM players p
        JOIN user_features uf ON uf.user_id = p.user_id AND uf.enabled = false
        LEFT JOIN bk ON bk.user_id = p.user_id
        GROUP BY uf.feature`),
      db.execute(sql`
        SELECT feature, count(DISTINCT user_id)::int AS players FROM feature_events
        WHERE created_at >= ${activeFrom}::timestamptz AND created_at < ${until}::timestamptz
        GROUP BY feature`),
      // когорта — первое открытие в окне; удержание — запись в следующие retentionDays суток
      db.execute(sql`WITH first_open AS (
          SELECT feature, user_id, min(created_at) AS at FROM feature_events
          WHERE kind = 'open'
            AND created_at >= ${cohortFrom}::timestamptz AND created_at < ${cohortTo}::timestamptz
          GROUP BY feature, user_id
        )
        SELECT f.feature, count(*)::int AS players,
          count(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.user_id = f.user_id AND b.status IN ${COUNTED_BOOKING_STATUSES}
              AND b.created_at > f.at AND b.created_at <= f.at + ${retentionWindow}
          ))::int AS retained
        FROM first_open f GROUP BY f.feature`),
    ])

    const allPlayers = num(totals[0]?.players)
    const allBookings = num(totals[0]?.bookings)
    const disabledBy = byFeature(disabled)
    const activeBy = byFeature(active)
    const retentionBy = byFeature(retention)

    const features = PLAYER_FEATURES.map((feature: PlayerFeature) => {
      const off = disabledBy.get(feature)
      const offPlayers = num(off?.players)
      const offBookings = num(off?.bookings)
      const onPlayers = allPlayers - offPlayers
      const activePlayers = num(activeBy.get(feature)?.players)
      const ret = retentionBy.get(feature)
      const cohort = num(ret?.players)
      return {
        feature,
        disabledShare: cohortMetric(allPlayers, ratio(offPlayers, allPlayers)),
        weeklyActive: cohortMetric(activePlayers, activePlayers),
        retention: cohortMetric(cohort, ratio(num(ret?.retained), cohort)),
        bookingFrequency: {
          on: cohortMetric(onPlayers, ratio(allBookings - offBookings, onPlayers)),
          off: cohortMetric(offPlayers, ratio(offBookings, offPlayers)),
        },
      }
    })

    return {
      generatedAt: until,
      minCohort: FEATURE_ANALYTICS_MIN_COHORT,
      retentionDays: FEATURE_EVENTS_RETENTION_DAYS,
      windows: FEATURE_ANALYTICS_WINDOWS,
      players: allPlayers >= FEATURE_ANALYTICS_MIN_COHORT ? allPlayers : null,
      features,
    }
  },
}

/**
 * Удалить события старше 180 дней (D-25). Шаг планировщика раз в час, порциями, как очистка
 * журнала уведомлений; индекс `feature_events_created_idx`.
 */
export async function purgeExpiredFeatureEvents(now: Date, limit = 5000): Promise<number> {
  const before = iso(daysBefore(now, FEATURE_EVENTS_RETENTION_DAYS))
  const rows = await defaultDb.execute(sql`
    DELETE FROM ${featureEvents} WHERE id IN (
      SELECT id FROM ${featureEvents} WHERE created_at < ${before}::timestamptz LIMIT ${limit}
    )
    RETURNING id`)
  return rows.length
}

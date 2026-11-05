import {
  ReportExportQuery,
  ReportExportTooLargeError,
  reportsService,
  requireCanManageContent,
} from '@volley-time/core'
import type { ReportExportPreview } from '@volley-time/shared'

/** Строк предпросмотра выгрузки на экране экспорта. */
const PREVIEW_ROWS = 4

/**
 * Выгрузка отчёта в CSV (W-10, 21.2.7): финансовый (записи кассы периода) или посещаемость.
 * Только manager своей группы; формулы в ячейках нейтрализуются, время — в часовом поясе
 * группы. `preview=1` вместо файла отдаёт JSON с числом строк, размером и первыми строками.
 * Слишком большая выборка — 422.
 */
export default defineApiHandler(async (event) => {
  requireCanManageContent(event.context.member ?? null)
  const ctx = createServiceContextFromEvent(event)
  const query = ReportExportQuery.parse(getQuery(event))
  let data
  try {
    data = await reportsService.buildExport(ctx, event.context.organization!.id, query)
  } catch (e) {
    if (e instanceof ReportExportTooLargeError) {
      throw createError({
        statusCode: 422,
        statusMessage: e.message,
        data: { code: e.code },
      })
    }
    throw e
  }
  setResponseHeader(event, 'cache-control', 'no-store')
  if (query.preview) {
    return {
      type: data.type,
      columns: data.columns,
      rows: data.rows.slice(0, PREVIEW_ROWS),
      total: data.rows.length,
      bytes: Buffer.byteLength(data.csv, 'utf8'),
    } satisfies ReportExportPreview
  }
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(
    event,
    'content-disposition',
    `attachment; filename="report-${query.type}-${query.from}_${query.to}.csv"`,
  )
  return data.csv
})

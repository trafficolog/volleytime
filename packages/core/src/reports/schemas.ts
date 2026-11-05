import {
  REPORT_EXPORT_COLUMNS,
  REPORT_EXPORT_TYPES,
  resolveReportPeriod,
} from '@volley-time/shared'
import { z } from 'zod'

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')

/**
 * Период отчёта в датах группы: `from` и `to` включительно, не длиннее года. Границы в моменты
 * времени сервер строит сам по часовому поясу группы.
 */
export const ReportPeriodQuery = z
  .object({ from: LocalDate, to: LocalDate })
  .refine((p) => resolveReportPeriod(p.from, p.to, 'UTC') !== null, {
    message: 'Период: даты ГГГГ-ММ-ДД, начало не позже конца, не длиннее года',
    path: ['to'],
  })
export type ReportPeriodQuery = z.infer<typeof ReportPeriodQuery>

/**
 * Запрос выгрузки: тип отчёта, период и колонки через запятую (по умолчанию — колонки по
 * умолчанию типа); `preview=1` вернёт JSON с первыми строками вместо файла.
 */
export const ReportExportQuery = z
  .object({
    type: z.enum(REPORT_EXPORT_TYPES),
    from: LocalDate,
    to: LocalDate,
    columns: z
      .string()
      .max(200)
      .optional()
      .transform((v) => (v ? v.split(',').filter(Boolean) : undefined)),
    preview: z
      .enum(['0', '1'])
      .optional()
      .transform((v) => v === '1'),
  })
  .refine((p) => resolveReportPeriod(p.from, p.to, 'UTC') !== null, {
    message: 'Период: даты ГГГГ-ММ-ДД, начало не позже конца, не длиннее года',
    path: ['to'],
  })
  .refine(
    (p) => {
      const known = REPORT_EXPORT_COLUMNS[p.type].map((c) => c.key)
      return !p.columns || p.columns.every((key) => known.includes(key))
    },
    { message: 'Неизвестная колонка отчёта', path: ['columns'] },
  )
export type ReportExportQuery = z.infer<typeof ReportExportQuery>

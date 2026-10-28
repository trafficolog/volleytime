import { z } from 'zod'

/** Максимальная сумма одной операции: 100 000.00 в минорных единицах. */
export const MAX_LEDGER_AMOUNT = 10_000_000

/** Расход организатора (Task 6.8.7). Суммы — целые минорные единицы. Комментарий обязателен (21.2.3). */
export const AddExpenseInput = z.object({
  category: z.enum(['rent', 'equipment', 'salary', 'other']),
  amount: z.number().int().positive().max(MAX_LEDGER_AMOUNT),
  description: z.string().trim().min(1, 'Укажите комментарий к операции').max(500),
  occurredAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + 86_400_000, 'Дата операции не может быть в будущем')
    .optional(),
  eventId: z.number().int().positive().optional(),
})
export type AddExpenseInput = z.input<typeof AddExpenseInput>

/** Ручной доход (взнос, спонсорство, прочее) — без платежа (Task 6.8.9). */
export const AddIncomeInput = z.object({
  category: z.enum(['contribution', 'carryover', 'donation', 'sponsorship', 'other_income']),
  amount: z.number().int().positive().max(MAX_LEDGER_AMOUNT),
  description: z.string().trim().min(1, 'Укажите комментарий к операции').max(500),
  occurredAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + 86_400_000, 'Дата операции не может быть в будущем')
    .optional(),
  eventId: z.number().int().positive().optional(),
})
export type AddIncomeInput = z.input<typeof AddIncomeInput>

const LEDGER_CATEGORIES = [
  'payment_income',
  'rent',
  'equipment',
  'refund',
  'salary',
  'other',
  'donation',
  'sponsorship',
  'other_income',
  'contribution',
  'carryover',
] as const

/** Фильтры журнала кассы (21.2.3): тип, категория, период по дате операции. */
export const LedgerFilterQuery = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.enum(LEDGER_CATEGORIES).optional(),
  /** Дата операции не раньше (включительно) */
  from: z.coerce.date().optional(),
  /** Дата операции раньше (не включительно) */
  to: z.coerce.date().optional(),
})

/** Журнал кассы с постраничным чтением. */
export const LedgerHistoryQuery = LedgerFilterQuery.extend({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
})
export type LedgerHistoryQuery = z.infer<typeof LedgerHistoryQuery>

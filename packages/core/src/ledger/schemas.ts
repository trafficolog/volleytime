import { z } from 'zod'

/** Максимальная сумма одной операции: 100 000.00 в минорных единицах. */
export const MAX_LEDGER_AMOUNT = 10_000_000

/** Расход организатора (Task 6.8.7). Суммы — целые минорные единицы. */
export const AddExpenseInput = z.object({
  category: z.enum(['rent', 'equipment', 'salary', 'other']),
  amount: z.number().int().positive().max(MAX_LEDGER_AMOUNT),
  description: z.string().trim().max(500).optional(),
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
  description: z.string().trim().max(500).optional(),
  occurredAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + 86_400_000, 'Дата операции не может быть в будущем')
    .optional(),
  eventId: z.number().int().positive().optional(),
})
export type AddIncomeInput = z.input<typeof AddIncomeInput>

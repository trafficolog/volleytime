import { z } from 'zod'

/** Способы оплаты группы (21.2.11); онлайн-способы — фаза 12, в модели их нет. */
export const PAYMENT_METHOD_CODES = ['cash', 'transfer'] as const
export const PaymentMethodCode = z.enum(PAYMENT_METHOD_CODES)
export type PaymentMethodCode = z.infer<typeof PaymentMethodCode>

/**
 * 9+ цифр подряд в тексте — похоже на номер карты или счёта. Между цифрами допускается любая
 * серия разделителей (пробелы, любые тире, точки, слэши, подчёркивания и т. п.), цифры — любые
 * Unicode (в том числе полноширинные), чтобы запись не обходила проверку.
 */
const LONG_DIGIT_RUN = /\p{Nd}(?:[\s\p{Pd}._/\\,:;|]*\p{Nd}){8,}/u

const detailText = z
  .string()
  .trim()
  .max(100, 'Не длиннее 100 символов')
  .refine(
    (v) => !LONG_DIGIT_RUN.test(v),
    'Номер карты не принимается: укажите только последние 4 цифры',
  )
  .nullable()
  .transform((v) => (v === '' ? null : v))

const cardLast4 = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Последние 4 цифры карты')
  .nullable()
  .or(z.literal('').transform(() => null))

/**
 * PATCH способа оплаты (21.2.11). Поля необязательные, неизвестные ключи запрещены: полный
 * номер карты в виде отдельного поля не принимается, а не отбрасывается молча.
 */
export const UpdatePaymentMethodInput = z
  .object({
    enabled: z.boolean(),
    bank: detailText,
    cardLast4,
    recipient: detailText,
  })
  .partial()
  .strict()
export type UpdatePaymentMethodInput = z.input<typeof UpdatePaymentMethodInput>

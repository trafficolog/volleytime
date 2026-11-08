import { z } from 'zod'

export const SHORT_LINK_MIN = 3
export const SHORT_LINK_MAX = 32

/** Формат: строчные латинские буквы, цифры, дефис; дефис не в начале, не в конце и не двойной. */
export const SHORT_LINK_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/

/**
 * PUT короткой ссылки: строка или null (снять). Регистр приводится к строчному до проверки, поэтому
 * `VT-Minsk` и `vt-minsk` — одно значение. Зарезервированные слова и занятость проверяет сервис.
 */
export const SetShortLinkInput = z
  .object({
    shortLink: z
      .string()
      .trim()
      .toLowerCase()
      .min(SHORT_LINK_MIN, 'Не короче 3 знаков')
      .max(SHORT_LINK_MAX, 'Не длиннее 32 знаков')
      .refine(
        (v) => SHORT_LINK_PATTERN.test(v) && !v.includes('--'),
        'Строчные латинские буквы, цифры и дефис; дефис не в начале, не в конце и не двойной',
      )
      .nullable(),
  })
  .strict()
export type SetShortLinkInput = z.input<typeof SetShortLinkInput>

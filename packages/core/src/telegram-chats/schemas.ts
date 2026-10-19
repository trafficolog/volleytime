import { z } from 'zod'

/** Telegram id группового чата: отрицательное целое (`-100…` у супергрупп), до 15 цифр. */
export const TelegramChatIdSchema = z.string().regex(/^-\d{1,15}$/)
const TelegramUserIdSchema = z.string().regex(/^\d{1,15}$/)
export const ChatTypeSchema = z.enum(['group', 'supergroup'])

/**
 * Бот принял код в групповом чате (внутренний канал под секретом). `verdict: 'admin'` — отправитель
 * проверен как администратор чата (creator/administrator по `getChatMember`), код можно применить;
 * `verdict: 'rejected'` — код прозвучал в чате, но не от администратора (не админ, анонимный админ,
 * не удалось проверить): код сгорает без привязки.
 */
export const ClaimChatLinkInput = z.discriminatedUnion('verdict', [
  z
    .object({
      verdict: z.literal('admin'),
      code: z.string().max(64),
      chatId: TelegramChatIdSchema,
      chatType: ChatTypeSchema,
      title: z.string().trim().min(1).max(255),
      /** Может ли бот писать в чат — по `getChatMember` бота. */
      botCanPost: z.boolean(),
      /** Администратор чата, отправивший код. */
      confirmedByTelegramId: TelegramUserIdSchema,
    })
    .strict(),
  z
    .object({
      verdict: z.literal('rejected'),
      code: z.string().max(64),
      chatId: TelegramChatIdSchema,
    })
    .strict(),
])
export type ClaimChatLinkInput = z.input<typeof ClaimChatLinkInput>

/** `my_chat_member` бота в групповом чате: новый статус бота и может ли он писать. */
export const ChatMembershipInput = z
  .object({
    chatId: TelegramChatIdSchema,
    chatType: ChatTypeSchema,
    title: z.string().trim().min(1).max(255).optional(),
    status: z.enum(['creator', 'administrator', 'member', 'restricted', 'left', 'kicked']),
    canPost: z.boolean(),
  })
  .strict()
export type ChatMembershipInput = z.infer<typeof ChatMembershipInput>

import { ClaimChatLinkInput, telegramChatService } from '@volley-time/core'

/**
 * Бот принял код привязки в групповом чате от администратора чата (20.3.4). Секрет проверяется
 * раньше разбора тела. Исход — в теле ответа (`linked`, `code_invalid`, `chat_taken`,
 * `group_has_chat`, `rejected`), чтобы бот ответил понятным текстом; код и id в логи не попадают.
 */
export default defineApiHandler(async (event) => {
  requireInternalSecret(event)
  const body = parseOrThrow(ClaimChatLinkInput, await readBody(event))
  // сжигание кода (`rejected`) не расходует лимит попыток привязки: иначе посторонний в чате
  // исчерпал бы его и заблокировал `/link` для администратора; у сжигания свой общий лимит бота
  if (body.verdict === 'admin') limitChatLinkClaim(event, body.confirmedByTelegramId, body.chatId)
  else limitBotCall(event, `reject:${body.chatId}`)
  return telegramChatService.claim(body)
})

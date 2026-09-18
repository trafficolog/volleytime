/** Человекочитаемое сообщение из ошибки $fetch (statusMessage доменной ошибки или общий текст). */
const CODE_MESSAGES: Record<string, string> = {
  'forbidden.pending_approval': 'Заявка на вступление ещё не одобрена организатором',
  'forbidden.manage_content': 'Нужны права организатора',
  'forbidden.manage_members': 'Нужны права организатора',
  'forbidden.owner_only': 'Действие доступно только владельцу',
  'forbidden.invite_role': 'Приглашать с этой ролью может только владелец',
  'forbidden.moderate': 'Недостаточно прав для действия с этим участником',
  'forbidden.not_member': 'Вы не участник этой организации',
  validation_failed: 'Проверьте заполнение полей',
  internal_error: 'Что-то пошло не так. Попробуйте ещё раз',
  'member.already_exists': 'Вы уже состоите в этой группе',
  'telegram.invalid':
    'Не удалось подтвердить вход через Telegram. Откройте приложение заново из чата с ботом',
  'telegram.not_configured': 'Вход через Telegram временно недоступен',
  'account.already_linked': 'Этот Telegram уже привязан к вашему аккаунту',
  'account.linked_to_other_user': 'Этот Telegram уже привязан к другому аккаунту',
  rate_limited: 'Слишком много попыток, попробуйте через минуту',
  'member.blocked': 'Организатор ограничил ваш доступ в группу',
  'invite.revoked': 'Ссылка отозвана организатором',
  'invite.expired': 'Срок действия ссылки истёк',
  'invite.uses_exhausted': 'Лимит вступлений по ссылке исчерпан',
  'invite.not_found': 'Приглашение не найдено',
  'booking.already_booked': 'Вы уже записаны на это событие',
  'booking.event_not_bookable': 'Запись на это событие закрыта',
  'booking.method_not_allowed': 'Этот способ оплаты недоступен для события',
  'booking.deadline_passed': 'Отменить запись уже нельзя — прошёл дедлайн отмены',
  'booking.not_cancellable': 'Эту запись нельзя отменить',
  'booking.cannot_cancel_others': 'Нельзя отменить чужую запись',
  'subscription.no_active': 'Нет активного абонемента с остатком',
  'subscription.pending_exists': 'У вас уже есть неоплаченный абонемент по этому плану',
  'event.starts_in_past': 'Время начала должно быть в будущем',
  'event.capacity_below_taken': 'Мест не может быть меньше, чем уже записано',
}

export function apiErrorCode(e: unknown): string | undefined {
  return (e as { data?: { data?: { code?: string } } })?.data?.data?.code
}

export function apiErrorStatus(e: unknown): number | undefined {
  return (
    (e as { statusCode?: number; status?: number })?.statusCode ??
    (e as { status?: number })?.status
  )
}

export function apiErrorMessage(e: unknown, fallback = 'Не удалось выполнить действие'): string {
  const code = apiErrorCode(e)
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]
  if (apiErrorStatus(e) === 403) return 'Недостаточно прав'
  if (apiErrorStatus(e) === 401) return 'Нужно войти заново'
  const msg = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
  return msg && /[а-яё]/i.test(msg) ? msg : fallback
}

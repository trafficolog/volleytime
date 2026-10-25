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
  'booking.invite_required': 'Для записи нужно приглашение организатора',
  'invite_request.already_pending': 'Запрос уже отправлен — ждите ответа организатора',
  'invite_request.not_pending': 'Организатор уже ответил на запрос',
  'invite_request.not_found': 'Запрос не найден',
  'event.join_mode_open': 'На это событие запись свободная — приглашение не нужно',
  'booking.already_booked': 'Вы уже записаны на это событие',
  'booking.event_not_bookable': 'Запись на это событие закрыта',
  'booking.method_not_allowed': 'Этот способ оплаты недоступен для события',
  'booking.deadline_passed': 'Отменить запись уже нельзя — прошёл дедлайн отмены',
  'booking.not_cancellable': 'Эту запись нельзя отменить',
  'booking.cannot_cancel_others': 'Нельзя отменить чужую запись',
  'booking.cancellation_not_allowed':
    'Организатор запретил отменять запись самостоятельно. Напишите организатору',
  'booking.seats_over_limit': 'Столько мест в одной записи взять нельзя',
  'booking.not_enough_seats': 'Свободных мест меньше, чем вы выбрали',
  'booking.not_open_yet': 'Запись на это событие ещё не открыта',
  // срок вышел и предложение снято организатором неразличимы по коду: текст нейтральный
  'waitlist_offer.expired': 'Предложение места больше не действует. Проверьте статус своей записи',
  'waitlist_offer.not_found': 'Это предложение места больше недоступно',
  'booking.multi_seat_disabled': 'Запись на несколько мест пока недоступна',
  'subscription.no_active': 'Нет активного абонемента с остатком',
  'subscription.not_enough_sessions': 'В абонементе не хватает занятий на все места',
  'subscription.pending_exists': 'У вас уже есть неоплаченный абонемент по этому плану',
  'event.not_found': 'Событие не найдено',
  'event.starts_in_past': 'Время начала должно быть в будущем',
  'event.capacity_below_taken': 'Мест не может быть меньше, чем уже записано',
  'event.series_date_locked':
    'Это событие входит в серию: день меняется только правкой серии. Время в тот же день можно изменить здесь. Чтобы провести игру в другой день, отмените эту дату и создайте разовое событие',
  'event.venue_not_in_org': 'Выбранной площадки нет в этой группе',
  'event.split_over_capacity':
    'Занято больше мест, чем вместимость события: увеличьте вместимость или снимите лишние записи, затем распределите сумму',
  'event.pricing_locked':
    'Тип оплаты и общую сумму уже нельзя менять: есть записи или распределение',
  'telegram_chat.not_linked': 'Чат группы не привязан',
  'telegram_chat.bot_removed': 'Бот удалён из чата группы: привяжите чат заново',
  'telegram_chat.no_rights': 'У бота нет права писать в чат группы',
  'telegram_chat.migrated': 'Чат перенесён в супергруппу: привяжите его заново',
  'telegram_chat.event_not_announceable':
    'Анонс доступен только для опубликованного события, которое ещё не началось',
  'telegram_chat.rate_limited': 'Слишком часто: повторите анонс через минуту',
  'telegram_chat.delivery_failed': 'Не удалось отправить анонс в чат. Попробуйте ещё раз',
  'event_balance.insufficient':
    'Не хватает баланса событий. Пополните баланс или сохраните событие как черновик',
  'series.invalid_rule': 'Проверьте правило повтора: дни недели и срок серии',
  'series.too_many_dates':
    'В серии не может быть больше 366 событий. Сократите срок или дни недели',
  'series.idempotency_conflict':
    'Эта попытка создания серии уже использована с другими данными. Нажмите «Создать» ещё раз',
  'series.from_in_past':
    'Прошедшие даты серии отменить нельзя: выберите сегодняшнюю или будущую дату',
  'series.not_found': 'Серия не найдена',
  'event.booking_opens_after_close':
    'Запись закрывается раньше, чем открывается: выберите более раннее открытие записи или меньшее время «Запись закрывается»',
  'event.booking_opens_in_past': 'Время открытия записи должно быть в будущем',
  'event.booking_already_open': 'Запись уже открыта: время открытия больше не меняется',
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

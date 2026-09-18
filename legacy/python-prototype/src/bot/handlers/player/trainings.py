"""Хендлеры для игроков: просмотр тренировок, запись с выбором оплаты."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession

from src.bot.keyboards import (
    back_to,
    main_menu,
    payment_method_choice,
    training_card,
    trainings_list,
)
from src.config import settings
from src.db.models import (
    BookingStatus,
    PaymentMethod,
    SlotType,
    User,
    UserRole,
)
from src.db.repositories.training import TrainingRepository
from src.services.booking import (
    AlreadyBookedError,
    BookingError,
    BookingService,
    NoSlotsError,
    TrainingClosedError,
)
from src.services.notifier import Notifier
from src.services.payments import PaymentService
from src.services.subscription import (
    NoActiveSubscriptionError,
    SubscriptionDepletedError,
    SubscriptionExpiredError,
    SubscriptionService,
)
from src.utils.money import format_byn
from src.utils.time import format_dt_human

router = Router(name="player_trainings")


@router.callback_query(F.data == "trainings:list")
async def cb_trainings_list(callback: CallbackQuery, session: AsyncSession) -> None:
    repo = TrainingRepository(session)
    trainings = await repo.list_upcoming(limit=10)
    if not trainings:
        if callback.message:
            await callback.message.edit_text(
                "Пока нет запланированных тренировок.",
                reply_markup=main_menu(),
            )
        await callback.answer()
        return
    if callback.message:
        await callback.message.edit_text(
            "🏐 <b>Ближайшие тренировки:</b>\n\nВыберите дату:",
            reply_markup=trainings_list(trainings),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("training:view:"))
async def cb_training_view(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
) -> None:
    training_id = int(callback.data.split(":")[-1])
    repo = TrainingRepository(session)
    training = await repo.get_by_id(training_id)
    if not training:
        await callback.answer("Тренировка не найдена", show_alert=True)
        return

    counts = await repo.count_active_bookings(training_id)
    booking_service = BookingService(session)
    my_booking = await booking_service.get_user_booking(training_id, user.id)

    text_lines = [
        f"🏐 <b>{format_dt_human(training.starts_at)}</b>",
        f"📍 {training.venue}",
        "",
        f"💰 Цена: {format_byn(training.price_main)}",
        "",
        f"Состав: {counts['main']}/{training.max_main_slots} основных, "
        f"{counts['rotation']}/{training.max_rotation_slots} ротация",
    ]
    if counts["waitlist"]:
        text_lines.append(f"⏳ В листе ожидания: {counts['waitlist']}")
    if training.notes:
        text_lines.extend(["", training.notes])

    if my_booking:
        slot_label = {
            "main": "✅ Вы в основном составе",
            "rotation": "✅ Вы на ротационном месте",
            "waitlist": f"⏳ Вы в листе ожидания (#{my_booking.waitlist_position})",
        }.get(my_booking.slot_type.value, "✅ Вы записаны")
        status_label = {
            BookingStatus.pending_payment: " · ожидает оплаты",
            BookingStatus.confirmed: " · оплачено",
        }.get(my_booking.status, "")
        text_lines.extend(["", slot_label + status_label])

    if callback.message:
        await callback.message.edit_text(
            "\n".join(text_lines),
            reply_markup=training_card(
                training_id=training_id,
                can_book=my_booking is None,
                already_booked=my_booking is not None,
            ),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("booking:start:"))
async def cb_booking_start(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
) -> None:
    """Шаг 1 записи: проверяем доступность слота и показываем выбор оплаты."""
    training_id = int(callback.data.split(":")[-1])
    svc = BookingService(session)
    try:
        proposal = await svc.propose_slot(training_id, user.id)
    except TrainingClosedError as e:
        await callback.answer(str(e), show_alert=True)
        return
    except AlreadyBookedError as e:
        await callback.answer(str(e), show_alert=True)
        return
    except BookingError as e:
        await callback.answer(str(e), show_alert=True)
        return

    sub_svc = SubscriptionService(session)
    best_sub = await sub_svc.get_best_for_consumption(user.id)

    slot_msg = {
        SlotType.main: "основной состав",
        SlotType.rotation: "ротационное место",
        SlotType.waitlist: f"лист ожидания (#{proposal.waitlist_position})",
    }[proposal.slot_type]

    text = (
        f"🏐 Доступно: <b>{slot_msg}</b>\n"
        f"Цена: <b>{proposal.price} BYN</b>\n\n"
        f"Выберите способ оплаты:"
    )
    if callback.message:
        await callback.message.edit_text(
            text,
            reply_markup=payment_method_choice(
                training_id=training_id,
                has_subscription=best_sub is not None,
                remaining=best_sub.remaining_sessions if best_sub else 0,
            ),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("booking:pay:sub:"))
async def cb_pay_with_subscription(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
) -> None:
    """Оплата записи с абонемента: бронь сразу confirmed."""
    training_id = int(callback.data.split(":")[-1])
    booking_svc = BookingService(session)
    sub_svc = SubscriptionService(session)

    try:
        proposal = await booking_svc.propose_slot(training_id, user.id)
    except BookingError as e:
        await callback.answer(str(e), show_alert=True)
        return

    sub = await sub_svc.get_best_for_consumption(user.id)
    if not sub:
        await callback.answer("Нет активного абонемента", show_alert=True)
        return

    # Списываем сессию
    try:
        sub = await sub_svc.consume_session(sub.id)
    except (NoActiveSubscriptionError, SubscriptionDepletedError, SubscriptionExpiredError) as e:
        await callback.answer(f"Не удалось списать: {e}", show_alert=True)
        return

    # Создаём бронь сразу confirmed
    try:
        booking = await booking_svc.create_booking(
            training_id=training_id,
            user_id=user.id,
            slot_type=proposal.slot_type,
            status=BookingStatus.confirmed,
            subscription_id=sub.id,
            waitlist_position=proposal.waitlist_position,
        )
    except NoSlotsError as e:
        # Откатываем списание
        await sub_svc.restore_session(sub.id)
        await callback.answer(str(e), show_alert=True)
        return
    except AlreadyBookedError as e:
        await sub_svc.restore_session(sub.id)
        await callback.answer(str(e), show_alert=True)
        return

    if callback.message:
        await callback.message.edit_text(
            f"✅ Запись подтверждена!\n\n"
            f"С абонемента списана 1 сессия. "
            f"Осталось: <b>{sub.remaining_sessions} из {sub.total_sessions}</b>",
            reply_markup=back_to("trainings:list", "« К списку"),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("booking:pay:cash:"))
async def cb_pay_cash(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
    notifier: Notifier,
) -> None:
    """Оплата записи наличными: бронь pending, ждёт подтверждения админа."""
    training_id = int(callback.data.split(":")[-1])
    booking_svc = BookingService(session)
    payment_svc = PaymentService(session)

    try:
        proposal = await booking_svc.propose_slot(training_id, user.id)
    except BookingError as e:
        await callback.answer(str(e), show_alert=True)
        return

    # Создаём бронь в pending_payment
    try:
        booking = await booking_svc.create_booking(
            training_id=training_id,
            user_id=user.id,
            slot_type=proposal.slot_type,
            status=BookingStatus.pending_payment,
            waitlist_position=proposal.waitlist_position,
        )
    except (NoSlotsError, AlreadyBookedError) as e:
        await callback.answer(str(e), show_alert=True)
        return

    # Создаём pending-платёж
    from decimal import Decimal
    payment = await payment_svc.create_for_booking(
        user_id=user.id,
        booking_id=booking.id,
        amount=Decimal(str(proposal.price)),
        method=PaymentMethod.cash,
    )
    booking.payment_id = payment.id
    await session.flush()

    if callback.message:
        await callback.message.edit_text(
            f"✅ Бронь создана.\n\n"
            f"Принесите <b>{proposal.price} BYN</b> на тренировку.\n"
            f"После того как админ подтвердит получение — запись станет подтверждённой.",
            reply_markup=back_to("trainings:list", "« К списку"),
            parse_mode="HTML",
        )
    await callback.answer()

    # Уведомление админам
    if settings.admin_telegram_ids:
        username = f" (@{user.username})" if user.username else ""
        await notifier.send_to_admins(
            settings.admin_telegram_ids,
            text=(
                f"💵 <b>Новая бронь (наличные)</b>\n\n"
                f"Игрок: {user.full_name}{username}\n"
                f"Тренировка: на {proposal.price} BYN\n"
                f"Платёж #{payment.id}\n\n"
                f"Подтвердить можно в админ-меню → «Ожидают оплаты»."
            ),
        )


@router.callback_query(F.data.startswith("booking:cancel:"))
async def cb_booking_cancel(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
) -> None:
    training_id = int(callback.data.split(":")[-1])
    booking_svc = BookingService(session)
    sub_svc = SubscriptionService(session)
    booking = await booking_svc.get_user_booking(training_id, user.id)
    if not booking:
        await callback.answer("Активной записи нет", show_alert=True)
        return

    # Если оплачено с абонемента — возвращаем сессию
    if booking.subscription_id and booking.status == BookingStatus.confirmed:
        await sub_svc.restore_session(booking.subscription_id)

    await booking_svc.cancel_booking(booking.id, reason="user_cancelled")
    await booking_svc.promote_from_waitlist(training_id)
    await callback.answer("Запись отменена", show_alert=True)
    callback.data = f"training:view:{training_id}"
    await cb_training_view(callback, session, user)

"""Админ-хендлеры: список тренировок, отметка посещаемости, отмена тренировки."""
from __future__ import annotations

import logging
from typing import Optional

from aiogram import F, Router
from aiogram.types import CallbackQuery
from aiogram.utils.keyboard import InlineKeyboardBuilder
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.bot.keyboards import admin_menu, back_to
from src.db.models import (
    Booking,
    BookingStatus,
    LedgerCategory,
    Payment,
    PaymentKind,
    PaymentMethod,
    PaymentStatus,
    Training,
    TrainingStatus,
    User,
    UserRole,
)
from src.db.repositories.training import TrainingRepository
from src.services.ledger import LedgerService
from src.services.notifier import Notifier
from src.services.subscription import SubscriptionService
from src.utils.money import format_byn
from src.utils.time import format_dt_human, now_msk

logger = logging.getLogger(__name__)

router = Router(name="admin_trainings_manage")


def is_admin(user: User) -> bool:
    return user.role == UserRole.admin


# ---------- Список тренировок (админ) ----------

@router.callback_query(F.data == "admin:trainings:list")
async def cb_trainings_list(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return

    # Последние 7 ближайших + последние 5 прошедших
    now = now_msk()
    upcoming = await session.execute(
        select(Training)
        .where(and_(Training.starts_at >= now, Training.status != TrainingStatus.cancelled))
        .order_by(Training.starts_at.asc())
        .limit(7)
    )
    past = await session.execute(
        select(Training)
        .where(Training.starts_at < now)
        .order_by(Training.starts_at.desc())
        .limit(5)
    )
    upcoming_list = list(upcoming.scalars().all())
    past_list = list(past.scalars().all())

    lines = ["📅 <b>Тренировки</b>\n"]
    kb = InlineKeyboardBuilder()

    if upcoming_list:
        lines.append("<b>Предстоящие:</b>")
        for t in upcoming_list:
            kb.button(
                text=f"▶️ {format_dt_human(t.starts_at)} · {t.venue}",
                callback_data=f"admin:training:view:{t.id}",
            )
    if past_list:
        lines.append("\n<b>Прошедшие (5 последних):</b>")
        for t in past_list:
            icon = "🏁" if t.status == TrainingStatus.finished else "⏰"
            kb.button(
                text=f"{icon} {format_dt_human(t.starts_at)} · {t.venue}",
                callback_data=f"admin:training:view:{t.id}",
            )
    if not upcoming_list and not past_list:
        lines.append("Тренировок ещё нет.")

    kb.button(text="« В админ-меню", callback_data="admin:menu")
    kb.adjust(1)

    if callback.message:
        await callback.message.edit_text(
            "\n".join(lines),
            reply_markup=kb.as_markup(),
            parse_mode="HTML",
        )
    await callback.answer()


# ---------- Карточка тренировки (админ-view) ----------

@router.callback_query(F.data.startswith("admin:training:view:"))
async def cb_training_view(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    training_id = int(callback.data.split(":")[-1])
    training = await session.get(Training, training_id)
    if not training:
        await callback.answer("Не найдена", show_alert=True)
        return

    result = await session.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(Booking.training_id == training_id)
        .order_by(Booking.created_at.asc())
    )
    bookings = list(result.scalars().all())

    main_bs = [b for b in bookings if b.slot_type.value == "main" and b.status != BookingStatus.cancelled]
    rot_bs = [b for b in bookings if b.slot_type.value == "rotation" and b.status != BookingStatus.cancelled]
    wl_bs = [b for b in bookings if b.slot_type.value == "waitlist" and b.status != BookingStatus.cancelled]

    def _list(label: str, items: list[Booking]) -> str:
        if not items:
            return f"<b>{label}:</b> пусто\n"
        out = [f"<b>{label} ({len(items)}):</b>"]
        for b in items:
            status_icon = {
                BookingStatus.pending_payment: "⏳",
                BookingStatus.confirmed: "✅",
                BookingStatus.attended: "🏐",
                BookingStatus.no_show: "❌",
            }.get(b.status, "·")
            out.append(f"  {status_icon} {b.user.full_name}")
        return "\n".join(out) + "\n"

    lines = [
        f"📅 <b>{format_dt_human(training.starts_at)}</b>",
        f"📍 {training.venue}",
        f"💰 {format_byn(training.price_main)} · статус: {training.status.value}",
        "",
        _list("Основной состав", main_bs),
        _list("Ротация", rot_bs),
        _list("Лист ожидания", wl_bs),
    ]

    kb = InlineKeyboardBuilder()
    is_past = training.starts_at < now_msk()
    is_active = training.status not in (TrainingStatus.cancelled, TrainingStatus.finished)

    if is_past and is_active:
        kb.button(
            text="🏐 Отметить посещаемость",
            callback_data=f"admin:training:attend:{training_id}",
        )
    if is_active:
        kb.button(
            text="🚫 Отменить тренировку",
            callback_data=f"admin:training:cancel:{training_id}",
        )
    kb.button(text="« К списку", callback_data="admin:trainings:list")
    kb.adjust(1)

    if callback.message:
        await callback.message.edit_text(
            "\n".join(lines),
            reply_markup=kb.as_markup(),
            parse_mode="HTML",
        )
    await callback.answer()


# ---------- Отметка посещаемости (Task 2.6.3) ----------

@router.callback_query(F.data.startswith("admin:training:attend:"))
async def cb_attend_open(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    training_id = int(callback.data.split(":")[-1])
    training = await session.get(Training, training_id)
    if not training:
        await callback.answer("Не найдена", show_alert=True)
        return

    # Берём только подтверждённые брони (или уже отмеченные — для повторного редактирования)
    result = await session.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(
            and_(
                Booking.training_id == training_id,
                Booking.status.in_([
                    BookingStatus.confirmed,
                    BookingStatus.attended,
                    BookingStatus.no_show,
                ]),
            )
        )
        .order_by(Booking.created_at.asc())
    )
    bookings = list(result.scalars().all())

    if not bookings:
        await callback.answer("Нет подтверждённых записей", show_alert=True)
        return

    kb = InlineKeyboardBuilder()
    for b in bookings:
        icon = {
            BookingStatus.confirmed: "·",
            BookingStatus.attended: "🏐",
            BookingStatus.no_show: "❌",
        }.get(b.status, "·")
        kb.button(
            text=f"{icon} {b.user.full_name}",
            callback_data=f"admin:booking:toggle:{b.id}",
        )
    kb.button(text="🏁 Завершить тренировку", callback_data=f"admin:training:finish:{training_id}")
    kb.button(text="« К карточке", callback_data=f"admin:training:view:{training_id}")
    kb.adjust(1)

    if callback.message:
        await callback.message.edit_text(
            f"🏐 <b>Посещаемость · {format_dt_human(training.starts_at)}</b>\n\n"
            "Жмите на имя для переключения статуса:\n"
            "· → 🏐 attended → ❌ no_show → · (confirmed)",
            reply_markup=kb.as_markup(),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:booking:toggle:"))
async def cb_attend_toggle(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    booking_id = int(callback.data.split(":")[-1])
    booking = await session.get(Booking, booking_id)
    if not booking:
        await callback.answer("Не найдено", show_alert=True)
        return

    # Цикл: confirmed → attended → no_show → confirmed
    cycle = {
        BookingStatus.confirmed: BookingStatus.attended,
        BookingStatus.attended: BookingStatus.no_show,
        BookingStatus.no_show: BookingStatus.confirmed,
    }
    booking.status = cycle.get(booking.status, BookingStatus.attended)
    await session.flush()

    # Перерисовываем экран отметки
    callback.data = f"admin:training:attend:{booking.training_id}"
    await cb_attend_open(callback, session, user)


@router.callback_query(F.data.startswith("admin:training:finish:"))
async def cb_training_finish(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    training_id = int(callback.data.split(":")[-1])
    training = await session.get(Training, training_id)
    if not training:
        await callback.answer("Не найдена", show_alert=True)
        return
    training.status = TrainingStatus.finished
    await session.flush()
    await callback.answer("✅ Тренировка завершена", show_alert=True)
    callback.data = f"admin:training:view:{training_id}"
    await cb_training_view(callback, session, user)


# ---------- Отмена тренировки админом (Task 2.6.4) ----------

@router.callback_query(F.data.startswith("admin:training:cancel:"))
async def cb_training_cancel_confirm(callback: CallbackQuery, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    training_id = int(callback.data.split(":")[-1])

    kb = InlineKeyboardBuilder()
    kb.button(text="🚫 Да, отменить", callback_data=f"admin:training:cancel:confirm:{training_id}")
    kb.button(text="« Назад", callback_data=f"admin:training:view:{training_id}")
    kb.adjust(1)

    if callback.message:
        await callback.message.edit_text(
            "<b>Отменить тренировку?</b>\n\n"
            "Это действие:\n"
            "• уведомит всех записавшихся,\n"
            "• вернёт сессии абонементов,\n"
            "• пометит наличные платежи как требующие возврата,\n"
            "• запишет возвраты в кассу.\n\n"
            "<b>Отменить нельзя!</b>",
            reply_markup=kb.as_markup(),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:training:cancel:confirm:"))
async def cb_training_cancel_execute(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
    notifier: Notifier,
) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    training_id = int(callback.data.split(":")[-1])
    training = await session.get(Training, training_id)
    if not training:
        await callback.answer("Не найдена", show_alert=True)
        return
    if training.status == TrainingStatus.cancelled:
        await callback.answer("Уже отменена", show_alert=True)
        return

    # Загружаем все активные брони
    result = await session.execute(
        select(Booking)
        .options(selectinload(Booking.user))
        .where(
            and_(
                Booking.training_id == training_id,
                Booking.status.in_([
                    BookingStatus.pending_payment,
                    BookingStatus.confirmed,
                ]),
            )
        )
    )
    bookings = list(result.scalars().all())

    sub_svc = SubscriptionService(session)
    ledger = LedgerService(session)

    refunds_needed: list[Booking] = []  # для cash-возвратов
    sessions_restored = 0

    for b in bookings:
        # Восстановить сессию абонемента, если оплачено им
        if b.subscription_id and b.status == BookingStatus.confirmed:
            await sub_svc.restore_session(b.subscription_id)
            sessions_restored += 1

        # Для наличных — пометить как требующий возврата + expense в кассу
        if b.payment_id and b.status == BookingStatus.confirmed:
            payment = await session.get(Payment, b.payment_id)
            if payment and payment.status == PaymentStatus.succeeded and payment.method == PaymentMethod.cash:
                # Создаём отрицательное движение в кассе
                await ledger.record_expense(
                    amount=payment.amount,
                    category=LedgerCategory.refund,
                    description=f"Возврат игроку #{b.user_id} за отменённую тренировку #{training_id}",
                    related_training_id=training_id,
                    admin_id=user.id,
                )
                payment.status = PaymentStatus.refunded
                refunds_needed.append(b)

        b.status = BookingStatus.cancelled
        b.cancelled_at = now_msk()
        b.cancellation_reason = "training_cancelled_by_admin"

    training.status = TrainingStatus.cancelled
    await session.flush()

    # Массовая рассылка уведомлений
    notified = 0
    for b in bookings:
        text = (
            f"⚠️ <b>Тренировка отменена</b>\n\n"
            f"📅 {format_dt_human(training.starts_at)}\n"
            f"📍 {training.venue}\n\n"
        )
        if b.subscription_id:
            text += "Сессия возвращена в ваш абонемент."
        elif b in refunds_needed:
            text += "Возврат наличными — свяжитесь с организатором."
        if await notifier.send(b.user.telegram_id, text):
            notified += 1

    # Финальный экран
    if callback.message:
        await callback.message.edit_text(
            f"🚫 <b>Тренировка отменена</b>\n\n"
            f"Уведомлено игроков: {notified} из {len(bookings)}\n"
            f"Сессий абонементов восстановлено: {sessions_restored}\n"
            f"Наличных возвратов: {len(refunds_needed)}",
            reply_markup=back_to("admin:menu", "« В админ-меню"),
            parse_mode="HTML",
        )
    await callback.answer()

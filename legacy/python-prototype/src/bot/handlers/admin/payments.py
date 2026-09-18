"""Админ-хендлеры: pending-платежи и их подтверждение."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.types import CallbackQuery
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.bot.keyboards import admin_menu, back_to, payment_confirm_actions
from src.db.models import (
    Payment,
    PaymentMethod,
    Subscription,
    User,
    UserRole,
)
from src.services.notifier import Notifier
from src.services.payments import (
    PaymentAlreadyProcessedError,
    PaymentError,
    PaymentService,
)
from src.utils.money import format_byn

router = Router(name="admin_payments")


def is_admin(user: User) -> bool:
    return user.role == UserRole.admin


@router.callback_query(F.data == "admin:payments:pending")
async def cb_pending_list(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return

    svc = PaymentService(session)
    pending = await svc.list_pending()
    if not pending:
        if callback.message:
            await callback.message.edit_text(
                "⏳ Ожидающих оплаты нет.",
                reply_markup=back_to("admin:menu", "« В админ-меню"),
            )
        await callback.answer()
        return

    lines = ["⏳ <b>Ожидают подтверждения:</b>\n"]
    for p in pending[:10]:
        # Получим игрока
        player = await session.get(User, p.user_id)
        kind = "Абонемент" if p.subscription_id else "Тренировка"
        method = {
            PaymentMethod.cash: "наличные",
            PaymentMethod.bepaid_card: "карта",
            PaymentMethod.bepaid_erip: "ЕРИП",
        }.get(p.method, p.method.value)
        username = f" (@{player.username})" if player and player.username else ""
        lines.append(
            f"#{p.id} · {player.full_name if player else '?'}{username}\n"
            f"   {kind} · {format_byn(p.amount)} · {method}"
        )
    lines.append("\nЧтобы подтвердить — нажмите на номер платежа:")

    # Делаем клавиатуру с инлайн-кнопками по каждому платежу
    from aiogram.utils.keyboard import InlineKeyboardBuilder
    kb = InlineKeyboardBuilder()
    for p in pending[:10]:
        kb.button(text=f"#{p.id} · {format_byn(p.amount)}", callback_data=f"admin:pay:view:{p.id}")
    kb.button(text="« В админ-меню", callback_data="admin:menu")
    kb.adjust(1)

    if callback.message:
        await callback.message.edit_text(
            "\n".join(lines),
            reply_markup=kb.as_markup(),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:pay:view:"))
async def cb_pay_view(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    payment_id = int(callback.data.split(":")[-1])
    payment = await session.get(Payment, payment_id)
    if not payment:
        await callback.answer("Платёж не найден", show_alert=True)
        return

    player = await session.get(User, payment.user_id)
    username = f" (@{player.username})" if player and player.username else ""
    lines = [
        f"💳 <b>Платёж #{payment.id}</b>",
        "",
        f"Игрок: {player.full_name if player else '?'}{username}",
        f"Сумма: <b>{format_byn(payment.amount)}</b>",
        f"Статус: {payment.status.value}",
        f"Метод: {payment.method.value}",
    ]
    if payment.subscription_id:
        sub = await session.get(Subscription, payment.subscription_id)
        if sub:
            lines.append(f"Тип: абонемент на {sub.total_sessions} сессий")
    elif payment.booking_id:
        lines.append("Тип: оплата за тренировку")

    if callback.message:
        await callback.message.edit_text(
            "\n".join(lines),
            reply_markup=payment_confirm_actions(payment.id),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:pay:confirm:"))
async def cb_pay_confirm(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
    notifier: Notifier,
) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    payment_id = int(callback.data.split(":")[-1])
    svc = PaymentService(session)
    try:
        payment = await svc.confirm(payment_id, admin_id=user.id)
    except PaymentAlreadyProcessedError:
        await callback.answer("Уже подтверждён", show_alert=True)
        return
    except PaymentError as e:
        await callback.answer(str(e), show_alert=True)
        return

    # Уведомим игрока
    player = await session.get(User, payment.user_id)
    if player:
        if payment.subscription_id:
            await notifier.send(
                player.telegram_id,
                "✅ Ваш абонемент <b>активирован</b>. Теперь вы можете списывать сессии при записи.",
            )
        else:
            await notifier.send(
                player.telegram_id,
                "✅ Ваша оплата подтверждена, запись на тренировку зафиксирована.",
            )

    if callback.message:
        await callback.message.edit_text(
            f"✅ Платёж #{payment.id} подтверждён.\n"
            f"Поступление {format_byn(payment.amount)} записано в кассу.",
            reply_markup=back_to("admin:payments:pending", "« К списку"),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("admin:pay:reject:"))
async def cb_pay_reject(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
    notifier: Notifier,
) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    payment_id = int(callback.data.split(":")[-1])
    svc = PaymentService(session)
    try:
        payment = await svc.fail(payment_id, reason="rejected_by_admin")
    except PaymentError as e:
        await callback.answer(str(e), show_alert=True)
        return

    player = await session.get(User, payment.user_id)
    if player:
        await notifier.send(
            player.telegram_id,
            "❌ Ваш платёж был отклонён администратором. Свяжитесь с организатором для уточнений.",
        )

    if callback.message:
        await callback.message.edit_text(
            f"❌ Платёж #{payment.id} отклонён.",
            reply_markup=back_to("admin:payments:pending", "« К списку"),
        )
    await callback.answer()

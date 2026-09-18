"""Хендлеры абонементов: просмотр своих, покупка, выбор оплаты."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.types import CallbackQuery
from sqlalchemy.ext.asyncio import AsyncSession

from src.bot.keyboards import (
    back_to,
    main_menu,
    subscription_payment_method,
    subscription_plans,
)
from src.config import settings
from src.db.models import PaymentMethod, User, UserRole
from src.services.notifier import Notifier
from src.services.subscription import DEFAULT_PLANS, SubscriptionService, get_plan
from src.utils.money import format_byn
from src.utils.time import format_dt_human

router = Router(name="subscriptions")


@router.callback_query(F.data == "subs:my")
async def cb_my_subs(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    svc = SubscriptionService(session)
    active = await svc.get_active_for_user(user.id)
    if not active:
        text = (
            "🎫 У вас нет активных абонементов.\n\n"
            "Купите абонемент — это выгоднее, чем оплачивать тренировки по одной."
        )
    else:
        lines = ["🎫 <b>Ваши активные абонементы:</b>\n"]
        for s in active:
            lines.append(
                f"• <b>{s.remaining_sessions} из {s.total_sessions}</b> "
                f"осталось · действует до {format_dt_human(s.expires_at)}"
            )
        text = "\n".join(lines)
    if callback.message:
        await callback.message.edit_text(
            text,
            reply_markup=main_menu(is_admin=user.role == UserRole.admin),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data == "subs:buy")
async def cb_buy(callback: CallbackQuery) -> None:
    text = (
        "💳 <b>Выберите абонемент</b>\n\n"
        "Чем больше сессий — тем дешевле каждая тренировка.\n"
        "Срок действия отсчитывается с момента подтверждения оплаты."
    )
    if callback.message:
        await callback.message.edit_text(
            text,
            reply_markup=subscription_plans(DEFAULT_PLANS),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("sub:plan:"))
async def cb_choose_plan(callback: CallbackQuery) -> None:
    code = callback.data.split(":")[-1]
    plan = get_plan(code)
    if not plan:
        await callback.answer("План не найден", show_alert=True)
        return
    text = (
        f"🎫 <b>{plan.title}</b>\n\n"
        f"Цена: <b>{format_byn(plan.price)}</b>\n"
        f"Сессий: {plan.total_sessions}\n"
        f"Срок действия: {plan.valid_days} дней с активации\n\n"
        f"Выберите способ оплаты:"
    )
    if callback.message:
        await callback.message.edit_text(
            text,
            reply_markup=subscription_payment_method(code),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("sub:pay:cash:"))
async def cb_pay_sub_cash(
    callback: CallbackQuery,
    session: AsyncSession,
    user: User,
    notifier: Notifier,
) -> None:
    code = callback.data.split(":")[-1]
    plan = get_plan(code)
    if not plan:
        await callback.answer("План не найден", show_alert=True)
        return

    svc = SubscriptionService(session)
    sub, payment = await svc.create_pending(
        user_id=user.id,
        plan=plan,
        method=PaymentMethod.cash,
    )
    # Здесь делаем commit, потому что middleware закоммитит после хендлера,
    # но нам важно гарантировать, что данные доехали до уведомления админа.

    # Уведомляем игрока
    if callback.message:
        await callback.message.edit_text(
            f"✅ Заявка на абонемент <b>{plan.title}</b> создана.\n\n"
            f"Принесите <b>{format_byn(plan.price)}</b> на ближайшую тренировку.\n"
            f"После того как админ подтвердит получение, абонемент активируется.",
            reply_markup=back_to("menu:main", "« В меню"),
            parse_mode="HTML",
        )
    await callback.answer()

    # Уведомляем админов
    if settings.admin_telegram_ids:
        await notifier.send_to_admins(
            settings.admin_telegram_ids,
            text=(
                f"💵 <b>Новая заявка на абонемент</b>\n\n"
                f"Игрок: {user.full_name}"
                + (f" (@{user.username})" if user.username else "")
                + f"\nПлан: {plan.title}\n"
                f"Сумма: {format_byn(plan.price)}\n"
                f"Способ: наличными\n\n"
                f"Когда получите деньги — подтвердите в админ-меню → «Ожидают оплаты»."
            ),
        )

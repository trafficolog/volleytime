"""Inline-клавиатуры."""
from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


def main_menu(is_admin: bool = False) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="🏐 Ближайшие тренировки", callback_data="trainings:list")
    kb.button(text="🎫 Мои абонементы", callback_data="subs:my")
    kb.button(text="📋 Мои записи", callback_data="bookings:my")
    kb.button(text="💳 Купить абонемент", callback_data="subs:buy")
    if is_admin:
        kb.button(text="⚙️ Админ", callback_data="admin:menu")
    kb.adjust(1)
    return kb.as_markup()


def trainings_list(trainings: list) -> InlineKeyboardMarkup:
    from src.utils.time import format_dt_human
    kb = InlineKeyboardBuilder()
    for t in trainings:
        kb.button(
            text=f"{format_dt_human(t.starts_at)} · {t.venue}",
            callback_data=f"training:view:{t.id}",
        )
    kb.button(text="« В меню", callback_data="menu:main")
    kb.adjust(1)
    return kb.as_markup()


def training_card(training_id: int, can_book: bool, already_booked: bool) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    if already_booked:
        kb.button(text="❌ Отменить запись", callback_data=f"booking:cancel:{training_id}")
    elif can_book:
        kb.button(text="✍️ Записаться", callback_data=f"booking:start:{training_id}")
    kb.button(text="« К списку", callback_data="trainings:list")
    kb.adjust(1)
    return kb.as_markup()


def payment_method_choice(training_id: int, has_subscription: bool, remaining: int = 0) -> InlineKeyboardMarkup:
    """Выбор способа оплаты после нажатия "Записаться"."""
    kb = InlineKeyboardBuilder()
    if has_subscription:
        kb.button(
            text=f"🎫 Списать с абонемента ({remaining} осталось)",
            callback_data=f"booking:pay:sub:{training_id}",
        )
    kb.button(text="💵 Наличными на тренировке", callback_data=f"booking:pay:cash:{training_id}")
    # bePaid появится в Фазе 3 — пока заглушка
    # kb.button(text="💳 Картой / ЕРИП", callback_data=f"booking:pay:bepaid:{training_id}")
    kb.button(text="« Отмена", callback_data=f"training:view:{training_id}")
    kb.adjust(1)
    return kb.as_markup()


def subscription_plans(plans: list) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for p in plans:
        per_session = (p.price / p.total_sessions).quantize(__import__("decimal").Decimal("0.01"))
        kb.button(
            text=f"{p.title} — {p.price} BYN ({per_session}/трен.)",
            callback_data=f"sub:plan:{p.code}",
        )
    kb.button(text="« В меню", callback_data="menu:main")
    kb.adjust(1)
    return kb.as_markup()


def subscription_payment_method(plan_code: str) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="💵 Наличными", callback_data=f"sub:pay:cash:{plan_code}")
    # bePaid в Фазе 3
    kb.button(text="« Назад", callback_data="subs:buy")
    kb.adjust(1)
    return kb.as_markup()


def admin_menu() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="➕ Создать тренировку", callback_data="admin:training:new")
    kb.button(text="📅 Все тренировки", callback_data="admin:trainings:list")
    kb.button(text="⏳ Ожидают оплаты", callback_data="admin:payments:pending")
    kb.button(text="💰 Касса", callback_data="admin:ledger")
    kb.button(text="💸 Добавить расход", callback_data="admin:expense:new")
    kb.button(text="« В меню", callback_data="menu:main")
    kb.adjust(1)
    return kb.as_markup()


def payment_confirm_actions(payment_id: int) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="✅ Подтвердить", callback_data=f"admin:pay:confirm:{payment_id}")
    kb.button(text="❌ Отклонить", callback_data=f"admin:pay:reject:{payment_id}")
    kb.adjust(2)
    return kb.as_markup()


def back_to(callback_data: str, text: str = "« Назад") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=text, callback_data=callback_data)
    return kb.as_markup()

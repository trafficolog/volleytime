"""Админ-хендлеры: касса (баланс, история, добавление расхода)."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation

from aiogram import F, Router
from aiogram.filters import StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from src.bot.keyboards import admin_menu, back_to
from src.db.models import LedgerCategory, LedgerType, User, UserRole
from src.services.ledger import LedgerService
from src.utils.money import format_byn, to_money
from src.utils.time import format_dt_human

router = Router(name="admin_ledger")


def is_admin(user: User) -> bool:
    return user.role == UserRole.admin


@router.callback_query(F.data == "admin:ledger")
async def cb_ledger(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    svc = LedgerService(session)
    balance = await svc.get_balance()
    recent = await svc.list_recent(limit=15)

    lines = [
        "💰 <b>Касса</b>\n",
        f"Поступления всего: <b>{format_byn(balance.income_total)}</b>",
        f"Расходы всего: <b>{format_byn(balance.expense_total)}</b>",
        f"Текущий баланс: <b>{format_byn(balance.balance)}</b>",
    ]
    if recent:
        lines.append("\n<b>Последние операции:</b>")
        for e in recent:
            sign = "➕" if e.type == LedgerType.income else "➖"
            category_label = {
                LedgerCategory.training_fee: "тренировка",
                LedgerCategory.subscription: "абонемент",
                LedgerCategory.rent: "аренда",
                LedgerCategory.balls: "инвентарь",
                LedgerCategory.refund: "возврат",
                LedgerCategory.other: "прочее",
            }.get(e.category, e.category.value)
            lines.append(
                f"{sign} {format_byn(e.amount)} · {category_label} · "
                f"{e.occurred_on.strftime('%d.%m')} · {e.description or ''}"
            )
    if callback.message:
        await callback.message.edit_text(
            "\n".join(lines),
            reply_markup=back_to("admin:menu", "« В админ-меню"),
            parse_mode="HTML",
        )
    await callback.answer()


# ---------- FSM добавления расхода ----------

class AddExpense(StatesGroup):
    waiting_category = State()
    waiting_amount = State()
    waiting_description = State()


@router.callback_query(F.data == "admin:expense:new")
async def cb_add_expense(callback: CallbackQuery, user: User, state: FSMContext) -> None:
    if not is_admin(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    await state.set_state(AddExpense.waiting_category)
    from aiogram.utils.keyboard import InlineKeyboardBuilder
    kb = InlineKeyboardBuilder()
    kb.button(text="🏟 Аренда зала", callback_data="expense:cat:rent")
    kb.button(text="🏐 Инвентарь (мячи)", callback_data="expense:cat:balls")
    kb.button(text="🔁 Возврат игроку", callback_data="expense:cat:refund")
    kb.button(text="📦 Прочее", callback_data="expense:cat:other")
    kb.button(text="« Отмена", callback_data="admin:menu")
    kb.adjust(1)

    if callback.message:
        await callback.message.edit_text(
            "💸 <b>Новый расход</b>\n\nВыберите категорию:",
            reply_markup=kb.as_markup(),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data.startswith("expense:cat:"), StateFilter(AddExpense.waiting_category))
async def cb_expense_category(callback: CallbackQuery, state: FSMContext) -> None:
    code = callback.data.split(":")[-1]
    mapping = {
        "rent": LedgerCategory.rent,
        "balls": LedgerCategory.balls,
        "refund": LedgerCategory.refund,
        "other": LedgerCategory.other,
    }
    category = mapping.get(code, LedgerCategory.other)
    await state.update_data(category=category.value)
    await state.set_state(AddExpense.waiting_amount)
    if callback.message:
        await callback.message.answer(
            "💰 Сумма расхода в BYN (например <code>100</code> или <code>54.50</code>):",
            parse_mode="HTML",
        )
    await callback.answer()


@router.message(StateFilter(AddExpense.waiting_amount))
async def msg_expense_amount(message: Message, state: FSMContext) -> None:
    if not message.text:
        await message.answer("Пришлите сумму текстом")
        return
    try:
        amount = to_money(message.text.strip().replace(",", "."))
        if amount <= 0:
            raise InvalidOperation
    except (InvalidOperation, ValueError):
        await message.answer("Не понял сумму. Пример: <code>100</code>", parse_mode="HTML")
        return
    await state.update_data(amount=str(amount))
    await state.set_state(AddExpense.waiting_description)
    await message.answer(
        "📝 Описание расхода (например: «аренда 30.05» или «насос для мячей»):"
    )


@router.message(StateFilter(AddExpense.waiting_description))
async def msg_expense_description(
    message: Message,
    state: FSMContext,
    session: AsyncSession,
    user: User,
) -> None:
    if not message.text:
        await message.answer("Пришлите описание текстом")
        return
    data = await state.get_data()
    svc = LedgerService(session)
    entry = await svc.record_expense(
        amount=Decimal(data["amount"]),
        category=LedgerCategory(data["category"]),
        description=message.text.strip(),
        admin_id=user.id,
    )
    await state.clear()
    await message.answer(
        f"✅ Расход записан:\n\n"
        f"<b>{format_byn(entry.amount)}</b> · {entry.description}",
        parse_mode="HTML",
        reply_markup=admin_menu(),
    )

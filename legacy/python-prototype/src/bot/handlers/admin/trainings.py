"""Админ-хендлеры: меню, создание тренировки через FSM."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from aiogram import F, Router
from aiogram.filters import StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import AsyncSession

from src.bot.keyboards import admin_menu
from src.config import settings
from src.db.models import User, UserRole
from src.db.repositories.training import TrainingRepository
from src.utils.money import to_money
from src.utils.time import format_dt_human

router = Router(name="admin")


# ----- Фильтр доступа -----

def is_admin_filter(user: User) -> bool:
    return user.role == UserRole.admin


# ----- FSM создания тренировки -----

class CreateTraining(StatesGroup):
    waiting_datetime = State()
    waiting_venue = State()
    waiting_price = State()
    waiting_rent = State()
    waiting_notes = State()


@router.callback_query(F.data == "admin:menu")
async def cb_admin_menu(callback: CallbackQuery, user: User) -> None:
    if not is_admin_filter(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    if callback.message:
        await callback.message.edit_text(
            "⚙️ <b>Админ-меню</b>",
            reply_markup=admin_menu(),
            parse_mode="HTML",
        )
    await callback.answer()


@router.callback_query(F.data == "admin:training:new")
async def cb_admin_training_new(callback: CallbackQuery, user: User, state: FSMContext) -> None:
    if not is_admin_filter(user):
        await callback.answer("Доступ запрещён", show_alert=True)
        return
    await state.set_state(CreateTraining.waiting_datetime)
    if callback.message:
        await callback.message.answer(
            "📅 Введите дату и время начала тренировки в формате\n"
            "<code>ДД.ММ.ГГГГ ЧЧ:ММ</code>\n\n"
            "Например: <code>30.05.2026 19:00</code>",
            parse_mode="HTML",
        )
    await callback.answer()


@router.message(StateFilter(CreateTraining.waiting_datetime))
async def msg_training_datetime(message: Message, state: FSMContext) -> None:
    if not message.text:
        await message.answer("Пришлите дату текстом")
        return
    try:
        dt = datetime.strptime(message.text.strip(), "%d.%m.%Y %H:%M")
        dt = dt.replace(tzinfo=settings.tz)
    except ValueError:
        await message.answer(
            "Не понял формат. Пример: <code>30.05.2026 19:00</code>",
            parse_mode="HTML",
        )
        return
    await state.update_data(starts_at=dt.isoformat())
    await state.set_state(CreateTraining.waiting_venue)
    await message.answer("🏟 Введите название зала / адрес:")


@router.message(StateFilter(CreateTraining.waiting_venue))
async def msg_training_venue(message: Message, state: FSMContext) -> None:
    if not message.text:
        await message.answer("Пришлите название зала текстом")
        return
    await state.update_data(venue=message.text.strip())
    await state.set_state(CreateTraining.waiting_price)
    await message.answer(
        "💰 Цена с человека за тренировку, BYN (например <code>15</code>):",
        parse_mode="HTML",
    )


@router.message(StateFilter(CreateTraining.waiting_price))
async def msg_training_price(message: Message, state: FSMContext) -> None:
    price = _parse_money(message.text)
    if price is None:
        await message.answer(
            "Не понял сумму. Пример: <code>15</code> или <code>12.50</code>",
            parse_mode="HTML",
        )
        return
    # Сохраняем одну цену для обоих типов слотов
    await state.update_data(price_main=str(price), price_rotation=str(price))
    await state.set_state(CreateTraining.waiting_rent)
    await message.answer("💸 Стоимость аренды зала за эту тренировку, BYN:")


@router.message(StateFilter(CreateTraining.waiting_rent))
async def msg_training_rent(message: Message, state: FSMContext) -> None:
    rent = _parse_money(message.text)
    if rent is None:
        await message.answer("Не понял сумму", parse_mode="HTML")
        return
    await state.update_data(rent_cost=str(rent))
    await state.set_state(CreateTraining.waiting_notes)
    await message.answer(
        "📝 Комментарий к тренировке (или отправьте <code>-</code>, чтобы пропустить):",
        parse_mode="HTML",
    )


@router.message(StateFilter(CreateTraining.waiting_notes))
async def msg_training_notes(
    message: Message,
    state: FSMContext,
    session: AsyncSession,
    user: User,
) -> None:
    notes = (message.text or "").strip()
    if notes == "-":
        notes = None
    data = await state.get_data()

    starts_at = datetime.fromisoformat(data["starts_at"])
    ends_at = starts_at + timedelta(hours=2)  # длительность по умолчанию

    repo = TrainingRepository(session)
    training = await repo.create(
        starts_at=starts_at,
        ends_at=ends_at,
        venue=data["venue"],
        price_main=Decimal(data["price_main"]),
        price_rotation=Decimal(data["price_rotation"]),
        rent_cost=Decimal(data["rent_cost"]),
        max_main_slots=settings.default_max_main_slots,
        max_rotation_slots=settings.default_max_rotation_slots,
        created_by_admin_id=user.id,
        notes=notes,
    )

    await state.clear()
    await message.answer(
        f"✅ Тренировка создана!\n\n"
        f"<b>{format_dt_human(training.starts_at)}</b>\n"
        f"📍 {training.venue}\n"
        f"💰 Цена: {training.price_main} BYN\n"
        f"💸 Аренда: {training.rent_cost} BYN\n"
        f"👥 Мест: {training.max_main_slots} + {training.max_rotation_slots} ротация",
        parse_mode="HTML",
        reply_markup=admin_menu(),
    )


def _parse_money(text: str | None) -> Decimal | None:
    if not text:
        return None
    try:
        return to_money(text.strip().replace(",", "."))
    except (InvalidOperation, ValueError):
        return None

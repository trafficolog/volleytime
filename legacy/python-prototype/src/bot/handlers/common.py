"""Общие хендлеры: /start, /help, переход в меню."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message

from src.bot.keyboards import main_menu
from src.db.models import User, UserRole

router = Router(name="common")


WELCOME_TEXT = (
    "🏐 <b>Привет!</b>\n\n"
    "Я бот для записи на волейбольные тренировки.\n\n"
    "Через меня можно:\n"
    "• Посмотреть ближайшие тренировки\n"
    "• Записаться и оплатить место\n"
    "• Купить абонемент\n"
    "• Управлять своими записями\n\n"
    "Используй меню ниже:"
)


@router.message(CommandStart())
async def cmd_start(message: Message, user: User) -> None:
    is_admin = user.role == UserRole.admin
    await message.answer(
        WELCOME_TEXT,
        reply_markup=main_menu(is_admin=is_admin),
        parse_mode="HTML",
    )


@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    text = (
        "<b>Команды:</b>\n"
        "/start — главное меню\n"
        "/help — эта справка\n\n"
        "Всё остальное доступно через кнопки в меню."
    )
    await message.answer(text, parse_mode="HTML")


@router.callback_query(F.data == "menu:main")
async def cb_main_menu(callback: CallbackQuery, user: User) -> None:
    is_admin = user.role == UserRole.admin
    if callback.message:
        await callback.message.edit_text(
            WELCOME_TEXT,
            reply_markup=main_menu(is_admin=is_admin),
            parse_mode="HTML",
        )
    await callback.answer()

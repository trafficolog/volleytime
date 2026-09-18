"""Отправка уведомлений конкретным пользователям по telegram_id.

Используется сервисами и хендлерами, когда нужно уведомить кого-то,
не связанного с текущим апдейтом (например, всех админов о новом pending-платеже).
"""
from __future__ import annotations

import logging
from typing import Optional

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from aiogram.types import InlineKeyboardMarkup

logger = logging.getLogger(__name__)


class Notifier:
    def __init__(self, bot: Bot):
        self.bot = bot

    async def send(
        self,
        telegram_id: int,
        text: str,
        reply_markup: Optional[InlineKeyboardMarkup] = None,
        parse_mode: str = "HTML",
    ) -> bool:
        try:
            await self.bot.send_message(
                chat_id=telegram_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode=parse_mode,
            )
            return True
        except TelegramAPIError as e:
            logger.warning("Не удалось отправить уведомление пользователю %s: %s", telegram_id, e)
            return False

    async def send_to_admins(
        self,
        admin_ids: list[int],
        text: str,
        reply_markup: Optional[InlineKeyboardMarkup] = None,
    ) -> int:
        """Шлёт сообщение всем админам, возвращает число успешных доставок."""
        delivered = 0
        for tg_id in admin_ids:
            if await self.send(tg_id, text, reply_markup=reply_markup):
                delivered += 1
        return delivered

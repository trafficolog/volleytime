"""Middleware для внедрения сессии БД и пользователя в хендлеры."""
from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict

from aiogram import BaseMiddleware, Bot
from aiogram.types import TelegramObject, User as TgUser

from src.config import settings
from src.db.base import async_session_maker
from src.db.repositories.user import UserRepository
from src.services.notifier import Notifier


class DatabaseMiddleware(BaseMiddleware):
    """Открывает сессию БД на время обработки апдейта."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        async with async_session_maker() as session:
            data["session"] = session
            try:
                result = await handler(event, data)
                await session.commit()
                return result
            except Exception:
                await session.rollback()
                raise


class UserMiddleware(BaseMiddleware):
    """Достаёт/создаёт User из БД и кладёт в data."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        session = data.get("session")
        event_from_user: TgUser | None = data.get("event_from_user")
        if session is None or event_from_user is None:
            return await handler(event, data)

        repo = UserRepository(session)
        user, _ = await repo.get_or_create(
            telegram_id=event_from_user.id,
            full_name=event_from_user.full_name,
            username=event_from_user.username,
            admin_ids=settings.admin_telegram_ids,
        )
        data["user"] = user
        return await handler(event, data)


class NotifierMiddleware(BaseMiddleware):
    """Кладёт в data Notifier — обёртку над bot.send_message."""

    def __init__(self, bot: Bot):
        self.notifier = Notifier(bot)

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        data["notifier"] = self.notifier
        return await handler(event, data)

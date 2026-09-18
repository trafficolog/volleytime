"""Точка входа Telegram-бота. Long-polling режим для разработки."""
from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage

from src.bot.handlers.admin import get_admin_router
from src.bot.handlers.common import router as common_router
from src.bot.handlers.player import get_player_router
from src.bot.middlewares import DatabaseMiddleware, NotifierMiddleware, UserMiddleware
from src.config import settings
from src.db.base import engine
from src.db.models import Base


async def init_db() -> None:
    """Создаёт таблицы при первом запуске. В проде используйте Alembic."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def main() -> None:
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if not settings.bot_token:
        raise RuntimeError(
            "BOT_TOKEN не задан. Создайте файл .env (см. .env.example) "
            "и пропишите токен от @BotFather."
        )

    await init_db()

    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=MemoryStorage())

    # Middleware (порядок важен: сначала сессия, потом юзер, потом notifier)
    dp.update.middleware(DatabaseMiddleware())
    dp.update.middleware(UserMiddleware())
    dp.update.middleware(NotifierMiddleware(bot))

    # Роутеры
    dp.include_router(common_router)
    dp.include_router(get_player_router())
    dp.include_router(get_admin_router())

    logging.info("Бот стартовал. Polling...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

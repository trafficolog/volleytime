"""Создание async-движка и фабрики сессий."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
)

async_session_maker: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    expire_on_commit=False,
)


async def get_session() -> AsyncSession:
    """Async-генератор сессии (для использования в middleware/handlers)."""
    async with async_session_maker() as session:
        yield session

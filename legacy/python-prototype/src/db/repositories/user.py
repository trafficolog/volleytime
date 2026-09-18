"""Запросы к таблице users."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import User, UserRole


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_telegram_id(self, telegram_id: int) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        telegram_id: int,
        full_name: str,
        username: Optional[str] = None,
        role: UserRole = UserRole.player,
    ) -> User:
        user = User(
            telegram_id=telegram_id,
            full_name=full_name,
            username=username,
            role=role,
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def get_or_create(
        self,
        telegram_id: int,
        full_name: str,
        username: Optional[str] = None,
        admin_ids: Optional[list[int]] = None,
    ) -> tuple[User, bool]:
        """Возвращает (user, created) — был ли создан новый."""
        existing = await self.get_by_telegram_id(telegram_id)
        if existing:
            # Обновим, если изменилось имя или username
            changed = False
            if existing.full_name != full_name:
                existing.full_name = full_name
                changed = True
            if existing.username != username:
                existing.username = username
                changed = True
            if changed:
                await self.session.flush()
            return existing, False

        role = UserRole.admin if admin_ids and telegram_id in admin_ids else UserRole.player
        user = await self.create(telegram_id, full_name, username, role=role)
        return user, True

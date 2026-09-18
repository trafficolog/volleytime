"""Запросы к таблице trainings."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.models import Booking, BookingStatus, Training, TrainingStatus
from src.utils.time import now_msk


class TrainingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, training_id: int, with_bookings: bool = False) -> Optional[Training]:
        stmt = select(Training).where(Training.id == training_id)
        if with_bookings:
            stmt = stmt.options(selectinload(Training.bookings).selectinload(Booking.user))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_upcoming(self, limit: int = 10) -> list[Training]:
        """Список будущих и сегодняшних тренировок (не cancelled, не finished)."""
        result = await self.session.execute(
            select(Training)
            .where(
                and_(
                    Training.starts_at >= now_msk() - timedelta(hours=3),
                    Training.status.in_([TrainingStatus.open, TrainingStatus.planned, TrainingStatus.closed]),
                )
            )
            .order_by(Training.starts_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create(
        self,
        starts_at: datetime,
        ends_at: datetime,
        venue: str,
        price_main: Decimal,
        price_rotation: Decimal,
        rent_cost: Decimal,
        max_main_slots: int = 12,
        max_rotation_slots: int = 2,
        created_by_admin_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> Training:
        training = Training(
            starts_at=starts_at,
            ends_at=ends_at,
            venue=venue,
            price_main=price_main,
            price_rotation=price_rotation,
            rent_cost=rent_cost,
            max_main_slots=max_main_slots,
            max_rotation_slots=max_rotation_slots,
            created_by_admin_id=created_by_admin_id,
            notes=notes,
            status=TrainingStatus.open,
        )
        self.session.add(training)
        await self.session.flush()
        return training

    async def count_active_bookings(self, training_id: int) -> dict[str, int]:
        """Считает, сколько мест занято в каждом слоте."""
        result = await self.session.execute(
            select(Booking).where(
                and_(
                    Booking.training_id == training_id,
                    Booking.status.in_([
                        BookingStatus.confirmed,
                        BookingStatus.pending_payment,
                    ]),
                )
            )
        )
        bookings = result.scalars().all()
        counts = {"main": 0, "rotation": 0, "waitlist": 0}
        for b in bookings:
            counts[b.slot_type.value] += 1
        return counts

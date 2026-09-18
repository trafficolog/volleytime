"""Бизнес-логика записи на тренировку.

Ключевая идея: запись разрешена только в открытое окно, слоты выделяются
по приоритету main -> rotation -> waitlist. Гонки между параллельными
запросами защищены уникальным индексом (user_id, training_id) на уровне БД.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.models import (
    Booking,
    BookingStatus,
    SlotType,
    Training,
    TrainingStatus,
)
from src.db.repositories.training import TrainingRepository
from src.utils.time import now_msk


class BookingError(Exception):
    """Базовое исключение для ошибок записи."""


class TrainingClosedError(BookingError):
    pass


class AlreadyBookedError(BookingError):
    pass


class NoSlotsError(BookingError):
    pass


@dataclass
class BookingProposal:
    """Предложение записи: какой слот достанется и сколько стоит."""
    slot_type: SlotType
    price: Optional[float]  # None если из абонемента
    waitlist_position: Optional[int] = None


class BookingService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.training_repo = TrainingRepository(session)

    async def propose_slot(self, training_id: int, user_id: int) -> BookingProposal:
        """Какой слот будет выдан пользователю при попытке записи."""
        training = await self.training_repo.get_by_id(training_id)
        if not training:
            raise BookingError("Тренировка не найдена")

        self._assert_open_for_booking(training)
        await self._assert_not_booked(training_id, user_id)

        counts = await self.training_repo.count_active_bookings(training_id)

        if counts["main"] < training.max_main_slots:
            return BookingProposal(slot_type=SlotType.main, price=float(training.price_main))
        if counts["rotation"] < training.max_rotation_slots:
            return BookingProposal(slot_type=SlotType.rotation, price=float(training.price_rotation))

        position = counts["waitlist"] + 1
        return BookingProposal(
            slot_type=SlotType.waitlist,
            price=float(training.price_main),
            waitlist_position=position,
        )

    async def create_booking(
        self,
        training_id: int,
        user_id: int,
        slot_type: SlotType,
        status: BookingStatus = BookingStatus.pending_payment,
        payment_id: Optional[int] = None,
        subscription_id: Optional[int] = None,
        waitlist_position: Optional[int] = None,
    ) -> Booking:
        """Создаёт запись. Проверяет, что слот ещё доступен (на момент создания)."""
        training = await self.training_repo.get_by_id(training_id)
        if not training:
            raise BookingError("Тренировка не найдена")

        self._assert_open_for_booking(training)

        # Финальная проверка по счётчику (защита от гонок частично).
        counts = await self.training_repo.count_active_bookings(training_id)
        if slot_type == SlotType.main and counts["main"] >= training.max_main_slots:
            raise NoSlotsError("Основной состав уже заполнен")
        if slot_type == SlotType.rotation and counts["rotation"] >= training.max_rotation_slots:
            raise NoSlotsError("Все ротационные места заняты")

        booking = Booking(
            user_id=user_id,
            training_id=training_id,
            slot_type=slot_type,
            status=status,
            payment_id=payment_id,
            subscription_id=subscription_id,
            waitlist_position=waitlist_position,
        )
        self.session.add(booking)
        try:
            await self.session.flush()
        except IntegrityError as e:
            await self.session.rollback()
            raise AlreadyBookedError("Вы уже записаны на эту тренировку") from e
        return booking

    async def cancel_booking(self, booking_id: int, reason: Optional[str] = None) -> Booking:
        """Отменяет запись. После отмены подтягивается первый из листа ожидания."""
        booking = await self.session.get(Booking, booking_id)
        if not booking:
            raise BookingError("Запись не найдена")
        if booking.status == BookingStatus.cancelled:
            return booking

        booking.status = BookingStatus.cancelled
        booking.cancelled_at = now_msk()
        booking.cancellation_reason = reason
        await self.session.flush()
        return booking

    async def promote_from_waitlist(self, training_id: int) -> Optional[Booking]:
        """Поднимает первого из листа ожидания в основной состав, если есть место."""
        training = await self.training_repo.get_by_id(training_id)
        if not training:
            return None

        counts = await self.training_repo.count_active_bookings(training_id)
        if counts["main"] >= training.max_main_slots and counts["rotation"] >= training.max_rotation_slots:
            return None

        result = await self.session.execute(
            select(Booking)
            .where(
                and_(
                    Booking.training_id == training_id,
                    Booking.slot_type == SlotType.waitlist,
                    Booking.status.in_([BookingStatus.pending_payment, BookingStatus.confirmed]),
                )
            )
            .order_by(Booking.waitlist_position.asc().nullslast())
            .limit(1)
        )
        next_in_line = result.scalar_one_or_none()
        if not next_in_line:
            return None

        if counts["main"] < training.max_main_slots:
            next_in_line.slot_type = SlotType.main
        else:
            next_in_line.slot_type = SlotType.rotation
        next_in_line.waitlist_position = None
        await self.session.flush()
        return next_in_line

    async def get_user_booking(self, training_id: int, user_id: int) -> Optional[Booking]:
        result = await self.session.execute(
            select(Booking).where(
                and_(
                    Booking.training_id == training_id,
                    Booking.user_id == user_id,
                    Booking.status != BookingStatus.cancelled,
                )
            )
        )
        return result.scalar_one_or_none()

    # ---------------- внутренние проверки ----------------

    def _assert_open_for_booking(self, training: Training) -> None:
        if training.status not in (TrainingStatus.open, TrainingStatus.planned):
            raise TrainingClosedError("Запись на эту тренировку закрыта")
        close_at = training.starts_at - timedelta(hours=settings.booking_closes_hours_before)
        if now_msk() >= close_at:
            raise TrainingClosedError(
                f"Запись закрывается за {settings.booking_closes_hours_before} ч. до начала"
            )

    async def _assert_not_booked(self, training_id: int, user_id: int) -> None:
        existing = await self.get_user_booking(training_id, user_id)
        if existing:
            raise AlreadyBookedError("Вы уже записаны на эту тренировку")

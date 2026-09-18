"""Тесты бизнес-логики записи на тренировку.

Проверяем ключевые сценарии:
- запись попадает в основной состав, пока есть места
- переполнение → ротация → лист ожидания
- нельзя записаться дважды
- запись закрывается за N часов до тренировки
- отмена освобождает место и продвигает waitlist
"""
from __future__ import annotations

import asyncio
from datetime import timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.db.models import (
    Base,
    BookingStatus,
    SlotType,
    User,
    UserRole,
)
from src.db.repositories.training import TrainingRepository
from src.services.booking import (
    AlreadyBookedError,
    BookingService,
    TrainingClosedError,
)
from src.utils.time import now_msk


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    """In-memory SQLite на каждый тест."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as s:
        yield s
    await engine.dispose()


async def _make_user(session: AsyncSession, tg_id: int, name: str = "Player") -> User:
    user = User(telegram_id=tg_id, full_name=name, role=UserRole.player)
    session.add(user)
    await session.flush()
    return user


async def _make_training(session: AsyncSession, hours_ahead: int = 24, max_main: int = 2, max_rot: int = 1):
    repo = TrainingRepository(session)
    starts = now_msk() + timedelta(hours=hours_ahead)
    return await repo.create(
        starts_at=starts,
        ends_at=starts + timedelta(hours=2),
        venue="Test Hall",
        price_main=Decimal("15"),
        price_rotation=Decimal("15"),
        rent_cost=Decimal("100"),
        max_main_slots=max_main,
        max_rotation_slots=max_rot,
    )


@pytest.mark.asyncio
async def test_first_player_gets_main_slot(session):
    user = await _make_user(session, 1)
    training = await _make_training(session)
    svc = BookingService(session)

    proposal = await svc.propose_slot(training.id, user.id)
    assert proposal.slot_type == SlotType.main
    assert proposal.price == 15.0


@pytest.mark.asyncio
async def test_slots_fill_in_order_main_rotation_waitlist(session):
    training = await _make_training(session, max_main=2, max_rot=1)
    svc = BookingService(session)

    u1 = await _make_user(session, 1, "U1")
    u2 = await _make_user(session, 2, "U2")
    u3 = await _make_user(session, 3, "U3")
    u4 = await _make_user(session, 4, "U4")

    await svc.create_booking(training.id, u1.id, SlotType.main, BookingStatus.confirmed)
    await svc.create_booking(training.id, u2.id, SlotType.main, BookingStatus.confirmed)

    # Третий должен попасть в ротацию
    p3 = await svc.propose_slot(training.id, u3.id)
    assert p3.slot_type == SlotType.rotation
    await svc.create_booking(training.id, u3.id, SlotType.rotation, BookingStatus.confirmed)

    # Четвёртый — в лист ожидания
    p4 = await svc.propose_slot(training.id, u4.id)
    assert p4.slot_type == SlotType.waitlist
    assert p4.waitlist_position == 1


@pytest.mark.asyncio
async def test_cannot_book_twice(session):
    training = await _make_training(session)
    user = await _make_user(session, 1)
    svc = BookingService(session)

    await svc.create_booking(training.id, user.id, SlotType.main, BookingStatus.confirmed)

    with pytest.raises(AlreadyBookedError):
        await svc.propose_slot(training.id, user.id)


@pytest.mark.asyncio
async def test_booking_closed_within_window(session):
    # Тренировка через 1 час, окно закрытия за 2 часа → запись закрыта
    training = await _make_training(session, hours_ahead=1)
    user = await _make_user(session, 1)
    svc = BookingService(session)

    with pytest.raises(TrainingClosedError):
        await svc.propose_slot(training.id, user.id)


@pytest.mark.asyncio
async def test_cancel_promotes_waitlist(session):
    training = await _make_training(session, max_main=1, max_rot=0)
    svc = BookingService(session)

    u1 = await _make_user(session, 1, "U1")
    u2 = await _make_user(session, 2, "U2")

    b1 = await svc.create_booking(training.id, u1.id, SlotType.main, BookingStatus.confirmed)
    b2 = await svc.create_booking(
        training.id, u2.id, SlotType.waitlist, BookingStatus.confirmed,
        waitlist_position=1,
    )

    # Отменяем первого
    await svc.cancel_booking(b1.id, reason="test")
    promoted = await svc.promote_from_waitlist(training.id)

    assert promoted is not None
    assert promoted.id == b2.id
    assert promoted.slot_type == SlotType.main
    assert promoted.waitlist_position is None

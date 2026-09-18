"""Интеграционные тесты: полный цикл оплаты от создания до confirm."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.db.models import (
    Base,
    Booking,
    BookingStatus,
    LedgerCategory,
    LedgerType,
    PaymentMethod,
    PaymentStatus,
    SlotType,
    SubscriptionStatus,
    Training,
    TrainingStatus,
    User,
    UserRole,
)
from src.services.ledger import LedgerService
from src.services.payments import (
    PaymentAlreadyProcessedError,
    PaymentService,
)
from src.services.subscription import (
    SubscriptionService,
    get_plan,
)
from src.utils.time import now_msk


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as s:
        yield s
    await engine.dispose()


async def _player(session, tg=1, role=UserRole.player) -> User:
    u = User(telegram_id=tg, full_name=f"Player {tg}", role=role)
    session.add(u)
    await session.flush()
    return u


async def _training(session) -> Training:
    starts = now_msk() + timedelta(days=2)
    t = Training(
        starts_at=starts,
        ends_at=starts + timedelta(hours=2),
        venue="Спортшкола №1",
        price_main=Decimal("15.00"),
        price_rotation=Decimal("15.00"),
        status=TrainingStatus.open,
    )
    session.add(t)
    await session.flush()
    return t


# ---------- Сценарий 1: cash-оплата за тренировку ----------

@pytest.mark.asyncio
async def test_full_flow_cash_payment_for_training(session):
    player = await _player(session)
    admin = await _player(session, tg=999, role=UserRole.admin)
    training = await _training(session)

    # Шаг 1: создаём бронь в pending_payment
    booking = Booking(
        user_id=player.id,
        training_id=training.id,
        slot_type=SlotType.main,
        status=BookingStatus.pending_payment,
    )
    session.add(booking)
    await session.flush()

    # Шаг 2: создаём pending-платёж
    payment_svc = PaymentService(session)
    payment = await payment_svc.create_for_booking(
        user_id=player.id,
        booking_id=booking.id,
        amount=Decimal("15.00"),
        method=PaymentMethod.cash,
    )
    booking.payment_id = payment.id
    await session.flush()

    assert payment.status == PaymentStatus.pending
    assert booking.status == BookingStatus.pending_payment

    # Шаг 3: касса ещё пустая
    ledger = LedgerService(session)
    bal_before = await ledger.get_balance()
    assert bal_before.balance == Decimal("0.00")

    # Шаг 4: админ подтверждает платёж
    confirmed = await payment_svc.confirm(payment.id, admin_id=admin.id)
    await session.refresh(booking)

    # Проверки
    assert confirmed.status == PaymentStatus.succeeded
    assert confirmed.confirmed_by_admin_id == admin.id
    assert booking.status == BookingStatus.confirmed

    # Касса увеличилась
    bal_after = await ledger.get_balance()
    assert bal_after.income_total == Decimal("15.00")
    assert bal_after.balance == Decimal("15.00")


# ---------- Сценарий 2: cash-оплата абонемента ----------

@pytest.mark.asyncio
async def test_full_flow_cash_payment_for_subscription(session):
    player = await _player(session)
    admin = await _player(session, tg=999, role=UserRole.admin)

    # Шаг 1: создаём pending-абонемент + pending-платёж
    sub_svc = SubscriptionService(session)
    plan = get_plan("8x")
    sub, payment = await sub_svc.create_pending(
        user_id=player.id,
        plan=plan,
        method=PaymentMethod.cash,
    )

    assert sub.status == SubscriptionStatus.expired  # ещё не активен
    assert payment.status == PaymentStatus.pending

    # Шаг 2: админ подтверждает
    payment_svc = PaymentService(session)
    await payment_svc.confirm(payment.id, admin_id=admin.id)
    await session.refresh(sub)

    # Проверки
    assert sub.status == SubscriptionStatus.active
    assert sub.remaining_sessions == 8

    # Касса
    ledger = LedgerService(session)
    bal = await ledger.get_balance()
    assert bal.income_total == plan.price
    assert bal.balance == plan.price


# ---------- Сценарий 3: двойное подтверждение защищено ----------

@pytest.mark.asyncio
async def test_double_confirm_protected(session):
    player = await _player(session)
    admin = await _player(session, tg=999, role=UserRole.admin)
    training = await _training(session)
    booking = Booking(
        user_id=player.id,
        training_id=training.id,
        slot_type=SlotType.main,
        status=BookingStatus.pending_payment,
    )
    session.add(booking)
    await session.flush()

    payment_svc = PaymentService(session)
    payment = await payment_svc.create_for_booking(
        user_id=player.id,
        booking_id=booking.id,
        amount=Decimal("15.00"),
        method=PaymentMethod.cash,
    )

    await payment_svc.confirm(payment.id, admin_id=admin.id)

    with pytest.raises(PaymentAlreadyProcessedError):
        await payment_svc.confirm(payment.id, admin_id=admin.id)

    # Касса должна содержать ровно ОДНУ запись
    ledger = LedgerService(session)
    recent = await ledger.list_recent()
    income_entries = [e for e in recent if e.type == LedgerType.income]
    assert len(income_entries) == 1


# ---------- Сценарий 4: отказ платежа отменяет бронь ----------

@pytest.mark.asyncio
async def test_payment_fail_cancels_booking(session):
    player = await _player(session)
    training = await _training(session)
    booking = Booking(
        user_id=player.id,
        training_id=training.id,
        slot_type=SlotType.main,
        status=BookingStatus.pending_payment,
    )
    session.add(booking)
    await session.flush()

    payment_svc = PaymentService(session)
    payment = await payment_svc.create_for_booking(
        user_id=player.id,
        booking_id=booking.id,
        amount=Decimal("15.00"),
        method=PaymentMethod.cash,
    )

    failed = await payment_svc.fail(payment.id, reason="rejected_by_admin")
    await session.refresh(booking)

    assert failed.status == PaymentStatus.failed
    assert booking.status == BookingStatus.cancelled
    assert booking.cancellation_reason == "payment_failed"

    # Касса не изменилась
    ledger = LedgerService(session)
    bal = await ledger.get_balance()
    assert bal.balance == Decimal("0.00")

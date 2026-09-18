"""Тесты сервиса кассы (Ledger)."""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.db.models import (
    Base,
    LedgerCategory,
    LedgerType,
    Payment,
    PaymentKind,
    PaymentMethod,
    PaymentStatus,
    Subscription,
    SubscriptionStatus,
    User,
    UserRole,
)
from src.services.ledger import LedgerService
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


async def _user(session: AsyncSession, tg: int = 1) -> User:
    u = User(telegram_id=tg, full_name="P", role=UserRole.player)
    session.add(u)
    await session.flush()
    return u


@pytest.mark.asyncio
async def test_record_income_creates_entry(session):
    svc = LedgerService(session)
    e = await svc.record_income(
        amount=Decimal("15.00"),
        category=LedgerCategory.training_fee,
        description="оплата за тренировку",
    )
    assert e.id is not None
    assert e.type == LedgerType.income
    assert e.amount == Decimal("15.00")


@pytest.mark.asyncio
async def test_record_expense_with_evidence(session):
    svc = LedgerService(session)
    e = await svc.record_expense(
        amount=Decimal("100.00"),
        category=LedgerCategory.rent,
        description="аренда 30.05",
        evidence_file_id="AgACAgIAA...",
    )
    assert e.type == LedgerType.expense
    assert e.evidence_file_id == "AgACAgIAA..."


@pytest.mark.asyncio
async def test_balance_zero_initially(session):
    svc = LedgerService(session)
    b = await svc.get_balance()
    assert b.income_total == Decimal("0.00")
    assert b.expense_total == Decimal("0.00")
    assert b.balance == Decimal("0.00")


@pytest.mark.asyncio
async def test_balance_after_income_and_expense(session):
    svc = LedgerService(session)
    await svc.record_income(Decimal("210.00"), LedgerCategory.training_fee, "14 игроков")
    await svc.record_expense(Decimal("100.00"), LedgerCategory.rent, "зал")
    await svc.record_expense(Decimal("20.00"), LedgerCategory.balls, "мяч")

    b = await svc.get_balance()
    assert b.income_total == Decimal("210.00")
    assert b.expense_total == Decimal("120.00")
    assert b.balance == Decimal("90.00")


@pytest.mark.asyncio
async def test_balance_filters_by_date(session):
    svc = LedgerService(session)
    today = now_msk().date()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    await svc.record_income(Decimal("50"), LedgerCategory.training_fee, "вчера", )
    # Подменим дату для проверки фильтра
    e1 = await svc.record_expense(Decimal("30"), LedgerCategory.rent, "сегодня")
    # Принудительно ставим прошлую дату для первой записи
    from sqlalchemy import select
    from src.db.models import LedgerEntry
    result = await session.execute(select(LedgerEntry).order_by(LedgerEntry.id.asc()))
    entries = list(result.scalars().all())
    entries[0].occurred_on = yesterday
    await session.flush()

    # Баланс на вчера: только первый income, без расхода
    b_yesterday = await svc.get_balance(until=yesterday)
    assert b_yesterday.income_total == Decimal("50.00")
    assert b_yesterday.expense_total == Decimal("0.00")
    assert b_yesterday.balance == Decimal("50.00")

    # Баланс на сегодня: и доход и расход
    b_today = await svc.get_balance(until=today)
    assert b_today.income_total == Decimal("50.00")
    assert b_today.expense_total == Decimal("30.00")
    assert b_today.balance == Decimal("20.00")


@pytest.mark.asyncio
async def test_list_recent_orders_desc(session):
    svc = LedgerService(session)
    await svc.record_income(Decimal("10"), LedgerCategory.training_fee, "first")
    await svc.record_income(Decimal("20"), LedgerCategory.training_fee, "second")
    await svc.record_income(Decimal("30"), LedgerCategory.training_fee, "third")

    recent = await svc.list_recent(limit=5)
    assert len(recent) == 3
    # Самый свежий первый
    assert recent[0].description == "third"


@pytest.mark.asyncio
async def test_record_income_from_payment_for_subscription(session):
    user = await _user(session)
    payment = Payment(
        user_id=user.id,
        amount=Decimal("104.00"),
        kind=PaymentKind.subscription,
        method=PaymentMethod.cash,
        status=PaymentStatus.succeeded,
    )
    session.add(payment)
    await session.flush()
    payment.subscription_id = None  # Имитируем — payment в реальности связан с подпиской
    # Чтобы хелпер взял правильную категорию, нужен subscription_id; создадим subscription
    sub = Subscription(
        user_id=user.id, total_sessions=8, used_sessions=0,
        price=Decimal("104.00"),
        purchased_at=now_msk(),
        expires_at=now_msk() + timedelta(days=60),
        status=SubscriptionStatus.active,
        payment_id=payment.id,
    )
    session.add(sub)
    await session.flush()
    payment.subscription_id = sub.id
    await session.flush()

    svc = LedgerService(session)
    entry = await svc.record_income_from_payment(payment)
    assert entry.category == LedgerCategory.subscription
    assert entry.amount == Decimal("104.00")
    assert entry.related_payment_id == payment.id


@pytest.mark.asyncio
async def test_record_income_from_payment_for_booking(session):
    user = await _user(session)
    payment = Payment(
        user_id=user.id,
        amount=Decimal("15.00"),
        kind=PaymentKind.single,
        method=PaymentMethod.cash,
        status=PaymentStatus.succeeded,
    )
    session.add(payment)
    await session.flush()

    svc = LedgerService(session)
    entry = await svc.record_income_from_payment(payment)
    assert entry.category == LedgerCategory.training_fee
    assert entry.amount == Decimal("15.00")

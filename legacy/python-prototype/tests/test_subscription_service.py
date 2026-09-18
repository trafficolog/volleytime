"""Тесты бизнес-логики абонементов."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.db.models import (
    Base,
    PaymentMethod,
    Subscription,
    SubscriptionStatus,
    User,
    UserRole,
)
from src.services.subscription import (
    DEFAULT_PLANS,
    SubscriptionDepletedError,
    SubscriptionExpiredError,
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


async def _user(session: AsyncSession, tg_id: int = 1) -> User:
    u = User(telegram_id=tg_id, full_name="P", role=UserRole.player)
    session.add(u)
    await session.flush()
    return u


@pytest.mark.asyncio
async def test_plans_consistent():
    assert get_plan("8x") is not None
    assert get_plan("8x").total_sessions == 8
    assert get_plan("nope") is None


@pytest.mark.asyncio
async def test_create_pending_subscription(session):
    user = await _user(session)
    svc = SubscriptionService(session)
    plan = get_plan("4x")

    sub, payment = await svc.create_pending(user.id, plan, method=PaymentMethod.cash)
    assert sub.user_id == user.id
    assert sub.total_sessions == 4
    assert sub.status == SubscriptionStatus.expired  # станет active после оплаты
    assert payment.amount == plan.price
    assert payment.subscription_id == sub.id


@pytest.mark.asyncio
async def test_consume_session_atomic(session):
    user = await _user(session)
    sub = Subscription(
        user_id=user.id,
        total_sessions=3,
        used_sessions=0,
        price=Decimal("50"),
        purchased_at=now_msk(),
        expires_at=now_msk() + timedelta(days=30),
        status=SubscriptionStatus.active,
    )
    session.add(sub)
    await session.flush()

    svc = SubscriptionService(session)
    s1 = await svc.consume_session(sub.id)
    assert s1.used_sessions == 1
    s2 = await svc.consume_session(sub.id)
    assert s2.used_sessions == 2
    s3 = await svc.consume_session(sub.id)
    assert s3.used_sessions == 3
    assert s3.status == SubscriptionStatus.depleted

    with pytest.raises(SubscriptionDepletedError):
        await svc.consume_session(sub.id)


@pytest.mark.asyncio
async def test_consume_expired_subscription(session):
    user = await _user(session)
    sub = Subscription(
        user_id=user.id,
        total_sessions=5,
        used_sessions=0,
        price=Decimal("50"),
        purchased_at=now_msk() - timedelta(days=100),
        expires_at=now_msk() - timedelta(days=1),  # истёк вчера
        status=SubscriptionStatus.active,
    )
    session.add(sub)
    await session.flush()

    svc = SubscriptionService(session)
    with pytest.raises(SubscriptionExpiredError):
        await svc.consume_session(sub.id)


@pytest.mark.asyncio
async def test_get_active_excludes_expired(session):
    user = await _user(session)
    expired = Subscription(
        user_id=user.id, total_sessions=4, used_sessions=0, price=Decimal("50"),
        purchased_at=now_msk() - timedelta(days=100),
        expires_at=now_msk() - timedelta(days=1),
        status=SubscriptionStatus.active,
    )
    active = Subscription(
        user_id=user.id, total_sessions=4, used_sessions=0, price=Decimal("50"),
        purchased_at=now_msk(),
        expires_at=now_msk() + timedelta(days=10),
        status=SubscriptionStatus.active,
    )
    session.add_all([expired, active])
    await session.flush()

    svc = SubscriptionService(session)
    result = await svc.get_active_for_user(user.id)
    assert len(result) == 1
    assert result[0].id == active.id


@pytest.mark.asyncio
async def test_fifo_consumption_chooses_nearest_expiry(session):
    user = await _user(session)
    far = Subscription(
        user_id=user.id, total_sessions=4, used_sessions=0, price=Decimal("50"),
        purchased_at=now_msk(),
        expires_at=now_msk() + timedelta(days=60),
        status=SubscriptionStatus.active,
    )
    near = Subscription(
        user_id=user.id, total_sessions=4, used_sessions=0, price=Decimal("50"),
        purchased_at=now_msk(),
        expires_at=now_msk() + timedelta(days=5),
        status=SubscriptionStatus.active,
    )
    session.add_all([far, near])
    await session.flush()

    svc = SubscriptionService(session)
    best = await svc.get_best_for_consumption(user.id)
    assert best.id == near.id


@pytest.mark.asyncio
async def test_restore_session(session):
    user = await _user(session)
    sub = Subscription(
        user_id=user.id, total_sessions=4, used_sessions=2, price=Decimal("50"),
        purchased_at=now_msk(),
        expires_at=now_msk() + timedelta(days=30),
        status=SubscriptionStatus.active,
    )
    session.add(sub)
    await session.flush()

    svc = SubscriptionService(session)
    restored = await svc.restore_session(sub.id)
    assert restored.used_sessions == 1


@pytest.mark.asyncio
async def test_restore_reactivates_depleted(session):
    user = await _user(session)
    sub = Subscription(
        user_id=user.id, total_sessions=4, used_sessions=4, price=Decimal("50"),
        purchased_at=now_msk(),
        expires_at=now_msk() + timedelta(days=30),
        status=SubscriptionStatus.depleted,
    )
    session.add(sub)
    await session.flush()

    svc = SubscriptionService(session)
    restored = await svc.restore_session(sub.id)
    assert restored.used_sessions == 3
    assert restored.status == SubscriptionStatus.active

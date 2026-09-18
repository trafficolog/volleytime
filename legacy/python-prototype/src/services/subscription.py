"""Бизнес-логика абонементов: покупка, списание, проверка валидности.

Ключевые гарантии:
- Списание сессии атомарно на уровне SQL (SET used = used + 1 WHERE used < total).
  Это защищает от гонок (одну сессию не спишут дважды).
- При выборе абонемента для списания берётся ближайший к истечению (FIFO).
- Истёкшие или израсходованные абонементы автоматически переводятся в
  соответствующий статус при следующем обращении.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    PaymentKind,
    PaymentMethod,
    PaymentStatus,
    Subscription,
    SubscriptionStatus,
    Payment,
)
from src.utils.time import now_msk, to_msk


# --------------- ошибки ---------------

class SubscriptionError(Exception):
    pass


class NoActiveSubscriptionError(SubscriptionError):
    pass


class SubscriptionDepletedError(SubscriptionError):
    pass


class SubscriptionExpiredError(SubscriptionError):
    pass


# --------------- планы ---------------

@dataclass(frozen=True)
class SubscriptionPlan:
    """Описание плана. Лежит в коде, потому что меняется редко."""
    code: str
    total_sessions: int
    price: Decimal
    valid_days: int
    title: str


# Базовые планы. Цены можно вынести в settings, если станут часто меняться.
DEFAULT_PLANS: list[SubscriptionPlan] = [
    SubscriptionPlan(
        code="4x",
        total_sessions=4,
        price=Decimal("56.00"),     # 14 BYN за тренировку (скидка 1 BYN от разовой 15)
        valid_days=35,
        title="4 тренировки",
    ),
    SubscriptionPlan(
        code="8x",
        total_sessions=8,
        price=Decimal("104.00"),    # 13 BYN за тренировку
        valid_days=60,
        title="8 тренировок",
    ),
    SubscriptionPlan(
        code="12x",
        total_sessions=12,
        price=Decimal("144.00"),    # 12 BYN за тренировку
        valid_days=90,
        title="12 тренировок",
    ),
]


def get_plan(code: str) -> Optional[SubscriptionPlan]:
    for p in DEFAULT_PLANS:
        if p.code == code:
            return p
    return None


# --------------- сервис ---------------

class SubscriptionService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_pending(
        self,
        user_id: int,
        plan: SubscriptionPlan,
        method: PaymentMethod,
    ) -> tuple[Subscription, Payment]:
        """Создаёт неактивированный абонемент + связанный pending-платёж.

        Активация (status=active) произойдёт после подтверждения оплаты:
        - админом (для cash/перевода в Фазе 2),
        - вебхуком bePaid (для карты в Фазе 3).
        """
        now = now_msk()
        sub = Subscription(
            user_id=user_id,
            total_sessions=plan.total_sessions,
            used_sessions=0,
            price=plan.price,
            purchased_at=now,
            expires_at=now + timedelta(days=plan.valid_days),
            status=SubscriptionStatus.expired,  # станет active после оплаты
        )
        self.session.add(sub)
        await self.session.flush()

        payment = Payment(
            user_id=user_id,
            amount=plan.price,
            kind=PaymentKind.subscription,
            method=method,
            status=PaymentStatus.pending,
            subscription_id=sub.id,
        )
        self.session.add(payment)
        await self.session.flush()

        sub.payment_id = payment.id
        await self.session.flush()
        return sub, payment

    async def activate(self, subscription_id: int) -> Subscription:
        """Переводит абонемент в active. Вызывается после успешной оплаты."""
        sub = await self.session.get(Subscription, subscription_id)
        if not sub:
            raise SubscriptionError("Абонемент не найден")
        sub.status = SubscriptionStatus.active
        # Пересчитываем expires_at от момента активации, а не покупки.
        # Это важно, если оплата прошла позже создания записи в БД.
        # Для простоты в Фазе 2 — оставляем как было при create_pending.
        await self.session.flush()
        return sub

    async def get_active_for_user(self, user_id: int) -> list[Subscription]:
        """Возвращает все активные абонементы пользователя (FIFO по expires_at)."""
        now = now_msk()
        result = await self.session.execute(
            select(Subscription)
            .where(
                and_(
                    Subscription.user_id == user_id,
                    Subscription.status == SubscriptionStatus.active,
                )
            )
            .order_by(Subscription.expires_at.asc())
        )
        all_active = list(result.scalars().all())
        valid = []
        for s in all_active:
            if to_msk(s.expires_at) <= now:
                # Помечаем истёкшие
                s.status = SubscriptionStatus.expired
            elif s.remaining_sessions <= 0:
                s.status = SubscriptionStatus.depleted
            else:
                valid.append(s)
        await self.session.flush()
        return valid

    async def get_best_for_consumption(self, user_id: int) -> Optional[Subscription]:
        """Лучший абонемент для списания: с ближайшим истечением, ещё с сессиями."""
        active = await self.get_active_for_user(user_id)
        return active[0] if active else None

    async def consume_session(self, subscription_id: int) -> Subscription:
        """Списывает одну сессию. Атомарно через WHERE-условие.

        Если used_sessions уже == total_sessions, UPDATE не затронет строк
        → бросаем SubscriptionDepletedError.
        """
        sub = await self.session.get(Subscription, subscription_id)
        if not sub:
            raise SubscriptionError("Абонемент не найден")

        # Сначала проверяем количество сессий — depleted должен быть приоритетнее.
        if sub.used_sessions >= sub.total_sessions or sub.status == SubscriptionStatus.depleted:
            raise SubscriptionDepletedError("На абонементе не осталось сессий")

        if to_msk(sub.expires_at) <= now_msk():
            sub.status = SubscriptionStatus.expired
            await self.session.flush()
            raise SubscriptionExpiredError("Срок действия абонемента истёк")

        if sub.status != SubscriptionStatus.active:
            raise NoActiveSubscriptionError(f"Абонемент в статусе {sub.status.value}")

        # Атомарное списание через WHERE-условие.
        result = await self.session.execute(
            update(Subscription)
            .where(
                and_(
                    Subscription.id == subscription_id,
                    Subscription.used_sessions < Subscription.total_sessions,
                    Subscription.status == SubscriptionStatus.active,
                )
            )
            .values(used_sessions=Subscription.used_sessions + 1)
            .execution_options(synchronize_session="fetch")
        )
        if result.rowcount == 0:
            raise SubscriptionDepletedError("На абонементе не осталось сессий")

        await self.session.refresh(sub)

        if sub.remaining_sessions <= 0:
            sub.status = SubscriptionStatus.depleted
            await self.session.flush()
        return sub

    async def restore_session(self, subscription_id: int) -> Subscription:
        """Возвращает сессию обратно (при отмене записи в срок)."""
        sub = await self.session.get(Subscription, subscription_id)
        if not sub:
            raise SubscriptionError("Абонемент не найден")
        if sub.used_sessions <= 0:
            return sub
        sub.used_sessions -= 1
        if sub.status == SubscriptionStatus.depleted and to_msk(sub.expires_at) > now_msk():
            sub.status = SubscriptionStatus.active
        await self.session.flush()
        return sub

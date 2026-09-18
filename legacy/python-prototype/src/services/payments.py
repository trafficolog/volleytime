"""Сервис платежей: создание, подтверждение, отказ, refund.

В Фазе 2 поддерживаются методы:
- cash — наличные на тренировке, подтверждает админ.
- bepaid_card / bepaid_erip — заглушки, будут реализованы в Фазе 3.

Подтверждение платежа триггерит:
- активацию связанного Subscription или
- подтверждение связанного Booking;
- запись в кассу.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.db.models import (
    Booking,
    BookingStatus,
    LedgerCategory,
    Payment,
    PaymentKind,
    PaymentMethod,
    PaymentStatus,
    Subscription,
    SubscriptionStatus,
)
from src.services.ledger import LedgerService
from src.utils.money import to_money
from src.utils.time import now_msk, to_msk


class PaymentError(Exception):
    pass


class PaymentNotFoundError(PaymentError):
    pass


class PaymentAlreadyProcessedError(PaymentError):
    pass


class PaymentService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ledger = LedgerService(session)

    async def create_for_booking(
        self,
        user_id: int,
        booking_id: int,
        amount: Decimal,
        method: PaymentMethod,
    ) -> Payment:
        payment = Payment(
            user_id=user_id,
            amount=to_money(amount),
            kind=PaymentKind.single,
            method=method,
            status=PaymentStatus.pending,
            booking_id=booking_id,
        )
        self.session.add(payment)
        await self.session.flush()
        return payment

    async def confirm(
        self,
        payment_id: int,
        admin_id: Optional[int] = None,
    ) -> Payment:
        """Подтверждает платёж. Применяет все побочные эффекты."""
        payment = await self.session.get(Payment, payment_id)
        if not payment:
            raise PaymentNotFoundError("Платёж не найден")
        if payment.status == PaymentStatus.succeeded:
            raise PaymentAlreadyProcessedError("Платёж уже подтверждён")
        if payment.status not in (PaymentStatus.pending,):
            raise PaymentError(f"Нельзя подтвердить платёж в статусе {payment.status.value}")

        payment.status = PaymentStatus.succeeded
        payment.succeeded_at = now_msk()
        payment.confirmed_by_admin_id = admin_id

        # Активируем связанные сущности
        related_training_id: Optional[int] = None
        if payment.subscription_id:
            sub = await self.session.get(Subscription, payment.subscription_id)
            if sub:
                sub.status = SubscriptionStatus.active
                # Пересчитываем срок от момента активации
                # (только если purchased_at был в прошлом более чем на час)
                if to_msk(sub.purchased_at) < now_msk() - timedelta(hours=1):
                    days = (to_msk(sub.expires_at) - to_msk(sub.purchased_at)).days
                    sub.purchased_at = now_msk()
                    sub.expires_at = now_msk() + timedelta(days=days)

        if payment.booking_id:
            booking = await self.session.get(Booking, payment.booking_id)
            if booking and booking.status == BookingStatus.pending_payment:
                booking.status = BookingStatus.confirmed
                related_training_id = booking.training_id

        # Касса
        await self.ledger.record_income_from_payment(
            payment,
            related_training_id=related_training_id,
            admin_id=admin_id,
        )

        await self.session.flush()
        return payment

    async def fail(self, payment_id: int, reason: Optional[str] = None) -> Payment:
        payment = await self.session.get(Payment, payment_id)
        if not payment:
            raise PaymentNotFoundError("Платёж не найден")
        if payment.status == PaymentStatus.succeeded:
            raise PaymentAlreadyProcessedError("Нельзя отметить как failed успешный платёж")

        payment.status = PaymentStatus.failed
        payment.bepaid_status = reason or "failed"

        # Если был booking — снять бронь
        if payment.booking_id:
            booking = await self.session.get(Booking, payment.booking_id)
            if booking and booking.status == BookingStatus.pending_payment:
                booking.status = BookingStatus.cancelled
                booking.cancelled_at = now_msk()
                booking.cancellation_reason = "payment_failed"

        await self.session.flush()
        return payment

    async def list_pending(self) -> list[Payment]:
        from sqlalchemy import select
        result = await self.session.execute(
            select(Payment)
            .where(Payment.status == PaymentStatus.pending)
            .order_by(Payment.created_at.asc())
        )
        return list(result.scalars().all())

    async def get(self, payment_id: int) -> Optional[Payment]:
        return await self.session.get(Payment, payment_id)

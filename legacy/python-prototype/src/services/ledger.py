"""Касса: учёт всех движений денег группы.

Принципы:
- Каждое успешное поступление автоматически создаёт LedgerEntry(income).
- Расходы (аренда, мячи) вводятся админом вручную с фото чека.
- Баланс на дату считается как sum(income) - sum(expense) до этой даты.
- Никогда не редактируем старые записи: только добавляем новые (audit-friendly).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date as date_type
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import (
    LedgerCategory,
    LedgerEntry,
    LedgerType,
    Payment,
)
from src.utils.money import to_money
from src.utils.time import now_msk


@dataclass(frozen=True)
class LedgerBalance:
    income_total: Decimal
    expense_total: Decimal
    balance: Decimal


class LedgerService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def record_income(
        self,
        amount: Decimal,
        category: LedgerCategory,
        description: str,
        related_payment_id: Optional[int] = None,
        related_training_id: Optional[int] = None,
        admin_id: Optional[int] = None,
    ) -> LedgerEntry:
        entry = LedgerEntry(
            type=LedgerType.income,
            category=category,
            amount=to_money(amount),
            description=description,
            occurred_on=now_msk().date(),
            related_payment_id=related_payment_id,
            related_training_id=related_training_id,
            created_by_admin_id=admin_id,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def record_expense(
        self,
        amount: Decimal,
        category: LedgerCategory,
        description: str,
        occurred_on: Optional[date_type] = None,
        evidence_file_id: Optional[str] = None,
        related_training_id: Optional[int] = None,
        admin_id: Optional[int] = None,
    ) -> LedgerEntry:
        entry = LedgerEntry(
            type=LedgerType.expense,
            category=category,
            amount=to_money(amount),
            description=description,
            occurred_on=occurred_on or now_msk().date(),
            evidence_file_id=evidence_file_id,
            related_training_id=related_training_id,
            created_by_admin_id=admin_id,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def record_income_from_payment(
        self,
        payment: Payment,
        related_training_id: Optional[int] = None,
        admin_id: Optional[int] = None,
    ) -> LedgerEntry:
        """Хелпер: при подтверждении платежа автоматически в кассу."""
        category = (
            LedgerCategory.subscription
            if payment.subscription_id
            else LedgerCategory.training_fee
        )
        description = f"Платёж #{payment.id} от пользователя #{payment.user_id}"
        return await self.record_income(
            amount=payment.amount,
            category=category,
            description=description,
            related_payment_id=payment.id,
            related_training_id=related_training_id,
            admin_id=admin_id,
        )

    async def get_balance(
        self,
        until: Optional[date_type] = None,
    ) -> LedgerBalance:
        """Баланс на указанную дату (по умолчанию — сегодня)."""
        until = until or now_msk().date()
        income_stmt = select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            and_(
                LedgerEntry.type == LedgerType.income,
                LedgerEntry.occurred_on <= until,
            )
        )
        expense_stmt = select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            and_(
                LedgerEntry.type == LedgerType.expense,
                LedgerEntry.occurred_on <= until,
            )
        )
        income = to_money(await self.session.scalar(income_stmt) or 0)
        expense = to_money(await self.session.scalar(expense_stmt) or 0)
        return LedgerBalance(
            income_total=income,
            expense_total=expense,
            balance=income - expense,
        )

    async def list_recent(self, limit: int = 20) -> list[LedgerEntry]:
        result = await self.session.execute(
            select(LedgerEntry)
            .order_by(LedgerEntry.occurred_on.desc(), LedgerEntry.id.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

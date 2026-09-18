"""Работа с деньгами через Decimal. Никогда не используем float для финансов."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

CURRENCY_PRECISION = Decimal("0.01")


def to_money(value: int | float | str | Decimal) -> Decimal:
    """Приводит число к Decimal с округлением до копеек."""
    return Decimal(str(value)).quantize(CURRENCY_PRECISION, rounding=ROUND_HALF_UP)


def format_byn(value: Decimal) -> str:
    """Форматирует сумму для отображения пользователю: 25.00 BYN"""
    return f"{to_money(value)} BYN"


def to_bepaid_amount(value: Decimal) -> int:
    """bePaid принимает суммы в минимальных единицах (копейках). 25.00 BYN -> 2500."""
    return int(to_money(value) * 100)

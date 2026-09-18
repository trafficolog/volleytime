"""Работа с временем в таймзоне Europe/Minsk."""
from __future__ import annotations

from datetime import datetime, timezone

from src.config import settings


def now_msk() -> datetime:
    """Текущее время в Минске."""
    return datetime.now(tz=settings.tz)


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def to_msk(dt: datetime) -> datetime:
    """Конвертация любого datetime в минский часовой пояс."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(settings.tz)


def format_dt_human(dt: datetime) -> str:
    """'Пт, 30 мая в 19:00'"""
    weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    months = ["янв", "фев", "мар", "апр", "мая", "июн",
              "июл", "авг", "сен", "окт", "ноя", "дек"]
    dt = to_msk(dt)
    return f"{weekdays[dt.weekday()]}, {dt.day} {months[dt.month - 1]} в {dt.strftime('%H:%M')}"

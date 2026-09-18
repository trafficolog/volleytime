"""Хендлеры просмотра записей игрока."""
from __future__ import annotations

from aiogram import F, Router
from aiogram.types import CallbackQuery
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.bot.keyboards import main_menu
from src.db.models import Booking, BookingStatus, User, UserRole
from src.utils.time import format_dt_human, now_msk

router = Router(name="my_bookings")


@router.callback_query(F.data == "bookings:my")
async def cb_my_bookings(callback: CallbackQuery, session: AsyncSession, user: User) -> None:
    result = await session.execute(
        select(Booking)
        .options(selectinload(Booking.training))
        .where(
            and_(
                Booking.user_id == user.id,
                Booking.status.in_([
                    BookingStatus.pending_payment,
                    BookingStatus.confirmed,
                ]),
            )
        )
    )
    bookings = list(result.scalars().all())
    # Только будущие
    bookings = [b for b in bookings if b.training.starts_at >= now_msk()]
    bookings.sort(key=lambda b: b.training.starts_at)

    if not bookings:
        text = "📋 У вас нет предстоящих записей."
    else:
        lines = ["📋 <b>Ваши предстоящие записи:</b>\n"]
        for b in bookings:
            slot_label = {
                "main": "основной",
                "rotation": "ротация",
                "waitlist": f"в ожидании #{b.waitlist_position or '?'}",
            }[b.slot_type.value]
            status_label = {
                BookingStatus.pending_payment: " · ожидает оплаты",
                BookingStatus.confirmed: " · оплачено",
            }.get(b.status, "")
            lines.append(
                f"• {format_dt_human(b.training.starts_at)}\n"
                f"  📍 {b.training.venue} · {slot_label}{status_label}"
            )
        text = "\n\n".join(lines)

    if callback.message:
        await callback.message.edit_text(
            text,
            reply_markup=main_menu(is_admin=user.role == UserRole.admin),
            parse_mode="HTML",
        )
    await callback.answer()

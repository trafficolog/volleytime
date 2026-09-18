"""SQLAlchemy 2.0 модели данных."""
from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ----------------------------- Enum-ы -----------------------------

class UserRole(str, enum.Enum):
    player = "player"
    admin = "admin"


class TrainingStatus(str, enum.Enum):
    planned = "planned"
    open = "open"
    closed = "closed"
    cancelled = "cancelled"
    finished = "finished"


class SlotType(str, enum.Enum):
    main = "main"
    rotation = "rotation"
    waitlist = "waitlist"


class BookingStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    confirmed = "confirmed"
    cancelled = "cancelled"
    attended = "attended"
    no_show = "no_show"


class PaymentKind(str, enum.Enum):
    single = "single"
    subscription = "subscription"
    refund = "refund"


class PaymentMethod(str, enum.Enum):
    bepaid_card = "bepaid_card"
    bepaid_erip = "bepaid_erip"
    cash = "cash"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    depleted = "depleted"
    expired = "expired"
    refunded = "refunded"


class LedgerType(str, enum.Enum):
    income = "income"
    expense = "expense"


class LedgerCategory(str, enum.Enum):
    training_fee = "training_fee"
    subscription = "subscription"
    rent = "rent"
    balls = "balls"
    refund = "refund"
    other = "other"


# ----------------------------- Модели -----------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String(64))
    full_name: Mapped[str] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.player)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    bookings: Mapped[list["Booking"]] = relationship(back_populates="user")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="user",
        foreign_keys="Payment.user_id",
    )


class Training(Base):
    __tablename__ = "trainings"

    id: Mapped[int] = mapped_column(primary_key=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    venue: Mapped[str] = mapped_column(String(255))
    price_main: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    price_rotation: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    max_main_slots: Mapped[int] = mapped_column(Integer, default=12)
    max_rotation_slots: Mapped[int] = mapped_column(Integer, default=2)
    rent_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    status: Mapped[TrainingStatus] = mapped_column(Enum(TrainingStatus), default=TrainingStatus.open)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by_admin_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    bookings: Mapped[list["Booking"]] = relationship(back_populates="training")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        UniqueConstraint("user_id", "training_id", name="uq_user_training"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    training_id: Mapped[int] = mapped_column(ForeignKey("trainings.id"), index=True)
    slot_type: Mapped[SlotType] = mapped_column(Enum(SlotType))
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.pending_payment)
    waitlist_position: Mapped[Optional[int]] = mapped_column(Integer)

    payment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payments.id"))
    subscription_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subscriptions.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[Optional[str]] = mapped_column(String(255))

    user: Mapped["User"] = relationship(back_populates="bookings")
    training: Mapped["Training"] = relationship(back_populates="bookings")
    payment: Mapped[Optional["Payment"]] = relationship(foreign_keys=[payment_id])
    subscription: Mapped[Optional["Subscription"]] = relationship(foreign_keys=[subscription_id])


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    total_sessions: Mapped[int] = mapped_column(Integer)
    used_sessions: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus), default=SubscriptionStatus.active)
    payment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payments.id"))

    user: Mapped["User"] = relationship(back_populates="subscriptions")

    @property
    def remaining_sessions(self) -> int:
        return self.total_sessions - self.used_sessions


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    kind: Mapped[PaymentKind] = mapped_column(Enum(PaymentKind))
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod))
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.pending)

    # bePaid-specific
    bepaid_token: Mapped[Optional[str]] = mapped_column(String(128), index=True)
    bepaid_uid: Mapped[Optional[str]] = mapped_column(String(128), unique=True, index=True)
    bepaid_status: Mapped[Optional[str]] = mapped_column(String(64))
    payment_url: Mapped[Optional[str]] = mapped_column(String(512))

    # Связи с тем, за что платили
    booking_id: Mapped[Optional[int]] = mapped_column(ForeignKey("bookings.id"))
    subscription_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subscriptions.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    succeeded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    confirmed_by_admin_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    user: Mapped["User"] = relationship(foreign_keys=[user_id], back_populates="payments")


class LedgerEntry(Base):
    """Касса: учёт поступлений и расходов для прозрачности группы."""
    __tablename__ = "ledger_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[LedgerType] = mapped_column(Enum(LedgerType))
    category: Mapped[LedgerCategory] = mapped_column(Enum(LedgerCategory))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    description: Mapped[Optional[str]] = mapped_column(Text)
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    evidence_file_id: Mapped[Optional[str]] = mapped_column(String(255))

    related_payment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("payments.id"))
    related_training_id: Mapped[Optional[int]] = mapped_column(ForeignKey("trainings.id"))
    created_by_admin_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdminLog(Base):
    __tablename__ = "admin_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(64))
    target_type: Mapped[Optional[str]] = mapped_column(String(64))
    target_id: Mapped[Optional[int]] = mapped_column(Integer)
    details: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

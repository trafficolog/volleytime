"""Конфигурация приложения. Читает значения из .env через pydantic-settings."""
from __future__ import annotations

from pathlib import Path
from typing import List
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Telegram
    bot_token: str = ""
    admin_telegram_ids: List[int] = Field(default_factory=list)

    # БД
    database_url: str = "sqlite+aiosqlite:///./volleyball.db"

    # Бизнес-параметры
    timezone: str = "Europe/Minsk"
    default_max_main_slots: int = 12
    default_max_rotation_slots: int = 2
    booking_closes_hours_before: int = 2
    payment_ttl_minutes: int = 15
    waitlist_confirm_minutes: int = 30

    # bePaid
    bepaid_shop_id: str = ""
    bepaid_secret_key: str = ""
    bepaid_public_key_path: str = "./bepaid_public_key.pem"
    bepaid_api_url: str = "https://api.bepaid.by"
    bepaid_checkout_url: str = "https://checkout.bepaid.by/ctp/api/checkouts"
    bepaid_test_mode: bool = True
    bepaid_webhook_url: str = ""

    # Web
    web_host: str = "0.0.0.0"
    web_port: int = 8080

    # Логи
    log_level: str = "INFO"

    @field_validator("admin_telegram_ids", mode="before")
    @classmethod
    def _parse_admin_ids(cls, v):
        if v is None or v == "":
            return []
        if isinstance(v, int):
            return [v]
        if isinstance(v, str):
            return [int(x.strip()) for x in v.split(",") if x.strip()]
        return v

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    @property
    def bepaid_public_key(self) -> bytes | None:
        path = Path(self.bepaid_public_key_path)
        if path.exists():
            return path.read_bytes()
        return None


settings = Settings()

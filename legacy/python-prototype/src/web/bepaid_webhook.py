"""Заглушка под вебхук bePaid.

Реальная обработка будет добавлена после регистрации мерчанта и получения
публичного ключа. Пока валидация подписи реализована, но логика только
логирует событие.
"""
from __future__ import annotations

import base64
import logging

from aiohttp import web
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from src.config import settings

logger = logging.getLogger(__name__)


def verify_bepaid_signature(body: bytes, signature_b64: str, public_key_pem: bytes) -> bool:
    """Проверка RSA-подписи нотификации bePaid.

    Согласно докам bePaid, заголовок Content-Signature содержит RSA-подпись
    тела запроса, закодированную в Base64. Подпись делается приватным ключом
    магазина (хранится у bePaid), проверяем публичным.
    """
    try:
        public_key = serialization.load_pem_public_key(public_key_pem)
        signature = base64.b64decode(signature_b64)
        public_key.verify(
            signature,
            body,
            padding.PKCS1v15(),
            hashes.SHA1(),  # bePaid использует SHA1 — уточнить в актуальных доках
        )
        return True
    except (InvalidSignature, ValueError) as e:
        logger.warning("Bad bePaid signature: %s", e)
        return False


async def handle_bepaid_webhook(request: web.Request) -> web.Response:
    body = await request.read()
    signature = request.headers.get("Content-Signature", "")

    public_key = settings.bepaid_public_key
    if not public_key:
        logger.error("BePaid public key not configured")
        return web.Response(status=500, text="Public key not configured")

    if not verify_bepaid_signature(body, signature, public_key):
        return web.Response(status=403, text="Bad signature")

    # TODO: разбор payload, поиск Payment по bepaid_uid, обновление статуса,
    #       подтверждение Booking / активация Subscription, идемпотентность.
    logger.info("bePaid webhook received (TODO: process). Body size: %d", len(body))

    return web.Response(status=200, text="OK")


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_post("/webhooks/bepaid", handle_bepaid_webhook)
    app.router.add_get("/health", lambda r: web.Response(text="OK"))
    return app


async def run_web_server() -> None:
    import asyncio

    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, settings.web_host, settings.web_port)
    await site.start()
    logger.info("Web server started on %s:%s", settings.web_host, settings.web_port)
    # Бесконечный сон, иначе процесс выйдет
    while True:
        await asyncio.sleep(3600)

from aiogram import Router

from src.bot.handlers.admin import ledger, manage, payments, trainings


def get_admin_router() -> Router:
    router = Router(name="admin_root")
    router.include_router(trainings.router)
    router.include_router(manage.router)
    router.include_router(payments.router)
    router.include_router(ledger.router)
    return router

from aiogram import Router

from src.bot.handlers.player import my_bookings, subscriptions, trainings


def get_player_router() -> Router:
    router = Router(name="player_root")
    router.include_router(trainings.router)
    router.include_router(subscriptions.router)
    router.include_router(my_bookings.router)
    return router

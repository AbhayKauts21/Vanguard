from __future__ import annotations

from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import build_async_database_url, settings, validate_database_settings


@lru_cache
def get_engine() -> AsyncEngine:
    validate_database_settings(settings)
    database_url = build_async_database_url(settings)
    return create_async_engine(
        database_url,
        echo=settings.DEBUG,
        pool_pre_ping=True,
    )


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_db_session() -> AsyncSession:
    async_session = get_session_factory()
    async with async_session() as session:
        yield session


async def check_database_health() -> bool:
    async with get_session_factory()() as session:
        result = await session.execute(text("SELECT 1"))
        return result.scalar_one() == 1


async def dispose_engine() -> None:
    database_url = build_async_database_url(settings)
    if not database_url:
        return
    await get_engine().dispose()

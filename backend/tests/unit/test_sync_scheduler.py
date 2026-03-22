from app.core.config import settings
from app.services import sync_scheduler


def test_scheduler_does_not_start_without_bookstack(monkeypatch):
    monkeypatch.setattr(settings, "BOOKSTACK_URL", "")
    monkeypatch.setattr(settings, "BOOKSTACK_TOKEN_ID", "")
    monkeypatch.setattr(settings, "BOOKSTACK_TOKEN_SECRET", "")
    monkeypatch.setattr(sync_scheduler, "_scheduler", None)

    sync_scheduler.start_scheduler()

    assert sync_scheduler._scheduler is None

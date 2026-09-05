from __future__ import annotations

import logging
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, messaging

from app.config import settings

logger = logging.getLogger(__name__)


@lru_cache
def _app() -> firebase_admin.App:
    if not settings.firebase_service_account_path:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_PATH is not set. Download the service "
            "account key from Firebase Console > Project Settings > Service "
            "Accounts, store it outside the repo, and point this env var at "
            "it (see docs/SETUP.md)."
        )
    cred = credentials.Certificate(settings.firebase_service_account_path)
    return firebase_admin.initialize_app(cred)


def send_push(token: str, title: str, body: str, data: dict | None = None) -> str:
    """Send a single FCM push notification. Returns the provider message id.

    Raises on failure — callers (e.g. scheduled jobs) must catch this and log
    it via notification_log rather than let it fail silently.
    """
    _app()
    message = messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body),
        data=data or {},
    )
    message_id = messaging.send(message)
    logger.info("Sent FCM push %s to token ending %s", message_id, token[-6:])
    return message_id

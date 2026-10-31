import logging
from celery import Celery
from app.core.config import settings

logger = logging.getLogger("judgely_celery")

broker_url = settings.CELERY_BROKER_URL
result_backend = settings.CELERY_RESULT_BACKEND

celery_app = Celery(
    "judgely_tasks",
    broker=broker_url,
    backend=result_backend,
    include=["app.services.ai_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    result_expires=settings.AI_RESULT_TTL_SECONDS,
    task_always_eager=settings.CELERY_ALWAYS_EAGER,
    task_eager_propagates=True,
)


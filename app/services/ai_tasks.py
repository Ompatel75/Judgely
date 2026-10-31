import json
import time
import logging
from typing import Optional
from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.redis import get_redis_client
from app.services.ai import generate_tutor_hint, AITutorHintResponse
from app.services.ai_cache import (
    get_cached_hint,
    set_cached_hint,
    release_inflight_lock
)
from app.services.ai_resilience import (
    check_and_apply_global_rpm_limit,
    is_circuit_open,
    record_gemini_success,
    record_gemini_failure,
    get_graceful_fallback_hint
)
from app.db.database import SessionLocal
from app.db.models import AITutorConversation

logger = logging.getLogger("ai_tasks")

@celery_app.task(
    bind=True,
    name="generate_ai_hint_task",
    max_retries=settings.AI_MAX_RETRIES,
    default_retry_delay=2
)
def generate_ai_hint_task(
    self,
    submission_id: int,
    user_id: int,
    problem_title: str,
    problem_description: str,
    user_code: str,
    verdict: str,
    help_level: str = "concise_hint",
    request_id: Optional[str] = None,
    cache_key: Optional[str] = None
) -> dict:
    task_id = self.request.id or f"local_{int(time.time()*1000)}"
    redis_client = get_redis_client()
    task_key = f"ai_task:{task_id}"

    # 1. Check if result was cached in the interim
    if cache_key:
        cached_result = get_cached_hint(cache_key)
        if cached_result:
            release_inflight_lock(cache_key)
            done_cached = {
                "task_id": task_id,
                "user_id": user_id,
                "submission_id": submission_id,
                "status": "done",
                "cached": True,
                "result": cached_result,
                "completed_at": time.time()
            }
            redis_client.set(task_key, json.dumps(done_cached), ex=settings.AI_RESULT_TTL_SECONDS)
            return done_cached

    # 2. Check Circuit Breaker (Phase 5)
    if is_circuit_open():
        logger.warning("Circuit breaker is OPEN. Returning graceful fallback hint for task %s", task_id)
        fallback = get_graceful_fallback_hint(problem_title, verdict, "temporary service cooldown")
        fallback_dict = fallback.model_dump()
        done_fallback = {
            "task_id": task_id,
            "user_id": user_id,
            "submission_id": submission_id,
            "status": "done",
            "cached": True,
            "result": fallback_dict,
            "completed_at": time.time()
        }
        redis_client.set(task_key, json.dumps(done_fallback), ex=settings.AI_RESULT_TTL_SECONDS)
        return done_fallback

    # 3. Update state in Redis to 'running'
    running_data = {
        "task_id": task_id,
        "user_id": user_id,
        "submission_id": submission_id,
        "status": "running",
        "started_at": time.time()
    }
    redis_client.set(task_key, json.dumps(running_data), ex=settings.AI_RESULT_TTL_SECONDS)

    # 4. Apply Global Worker RPM Limiter (Phase 5)
    check_and_apply_global_rpm_limit()

    # 5. Call Gemini service with resilience
    timing_collector = {}
    try:
        hint_response = generate_tutor_hint(
            problem_title=problem_title,
            problem_description=problem_description,
            user_code=user_code,
            verdict=verdict,
            help_level=help_level,
            request_id=request_id,
            timing_collector=timing_collector
        )

        record_gemini_success()

        # 6. Persist to DB conversation history
        db = SessionLocal()
        try:
            initial_summary = f"**Diagnosed Error:** {hint_response.what_went_wrong}\n\n**Hint 1:** {hint_response.hint_1}"
            db.add(AITutorConversation(
                submission_id=submission_id,
                user_id=user_id,
                role="assistant",
                content=initial_summary
            ))
            db.commit()
        except Exception as dbe:
            logger.error("Error saving tutor conversation to DB: %s", dbe)
            db.rollback()
        finally:
            db.close()

        # 7. Store in Redis cache (only successful non-error results)
        result_dict = hint_response.model_dump()
        if cache_key:
            set_cached_hint(cache_key, result_dict, ttl=settings.AI_CACHE_TTL_SECONDS)

        # 8. Store completed task result in Redis
        done_data = {
            "task_id": task_id,
            "user_id": user_id,
            "submission_id": submission_id,
            "status": "done",
            "cached": False,
            "result": result_dict,
            "completed_at": time.time()
        }
        redis_client.set(task_key, json.dumps(done_data), ex=settings.AI_RESULT_TTL_SECONDS)
        return done_data

    except Exception as e:
        record_gemini_failure()
        logger.error("Celery task %s encountered error: %s (attempt %d/%d)", task_id, e, self.request.retries + 1, self.max_retries + 1)
        
        # Check retry count
        if self.request.retries < self.max_retries:
            import random
            countdown = (2 ** self.request.retries) + random.uniform(0.1, 1.0)
            try:
                raise self.retry(exc=e, countdown=int(countdown))
            except Exception as retry_err:
                if "retry" in str(retry_err).lower():
                    raise retry_err

        # Retries exhausted: return graceful fallback instead of failing with stack trace
        logger.warning("All retries exhausted for task %s. Delivering friendly fallback hint.", task_id)
        fallback = get_graceful_fallback_hint(problem_title, verdict, "temporary API unavailability")
        fallback_data = {
            "task_id": task_id,
            "user_id": user_id,
            "submission_id": submission_id,
            "status": "done",
            "cached": True,
            "result": fallback.model_dump(),
            "completed_at": time.time()
        }
        redis_client.set(task_key, json.dumps(fallback_data), ex=settings.AI_RESULT_TTL_SECONDS)
        return fallback_data
    finally:
        if cache_key:
            release_inflight_lock(cache_key)


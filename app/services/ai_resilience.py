import time
import logging
from typing import Tuple, Optional
from datetime import datetime
from app.core.config import settings
from app.core.redis import get_redis_client
from app.services.ai import AITutorHintResponse

logger = logging.getLogger("ai_resilience")

# 1. Per-User Rate Limiting in Redis
def check_user_rate_limit(user_id: int) -> Tuple[bool, Optional[int], Optional[str]]:
    """
    Checks per-user rate limit (RPM and RPD) in Redis.
    Returns (is_allowed, retry_after_seconds, error_message).
    """
    redis_client = get_redis_client()
    now = time.time()
    current_minute = int(now // 60)
    current_day = datetime.utcnow().strftime("%Y-%m-%d")

    minute_key = f"ai_rate:user:{user_id}:min:{current_minute}"
    day_key = f"ai_rate:user:{user_id}:day:{current_day}"

    try:
        # Check minute limit
        current_min_count = redis_client.get(minute_key)
        if current_min_count and int(current_min_count) >= settings.AI_RATE_LIMIT_USER_RPM:
            seconds_remaining = 60 - int(now % 60)
            msg = f"Rate limit exceeded: You have reached the maximum of {settings.AI_RATE_LIMIT_USER_RPM} AI requests per minute. Please retry after {seconds_remaining} seconds."
            logger.warning("User %s exceeded AI RPM limit", user_id)
            return False, max(1, seconds_remaining), msg

        # Check daily limit
        current_day_count = redis_client.get(day_key)
        if current_day_count and int(current_day_count) >= settings.AI_RATE_LIMIT_USER_RPD:
            # Resets at midnight UTC
            seconds_to_midnight = 86400 - int(now % 86400)
            msg = f"Daily AI quota reached: You have reached your limit of {settings.AI_RATE_LIMIT_USER_RPD} AI requests for today. Quota resets at 00:00 UTC."
            logger.warning("User %s exceeded AI RPD limit", user_id)
            return False, max(1, seconds_to_midnight), msg

        # Increment counters
        pipe = redis_client.pipeline()
        pipe.incr(minute_key)
        pipe.expire(minute_key, 65)
        pipe.incr(day_key)
        pipe.expire(day_key, 90000)
        pipe.execute()

        return True, None, None

    except Exception as e:
        logger.error("Rate limit check encountered error: %s. Allowing request as fallback.", e)
        return True, None, None

# 2. Global Worker RPM Limiter
def check_and_apply_global_rpm_limit() -> int:
    """
    Ensures total worker calls across the entire cluster stay under free-tier RPM.
    Queues/delays instead of failing. Returns number of seconds delayed.
    """
    redis_client = get_redis_client()
    now = time.time()
    current_minute = int(now // 60)
    global_key = f"ai_global_rpm:{current_minute}"

    try:
        current_rpm = redis_client.incr(global_key)
        if current_rpm == 1:
            redis_client.expire(global_key, 70)

        if current_rpm > settings.AI_GLOBAL_RPM_LIMIT:
            delay = 60 - int(now % 60) + 1
            logger.info("Global free-tier RPM threshold reached (%d > %d). Throttling worker for %ds to prevent 429.", current_rpm, settings.AI_GLOBAL_RPM_LIMIT, delay)
            time.sleep(delay)
            return delay

        return 0
    except Exception as e:
        logger.warning("Error checking global RPM limit: %s", e)
        return 0

# 3. Circuit Breaker & Cooldown
def is_circuit_open() -> bool:
    """Checks whether the AI circuit breaker is currently open (in cooldown)."""
    redis_client = get_redis_client()
    try:
        state = redis_client.get("ai_circuit:state")
        return state == "open"
    except Exception:
        return False

def record_gemini_success() -> None:
    """Resets consecutive failure count on successful Gemini response."""
    redis_client = get_redis_client()
    try:
        redis_client.set("ai_circuit:consecutive_failures", 0)
    except Exception:
        pass

def record_gemini_failure() -> None:
    """Records a failure and trips circuit breaker if threshold is exceeded."""
    redis_client = get_redis_client()
    try:
        failures = redis_client.incr("ai_circuit:consecutive_failures")
        if failures >= settings.AI_CIRCUIT_BREAKER_THRESHOLD:
            logger.warning("Circuit breaker TRIPPED after %d consecutive failures. Cooldown activated for %ds.", failures, settings.AI_CIRCUIT_BREAKER_COOLDOWN_SECONDS)
            redis_client.set("ai_circuit:state", "open", ex=settings.AI_CIRCUIT_BREAKER_COOLDOWN_SECONDS)
    except Exception as e:
        logger.warning("Error updating circuit breaker: %s", e)

# 4. Graceful Fallback Hint Generation
def get_graceful_fallback_hint(problem_title: str, verdict: str, reason: str = "") -> AITutorHintResponse:
    """Generates a structured, friendly fallback hint when Gemini is unavailable or during cooldown."""
    return AITutorHintResponse(
        what_went_wrong=f"AI Tutor is operating in high-demand resilience mode ({reason or 'spikes in demand'}). The code received a '{verdict}' verdict.",
        hint_1="Review your loop boundaries, terminating conditions, and array indexes.",
        hint_2="Check variable data types for potential integer overflows (e.g. use long long in C++).",
        strong_hint="Inspect variable initialization inside loops and test with boundary values (N=1, extreme values).",
        edge_case="Boundary values: N=0, N=1, and max constraint sizes.",
        where_to_look="Main logic function and boundary loops.",
        concept="Edge Case & Bounds Validation",
        confidence="Low"
    )


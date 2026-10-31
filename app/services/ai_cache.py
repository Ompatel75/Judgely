import hashlib
import json
import logging
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger("ai_cache")

def normalize_code(code: str) -> str:
    """Normalizes code by stripping line trailing whitespace and standardizing newlines."""
    if not code:
        return ""
    # Standardize line endings
    cleaned = code.replace("\r\n", "\n").replace("\r", "\n")
    # Strip trailing whitespace on each line
    lines = [line.rstrip() for line in cleaned.split("\n")]
    # Strip leading/trailing blank lines
    return "\n".join(lines).strip()

def compute_normalized_code_hash(code: str) -> str:
    """Computes a SHA-256 hash of the normalized code."""
    norm = normalize_code(code)
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()

def build_hint_cache_key(
    problem_id: int,
    code: str,
    language: str,
    verdict: str,
    help_level: str,
    prompt_version: str = settings.PROMPT_VERSION,
    model_name: str = settings.AI_MODEL
) -> str:
    """Constructs a deterministic cache key across model, prompt version, problem, code, and verdict."""
    code_hash = compute_normalized_code_hash(code)
    norm_lang = (language or "cpp").strip().lower()
    norm_verdict = (verdict or "UNKNOWN").strip().upper()
    norm_help = (help_level or "concise_hint").strip().lower()

    raw_signature = f"{problem_id}:{code_hash}:{norm_lang}:{norm_verdict}:{norm_help}:{prompt_version}:{model_name}"
    signature_hash = hashlib.sha256(raw_signature.encode("utf-8")).hexdigest()
    return f"ai_cache:hint:{signature_hash}"

def get_cached_hint(cache_key: str) -> Optional[Dict[str, Any]]:
    """Retrieves cached hint result from Redis if present."""
    redis_client = get_redis_client()
    try:
        val = redis_client.get(cache_key)
        if val:
            logger.info("AI Cache HIT for key: %s", cache_key)
            return json.loads(val)
        logger.info("AI Cache MISS for key: %s", cache_key)
        return None
    except Exception as e:
        logger.warning("Error reading from Redis cache: %s", e)
        return None

def set_cached_hint(cache_key: str, hint_data: Dict[str, Any], ttl: int = settings.AI_CACHE_TTL_SECONDS) -> None:
    """Caches a successful hint result in Redis with a TTL. Does not cache errors."""
    if not hint_data:
        return
    # Guard against caching errors or failure messages
    err_text = str(hint_data.get("what_went_wrong", "")).lower()
    if "error" in err_text or "failed" in err_text or "issue" in err_text or "unavailable" in err_text:
        logger.info("Skipping caching for error/fallback response.")
        return

    redis_client = get_redis_client()
    try:
        redis_client.set(cache_key, json.dumps(hint_data), ex=ttl)
        logger.info("Cached hint result for key: %s (TTL: %ds)", cache_key, ttl)
    except Exception as e:
        logger.warning("Error writing to Redis cache: %s", e)

# Stampede protection: In-flight markers & locks
def acquire_inflight_lock(cache_key: str, task_id: str, timeout: int = 45) -> bool:
    """
    Tries to acquire an in-flight marker for this cache key using SET NX.
    Returns True if this is the first in-flight request, False if another request is already generating it.
    """
    redis_client = get_redis_client()
    lock_key = f"ai_inflight:{cache_key}"
    try:
        # Returns True if set, False if key already exists
        return bool(redis_client.set(lock_key, task_id, ex=timeout, nx=True))
    except Exception as e:
        logger.warning("Error acquiring in-flight lock: %s", e)
        return True

def get_inflight_task(cache_key: str) -> Optional[str]:
    """Returns the task_id of any currently in-flight generation for this cache key."""
    redis_client = get_redis_client()
    lock_key = f"ai_inflight:{cache_key}"
    try:
        val = redis_client.get(lock_key)
        return val if val else None
    except Exception as e:
        logger.warning("Error reading in-flight task: %s", e)
        return None

def release_inflight_lock(cache_key: str) -> None:
    """Releases the in-flight generation marker."""
    redis_client = get_redis_client()
    lock_key = f"ai_inflight:{cache_key}"
    try:
        redis_client.delete(lock_key)
    except Exception as e:
        logger.warning("Error releasing in-flight lock: %s", e)


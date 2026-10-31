import logging
import redis
from app.core.config import settings

logger = logging.getLogger("judgely_redis")

_redis_client = None

def get_redis_client():
    """Returns a shared Redis client, falling back cleanly to an in-memory FakeRedis store if unreachable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    try:
        client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=1.0
        )
        client.ping()
        _redis_client = client
        logger.info("Connected to Redis at %s", settings.REDIS_URL)
        return _redis_client
    except Exception as e:
        logger.info("Redis not reachable at %s (%s). Using in-memory FakeRedis fallback.", settings.REDIS_URL, e)
        try:
            import fakeredis
            _redis_client = fakeredis.FakeRedis(decode_responses=True)
            return _redis_client
        except Exception as fe:
            logger.error("Failed to initialize FakeRedis: %s", fe)
            raise fe

import logging
import redis
from app.core.config import settings

logger = logging.getLogger("judgely_redis")

_redis_client = None

class SimpleMemoryRedis:
    """Lightweight in-memory fallback if neither real Redis nor fakeredis is present."""
    def __init__(self):
        self._store = {}

    def ping(self):
        return True

    def get(self, key):
        return self._store.get(str(key))

    def set(self, key, value, ex=None):
        self._store[str(key)] = str(value)
        return True

    def setex(self, key, time, value):
        self._store[str(key)] = str(value)
        return True

    def delete(self, key):
        return self._store.pop(str(key), None) is not None

    def exists(self, key):
        return 1 if str(key) in self._store else 0

def get_redis_client():
    """Returns a shared Redis client, falling back cleanly to an in-memory FakeRedis/SimpleMemory store if unreachable."""
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
        logger.info("Redis not reachable at %s (%s). Using in-memory fallback.", settings.REDIS_URL, e)
        try:
            import fakeredis
            _redis_client = fakeredis.FakeRedis(decode_responses=True)
            return _redis_client
        except Exception:
            _redis_client = SimpleMemoryRedis()
            return _redis_client

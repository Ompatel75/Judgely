from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Judgely"
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    GEMINI_API_KEY: str = ""
    AI_MODEL: str = "gemini-3.8-flash"
    AI_TEMPERATURE: float = 0.2
    AI_REQUEST_TIMEOUT: float = 15.0
    AI_MAX_OUTPUT_TOKENS: int = 1024
    AI_THINKING_BUDGET: int = 0
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    CELERY_ALWAYS_EAGER: bool = False
    AI_RESULT_TTL_SECONDS: int = 3600
    AI_SYNC_MODE: bool = False
    PROMPT_VERSION: str = "v1"
    AI_CACHE_TTL_SECONDS: int = 86400
    AI_RATE_LIMIT_USER_RPM: int = 5
    AI_RATE_LIMIT_USER_RPD: int = 50
    AI_GLOBAL_RPM_LIMIT: int = 10
    AI_MAX_RETRIES: int = 3
    AI_CIRCUIT_BREAKER_THRESHOLD: int = 3
    AI_CIRCUIT_BREAKER_COOLDOWN_SECONDS: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Judgely"
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    GEMINI_API_KEY: str = ""
    AI_MODEL: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()

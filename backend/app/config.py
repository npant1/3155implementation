from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    secret_key: str = Field(min_length=32)
    cookie_secure: bool = False
    session_ttl_minutes: int = Field(default=720, gt=0, le=10080)

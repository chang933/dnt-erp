from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Database - yamasyeo 프로젝트 사용
    # .env 파일에 DATABASE_URL을 설정하거나, 여기에 직접 입력하세요
    # 형식: postgresql+psycopg2://postgres:[PASSWORD]@db.hetmepmsejcdwcxysezk.supabase.co:5432/postgres
    database_url: str = "postgresql+psycopg2://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
    
    # Security
    secret_key: str = "dnt-erp-secret-key-change-in-production"
    access_token_expire_minutes: int = 1440
    
    # Environment
    environment: str = "development"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )

settings = Settings()


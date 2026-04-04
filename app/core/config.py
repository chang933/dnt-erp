from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Database - yamasyeo 프로젝트 사용
    # .env 파일에 DATABASE_URL을 설정하거나, 여기에 직접 입력하세요
    # 형식: postgresql+psycopg2://postgres:[PASSWORD]@db.hetmepmsejcdwcxysezk.supabase.co:5432/postgres
    database_url: str = "postgresql+psycopg2://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
    # Supabase Pooler(6543) 사용 시 워커당 연결 수 (기본 1은 대기 큐로 저장이 느려질 수 있음)
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_recycle: int = 280
    
    # Security (운영에서는 SECRET_KEY를 강한 랜덤 문자열로 설정)
    secret_key: str = "dnt-erp-secret-key-change-in-production"
    access_token_expire_minutes: int = 1440
    # 최초 기동 시 어드민 1명 자동 생성 (둘 다 설정된 경우에만, 이미 있으면 스킵)
    bootstrap_admin_username: str | None = None
    bootstrap_admin_password: str | None = None

    # Environment
    environment: str = "development"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )

settings = Settings()


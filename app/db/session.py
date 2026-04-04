from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Supabase 연결 설정
engine = create_engine(
    settings.database_url,
    # Supabase Session pooler(6543/5432)는 동시 세션 수가 매우 작음 — 풀을 최소로
    pool_size=1,
    max_overflow=0,
    pool_timeout=20,
    pool_recycle=180,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"} if "sslmode=" not in settings.database_url.lower() else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


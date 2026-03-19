from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Supabase 연결 설정
engine = create_engine(
    settings.database_url,
    pool_size=3,
    max_overflow=2,
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


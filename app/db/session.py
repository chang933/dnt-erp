from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Supabase: 5432(Session 모드)는 동시 연결 수가 매우 적어 MaxClients 오류가 잘 남.
# 풀러 **6543(Transaction 모드)** 권장. https://supabase.com/docs/guides/database/connecting-to-postgres
_url = settings.database_url.lower()
_connect_args = {}
if "sslmode=" not in _url:
    _connect_args["sslmode"] = "require"
if ":6543" in _url:
    # PgBouncer transaction pool + psycopg2: prepared statement 비활성화
    _connect_args["prepare_threshold"] = None

engine = create_engine(
    settings.database_url,
    pool_size=1,
    max_overflow=0,
    pool_timeout=20,
    pool_recycle=180,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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

# pool_size 1 + max_overflow 0 은 요청마다 DB 대기로 저장 지연이 커짐. Pooler(6543)는 보통 워커당 소수 연결 허용.
_pool_size = max(1, int(settings.database_pool_size))
_max_overflow = max(0, int(settings.database_max_overflow))
_pool_recycle = max(60, int(settings.database_pool_recycle))

engine = create_engine(
    settings.database_url,
    pool_size=_pool_size,
    max_overflow=_max_overflow,
    pool_timeout=30,
    pool_recycle=_pool_recycle,
    pool_pre_ping=True,
    connect_args=_connect_args,
)

# commit 직후 응답 직렬화 시 불필요한 SELECT(refresh) 없이 동일 요청 내 객체 사용
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


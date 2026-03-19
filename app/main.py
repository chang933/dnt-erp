from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from app.core.config import settings
import os

# 모델들을 import하여 Base.metadata에 등록
from app.models import (
    AppSetting,
    Employee, Schedule, Attendance, Payroll, Document,
    Ingredient, InventoryLog, Customer, Visit, RevenueExpense,
    Order, OrderItem, Reservation, FoodCost,
)

# 기본 허용 origin 목록 (로컬 + 운영 프론트)
BASE_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.219.101:3000",
    "https://dnt-erp.vercel.app",
]

# 환경변수로 추가 허용 origin 지정 가능 (쉼표 구분)
extra_origins = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS = BASE_CORS_ORIGINS + [o.strip() for o in extra_origins.split(",") if o.strip()]


def _is_allowed_origin(origin: str | None) -> bool:
    if not origin:
        return False
    # Vercel preview 도메인 허용
    if origin.startswith("https://") and origin.endswith(".vercel.app"):
        return True
    return origin in CORS_ORIGINS


def _cors_headers(request: StarletteRequest):
    """요청 origin에 맞춰 CORS 헤더 dict 반환"""
    origin = request.headers.get("origin")
    allow_origin = origin if _is_allowed_origin(origin) else CORS_ORIGINS[0]
    return {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "*",
    }


class ForceCORSHeadersMiddleware(BaseHTTPMiddleware):
    """200/307 등 정상 응답에 CORS 헤더 강제 부여"""

    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        for k, v in _cors_headers(request).items():
            response.headers[k] = v
        return response


app = FastAPI(
    title="D.N.T ERP",
    description="식당 관리 ERP 시스템",
    version="1.0.0",
    default_response_class=ORJSONResponse
)

# GZip 압축
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS (preflight OPTIONS 처리용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# 모든 응답(500/307 포함)에 CORS 헤더 강제 부여 — 가장 나중에 추가해 응답 시 맨 마지막에 실행
app.add_middleware(ForceCORSHeadersMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """미처리 예외 시 CORS 헤더를 붙인 응답 반환 (500 에러도 브라우저에서 수신 가능)"""
    if isinstance(exc, HTTPException):
        headers = dict(_cors_headers(request))
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=headers,
        )
    headers = dict(_cors_headers(request))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
        headers=headers,
    )


@app.on_event("startup")
def on_startup():
    """앱 시작 시 존재하지 않는 테이블 자동 생성"""
    from app.db.base import Base
    from app.db.session import engine
    Base.metadata.create_all(bind=engine)


@app.get("/")
def read_root():
    """Health check"""
    return {
        "message": "D.N.T ERP Server is running!",
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.environment
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


@app.get("/health/db")
def health_check_db():
    """
    DB(Supabase) 연결 확인용.
    - 성공: {"status": "ok", "database": "connected"}
    - 실패: 500 + detail (Supabase 비밀번호/호스트/네트워크 문제일 수 있음)
    ※ Supabase에서 DB를 못 받아오면 API가 500을 반환하고,
      500 응답에 CORS 헤더가 없으면 브라우저가 CORS로 차단해 'Network Error'로 보입니다.
    """
    from app.db.session import engine
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"DB connection failed: {type(e).__name__} - {str(e)}",
        )

# 정적 파일 서빙 설정 (서류 파일용)
from fastapi.staticfiles import StaticFiles
try:
    uploads_dir = os.path.join(os.getcwd(), "uploads")
    if os.path.exists(uploads_dir):
        app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
except Exception:
    pass

# API 라우터 등록
from app.api.v1 import (
    employees, schedules, attendance, payroll, documents,
    ingredients, inventory_logs, customers, visits, certificates,
    revenue_expense, orders as orders_router, reservations, food_costs,
    settings as settings_router,
)
from app.api.v1 import employees_upload, documents_generate
app.include_router(settings_router.router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(employees.router, prefix="/api/v1/employees", tags=["employees"])
app.include_router(employees_upload.router, prefix="/api/v1/employees", tags=["employees"])
app.include_router(schedules.router, prefix="/api/v1/schedules", tags=["schedules"])
app.include_router(attendance.router, prefix="/api/v1/attendance", tags=["attendance"])
app.include_router(payroll.router, prefix="/api/v1/payroll", tags=["payroll"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(documents_generate.router, prefix="/api/v1/documents-generate", tags=["documents-generate"])
app.include_router(ingredients.router, prefix="/api/v1/ingredients", tags=["ingredients"])
app.include_router(inventory_logs.router, prefix="/api/v1/inventory-logs", tags=["inventory-logs"])
app.include_router(customers.router, prefix="/api/v1/customers", tags=["customers"])
app.include_router(reservations.router, prefix="/api/v1/reservations", tags=["reservations"])
app.include_router(visits.router, prefix="/api/v1/visits", tags=["visits"])
app.include_router(certificates.router, prefix="/api/v1/certificates", tags=["certificates"])
app.include_router(revenue_expense.router, prefix="/api/v1/revenue-expense", tags=["revenue-expense"])
app.include_router(orders_router.router, prefix="/api/v1/orders", tags=["orders"])
app.include_router(food_costs.router, prefix="/api/v1/food-costs", tags=["food-costs"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)



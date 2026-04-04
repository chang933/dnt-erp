"""공통 API 의존성"""
from typing import Optional
from fastapi import Depends, Header, HTTPException, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.store import Store
from app.models.user import User
from app.crud import user as user_crud
from app.core.security import decode_token

DEFAULT_STORE_ID = 1

security_bearer = HTTPBearer(auto_error=False)


ACCESS_FULL = "full"
ACCESS_READONLY = "readonly"
ACCESS_STAFF_INGREDIENTS = "staff_ingredients"

_STAFF_INGREDIENTS_PREFIXES = (
    "/api/v1/employees",
    "/api/v1/schedules",
    "/api/v1/attendance",
    "/api/v1/documents",
    "/api/v1/documents-generate",
    "/api/v1/ingredients",
    "/api/v1/inventory-logs",
    "/api/v1/food-costs",
    "/api/v1/reservations",
)


def _api_path_only(url_path: str) -> str:
    return url_path.split("?")[0]


def _allowed_staff_ingredients_api(url_path: str, method: str) -> bool:
    """admin(staff_ingredients): 직원(급여 제외)·식자재·예약. 지점은 GET만."""
    p = _api_path_only(url_path)
    if p == "/api/v1/auth/me" or p.startswith("/api/v1/auth/me/"):
        return True
    if p.startswith("/api/v1/stores"):
        return method.upper() == "GET"
    for prefix in _STAFF_INGREDIENTS_PREFIXES:
        if p == prefix or p.startswith(prefix + "/"):
            return True
    return False


def enforce_request_access(request: Request, user: User) -> None:
    """access_mode에 따라 메서드·경로 제한."""
    mode = (getattr(user, "access_mode", None) or ACCESS_FULL).strip().lower()
    if mode == ACCESS_FULL:
        return
    m = request.method.upper()
    if m == "OPTIONS":
        return
    path = request.url.path
    if mode == ACCESS_READONLY:
        if m in ("GET", "HEAD"):
            return
        raise HTTPException(status_code=403, detail="이 계정은 조회만 가능합니다.")
    if mode == ACCESS_STAFF_INGREDIENTS:
        if _allowed_staff_ingredients_api(path, m):
            return
        raise HTTPException(
            status_code=403,
            detail="이 계정은 허용된 메뉴(직원·식자재·예약 등)에서만 이용할 수 있습니다.",
        )


def get_current_user(
    db: Session = Depends(get_db),
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=401,
            detail="로그인이 필요합니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(creds.credentials)
        username = payload.get("sub")
        if not username or not isinstance(username, str):
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
    except JWTError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
    user = user_crud.get_user_by_username(db, username)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="사용할 수 없는 계정입니다")
    return user


def get_current_user_with_access(
    request: Request,
    user: User = Depends(get_current_user),
) -> User:
    enforce_request_access(request, user)
    return user


def get_current_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다")
    return user


def get_store_id(
    db: Session = Depends(get_db),
    x_store_id: Optional[str] = Header(None, alias="X-Store-Id"),
    store_id: Optional[int] = Query(None, description="지점 ID (헤더 없을 때 쿼리로 전달 가능)"),
) -> int:
    """
    현재 요청 지점. 기본값 1(검단점 등 최초 지점).
    프론트는 apiClient에 X-Store-Id를 붙이는 것을 권장합니다.
    """
    raw = x_store_id.strip() if x_store_id and x_store_id.strip() else None
    if raw is None and store_id is not None:
        sid = int(store_id)
    elif raw is None:
        sid = DEFAULT_STORE_ID
    else:
        try:
            sid = int(raw)
        except ValueError:
            raise HTTPException(status_code=400, detail="X-Store-Id는 정수여야 합니다")
    if sid < 1:
        raise HTTPException(status_code=400, detail="유효하지 않은 지점 ID")
    exists = db.query(Store.id).filter(Store.id == sid, Store.is_active.is_(True)).first()
    if not exists:
        # 비활성 지점이거나 없으면 404 (기본 1은 마이그레이션으로 항상 존재)
        raise HTTPException(status_code=404, detail="지점을 찾을 수 없거나 비활성입니다")
    return sid


def get_store_id_optional_inactive(
    db: Session = Depends(get_db),
    x_store_id: Optional[str] = Header(None, alias="X-Store-Id"),
    store_id: Optional[int] = Query(None),
) -> int:
    """지점 목록 조회 등: 비활성 지점 ID로 조회할 필요 없음 — get_store_id와 동일"""
    return get_store_id(db=db, x_store_id=x_store_id, store_id=store_id)

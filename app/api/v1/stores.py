from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.store import StoreCreate, StoreUpdate, StoreOut
from app.crud import store as crud_store
from app.api.deps import get_current_user, get_current_admin_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[StoreOut])
def list_stores(
    db: Session = Depends(get_db),
    active_only: bool = Query(
        True, description="true면 활성 지점만. false는 비활성 포함(관리자만)"
    ),
    current: User = Depends(get_current_user),
):
    """지점 목록. active_only=false 는 관리자만."""
    if not active_only and not current.is_admin:
        raise HTTPException(
            status_code=403,
            detail="비활성 지점을 포함한 목록은 관리자만 조회할 수 있습니다",
        )
    return crud_store.get_stores(db, active_only=active_only)


@router.post("/", response_model=StoreOut, status_code=201)
def create_store(
    body: StoreCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    """지점 등록 (관리자)"""
    return crud_store.create_store(db, body)


@router.patch("/{store_id}", response_model=StoreOut)
def update_store(
    store_id: int,
    body: StoreUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin_user),
):
    """지점 수정 (관리자)"""
    row = crud_store.update_store(db, store_id, body)
    if not row:
        raise HTTPException(status_code=404, detail="지점을 찾을 수 없습니다")
    return row

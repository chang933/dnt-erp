from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.api.deps import get_store_id
from app.schemas.inventory_log import (
    InventoryLog,
    InventoryLogCreate,
    InventoryLogWithIngredient,
)
from app.crud import inventory_log as crud_inventory_log
from app.models.ingredient import Ingredient

router = APIRouter()


@router.post("/", response_model=InventoryLog, status_code=201)
def create_inventory_log(
    log: InventoryLogCreate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """새 입출고 기록 등록 (재고 자동 업데이트)"""
    try:
        return crud_inventory_log.create_inventory_log(
            db=db, store_id=store_id, log=log
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[InventoryLogWithIngredient])
def get_inventory_logs(
    ingredient_id: Optional[int] = Query(None, description="식자재 ID로 필터링"),
    start_date: Optional[date] = Query(None, description="시작 날짜"),
    end_date: Optional[date] = Query(None, description="종료 날짜"),
    skip: int = Query(0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 레코드 수"),
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """입출고 로그 목록 조회"""
    if ingredient_id:
        logs = crud_inventory_log.get_inventory_logs_by_ingredient(
            db=db,
            store_id=store_id,
            ingredient_id=ingredient_id,
            skip=skip,
            limit=limit,
        )
    elif start_date and end_date:
        logs = crud_inventory_log.get_inventory_logs_by_date_range(
            db=db,
            store_id=store_id,
            start_date=start_date,
            end_date=end_date,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="ingredient_id 또는 (start_date & end_date)를 제공해야 합니다",
        )

    result = []
    for log in logs:
        ingredient = (
            db.query(Ingredient)
            .filter(
                Ingredient.id == log.ingredient_id,
                Ingredient.store_id == store_id,
            )
            .first()
        )
        if ingredient:
            result.append(
                InventoryLogWithIngredient(
                    id=log.id,
                    ingredient_id=log.ingredient_id,
                    log_type=log.log_type,
                    quantity=log.quantity,
                    date=log.date,
                    memo=log.memo,
                    created_at=log.created_at,
                    ingredient_name=ingredient.name,
                    ingredient_unit=ingredient.unit,
                )
            )

    return result


@router.get("/{log_id}", response_model=InventoryLog)
def get_inventory_log(
    log_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """입출고 로그 상세 조회"""
    db_log = crud_inventory_log.get_inventory_log(
        db=db, log_id=log_id, store_id=store_id
    )
    if db_log is None:
        raise HTTPException(status_code=404, detail="입출고 로그를 찾을 수 없습니다")
    return db_log


@router.delete("/{log_id}", status_code=204)
def delete_inventory_log(
    log_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """입출고 로그 삭제 (재고 자동 복구)"""
    success = crud_inventory_log.delete_inventory_log(
        db=db, store_id=store_id, log_id=log_id
    )
    if not success:
        raise HTTPException(status_code=404, detail="입출고 로그를 찾을 수 없습니다")
    return None

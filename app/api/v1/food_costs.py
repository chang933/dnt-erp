from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.api.deps import get_store_id
from app.schemas.food_cost import FoodCost, FoodCostCreate, FoodCostUpdate
from app.crud import food_cost as crud
from app.crud import kitchen_expense_sync

router = APIRouter()


@router.post("/sync-kitchen-expense-range", status_code=204)
def sync_kitchen_expense_range(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """보이는 월 범위 등에서 식자재 사용(입고) 합계를 주방지출(식자재 자동)로 일괄 반영합니다."""
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date는 end_date보다 늦을 수 없습니다")
    kitchen_expense_sync.sync_kitchen_expenses_for_date_range(
        db, store_id, start_date, end_date
    )
    return Response(status_code=204)


@router.get("/", response_model=List[FoodCost])
def get_food_costs(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    supplier: Optional[str] = Query(None),
    record_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    return crud.get_food_costs(
        db,
        store_id,
        start_date=start_date,
        end_date=end_date,
        supplier=supplier,
        record_type=record_type,
        skip=skip,
        limit=limit,
    )


@router.post("/", response_model=FoodCost, status_code=201)
def create_food_cost(
    food_cost: FoodCostCreate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    return crud.create_food_cost(db, store_id, food_cost)


@router.put("/{food_cost_id}", response_model=FoodCost)
def update_food_cost(
    food_cost_id: int,
    update: FoodCostUpdate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    obj = crud.update_food_cost(db, store_id, food_cost_id, update)
    if not obj:
        raise HTTPException(status_code=404, detail="식자재 비용 기록을 찾을 수 없습니다")
    return obj


@router.delete("/{food_cost_id}", status_code=204)
def delete_food_cost(
    food_cost_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    if not crud.delete_food_cost(db, store_id, food_cost_id):
        raise HTTPException(status_code=404, detail="식자재 비용 기록을 찾을 수 없습니다")

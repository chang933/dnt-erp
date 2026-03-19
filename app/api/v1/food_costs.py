from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.schemas.food_cost import FoodCost, FoodCostCreate, FoodCostUpdate
from app.crud import food_cost as crud

router = APIRouter()


@router.get("/", response_model=List[FoodCost])
def get_food_costs(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    supplier: Optional[str] = Query(None),
    record_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    return crud.get_food_costs(
        db, start_date=start_date, end_date=end_date,
        supplier=supplier, record_type=record_type,
        skip=skip, limit=limit,
    )


@router.post("/", response_model=FoodCost, status_code=201)
def create_food_cost(food_cost: FoodCostCreate, db: Session = Depends(get_db)):
    return crud.create_food_cost(db, food_cost)


@router.put("/{food_cost_id}", response_model=FoodCost)
def update_food_cost(
    food_cost_id: int, update: FoodCostUpdate, db: Session = Depends(get_db)
):
    obj = crud.update_food_cost(db, food_cost_id, update)
    if not obj:
        raise HTTPException(status_code=404, detail="식자재 비용 기록을 찾을 수 없습니다")
    return obj


@router.delete("/{food_cost_id}", status_code=204)
def delete_food_cost(food_cost_id: int, db: Session = Depends(get_db)):
    if not crud.delete_food_cost(db, food_cost_id):
        raise HTTPException(status_code=404, detail="식자재 비용 기록을 찾을 수 없습니다")

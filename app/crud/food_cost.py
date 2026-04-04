from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.models.food_cost import FoodCost
from app.schemas.food_cost import FoodCostCreate, FoodCostUpdate
from app.crud import kitchen_expense_sync


def get_food_costs(
    db: Session,
    store_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    supplier: Optional[str] = None,
    record_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
) -> List[FoodCost]:
    query = db.query(FoodCost).filter(FoodCost.store_id == store_id)
    if start_date:
        query = query.filter(FoodCost.date >= start_date)
    if end_date:
        query = query.filter(FoodCost.date <= end_date)
    if supplier:
        query = query.filter(FoodCost.supplier == supplier)
    if record_type:
        query = query.filter(FoodCost.record_type == record_type)
    return query.order_by(FoodCost.date, FoodCost.id).offset(skip).limit(limit).all()


def get_food_cost(db: Session, store_id: int, food_cost_id: int) -> Optional[FoodCost]:
    return (
        db.query(FoodCost)
        .filter(FoodCost.id == food_cost_id, FoodCost.store_id == store_id)
        .first()
    )


def create_food_cost(db: Session, store_id: int, food_cost: FoodCostCreate) -> FoodCost:
    db_obj = FoodCost(store_id=store_id, **food_cost.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    kitchen_expense_sync.sync_kitchen_expense_for_date(db, store_id, db_obj.date)
    return db_obj


def update_food_cost(
    db: Session, store_id: int, food_cost_id: int, update: FoodCostUpdate
) -> Optional[FoodCost]:
    db_obj = get_food_cost(db, store_id, food_cost_id)
    if not db_obj:
        return None
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(db_obj, field, value)
    synced_date = db_obj.date
    db.commit()
    db.refresh(db_obj)
    kitchen_expense_sync.sync_kitchen_expense_for_date(db, store_id, synced_date)
    return db_obj


def delete_food_cost(db: Session, store_id: int, food_cost_id: int) -> bool:
    db_obj = get_food_cost(db, store_id, food_cost_id)
    if not db_obj:
        return False
    synced_date = db_obj.date
    db.delete(db_obj)
    db.commit()
    kitchen_expense_sync.sync_kitchen_expense_for_date(db, store_id, synced_date)
    return True

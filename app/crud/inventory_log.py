from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date
from app.models.inventory_log import InventoryLog, InventoryLogType
from app.models.ingredient import Ingredient
from app.schemas.inventory_log import InventoryLogCreate


def get_inventory_log(db: Session, log_id: int, store_id: int) -> Optional[InventoryLog]:
    """입출고 로그 ID로 조회"""
    return (
        db.query(InventoryLog)
        .filter(InventoryLog.id == log_id, InventoryLog.store_id == store_id)
        .first()
    )


def get_inventory_logs_by_ingredient(
    db: Session, store_id: int, ingredient_id: int, skip: int = 0, limit: int = 100
) -> List[InventoryLog]:
    """식자재별 입출고 로그 조회"""
    return (
        db.query(InventoryLog)
        .filter(
            InventoryLog.store_id == store_id,
            InventoryLog.ingredient_id == ingredient_id,
        )
        .order_by(InventoryLog.date.desc(), InventoryLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_inventory_logs_by_date_range(
    db: Session, store_id: int, start_date: date, end_date: date
) -> List[InventoryLog]:
    """날짜 범위로 입출고 로그 조회"""
    return (
        db.query(InventoryLog)
        .filter(
            InventoryLog.store_id == store_id,
            and_(InventoryLog.date >= start_date, InventoryLog.date <= end_date),
        )
        .order_by(InventoryLog.date.desc(), InventoryLog.ingredient_id)
        .all()
    )


def create_inventory_log(db: Session, store_id: int, log: InventoryLogCreate) -> InventoryLog:
    """새 입출고 로그 생성 및 재고 업데이트"""
    ingredient = (
        db.query(Ingredient)
        .filter(Ingredient.id == log.ingredient_id, Ingredient.store_id == store_id)
        .first()
    )
    if not ingredient:
        raise ValueError("식자재를 찾을 수 없습니다")

    log_data = log.model_dump(by_alias=True)
    log_date = log_data.get("date") or log.log_date

    db_log = InventoryLog(
        store_id=store_id,
        ingredient_id=log.ingredient_id,
        log_type=log.log_type,
        quantity=log.quantity,
        date=log_date,
        memo=log.memo,
    )
    db.add(db_log)

    if log.log_type == InventoryLogType.IN:
        ingredient.stock += log.quantity
    else:
        if ingredient.stock < log.quantity:
            raise ValueError("재고가 부족합니다")
        ingredient.stock -= log.quantity

    db.commit()
    db.refresh(db_log)
    return db_log


def delete_inventory_log(db: Session, store_id: int, log_id: int) -> bool:
    """입출고 로그 삭제 및 재고 복구"""
    db_log = get_inventory_log(db, log_id, store_id)
    if not db_log:
        return False

    ingredient = (
        db.query(Ingredient)
        .filter(Ingredient.id == db_log.ingredient_id, Ingredient.store_id == store_id)
        .first()
    )
    if ingredient:
        if db_log.log_type == InventoryLogType.IN:
            ingredient.stock -= db_log.quantity
            if ingredient.stock < 0:
                ingredient.stock = 0
        else:
            ingredient.stock += db_log.quantity

    db.delete(db_log)
    db.commit()
    return True

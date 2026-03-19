from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.ingredient import Ingredient
from app.schemas.ingredient import IngredientCreate, IngredientUpdate


def get_ingredient(db: Session, ingredient_id: int) -> Optional[Ingredient]:
    """식자재 ID로 조회"""
    return db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()


def get_ingredients(
    db: Session,
    skip: int = 0,
    limit: int = 100
) -> List[Ingredient]:
    """식자재 목록 조회"""
    return db.query(Ingredient).order_by(Ingredient.name).offset(skip).limit(limit).all()


def create_ingredient(db: Session, ingredient: IngredientCreate) -> Ingredient:
    """새 식자재 생성"""
    db_ingredient = Ingredient(
        name=ingredient.name,
        unit=ingredient.unit,
        unit_price=ingredient.unit_price,
        stock=ingredient.stock
    )
    db.add(db_ingredient)
    db.commit()
    db.refresh(db_ingredient)
    return db_ingredient


def update_ingredient(
    db: Session,
    ingredient_id: int,
    ingredient_update: IngredientUpdate
) -> Optional[Ingredient]:
    """식자재 수정"""
    db_ingredient = get_ingredient(db, ingredient_id)
    if not db_ingredient:
        return None
    
    update_data = ingredient_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_ingredient, field, value)
    
    db.commit()
    db.refresh(db_ingredient)
    return db_ingredient


def delete_ingredient(db: Session, ingredient_id: int) -> bool:
    """식자재 삭제"""
    db_ingredient = get_ingredient(db, ingredient_id)
    if not db_ingredient:
        return False
    
    db.delete(db_ingredient)
    db.commit()
    return True


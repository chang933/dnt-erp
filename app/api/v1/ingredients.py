from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.ingredient import Ingredient, IngredientCreate, IngredientUpdate
from app.crud import ingredient as crud_ingredient

router = APIRouter()


@router.post("/", response_model=Ingredient, status_code=201)
def create_ingredient(
    ingredient: IngredientCreate,
    db: Session = Depends(get_db)
):
    """새 식자재 등록"""
    return crud_ingredient.create_ingredient(db=db, ingredient=ingredient)


@router.get("/", response_model=List[Ingredient])
def get_ingredients(
    skip: int = Query(0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 레코드 수"),
    db: Session = Depends(get_db)
):
    """식자재 목록 조회"""
    return crud_ingredient.get_ingredients(db=db, skip=skip, limit=limit)


@router.get("/{ingredient_id}", response_model=Ingredient)
def get_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db)
):
    """식자재 상세 조회"""
    db_ingredient = crud_ingredient.get_ingredient(db=db, ingredient_id=ingredient_id)
    if db_ingredient is None:
        raise HTTPException(status_code=404, detail="식자재를 찾을 수 없습니다")
    return db_ingredient


@router.put("/{ingredient_id}", response_model=Ingredient)
def update_ingredient(
    ingredient_id: int,
    ingredient_update: IngredientUpdate,
    db: Session = Depends(get_db)
):
    """식자재 수정"""
    db_ingredient = crud_ingredient.update_ingredient(
        db=db,
        ingredient_id=ingredient_id,
        ingredient_update=ingredient_update
    )
    if db_ingredient is None:
        raise HTTPException(status_code=404, detail="식자재를 찾을 수 없습니다")
    return db_ingredient


@router.delete("/{ingredient_id}", status_code=204)
def delete_ingredient(
    ingredient_id: int,
    db: Session = Depends(get_db)
):
    """식자재 삭제"""
    success = crud_ingredient.delete_ingredient(db=db, ingredient_id=ingredient_id)
    if not success:
        raise HTTPException(status_code=404, detail="식자재를 찾을 수 없습니다")
    return None


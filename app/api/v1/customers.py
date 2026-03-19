from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.schemas.customer import Customer, CustomerCreate, CustomerUpdate
from app.crud import customer as crud_customer

router = APIRouter()


@router.post("/", response_model=Customer, status_code=201)
def create_customer(
    customer: CustomerCreate,
    db: Session = Depends(get_db)
):
    """새 고객 등록"""
    return crud_customer.create_customer(db=db, customer=customer)


@router.get("/", response_model=List[Customer])
def get_customers(
    skip: int = Query(0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 레코드 수"),
    is_vip: Optional[bool] = Query(None, description="VIP 여부로 필터링"),
    is_blacklist: Optional[bool] = Query(None, description="블랙리스트 여부로 필터링"),
    search: Optional[str] = Query(None, description="이름 또는 연락처 검색"),
    db: Session = Depends(get_db)
):
    """고객 목록 조회"""
    return crud_customer.get_customers(
        db=db,
        skip=skip,
        limit=limit,
        is_vip=is_vip,
        is_blacklist=is_blacklist,
        search=search
    )


@router.get("/blacklist", response_model=List[Customer])
def get_blacklist_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """블랙리스트 고객 목록 조회"""
    return crud_customer.get_customers(
        db=db,
        skip=skip,
        limit=limit,
        is_blacklist=True
    )


@router.get("/{customer_id}", response_model=Customer)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db)
):
    """고객 상세 조회"""
    db_customer = crud_customer.get_customer(db=db, customer_id=customer_id)
    if db_customer is None:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    return db_customer


@router.put("/{customer_id}", response_model=Customer)
def update_customer(
    customer_id: int,
    customer_update: CustomerUpdate,
    db: Session = Depends(get_db)
):
    """고객 정보 수정"""
    db_customer = crud_customer.update_customer(
        db=db,
        customer_id=customer_id,
        customer_update=customer_update
    )
    if db_customer is None:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    return db_customer


@router.delete("/{customer_id}", status_code=204)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db)
):
    """고객 삭제"""
    success = crud_customer.delete_customer(db=db, customer_id=customer_id)
    if not success:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")
    return None


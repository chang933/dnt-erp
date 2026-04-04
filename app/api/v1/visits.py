from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.db.session import get_db
from app.api.deps import get_store_id
from app.schemas.visit import Visit, VisitCreate, VisitWithCustomer
from app.crud import visit as crud_visit
from app.models.customer import Customer

router = APIRouter()


@router.post("/", response_model=Visit, status_code=201)
def create_visit(
    visit: VisitCreate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """새 방문 기록 등록"""
    try:
        return crud_visit.create_visit(db=db, store_id=store_id, visit=visit)
    except ValueError:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")


@router.get("/", response_model=List[VisitWithCustomer])
def get_visits(
    customer_id: int = Query(..., description="고객 ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """고객별 방문 기록 조회"""
    visits = crud_visit.get_visits_by_customer(
        db=db,
        store_id=store_id,
        customer_id=customer_id,
        skip=skip,
        limit=limit,
    )

    customer = (
        db.query(Customer)
        .filter(Customer.id == customer_id, Customer.store_id == store_id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="고객을 찾을 수 없습니다")

    result = []
    for visit in visits:
        result.append(
            VisitWithCustomer(
                id=visit.id,
                customer_id=visit.customer_id,
                date=visit.date,
                memo=visit.memo,
                customer_name=customer.name,
                customer_phone=customer.phone,
            )
        )

    return result


@router.get("/date/{visit_date}", response_model=List[VisitWithCustomer])
def get_visits_by_date(
    visit_date: date,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """특정 날짜의 모든 방문 기록 조회"""
    visits = crud_visit.get_visits_by_date(
        db=db, store_id=store_id, visit_date=visit_date
    )

    result = []
    for visit in visits:
        customer = (
            db.query(Customer)
            .filter(
                Customer.id == visit.customer_id,
                Customer.store_id == store_id,
            )
            .first()
        )
        if customer:
            result.append(
                VisitWithCustomer(
                    id=visit.id,
                    customer_id=visit.customer_id,
                    date=visit.date,
                    memo=visit.memo,
                    customer_name=customer.name,
                    customer_phone=customer.phone,
                )
            )

    return result


@router.get("/{visit_id}", response_model=Visit)
def get_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """방문 기록 상세 조회"""
    db_visit = crud_visit.get_visit(db=db, visit_id=visit_id, store_id=store_id)
    if db_visit is None:
        raise HTTPException(status_code=404, detail="방문 기록을 찾을 수 없습니다")
    return db_visit


@router.delete("/{visit_id}", status_code=204)
def delete_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """방문 기록 삭제"""
    success = crud_visit.delete_visit(db=db, store_id=store_id, visit_id=visit_id)
    if not success:
        raise HTTPException(status_code=404, detail="방문 기록을 찾을 수 없습니다")
    return None

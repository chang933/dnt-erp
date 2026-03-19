from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.schemas.reservation import Reservation, ReservationCreate, ReservationUpdate
from app.crud import reservation as crud_reservation

router = APIRouter()


@router.post("/", response_model=Reservation, status_code=201)
def create_reservation(
    reservation: ReservationCreate,
    db: Session = Depends(get_db),
):
    """예약 등록"""
    return crud_reservation.create_reservation(db=db, reservation=reservation)


@router.get("/", response_model=List[Reservation])
def get_reservations(
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=2000),
    start_date: Optional[date] = Query(None, description="예약일 시작"),
    end_date: Optional[date] = Query(None, description="예약일 종료"),
    db: Session = Depends(get_db),
):
    """예약 목록 조회"""
    return crud_reservation.get_reservations(
        db=db,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/{reservation_id}", response_model=Reservation)
def get_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
):
    """예약 상세 조회"""
    db_reservation = crud_reservation.get_reservation(db=db, reservation_id=reservation_id)
    if db_reservation is None:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다")
    return db_reservation


@router.put("/{reservation_id}", response_model=Reservation)
def update_reservation(
    reservation_id: int,
    reservation_update: ReservationUpdate,
    db: Session = Depends(get_db),
):
    """예약 수정"""
    db_reservation = crud_reservation.update_reservation(
        db=db,
        reservation_id=reservation_id,
        reservation_update=reservation_update,
    )
    if db_reservation is None:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다")
    return db_reservation


@router.delete("/{reservation_id}", status_code=204)
def delete_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
):
    """예약 삭제"""
    success = crud_reservation.delete_reservation(db=db, reservation_id=reservation_id)
    if not success:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다")

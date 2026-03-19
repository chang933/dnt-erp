from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import date
from app.models.reservation import Reservation
from app.schemas.reservation import ReservationCreate, ReservationUpdate


def get_reservation(db: Session, reservation_id: int) -> Optional[Reservation]:
    return db.query(Reservation).filter(Reservation.id == reservation_id).first()


def get_reservations(
    db: Session,
    skip: int = 0,
    limit: int = 200,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[Reservation]:
    query = db.query(Reservation)
    if start_date:
        query = query.filter(Reservation.reservation_date >= start_date)
    if end_date:
        query = query.filter(Reservation.reservation_date <= end_date)
    return query.order_by(desc(Reservation.reservation_date), desc(Reservation.id)).offset(skip).limit(limit).all()


def create_reservation(db: Session, reservation: ReservationCreate) -> Reservation:
    db_reservation = Reservation(
        reservation_date=reservation.reservation_date,
        reservation_time=reservation.reservation_time,
        guest_name=reservation.guest_name,
        head_count=reservation.head_count,
        memo=reservation.memo,
    )
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    return db_reservation


def update_reservation(
    db: Session,
    reservation_id: int,
    reservation_update: ReservationUpdate,
) -> Optional[Reservation]:
    db_reservation = get_reservation(db, reservation_id)
    if not db_reservation:
        return None
    update_data = reservation_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_reservation, field, value)
    db.commit()
    db.refresh(db_reservation)
    return db_reservation


def delete_reservation(db: Session, reservation_id: int) -> bool:
    db_reservation = get_reservation(db, reservation_id)
    if not db_reservation:
        return False
    db.delete(db_reservation)
    db.commit()
    return True

from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, datetime
from app.models.visit import Visit
from app.schemas.visit import VisitCreate


def get_visit(db: Session, visit_id: int) -> Optional[Visit]:
    """방문 기록 ID로 조회"""
    return db.query(Visit).filter(Visit.id == visit_id).first()


def get_visits_by_customer(
    db: Session,
    customer_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[Visit]:
    """고객별 방문 기록 조회"""
    return db.query(Visit).filter(
        Visit.customer_id == customer_id
    ).order_by(Visit.date.desc()).offset(skip).limit(limit).all()


def get_visits_by_date(
    db: Session,
    visit_date: date
) -> List[Visit]:
    """특정 날짜의 모든 방문 기록 조회"""
    start_datetime = datetime.combine(visit_date, datetime.min.time())
    end_datetime = datetime.combine(visit_date, datetime.max.time())
    
    return db.query(Visit).filter(
        and_(Visit.date >= start_datetime, Visit.date <= end_datetime)
    ).order_by(Visit.date).all()


def create_visit(db: Session, visit: VisitCreate) -> Visit:
    """새 방문 기록 생성"""
    visit_data = visit.model_dump(by_alias=True)
    visit_date = visit_data.get('date') or visit.visit_date
    
    db_visit = Visit(
        customer_id=visit.customer_id,
        date=visit_date,
        memo=visit.memo
    )
    db.add(db_visit)
    db.commit()
    db.refresh(db_visit)
    return db_visit


def delete_visit(db: Session, visit_id: int) -> bool:
    """방문 기록 삭제"""
    db_visit = get_visit(db, visit_id)
    if not db_visit:
        return False
    
    db.delete(db_visit)
    db.commit()
    return True


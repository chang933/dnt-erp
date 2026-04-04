from sqlalchemy.orm import Session
from sqlalchemy import and_, extract
from typing import List, Optional
from datetime import date
from app.models.schedule import Schedule
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate


def get_schedule(db: Session, schedule_id: int, store_id: int) -> Optional[Schedule]:
    """스케줄 ID로 스케줄 조회"""
    return (
        db.query(Schedule)
        .filter(Schedule.id == schedule_id, Schedule.store_id == store_id)
        .first()
    )


def get_schedules_by_employee(
    db: Session,
    store_id: int,
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[Schedule]:
    """직원의 스케줄 조회 (날짜 범위 지정 가능)"""
    query = db.query(Schedule).filter(
        Schedule.store_id == store_id, Schedule.employee_id == employee_id
    )
    
    if start_date:
        query = query.filter(Schedule.date >= start_date)
    if end_date:
        query = query.filter(Schedule.date <= end_date)
    
    return query.order_by(Schedule.date).all()


def get_schedules_by_date_range(
    db: Session,
    store_id: int,
    start_date: date,
    end_date: date,
) -> List[Schedule]:
    """날짜 범위로 스케줄 조회 (모든 직원)"""
    return (
        db.query(Schedule)
        .filter(
            Schedule.store_id == store_id,
            and_(Schedule.date >= start_date, Schedule.date <= end_date),
        )
        .order_by(Schedule.date, Schedule.employee_id)
        .all()
    )


def get_schedules_by_month(
    db: Session,
    store_id: int,
    year: int,
    month: int,
) -> List[Schedule]:
    """특정 월의 모든 스케줄 조회"""
    return (
        db.query(Schedule)
        .filter(
            Schedule.store_id == store_id,
            extract("year", Schedule.date) == year,
            extract("month", Schedule.date) == month,
        )
        .order_by(Schedule.date, Schedule.employee_id)
        .all()
    )


def create_schedule(db: Session, store_id: int, schedule: ScheduleCreate) -> Schedule:
    """새 스케줄 생성"""
    # 같은 직원, 같은 날짜의 스케줄이 이미 있는지 확인
    schedule_data = schedule.model_dump(by_alias=True)
    schedule_date = schedule_data.get('date') or schedule.schedule_date
    
    existing = db.query(Schedule).filter(
        and_(
            Schedule.store_id == store_id,
            Schedule.employee_id == schedule.employee_id,
            Schedule.date == schedule_date,
        )
    ).first()
    
    if existing:
        # 기존 스케줄 업데이트
        for field, value in schedule_data.items():
            if field != 'employee_id':  # employee_id는 변경하지 않음
                setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing

    extra_hours = getattr(schedule, 'extra_hours', None)
    if extra_hours is None:
        extra_hours = 0
    
    db_schedule = Schedule(
        store_id=store_id,
        employee_id=schedule.employee_id,
        date=schedule_date,
        schedule_type=schedule.schedule_type,
        shift_start=schedule.shift_start,
        shift_end=schedule.shift_end,
        work_position=schedule.work_position,
        extra_hours=extra_hours,
    )
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule


def update_schedule(
    db: Session,
    store_id: int,
    schedule_id: int,
    schedule_update: ScheduleUpdate,
) -> Optional[Schedule]:
    """스케줄 수정"""
    db_schedule = get_schedule(db, schedule_id, store_id)
    if not db_schedule:
        return None
    
    update_data = schedule_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_schedule, field, value)
    
    db.commit()
    db.refresh(db_schedule)
    return db_schedule


def delete_schedule(db: Session, store_id: int, schedule_id: int) -> bool:
    """스케줄 삭제"""
    db_schedule = get_schedule(db, schedule_id, store_id)
    if not db_schedule:
        return False
    
    db.delete(db_schedule)
    db.commit()
    return True


def create_schedules_batch(
    db: Session,
    store_id: int,
    schedules: List[ScheduleCreate],
) -> List[Schedule]:
    """여러 스케줄 일괄 생성"""
    created_schedules = []
    for schedule_data in schedules:
        schedule = create_schedule(db, store_id, schedule_data)
        created_schedules.append(schedule)
    return created_schedules


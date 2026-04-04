from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional, Tuple
from datetime import date
from calendar import monthrange
from decimal import Decimal

from app.models.employee import Employee
from app.models.schedule import Schedule, ScheduleType as ScheduleTypeEnum
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
    """특정 월의 모든 스케줄 조회 (날짜 범위 — (store_id, date) 인덱스 활용)"""
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    return (
        db.query(Schedule)
        .filter(
            Schedule.store_id == store_id,
            Schedule.date >= start,
            Schedule.date <= end,
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


def batch_upsert_employee_week(
    db: Session,
    store_id: int,
    employee_id: int,
    days_data: List[Tuple[date, str, Optional[float]]],
) -> Optional[List[Schedule]]:
    """
    한 직원의 여러 날짜 스케줄을 단일 트랜잭션으로 upsert.
    주간 화면에서 요일별 동시 POST 시 Supabase/풀 OperationalError를 피하기 위함.
    """
    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id, Employee.store_id == store_id)
        .first()
    )
    if not employee:
        return None

    out: List[Schedule] = []
    for schedule_date, st_raw, extra_raw in days_data:
        st = ScheduleTypeEnum.OFF if st_raw == "휴무" else ScheduleTypeEnum.WORK
        if st == ScheduleTypeEnum.WORK:
            try:
                eh = Decimal(str(extra_raw if extra_raw is not None else 0))
            except Exception:
                eh = Decimal("0")
        else:
            eh = Decimal("0")

        existing = (
            db.query(Schedule)
            .filter(
                and_(
                    Schedule.store_id == store_id,
                    Schedule.employee_id == employee_id,
                    Schedule.date == schedule_date,
                )
            )
            .first()
        )

        if existing:
            existing.schedule_type = st
            existing.work_position = employee.employee_position
            existing.extra_hours = eh
            out.append(existing)
        else:
            ns = Schedule(
                store_id=store_id,
                employee_id=employee_id,
                date=schedule_date,
                schedule_type=st,
                shift_start=None,
                shift_end=None,
                work_position=employee.employee_position,
                extra_hours=eh,
            )
            db.add(ns)
            out.append(ns)

    db.commit()
    return out


from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List, Optional, Any
from datetime import date
from app.db.session import get_db
from app.api.deps import get_store_id
from app.schemas.schedule import Schedule, ScheduleCreate, ScheduleUpdate, ScheduleWithEmployee
from app.crud import schedule as crud_schedule
from app.models.employee import Employee
from app.models.schedule import ScheduleType

router = APIRouter()


def _parse_date_safe(value: Any) -> date:
    """클라이언트 날짜를 시간/타임존 없이 YYYY-MM-DD만 사용 (한 칸 밀림 방지)"""
    if isinstance(value, date):
        return value
    s = str(value).strip()[:10]
    return date.fromisoformat(s)


@router.post("/", response_model=Schedule, status_code=201)
async def create_schedule(
    request: Request,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """새 스케줄 등록 (날짜는 반드시 YYYY-MM-DD만 사용)"""
    body = await request.json()
    raw_date = body.get("date") or body.get("schedule_date")
    if not raw_date:
        raise HTTPException(status_code=400, detail="date 필드가 필요합니다")
    schedule_date = _parse_date_safe(raw_date)
    st = body.get("schedule_type") or "출근"
    schedule_type = ScheduleType.OFF if st == "휴무" else ScheduleType.WORK
    schedule = ScheduleCreate(
        employee_id=body["employee_id"],
        schedule_date=schedule_date,
        schedule_type=schedule_type,
        shift_start=body.get("shift_start"),
        shift_end=body.get("shift_end"),
        work_position=body.get("work_position"),
        extra_hours=body.get("extra_hours"),
    )
    employee = (
        db.query(Employee)
        .filter(Employee.id == schedule.employee_id, Employee.store_id == store_id)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")
    return crud_schedule.create_schedule(db=db, store_id=store_id, schedule=schedule)


@router.get("/", response_model=List[Schedule])
def get_schedules(
    employee_id: Optional[int] = Query(None, description="직원 ID로 필터링"),
    start_date: Optional[date] = Query(None, description="시작 날짜"),
    end_date: Optional[date] = Query(None, description="종료 날짜"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="년도"),
    month: Optional[int] = Query(None, ge=1, le=12, description="월"),
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """스케줄 목록 조회"""
    if employee_id:
        # 특정 직원의 스케줄 조회
        schedules = crud_schedule.get_schedules_by_employee(
            db=db,
            store_id=store_id,
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
        )
    elif year and month:
        # 특정 월의 모든 스케줄 조회
        schedules = crud_schedule.get_schedules_by_month(
            db=db, store_id=store_id, year=year, month=month
        )
    elif start_date and end_date:
        # 날짜 범위로 조회
        schedules = crud_schedule.get_schedules_by_date_range(
            db=db,
            store_id=store_id,
            start_date=start_date,
            end_date=end_date,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="employee_id, (year & month), 또는 (start_date & end_date) 중 하나를 제공해야 합니다"
        )
    
    return schedules


@router.get("/month/{year}/{month}", response_model=List[ScheduleWithEmployee])
def get_schedules_by_month_with_employee(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """특정 월의 모든 스케줄 조회 (직원 정보 포함)"""
    from sqlalchemy.orm import joinedload
    from app.models.schedule import Schedule as ScheduleModel
    
    # 직원 정보를 join해서 가져오기
    schedules = db.query(ScheduleModel).options(
        joinedload(ScheduleModel.employee)
    ).filter(
        ScheduleModel.store_id == store_id,
        extract('year', ScheduleModel.date) == year,
        extract('month', ScheduleModel.date) == month
    ).order_by(ScheduleModel.date, ScheduleModel.employee_id).all()
    
    # 직원 정보를 포함한 응답 생성
    result = []
    for schedule in schedules:
        if schedule.employee:
            schedule_dict = {
                'id': schedule.id,
                'employee_id': schedule.employee_id,
                'date': schedule.date,
                'schedule_type': schedule.schedule_type,
                'shift_start': schedule.shift_start,
                'shift_end': schedule.shift_end,
                'work_position': schedule.work_position,
                'extra_hours': float(schedule.extra_hours) if schedule.extra_hours is not None else 0,
            }
            result.append(ScheduleWithEmployee(
                **schedule_dict,
                employee_name=schedule.employee.name,
                employee_position=schedule.employee.employee_position
            ))
    
    return result


@router.get("/{schedule_id}", response_model=Schedule)
def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """스케줄 상세 조회"""
    db_schedule = crud_schedule.get_schedule(db=db, schedule_id=schedule_id, store_id=store_id)
    if db_schedule is None:
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다")
    return db_schedule


@router.put("/{schedule_id}", response_model=Schedule)
def update_schedule(
    schedule_id: int,
    schedule_update: ScheduleUpdate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """스케줄 수정"""
    db_schedule = crud_schedule.update_schedule(
        db=db,
        store_id=store_id,
        schedule_id=schedule_id,
        schedule_update=schedule_update
    )
    if db_schedule is None:
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다")
    return db_schedule


@router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """스케줄 삭제"""
    success = crud_schedule.delete_schedule(db=db, store_id=store_id, schedule_id=schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다")
    return None


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import List, Optional
from datetime import date
from app.db.session import get_db
from app.api.deps import get_store_id
from app.schemas.attendance import (
    Attendance,
    AttendanceCreate,
    AttendanceUpdate,
    AttendanceWithEmployee,
    MonthlyAttendanceSummary,
)
from app.crud import attendance as crud_attendance
from app.models.employee import Employee

router = APIRouter()


@router.post("/", response_model=Attendance, status_code=201)
def create_attendance(
    attendance: AttendanceCreate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """새 출퇴근 기록 등록 (사장/매니저가 수기 입력)"""
    employee = (
        db.query(Employee)
        .filter(Employee.id == attendance.employee_id, Employee.store_id == store_id)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    return crud_attendance.create_attendance(
        db=db, store_id=store_id, attendance=attendance
    )


@router.get("/", response_model=List[Attendance])
def get_attendances(
    employee_id: Optional[int] = Query(None, description="직원 ID로 필터링"),
    date: Optional[date] = Query(None, description="특정 날짜"),
    start_date: Optional[date] = Query(None, description="시작 날짜"),
    end_date: Optional[date] = Query(None, description="종료 날짜"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="년도"),
    month: Optional[int] = Query(None, ge=1, le=12, description="월"),
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """출퇴근 기록 목록 조회"""
    if employee_id and date:
        attendance = crud_attendance.get_attendance_by_employee_and_date(
            db=db,
            store_id=store_id,
            employee_id=employee_id,
            attendance_date=date,
        )
        return [attendance] if attendance else []
    elif employee_id:
        attendances = crud_attendance.get_attendances_by_employee(
            db=db,
            store_id=store_id,
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
        )
        return attendances
    elif date:
        attendances = crud_attendance.get_attendances_by_date(
            db=db, store_id=store_id, attendance_date=date
        )
        return attendances
    elif year and month:
        attendances = crud_attendance.get_attendances_by_month(
            db=db, store_id=store_id, year=year, month=month
        )
        return attendances
    else:
        raise HTTPException(
            status_code=400,
            detail="employee_id, date, (year & month), 또는 (start_date & end_date) 중 하나를 제공해야 합니다",
        )


@router.get("/month/{year}/{month}", response_model=List[AttendanceWithEmployee])
def get_attendances_by_month_with_employee(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """특정 월의 모든 출퇴근 기록 조회 (직원 정보 포함, join 1회)"""
    from sqlalchemy.orm import joinedload
    from app.models.attendance import Attendance as AttendanceModel
    from calendar import monthrange

    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    attendances = (
        db.query(AttendanceModel)
        .options(joinedload(AttendanceModel.employee))
        .filter(
            AttendanceModel.store_id == store_id,
            AttendanceModel.date >= start,
            AttendanceModel.date <= end,
        )
        .order_by(AttendanceModel.date, AttendanceModel.employee_id)
        .all()
    )

    result = []
    for attendance in attendances:
        emp = attendance.employee
        if emp and emp.store_id == store_id:
            result.append(
                AttendanceWithEmployee(
                    id=attendance.id,
                    employee_id=attendance.employee_id,
                    date=attendance.date,
                    check_in=attendance.check_in,
                    check_out=attendance.check_out,
                    status=attendance.status,
                    memo=attendance.memo,
                    employee_name=emp.name,
                )
            )

    return result


@router.get("/summary/{employee_id}/{year}/{month}", response_model=MonthlyAttendanceSummary)
def get_monthly_summary(
    employee_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """직원의 월간 출퇴근 통계"""
    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id, Employee.store_id == store_id)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    summary = crud_attendance.get_monthly_summary(
        db=db,
        store_id=store_id,
        employee_id=employee_id,
        year=year,
        month=month,
    )

    return MonthlyAttendanceSummary(
        employee_id=employee_id,
        employee_name=employee.name,
        **summary,
    )


@router.get("/{attendance_id}", response_model=Attendance)
def get_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """출퇴근 기록 상세 조회"""
    db_attendance = crud_attendance.get_attendance(
        db=db, attendance_id=attendance_id, store_id=store_id
    )
    if db_attendance is None:
        raise HTTPException(status_code=404, detail="출퇴근 기록을 찾을 수 없습니다")
    return db_attendance


@router.put("/{attendance_id}", response_model=Attendance)
def update_attendance(
    attendance_id: int,
    attendance_update: AttendanceUpdate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """출퇴근 기록 수정 (사장/매니저가 수기 수정)"""
    db_attendance = crud_attendance.update_attendance(
        db=db,
        store_id=store_id,
        attendance_id=attendance_id,
        attendance_update=attendance_update,
    )
    if db_attendance is None:
        raise HTTPException(status_code=404, detail="출퇴근 기록을 찾을 수 없습니다")
    return db_attendance


@router.delete("/{attendance_id}", status_code=204)
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """출퇴근 기록 삭제"""
    success = crud_attendance.delete_attendance(
        db=db, store_id=store_id, attendance_id=attendance_id
    )
    if not success:
        raise HTTPException(status_code=404, detail="출퇴근 기록을 찾을 수 없습니다")
    return None

from sqlalchemy.orm import Session
from sqlalchemy import and_, extract, func
from typing import List, Optional
from datetime import date, datetime, timedelta
from calendar import monthrange
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee
from app.schemas.attendance import AttendanceCreate, AttendanceUpdate


def get_attendance(db: Session, attendance_id: int, store_id: int) -> Optional[Attendance]:
    """출퇴근 기록 ID로 조회"""
    return (
        db.query(Attendance)
        .filter(Attendance.id == attendance_id, Attendance.store_id == store_id)
        .first()
    )


def get_attendance_by_employee_and_date(
    db: Session,
    store_id: int,
    employee_id: int,
    attendance_date: date,
) -> Optional[Attendance]:
    """직원과 날짜로 출퇴근 기록 조회"""
    return (
        db.query(Attendance)
        .filter(
            and_(
                Attendance.store_id == store_id,
                Attendance.employee_id == employee_id,
                Attendance.date == attendance_date,
            )
        )
        .first()
    )


def get_attendances_by_employee(
    db: Session,
    store_id: int,
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[Attendance]:
    """직원의 출퇴근 기록 조회 (날짜 범위 지정 가능)"""
    query = db.query(Attendance).filter(
        Attendance.store_id == store_id, Attendance.employee_id == employee_id
    )

    if start_date:
        query = query.filter(Attendance.date >= start_date)
    if end_date:
        query = query.filter(Attendance.date <= end_date)

    return query.order_by(Attendance.date.desc()).all()


def get_attendances_by_date(
    db: Session, store_id: int, attendance_date: date
) -> List[Attendance]:
    """특정 날짜의 모든 직원 출퇴근 기록 조회"""
    return (
        db.query(Attendance)
        .filter(
            Attendance.store_id == store_id, Attendance.date == attendance_date
        )
        .order_by(Attendance.employee_id)
        .all()
    )


def get_attendances_by_month(
    db: Session, store_id: int, year: int, month: int
) -> List[Attendance]:
    """특정 월의 모든 출퇴근 기록 조회 (날짜 범위 — date 인덱스 활용)"""
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    return (
        db.query(Attendance)
        .filter(
            Attendance.store_id == store_id,
            Attendance.date >= start,
            Attendance.date <= end,
        )
        .order_by(Attendance.date, Attendance.employee_id)
        .all()
    )


def create_attendance(
    db: Session, store_id: int, attendance: AttendanceCreate
) -> Attendance:
    """새 출퇴근 기록 생성"""
    attendance_data = attendance.model_dump(by_alias=True)
    attendance_date = attendance_data.get("date") or attendance.attendance_date

    existing = get_attendance_by_employee_and_date(
        db=db,
        store_id=store_id,
        employee_id=attendance.employee_id,
        attendance_date=attendance_date,
    )

    if existing:
        for field, value in attendance_data.items():
            if field != "employee_id":
                setattr(existing, field, value)
        db.commit()
        return existing

    db_attendance = Attendance(
        store_id=store_id,
        employee_id=attendance.employee_id,
        date=attendance_date,
        check_in=attendance.check_in,
        check_out=attendance.check_out,
        status=attendance.status,
        memo=attendance.memo,
    )
    db.add(db_attendance)
    db.commit()
    return db_attendance


def update_attendance(
    db: Session,
    store_id: int,
    attendance_id: int,
    attendance_update: AttendanceUpdate,
) -> Optional[Attendance]:
    """출퇴근 기록 수정"""
    db_attendance = get_attendance(db, attendance_id, store_id)
    if not db_attendance:
        return None

    update_data = attendance_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_attendance, field, value)

    db.commit()
    return db_attendance


def delete_attendance(db: Session, store_id: int, attendance_id: int) -> bool:
    """출퇴근 기록 삭제"""
    db_attendance = get_attendance(db, attendance_id, store_id)
    if not db_attendance:
        return False

    db.delete(db_attendance)
    db.commit()
    return True


def get_monthly_summary(
    db: Session,
    store_id: int,
    employee_id: int,
    year: int,
    month: int,
) -> dict:
    """직원의 월간 출퇴근 통계"""
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    attendances = get_attendances_by_employee(
        db=db,
        store_id=store_id,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )

    total_days = len(attendances)
    late_count = sum(1 for a in attendances if a.status == AttendanceStatus.LATE)
    early_leave_count = sum(
        1 for a in attendances if a.status == AttendanceStatus.EARLY_LEAVE
    )
    absent_count = sum(1 for a in attendances if a.status == AttendanceStatus.ABSENT)

    total_hours = 0.0
    for att in attendances:
        if att.check_in and att.check_out:
            delta = att.check_out - att.check_in
            total_hours += delta.total_seconds() / 3600.0

    return {
        "employee_id": employee_id,
        "year_month": f"{year}-{month:02d}",
        "total_days": total_days,
        "work_hours": round(total_hours, 2),
        "late_count": late_count,
        "early_leave_count": early_leave_count,
        "absent_count": absent_count,
    }

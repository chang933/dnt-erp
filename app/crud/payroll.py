from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from decimal import Decimal
from datetime import date, timedelta
from app.models.payroll import Payroll
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.schemas.payroll import PayrollCreate, PayrollUpdate


def get_payroll(db: Session, payroll_id: int, store_id: int) -> Optional[Payroll]:
    """급여 ID로 조회"""
    return (
        db.query(Payroll)
        .filter(Payroll.id == payroll_id, Payroll.store_id == store_id)
        .first()
    )


def get_payroll_by_employee_and_month(
    db: Session, store_id: int, employee_id: int, year_month: str
) -> Optional[Payroll]:
    """직원과 년월로 급여 조회"""
    return (
        db.query(Payroll)
        .filter(
            and_(
                Payroll.store_id == store_id,
                Payroll.employee_id == employee_id,
                Payroll.year_month == year_month,
            )
        )
        .first()
    )


def get_payrolls_by_employee(
    db: Session, store_id: int, employee_id: int, skip: int = 0, limit: int = 100
) -> List[Payroll]:
    """직원의 급여 목록 조회"""
    return (
        db.query(Payroll)
        .filter(Payroll.store_id == store_id, Payroll.employee_id == employee_id)
        .order_by(Payroll.year_month.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_payrolls_by_month(db: Session, store_id: int, year_month: str) -> List[Payroll]:
    """특정 년월의 모든 급여 조회"""
    return (
        db.query(Payroll)
        .filter(Payroll.store_id == store_id, Payroll.year_month == year_month)
        .order_by(Payroll.employee_id)
        .all()
    )


def create_payroll(db: Session, store_id: int, payroll: PayrollCreate) -> Payroll:
    """새 급여 생성"""
    existing = get_payroll_by_employee_and_month(
        db=db,
        store_id=store_id,
        employee_id=payroll.employee_id,
        year_month=payroll.year_month,
    )

    if existing:
        existing.employee_id = payroll.employee_id
        existing.year_month = payroll.year_month
        existing.work_hours = payroll.work_hours
        existing.base_pay = payroll.base_pay
        existing.weekly_holiday_pay = payroll.weekly_holiday_pay
        existing.insurance_type = payroll.insurance_type or "미가입"
        existing.absent_count = payroll.absent_count or 0
        existing.deductions = payroll.deductions
        existing.employer_deductions = payroll.employer_deductions or Decimal("0")
        existing.net_pay = payroll.net_pay
        db.commit()
        return existing

    db_payroll = Payroll(
        store_id=store_id,
        employee_id=payroll.employee_id,
        year_month=payroll.year_month,
        work_hours=payroll.work_hours,
        base_pay=payroll.base_pay,
        weekly_holiday_pay=payroll.weekly_holiday_pay,
        insurance_type=payroll.insurance_type or "미가입",
        absent_count=payroll.absent_count or 0,
        deductions=payroll.deductions,
        employer_deductions=payroll.employer_deductions or Decimal("0"),
        net_pay=payroll.net_pay,
    )
    db.add(db_payroll)
    db.commit()
    return db_payroll


def update_payroll(
    db: Session, store_id: int, payroll_id: int, payroll_update: PayrollUpdate
) -> Optional[Payroll]:
    """급여 수정"""
    db_payroll = get_payroll(db, payroll_id, store_id)
    if not db_payroll:
        return None

    update_data = payroll_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_payroll, field, value)

    db.commit()
    return db_payroll


def delete_payroll(db: Session, store_id: int, payroll_id: int) -> bool:
    """급여 삭제"""
    db_payroll = get_payroll(db, payroll_id, store_id)
    if not db_payroll:
        return False

    db.delete(db_payroll)
    db.commit()
    return True


def calculate_payroll(
    db: Session,
    store_id: int,
    employee_id: int,
    year_month: str,
    hourly_wage: Optional[Decimal] = None,
) -> PayrollCreate:
    """출퇴근 기록 기반 급여 자동 계산"""
    employee = (
        db.query(Employee)
        .filter(Employee.id == employee_id, Employee.store_id == store_id)
        .first()
    )
    if not employee:
        raise ValueError("직원을 찾을 수 없습니다")

    if hourly_wage is None:
        hourly_wage = employee.hourly_wage

    year, month = map(int, year_month.split("-"))
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)

    attendances = (
        db.query(Attendance)
        .filter(
            and_(
                Attendance.store_id == store_id,
                Attendance.employee_id == employee_id,
                Attendance.date >= start_date,
                Attendance.date <= end_date,
            )
        )
        .all()
    )

    total_hours = Decimal("0.0")
    for att in attendances:
        if att.check_in and att.check_out:
            delta = att.check_out - att.check_in
            hours = Decimal(str(delta.total_seconds() / 3600.0))
            total_hours += hours

    base_pay = total_hours * hourly_wage

    weekly_holiday_pay = Decimal("0.0")
    if total_hours >= Decimal("40"):
        weekly_holiday_pay = (total_hours / Decimal("40")) * hourly_wage * Decimal("8")

    deductions = base_pay * Decimal("0.1")

    net_pay = base_pay + weekly_holiday_pay - deductions

    return PayrollCreate(
        employee_id=employee_id,
        year_month=year_month,
        work_hours=total_hours,
        base_pay=base_pay,
        weekly_holiday_pay=weekly_holiday_pay,
        deductions=deductions,
        net_pay=net_pay,
    )

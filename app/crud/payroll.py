from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from decimal import Decimal
from datetime import date, timedelta
from app.models.payroll import Payroll
from app.models.employee import Employee
from app.models.attendance import Attendance, AttendanceStatus
from app.schemas.payroll import PayrollCreate, PayrollUpdate


def get_payroll(db: Session, payroll_id: int) -> Optional[Payroll]:
    """급여 ID로 조회"""
    return db.query(Payroll).filter(Payroll.id == payroll_id).first()


def get_payroll_by_employee_and_month(
    db: Session,
    employee_id: int,
    year_month: str
) -> Optional[Payroll]:
    """직원과 년월로 급여 조회"""
    return db.query(Payroll).filter(
        and_(
            Payroll.employee_id == employee_id,
            Payroll.year_month == year_month
        )
    ).first()


def get_payrolls_by_employee(
    db: Session,
    employee_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[Payroll]:
    """직원의 급여 목록 조회"""
    return db.query(Payroll).filter(
        Payroll.employee_id == employee_id
    ).order_by(Payroll.year_month.desc()).offset(skip).limit(limit).all()


def get_payrolls_by_month(
    db: Session,
    year_month: str
) -> List[Payroll]:
    """특정 년월의 모든 급여 조회"""
    return db.query(Payroll).filter(
        Payroll.year_month == year_month
    ).order_by(Payroll.employee_id).all()


def create_payroll(db: Session, payroll: PayrollCreate) -> Payroll:
    """새 급여 생성"""
    # 같은 직원, 같은 년월의 급여가 이미 있는지 확인
    existing = get_payroll_by_employee_and_month(
        db=db,
        employee_id=payroll.employee_id,
        year_month=payroll.year_month
    )
    
    if existing:
        # 기존 급여 업데이트 - insurance_type을 포함하여 모든 필드 업데이트
        existing.employee_id = payroll.employee_id
        existing.year_month = payroll.year_month
        existing.work_hours = payroll.work_hours
        existing.base_pay = payroll.base_pay
        existing.weekly_holiday_pay = payroll.weekly_holiday_pay
        existing.insurance_type = payroll.insurance_type or "미가입"
        existing.absent_count = payroll.absent_count or 0
        existing.deductions = payroll.deductions
        existing.employer_deductions = payroll.employer_deductions or Decimal('0')
        existing.net_pay = payroll.net_pay
        db.commit()
        db.refresh(existing)
        return existing
    
    db_payroll = Payroll(
        employee_id=payroll.employee_id,
        year_month=payroll.year_month,
        work_hours=payroll.work_hours,
        base_pay=payroll.base_pay,
        weekly_holiday_pay=payroll.weekly_holiday_pay,
        insurance_type=payroll.insurance_type or "미가입",
        absent_count=payroll.absent_count or 0,
        deductions=payroll.deductions,
        employer_deductions=payroll.employer_deductions or Decimal('0'),
        net_pay=payroll.net_pay
    )
    db.add(db_payroll)
    db.commit()
    db.refresh(db_payroll)
    return db_payroll


def update_payroll(
    db: Session,
    payroll_id: int,
    payroll_update: PayrollUpdate
) -> Optional[Payroll]:
    """급여 수정"""
    db_payroll = get_payroll(db, payroll_id)
    if not db_payroll:
        return None
    
    update_data = payroll_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_payroll, field, value)
    
    db.commit()
    db.refresh(db_payroll)
    return db_payroll


def delete_payroll(db: Session, payroll_id: int) -> bool:
    """급여 삭제"""
    db_payroll = get_payroll(db, payroll_id)
    if not db_payroll:
        return False
    
    db.delete(db_payroll)
    db.commit()
    return True


def calculate_payroll(
    db: Session,
    employee_id: int,
    year_month: str,
    hourly_wage: Optional[Decimal] = None
) -> PayrollCreate:
    """출퇴근 기록 기반 급여 자동 계산"""
    # 직원 정보 가져오기
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise ValueError("직원을 찾을 수 없습니다")
    
    # 시급 (입력값이 없으면 직원 정보에서 가져옴)
    if hourly_wage is None:
        hourly_wage = employee.hourly_wage
    
    # 년월 파싱
    year, month = map(int, year_month.split('-'))
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date = date(year, month + 1, 1) - timedelta(days=1)
    
    # 출퇴근 기록 가져오기
    attendances = db.query(Attendance).filter(
        and_(
            Attendance.employee_id == employee_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date
        )
    ).all()
    
    # 총 근무시간 계산
    total_hours = Decimal('0.0')
    for att in attendances:
        if att.check_in and att.check_out:
            delta = att.check_out - att.check_in
            hours = Decimal(str(delta.total_seconds() / 3600.0))
            total_hours += hours
    
    # 기본급 계산 (근무시간 × 시급)
    base_pay = total_hours * hourly_wage
    
    # 주휴수당 계산 (주 15시간 이상 근무 시 1일치 추가)
    # 간단히 주 40시간 근무 기준으로 계산 (실제로는 더 복잡할 수 있음)
    weekly_holiday_pay = Decimal('0.0')
    if total_hours >= Decimal('40'):
        # 주휴수당 = (총 근무시간 / 40) × 시급 × 8시간
        weekly_holiday_pay = (total_hours / Decimal('40')) * hourly_wage * Decimal('8')
    
    # 공제 (4대보험 등, 여기서는 간단히 기본급의 10%로 계산)
    deductions = base_pay * Decimal('0.1')
    
    # 실수령액 = 기본급 + 주휴수당 - 공제
    net_pay = base_pay + weekly_holiday_pay - deductions
    
    return PayrollCreate(
        employee_id=employee_id,
        year_month=year_month,
        work_hours=total_hours,
        base_pay=base_pay,
        weekly_holiday_pay=weekly_holiday_pay,
        deductions=deductions,
        net_pay=net_pay
    )


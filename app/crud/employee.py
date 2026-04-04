from sqlalchemy.orm import Session
from sqlalchemy import desc, text
from typing import List, Optional
from app.models.employee import Employee, EmployeeStatus
from app.schemas.employee import EmployeeCreate, EmployeeUpdate


def get_employee(db: Session, employee_id: int, store_id: int) -> Optional[Employee]:
    """직원 ID로 직원 조회"""
    return (
        db.query(Employee)
        .filter(Employee.id == employee_id, Employee.store_id == store_id)
        .first()
    )


def get_employees(
    db: Session,
    store_id: int,
    skip: int = 0,
    limit: int = 100,
    status: Optional[EmployeeStatus] = None,
) -> List[Employee]:
    """직원 목록 조회 (페이징 지원)"""
    query = db.query(Employee).filter(Employee.store_id == store_id)

    if status:
        query = query.filter(Employee.status == status)

    return query.order_by(desc(Employee.created_at)).offset(skip).limit(limit).all()


def create_employee(
    db: Session,
    store_id: int,
    employee: EmployeeCreate,
    ssn_override: Optional[str] = None,
) -> Employee:
    """새 직원 생성 (ssn_override 있으면 주민번호로 사용)"""
    ssn_val = ssn_override if ssn_override is not None else employee.ssn
    db_employee = Employee(
        store_id=store_id,
        name=employee.name,
        phone=employee.phone,
        address=employee.address,
        ssn=ssn_val,
        birth_date=employee.birth_date,
        gender=getattr(employee, 'gender', None),
        employee_position=employee.employee_position,
        employment_type=getattr(employee, 'employment_type', None),
        benefit_type=getattr(employee, 'benefit_type', None),
        salary_type=employee.salary_type,
        hourly_wage=employee.hourly_wage,
        monthly_salary=employee.monthly_salary,
        daily_wage_weekday=getattr(employee, "daily_wage_weekday", None),
        daily_wage_weekend=getattr(employee, "daily_wage_weekend", None),
        daily_contract_hours=getattr(employee, 'daily_contract_hours', None),
        hire_date=employee.hire_date,
        status=EmployeeStatus.ACTIVE
    )
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    # 주민번호를 raw UPDATE로 한 번 더 반영 (저장 누락 방지)
    db.execute(
        text("UPDATE erp_employees SET ssn = :ssn WHERE id = :id"),
        {"ssn": ssn_val, "id": db_employee.id}
    )
    db.commit()
    db.refresh(db_employee)
    return db_employee


def update_employee(
    db: Session,
    store_id: int,
    employee_id: int,
    employee_update: EmployeeUpdate,
    ssn_override: Optional[str] = None,
) -> Optional[Employee]:
    """직원 정보 수정 (ssn_override 있으면 해당 값으로 주민번호 갱신)"""
    db_employee = get_employee(db, employee_id, store_id)
    if not db_employee:
        return None
    
    update_data = employee_update.model_dump(exclude_unset=True)
    if ssn_override is not None:
        update_data["ssn"] = ssn_override
    elif "ssn" in employee_update.model_fields_set:
        update_data["ssn"] = employee_update.ssn
    for field, value in update_data.items():
        if hasattr(db_employee, field):
            setattr(db_employee, field, value)
    
    db.commit()
    db.refresh(db_employee)
    if "ssn" in update_data:
        db.execute(
            text("UPDATE erp_employees SET ssn = :ssn WHERE id = :id"),
            {"ssn": update_data["ssn"], "id": employee_id}
        )
        db.commit()
        db.refresh(db_employee)
    return db_employee


def delete_employee(db: Session, store_id: int, employee_id: int) -> bool:
    """직원 삭제 (실제 삭제가 아닌 퇴사 처리)"""
    db_employee = get_employee(db, employee_id, store_id)
    if not db_employee:
        return False
    
    db_employee.status = EmployeeStatus.RESIGNED
    if not db_employee.resign_date:
        from datetime import date
        db_employee.resign_date = date.today()
    
    db.commit()
    return True


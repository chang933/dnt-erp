from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.api.deps import get_store_id
from app.schemas.payroll import (
    Payroll,
    PayrollCreate,
    PayrollUpdate,
    PayrollCalculate,
    PayrollWithEmployee,
)
from app.crud import payroll as crud_payroll
from app.models.employee import Employee
from decimal import Decimal

router = APIRouter()


@router.post("/", response_model=Payroll, status_code=201)
def create_payroll(
    payroll: PayrollCreate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """새 급여 등록"""
    employee = (
        db.query(Employee)
        .filter(Employee.id == payroll.employee_id, Employee.store_id == store_id)
        .first()
    )
    if not employee:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    return crud_payroll.create_payroll(db=db, store_id=store_id, payroll=payroll)


@router.post("/calculate", response_model=Payroll, status_code=201)
def calculate_and_create_payroll(
    payroll_calc: PayrollCalculate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """출퇴근 기록 기반 급여 자동 계산 및 생성"""
    try:
        hourly_wage = (
            Decimal(str(payroll_calc.hourly_wage))
            if payroll_calc.hourly_wage
            else None
        )
        calculated_payroll = crud_payroll.calculate_payroll(
            db=db,
            store_id=store_id,
            employee_id=payroll_calc.employee_id,
            year_month=payroll_calc.year_month,
            hourly_wage=hourly_wage,
        )

        return crud_payroll.create_payroll(
            db=db, store_id=store_id, payroll=calculated_payroll
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"급여 계산 중 오류 발생: {str(e)}"
        )


@router.get("/", response_model=List[Payroll])
def get_payrolls(
    employee_id: Optional[int] = Query(None, description="직원 ID로 필터링"),
    year_month: Optional[str] = Query(
        None, pattern=r"^\d{4}-\d{2}$", description="년월 (YYYY-MM 형식)"
    ),
    skip: int = Query(0, ge=0, description="건너뛸 레코드 수"),
    limit: int = Query(100, ge=1, le=1000, description="가져올 레코드 수"),
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """급여 목록 조회"""
    if employee_id:
        payrolls = crud_payroll.get_payrolls_by_employee(
            db=db,
            store_id=store_id,
            employee_id=employee_id,
            skip=skip,
            limit=limit,
        )
    elif year_month:
        payrolls = crud_payroll.get_payrolls_by_month(
            db=db, store_id=store_id, year_month=year_month
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="employee_id 또는 year_month 중 하나를 제공해야 합니다",
        )

    return payrolls


@router.get("/month/{year_month}", response_model=List[PayrollWithEmployee])
def get_payrolls_by_month_with_employee(
    year_month: str,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """특정 년월의 모든 급여 조회 (직원 정보 포함)"""
    payrolls = crud_payroll.get_payrolls_by_month(
        db=db, store_id=store_id, year_month=year_month
    )

    result = []
    for payroll in payrolls:
        employee = (
            db.query(Employee)
            .filter(
                Employee.id == payroll.employee_id,
                Employee.store_id == store_id,
            )
            .first()
        )
        if employee:
            result.append(
                PayrollWithEmployee(
                    id=payroll.id,
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
                    created_at=payroll.created_at,
                    updated_at=payroll.updated_at,
                    employee_name=employee.name,
                    employee_position=employee.employee_position.value,
                )
            )

    return result


@router.get("/{payroll_id}", response_model=Payroll)
def get_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """급여 상세 조회"""
    db_payroll = crud_payroll.get_payroll(
        db=db, payroll_id=payroll_id, store_id=store_id
    )
    if db_payroll is None:
        raise HTTPException(status_code=404, detail="급여를 찾을 수 없습니다")
    return db_payroll


@router.put("/{payroll_id}", response_model=Payroll)
def update_payroll(
    payroll_id: int,
    payroll_update: PayrollUpdate,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """급여 수정"""
    db_payroll = crud_payroll.update_payroll(
        db=db,
        store_id=store_id,
        payroll_id=payroll_id,
        payroll_update=payroll_update,
    )
    if db_payroll is None:
        raise HTTPException(status_code=404, detail="급여를 찾을 수 없습니다")
    return db_payroll


@router.delete("/{payroll_id}", status_code=204)
def delete_payroll(
    payroll_id: int,
    db: Session = Depends(get_db),
    store_id: int = Depends(get_store_id),
):
    """급여 삭제"""
    success = crud_payroll.delete_payroll(
        db=db, store_id=store_id, payroll_id=payroll_id
    )
    if not success:
        raise HTTPException(status_code=404, detail="급여를 찾을 수 없습니다")
    return None
